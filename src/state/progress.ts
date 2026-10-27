/**
 * Player progression: per-category practice statistics, XP and levels,
 * streaks, achievements and adaptive difficulty. Everything here is a pure
 * function of (profile, attempt) so it can be unit-tested and persisted as
 * plain JSON. These are practice statistics, not an intelligence measure.
 */
import type { Category, Difficulty, PuzzleRef } from '../engine/types';
import { CATEGORIES } from '../engine/types';

export type Outcome = 'correct' | 'incorrect' | 'revealed' | 'skipped';

export interface AttemptRecord {
  ref: PuzzleRef;
  category: Category;
  family: string;
  title: string;
  difficulty: Difficulty;
  outcome: Outcome;
  /** 0..1, partial credit for multi-part answers. */
  score: number;
  hintsUsed: number;
  timeMs: number;
  selfAssessed?: boolean;
  /** Replays of saved/previous puzzles are stored separately from first attempts. */
  replay: boolean;
  /** Observation practice mode (re-viewing allowed) is tracked separately too. */
  practice?: boolean;
  mode: 'endless' | 'daily' | 'saved' | 'history';
}

export interface Tally {
  attempts: number;
  correct: number;
}

export interface CategoryStats {
  attempts: number;
  correct: number;
  partialScore: number;
  hintsUsed: number;
  reveals: number;
  skips: number;
  answeredTimeMs: number;
  answered: number;
  fastestCorrectMs: number | null;
  byDifficulty: Record<Difficulty, Tally>;
  families: Record<string, Tally>;
  recent: number[];
  currentStreak: number;
  bestStreak: number;
  maxSolved: 0 | Difficulty;
  selfAssessed: number;
  replay: Tally;
  practice: Tally;
  /** adaptive difficulty state */
  level: Difficulty;
  window: number[];
}

export interface Profile {
  version: 1;
  createdAt: number;
  xp: number;
  categories: Record<Category, CategoryStats>;
  streak: { current: number; best: number };
  achievements: Record<string, number>;
  totalSolved: number;
  noHintLogic: number;
  daily: { lastDate: string | null; streak: number; best: number; completed: number };
  mysteriesSolved: number;
  mysteriesPerfect: number;
  saved: number;
}

const RECENT_LIMIT = 20;
const WINDOW = 6;

function emptyTally(): Tally {
  return { attempts: 0, correct: 0 };
}

export function emptyStats(level: Difficulty = 1): CategoryStats {
  return {
    attempts: 0,
    correct: 0,
    partialScore: 0,
    hintsUsed: 0,
    reveals: 0,
    skips: 0,
    answeredTimeMs: 0,
    answered: 0,
    fastestCorrectMs: null,
    byDifficulty: { 1: emptyTally(), 2: emptyTally(), 3: emptyTally(), 4: emptyTally() },
    families: {},
    recent: [],
    currentStreak: 0,
    bestStreak: 0,
    maxSolved: 0,
    selfAssessed: 0,
    replay: emptyTally(),
    practice: emptyTally(),
    level,
    window: [],
  };
}

export function emptyProfile(now = Date.now()): Profile {
  const categories = {} as Record<Category, CategoryStats>;
  for (const c of CATEGORIES) categories[c] = emptyStats();
  return {
    version: 1,
    createdAt: now,
    xp: 0,
    categories,
    streak: { current: 0, best: 0 },
    achievements: {},
    totalSolved: 0,
    noHintLogic: 0,
    daily: { lastDate: null, streak: 0, best: 0, completed: 0 },
    mysteriesSolved: 0,
    mysteriesPerfect: 0,
    saved: 0,
  };
}

/** Repairs a profile loaded from storage (missing fields, old shapes). */
export function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const base = emptyProfile();
  const r = raw as Partial<Profile>;
  const out: Profile = { ...base, ...r, version: 1, categories: { ...base.categories } };
  for (const c of CATEGORIES) {
    const s = (r.categories as Record<string, Partial<CategoryStats>> | undefined)?.[c];
    if (s && typeof s === 'object') {
      out.categories[c] = { ...emptyStats(), ...s, byDifficulty: { ...emptyStats().byDifficulty, ...(s.byDifficulty ?? {}) } } as CategoryStats;
      const cs = out.categories[c];
      cs.recent = Array.isArray(cs.recent) ? cs.recent.filter((x) => typeof x === 'number').slice(-RECENT_LIMIT) : [];
      cs.window = Array.isArray(cs.window) ? cs.window.filter((x) => typeof x === 'number').slice(-WINDOW) : [];
      if (![1, 2, 3, 4].includes(cs.level)) cs.level = 1;
      if (!cs.families || typeof cs.families !== 'object' || Array.isArray(cs.families)) cs.families = {};
    }
  }
  if (typeof out.xp !== 'number' || !Number.isFinite(out.xp)) out.xp = 0;
  out.streak = { ...base.streak, ...(r.streak ?? {}) };
  out.daily = { ...base.daily, ...(r.daily ?? {}) };
  out.achievements = { ...(r.achievements ?? {}) };
  return out;
}

export const BASE_XP: Record<Difficulty, number> = { 1: 10, 2: 20, 3: 35, 4: 55 };

export function xpFor(rec: AttemptRecord): number {
  if (rec.outcome === 'skipped' || rec.outcome === 'revealed') return 0;
  const base = BASE_XP[rec.difficulty];
  let xp = rec.outcome === 'correct' ? base * Math.max(0.4, 1 - 0.2 * rec.hintsUsed) : base * 0.5 * rec.score * Math.max(0.4, 1 - 0.2 * rec.hintsUsed);
  if (rec.replay) xp *= 0.25;
  if (rec.mode === 'daily') xp *= 1.5;
  if (rec.practice) xp *= 0.5;
  return Math.round(xp);
}

export function levelFor(xp: number): { level: number; into: number; needed: number } {
  // Level n starts at 50·(n−1)² XP.
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, into: xp - start, needed: next - start };
}

/** Score used by adaptive difficulty: success that needed fewer hints counts more. */
export function adaptiveScore(rec: AttemptRecord): number {
  if (rec.outcome === 'correct') return rec.hintsUsed === 0 ? 1 : rec.hintsUsed === 1 ? 0.75 : 0.5;
  if (rec.outcome === 'incorrect') return rec.score * 0.5;
  return 0;
}

export interface AdaptiveChange {
  from: Difficulty;
  to: Difficulty;
}

/** Updates a category's adaptive level. Promote after strong recent play, demote after a struggle. */
export function updateAdaptive(stats: CategoryStats, rec: AttemptRecord): AdaptiveChange | null {
  if (rec.outcome === 'skipped' || rec.replay || rec.practice) return null;
  if (rec.difficulty !== stats.level) return null;
  stats.window = [...stats.window, adaptiveScore(rec)].slice(-WINDOW);
  if (stats.window.length < 4) return null;
  const avg = stats.window.reduce((a, b) => a + b, 0) / stats.window.length;
  const from = stats.level;
  if (avg >= 0.78 && stats.window.length >= 5 && stats.level < 4) {
    stats.level = (stats.level + 1) as Difficulty;
    stats.window = [];
    return { from, to: stats.level };
  }
  if (avg <= 0.3 && stats.level > 1) {
    stats.level = (stats.level - 1) as Difficulty;
    stats.window = [];
    return { from, to: stats.level };
  }
  return null;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  test(p: Profile, last?: AttemptRecord): boolean;
}

const solvedIn = (p: Profile, c: Category) => p.categories[c].correct;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-solve', name: 'First Lock Picked', description: 'Solve your first puzzle.', test: (p) => p.totalSolved >= 1 },
  { id: 'ten', name: 'Warming Up', description: 'Solve 10 puzzles.', test: (p) => p.totalSolved >= 10 },
  { id: 'fifty', name: 'Vault Regular', description: 'Solve 50 puzzles.', test: (p) => p.totalSolved >= 50 },
  { id: 'two-hundred', name: 'Keyholder', description: 'Solve 200 puzzles.', test: (p) => p.totalSolved >= 200 },
  { id: 'streak-5', name: 'On a Roll', description: 'Solve 5 puzzles in a row.', test: (p) => p.streak.best >= 5 },
  { id: 'streak-15', name: 'Unbroken', description: 'Solve 15 puzzles in a row.', test: (p) => p.streak.best >= 15 },
  { id: 'clean-mastermind', name: 'Mastermind', description: 'Solve a Mastermind puzzle without hints.', test: (_p, r) => !!r && r.outcome === 'correct' && r.difficulty === 4 && r.hintsUsed === 0 && !r.replay },
  { id: 'explorer', name: 'Explorer', description: 'Solve a puzzle in every endless category.', test: (p) => CATEGORIES.every((c) => solvedIn(p, c) > 0) },
  { id: 'polymath', name: 'Polymath', description: 'Reach Investigator level in four categories.', test: (p) => CATEGORIES.filter((c) => p.categories[c].maxSolved >= 3).length >= 4 },
  { id: 'logician', name: 'Logician', description: 'Solve 10 logic puzzles without hints.', test: (p) => p.noHintLogic >= 10 },
  { id: 'memory-ace', name: 'Photographic', description: 'Solve a Mastermind observation puzzle.', test: (_p, r) => !!r && r.category === 'observation' && r.difficulty === 4 && r.outcome === 'correct' },
  { id: 'daily-1', name: 'Daily Visitor', description: 'Complete a daily challenge.', test: (p) => p.daily.completed >= 1 },
  { id: 'daily-3', name: 'Habit Forming', description: 'Complete daily challenges 3 days in a row.', test: (p) => p.daily.best >= 3 },
  { id: 'daily-7', name: 'Week of Wits', description: 'Complete daily challenges 7 days in a row.', test: (p) => p.daily.best >= 7 },
  { id: 'detective', name: 'Detective', description: 'Solve a murder mystery.', test: (p) => p.mysteriesSolved >= 1 },
  { id: 'chief-inspector', name: 'Chief Inspector', description: 'Solve every murder mystery.', test: (p) => p.mysteriesSolved >= 6 },
  { id: 'sharp-eye', name: 'Sharp Eye', description: 'Solve a mystery on your first accusation with method and key evidence right.', test: (p) => p.mysteriesPerfect >= 1 },
  { id: 'curator', name: 'Curator', description: 'Save 5 puzzles to replay later.', test: (p) => p.saved >= 5 },
];

export interface RecordResult {
  profile: Profile;
  xp: number;
  levelUp: boolean;
  unlocked: AchievementDef[];
  adaptive: AdaptiveChange | null;
}

/** Applies one attempt. Returns a new profile object (input is not mutated). */
export function recordAttempt(prev: Profile, rec: AttemptRecord): RecordResult {
  const p: Profile = structuredCloneSafe(prev);
  const s = p.categories[rec.category];
  const xp = xpFor(rec);
  const beforeLevel = levelFor(p.xp).level;
  p.xp += xp;
  let adaptive: AdaptiveChange | null = null;
  if (rec.outcome === 'skipped') {
    s.skips++;
  } else if (rec.replay) {
    s.replay.attempts++;
    if (rec.outcome === 'correct') s.replay.correct++;
  } else if (rec.practice) {
    s.practice.attempts++;
    if (rec.outcome === 'correct') s.practice.correct++;
  } else {
    s.attempts++;
    s.hintsUsed += rec.hintsUsed;
    s.byDifficulty[rec.difficulty].attempts++;
    const fam = (s.families[rec.family] ??= emptyTally());
    fam.attempts++;
    if (rec.selfAssessed) s.selfAssessed++;
    if (rec.outcome === 'revealed') s.reveals++;
    else {
      s.answered++;
      s.answeredTimeMs += rec.timeMs;
    }
    const ok = rec.outcome === 'correct';
    s.recent = [...s.recent, ok ? 1 : rec.outcome === 'incorrect' ? rec.score * 0.5 : 0].slice(-RECENT_LIMIT);
    if (ok) {
      s.correct++;
      s.partialScore += 1;
      s.byDifficulty[rec.difficulty].correct++;
      fam.correct++;
      s.currentStreak++;
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      p.streak.current++;
      p.streak.best = Math.max(p.streak.best, p.streak.current);
      p.totalSolved++;
      if (rec.difficulty > s.maxSolved) s.maxSolved = rec.difficulty;
      if (s.fastestCorrectMs === null || rec.timeMs < s.fastestCorrectMs) s.fastestCorrectMs = rec.timeMs;
      if (rec.category === 'logic' && rec.hintsUsed === 0) p.noHintLogic++;
    } else {
      s.partialScore += rec.score;
      s.currentStreak = 0;
      p.streak.current = 0;
    }
    adaptive = updateAdaptive(s, rec);
  }
  const unlocked = checkAchievements(p, rec);
  return { profile: p, xp, levelUp: levelFor(p.xp).level > beforeLevel, unlocked, adaptive };
}

export function checkAchievements(p: Profile, last?: AttemptRecord): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (a.test(p, last)) {
      p.achievements[a.id] = Date.now();
      out.push(a);
    }
  }
  return out;
}

export function accuracy(t: { attempts: number; correct: number }): number | null {
  return t.attempts ? t.correct / t.attempts : null;
}

function structuredCloneSafe<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Daily-challenge streak bookkeeping (dates are YYYY-MM-DD in local time). */
export function recordDailyCompletion(prev: Profile, date: string): { profile: Profile; unlocked: AchievementDef[] } {
  const p = structuredCloneSafe(prev);
  if (p.daily.lastDate === date) return { profile: p, unlocked: [] };
  const yesterday = shiftDate(date, -1);
  p.daily.streak = p.daily.lastDate === yesterday ? p.daily.streak + 1 : 1;
  p.daily.best = Math.max(p.daily.best, p.daily.streak);
  p.daily.lastDate = date;
  p.daily.completed++;
  return { profile: p, unlocked: checkAchievements(p) };
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
