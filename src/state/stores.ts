/**
 * Persisted collections. Every list is bounded so storage use stays small no
 * matter how long someone plays. Puzzles are stored as references
 * (generator, version, difficulty, seed), never as full puzzle data.
 */
import type { Category, Difficulty, PuzzleRef } from '../engine/types';
import { CATEGORIES } from '../engine/types';
import type { HistoryEntry } from '../engine/diversity';
import { HISTORY_LIMITS } from '../engine/diversity';
import type { Outcome } from './progress';
import { isObject } from './storage';

export const LIMITS = {
  recentPuzzles: 100,
  sessions: 30,
  saved: 100,
  dailyDays: 60,
  structural: HISTORY_LIMITS.total,
};

/* ---------------- settings ---------------- */

export interface Settings {
  reducedMotion: 'system' | 'on' | 'off';
  textSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  /** Multiplies memorisation time in observation puzzles. */
  exposureMultiplier: number;
  /** Allow re-viewing the memorised scene (results recorded as practice). */
  observationPractice: boolean;
  confirmReveal: boolean;
  defaultHints: boolean;
  defaultTimed: boolean;
  timerSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  reducedMotion: 'system',
  textSize: 'normal',
  highContrast: false,
  exposureMultiplier: 1,
  observationPractice: false,
  confirmReveal: true,
  defaultHints: true,
  defaultTimed: false,
  timerSeconds: 120,
};

export function sanitizeSettings(raw: unknown): Settings | null {
  if (!isObject(raw)) return null;
  const s = { ...DEFAULT_SETTINGS, ...raw } as Settings;
  if (!['system', 'on', 'off'].includes(s.reducedMotion)) s.reducedMotion = 'system';
  if (!['normal', 'large', 'xlarge'].includes(s.textSize)) s.textSize = 'normal';
  s.exposureMultiplier = Math.min(3, Math.max(0.5, Number(s.exposureMultiplier) || 1));
  s.timerSeconds = Math.min(600, Math.max(20, Number(s.timerSeconds) || 120));
  s.highContrast = !!s.highContrast;
  s.observationPractice = !!s.observationPractice;
  s.confirmReveal = s.confirmReveal !== false;
  s.defaultHints = s.defaultHints !== false;
  s.defaultTimed = !!s.defaultTimed;
  return s;
}

/* ---------------- recent puzzles (for the history screen) ---------------- */

export interface RecentPuzzle {
  ref: PuzzleRef;
  title: string;
  family: string;
  category: Category;
  outcome: Outcome;
  hintsUsed: number;
  timeMs: number;
  at: number;
  replay: boolean;
}

export function pushBounded<T>(list: readonly T[], item: T, limit: number): T[] {
  const next = [...list, item];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function isRef(x: unknown): x is PuzzleRef {
  return isObject(x) && typeof x.generator === 'string' && typeof x.seed === 'string' && typeof x.version === 'number' && [1, 2, 3, 4].includes(x.difficulty as number);
}

export function sanitizeRecent(raw: unknown): RecentPuzzle[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x) => isObject(x) && isRef(x.ref) && CATEGORIES.includes(x.category as Category)).slice(-LIMITS.recentPuzzles) as RecentPuzzle[];
}

export function sanitizeHistory(raw: unknown): HistoryEntry[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((e) => isObject(e) && typeof e.k === 'string' && typeof e.s === 'string' && CATEGORIES.includes(e.c as Category))
    .map((e) => ({ ...(e as unknown as HistoryEntry), f: Array.isArray((e as HistoryEntry).f) ? (e as HistoryEntry).f.slice(0, HISTORY_LIMITS.featuresPerEntry) : [] }))
    .slice(-LIMITS.structural);
}

/* ---------------- saved puzzles ---------------- */

export interface SavedPuzzle {
  ref: PuzzleRef;
  title: string;
  family: string;
  category: Category;
  savedAt: number;
}

export function sanitizeSaved(raw: unknown): SavedPuzzle[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x) => isObject(x) && isRef(x.ref)).slice(-LIMITS.saved) as SavedPuzzle[];
}

export function refKey(r: PuzzleRef): string {
  return `${r.generator}~${r.version}~${r.difficulty}~${r.seed}`;
}

/* ---------------- sessions ---------------- */

export interface SessionSummary {
  id: string;
  mode: 'endless' | 'daily' | 'saved';
  startedAt: number;
  endedAt: number;
  categories: Category[];
  difficulty: Difficulty | 'adaptive';
  timed: boolean;
  hints: boolean;
  counts: Record<Outcome, number>;
  xp: number;
}

export function sanitizeSessions(raw: unknown): SessionSummary[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x) => isObject(x) && typeof x.id === 'string' && isObject(x.counts)).slice(-LIMITS.sessions) as SessionSummary[];
}

/* ---------------- daily challenge ---------------- */

export interface DailyRecord {
  date: string;
  /** index → outcome for each of the day's puzzles */
  results: (Outcome | null)[];
  completed: boolean;
  xp: number;
}

export function sanitizeDaily(raw: unknown): DailyRecord[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x) => isObject(x) && typeof x.date === 'string' && Array.isArray(x.results)).slice(-LIMITS.dailyDays) as DailyRecord[];
}

/* ---------------- murder mysteries ---------------- */

export interface Accusation {
  culprit: string;
  method: string | null;
  evidence: string | null;
  correct: boolean;
  methodCorrect: boolean;
  evidenceCorrect: boolean;
  at: number;
}

export interface CaseProgress {
  inspected: string[];
  interviewed: string[];
  contradictions: string[];
  notes: Record<string, string>;
  board: string[];
  timelinePlaced: Record<string, string>;
  accusations: Accusation[];
  solved: boolean;
  revealed: boolean;
  /** first attempt result is kept separately from replays */
  firstResult: 'correct' | 'incorrect' | 'revealed' | null;
  replays: number;
  replayCorrect: number;
  /** true while re-investigating a case that was already solved or revealed */
  replaying: boolean;
}

export function emptyCaseProgress(): CaseProgress {
  return {
    inspected: [],
    interviewed: [],
    contradictions: [],
    notes: {},
    board: [],
    timelinePlaced: {},
    accusations: [],
    solved: false,
    revealed: false,
    firstResult: null,
    replays: 0,
    replayCorrect: 0,
    replaying: false,
  };
}

export function sanitizeCases(raw: unknown): Record<string, CaseProgress> | null {
  if (!isObject(raw)) return null;
  const out: Record<string, CaseProgress> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isObject(v)) continue;
    const base = emptyCaseProgress();
    out[k] = {
      ...base,
      ...(v as Partial<CaseProgress>),
      accusations: Array.isArray(v.accusations) ? (v.accusations as Accusation[]).slice(-20) : [],
      notes: isObject(v.notes) ? (v.notes as Record<string, string>) : {},
      timelinePlaced: isObject(v.timelinePlaced) ? (v.timelinePlaced as Record<string, string>) : {},
    };
  }
  return out;
}
