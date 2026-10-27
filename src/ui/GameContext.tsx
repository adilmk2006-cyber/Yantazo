/**
 * Global game state with persistence. Each slice is saved to localStorage
 * (via the defensive wrapper) whenever it changes; storage failures are shown
 * as a non-blocking notice and never interrupt play.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HistoryEntry } from '../engine/diversity';
import { historyEntryFor, pushHistory } from '../engine/diversity';
import type { Puzzle, PuzzleRef } from '../engine/types';
import type { AchievementDef, AttemptRecord, Profile, RecordResult } from '../state/progress';
import { checkAchievements, emptyProfile, recordAttempt, recordDailyCompletion, sanitizeProfile } from '../state/progress';
import { clearAll, lastStorageError, load, onQuotaPressure, save, storageIsPersistent } from '../state/storage';
import type { CaseProgress, DailyRecord, RecentPuzzle, SavedPuzzle, SessionSummary, Settings } from '../state/stores';
import {
  DEFAULT_SETTINGS,
  LIMITS,
  emptyCaseProgress,
  pushBounded,
  refKey,
  sanitizeCases,
  sanitizeDaily,
  sanitizeHistory,
  sanitizeRecent,
  sanitizeSaved,
  sanitizeSessions,
  sanitizeSettings,
} from '../state/stores';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'success' | 'info' | 'warning';
}

interface GameState {
  settings: Settings;
  setSettings(s: Partial<Settings>): void;
  profile: Profile;
  history: HistoryEntry[];
  recent: RecentPuzzle[];
  saved: SavedPuzzle[];
  sessions: SessionSummary[];
  daily: DailyRecord[];
  cases: Record<string, CaseProgress>;
  record(rec: AttemptRecord, puzzle: Puzzle | null): RecordResult;
  noteShown(puzzle: Puzzle): void;
  toggleSave(p: Puzzle): boolean;
  isSaved(ref: PuzzleRef): boolean;
  removeSaved(ref: PuzzleRef): void;
  addSession(s: SessionSummary): void;
  setDailyResult(date: string, index: number, outcome: DailyRecord['results'][number], size: number, xp: number): void;
  updateCase(id: string, fn: (c: CaseProgress) => CaseProgress): void;
  mysterySolved(perfect: boolean, firstTime: boolean): void;
  resetHistory(): void;
  resetAll(): void;
  toasts: Toast[];
  pushToast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  storageWarning: string | null;
  persistent: boolean;
}

const Ctx = createContext<GameState | null>(null);

export function useGame(): GameState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame outside GameProvider');
  return v;
}

function usePersisted<T>(key: string, fallback: T, sanitize: (raw: unknown) => T | null, onFail: () => void) {
  const [value, setValue] = useState<T>(() => load(key, fallback, sanitize));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!save(key, value)) onFail();
  }, [key, value, onFail]);
  return [value, setValue] as const;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const onFail = useCallback(() => setStorageWarning(lastStorageError() ?? 'Saving failed; progress is kept for this session only.'), []);
  const [settings, setSettingsState] = usePersisted<Settings>('settings', DEFAULT_SETTINGS, sanitizeSettings, onFail);
  const [profile, setProfile] = usePersisted<Profile>('profile', emptyProfile(), sanitizeProfile, onFail);
  const [history, setHistory] = usePersisted<HistoryEntry[]>('history', [], sanitizeHistory, onFail);
  const [recent, setRecent] = usePersisted<RecentPuzzle[]>('recent', [], sanitizeRecent, onFail);
  const [saved, setSaved] = usePersisted<SavedPuzzle[]>('saved', [], sanitizeSaved, onFail);
  const [sessions, setSessions] = usePersisted<SessionSummary[]>('sessions', [], sanitizeSessions, onFail);
  const [daily, setDaily] = usePersisted<DailyRecord[]>('daily', [], sanitizeDaily, onFail);
  const [cases, setCases] = usePersisted<Record<string, CaseProgress>>('cases', {}, sanitizeCases, onFail);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  // Under quota pressure, trim the largest optional collections first.
  useEffect(() => {
    onQuotaPressure(() => {
      setRecent((r) => r.slice(-30));
      setSessions((s) => s.slice(-10));
      setHistory((h) => h.slice(-80));
    });
  }, [setRecent, setSessions, setHistory]);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastId.current++;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const announce = useCallback(
    (unlocked: AchievementDef[]) => {
      for (const a of unlocked) pushToast({ title: `Achievement unlocked: ${a.name}`, body: a.description, tone: 'success' });
    },
    [pushToast],
  );

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const record = useCallback(
    (rec: AttemptRecord, puzzle: Puzzle | null): RecordResult => {
      const res = recordAttempt(profileRef.current, rec);
      profileRef.current = res.profile;
      setProfile(res.profile);
      announce(res.unlocked);
      if (res.levelUp) pushToast({ title: 'Level up!', body: 'Your practice level increased.', tone: 'success' });
      if (res.adaptive) {
        const up = res.adaptive.to > res.adaptive.from;
        pushToast({ title: up ? 'Difficulty increased' : 'Difficulty eased', body: `Adaptive ${rec.category} difficulty is now tier ${res.adaptive.to}.`, tone: 'info' });
      }
      if (rec.outcome !== 'skipped' || puzzle) {
        setRecent((r) =>
          pushBounded(
            r,
            { ref: rec.ref, title: rec.title, family: rec.family, category: rec.category, outcome: rec.outcome, hintsUsed: rec.hintsUsed, timeMs: rec.timeMs, at: Date.now(), replay: rec.replay },
            LIMITS.recentPuzzles,
          ),
        );
      }
      return res;
    },
    [announce, pushToast, setProfile, setRecent],
  );

  const noteShown = useCallback((p: Puzzle) => setHistory((h) => pushHistory(h, historyEntryFor(p))), [setHistory]);

  const isSaved = useCallback((ref: PuzzleRef) => saved.some((s) => refKey(s.ref) === refKey(ref)), [saved]);

  const toggleSave = useCallback(
    (p: Puzzle) => {
      const ref = { generator: p.generator, version: p.version, difficulty: p.difficulty, seed: p.seed };
      const exists = saved.some((s) => refKey(s.ref) === refKey(ref));
      if (exists) {
        setSaved((s) => s.filter((x) => refKey(x.ref) !== refKey(ref)));
        return false;
      }
      setSaved((s) => pushBounded(s, { ref, title: p.title, family: p.family, category: p.category, savedAt: Date.now() }, LIMITS.saved));
      const next = { ...profileRef.current, saved: profileRef.current.saved + 1 };
      const unlocked = checkAchievements(next);
      profileRef.current = next;
      setProfile(next);
      announce(unlocked);
      return true;
    },
    [saved, setSaved, setProfile, announce],
  );

  const removeSaved = useCallback((ref: PuzzleRef) => setSaved((s) => s.filter((x) => refKey(x.ref) !== refKey(ref))), [setSaved]);
  const addSession = useCallback((s: SessionSummary) => setSessions((list) => pushBounded(list, s, LIMITS.sessions)), [setSessions]);

  const dailyRef = useRef(daily);
  dailyRef.current = daily;

  const setDailyResult = useCallback(
    (date: string, index: number, outcome: DailyRecord['results'][number], size: number, xp: number) => {
      const list = dailyRef.current;
      const existing = list.find((d) => d.date === date) ?? { date, results: new Array(size).fill(null), completed: false, xp: 0 };
      if (existing.results[index]) return; // only the first result of the day counts
      const results = existing.results.slice();
      results[index] = outcome;
      const completed = results.every((r) => r !== null);
      const next = pushBounded(list.filter((d) => d.date !== date), { ...existing, results, completed, xp: existing.xp + xp }, LIMITS.dailyDays);
      dailyRef.current = next;
      setDaily(next);
      if (completed && !existing.completed) {
        const { profile: p, unlocked } = recordDailyCompletion(profileRef.current, date);
        profileRef.current = p;
        setProfile(p);
        pushToast({ title: 'Daily challenge complete', body: `Daily streak: ${p.daily.streak}`, tone: 'success' });
        announce(unlocked);
      }
    },
    [setDaily, setProfile, pushToast, announce],
  );

  const updateCase = useCallback((id: string, fn: (c: CaseProgress) => CaseProgress) => setCases((all) => ({ ...all, [id]: fn(all[id] ?? emptyCaseProgress()) })), [setCases]);

  const mysterySolved = useCallback(
    (perfect: boolean, firstTime: boolean) => {
      const p = { ...profileRef.current };
      if (firstTime) p.mysteriesSolved = Math.min(99, p.mysteriesSolved + 1);
      if (perfect) p.mysteriesPerfect += 1;
      p.xp += firstTime ? 150 : 30;
      const unlocked = checkAchievements(p);
      profileRef.current = p;
      setProfile(p);
      announce(unlocked);
    },
    [setProfile, announce],
  );

  const setSettings = useCallback((s: Partial<Settings>) => setSettingsState((prev) => ({ ...prev, ...s })), [setSettingsState]);
  const resetHistory = useCallback(() => setHistory([]), [setHistory]);
  const resetAll = useCallback(() => {
    clearAll();
    setSettingsState(DEFAULT_SETTINGS);
    setProfile(emptyProfile());
    setHistory([]);
    setRecent([]);
    setSaved([]);
    setSessions([]);
    setDaily([]);
    setCases({});
  }, [setSettingsState, setProfile, setHistory, setRecent, setSaved, setSessions, setDaily, setCases]);

  const value = useMemo<GameState>(
    () => ({
      settings,
      setSettings,
      profile,
      history,
      recent,
      saved,
      sessions,
      daily,
      cases,
      record,
      noteShown,
      toggleSave,
      isSaved,
      removeSaved,
      addSession,
      setDailyResult,
      updateCase,
      mysterySolved,
      resetHistory,
      resetAll,
      toasts,
      pushToast,
      dismissToast,
      storageWarning: storageWarning ?? (storageIsPersistent() ? null : 'Your browser is blocking local storage, so progress will not be kept after you close this tab.'),
      persistent: storageIsPersistent(),
    }),
    [settings, setSettings, profile, history, recent, saved, sessions, daily, cases, record, noteShown, toggleSave, isSaved, removeSaved, addSession, setDailyResult, updateCase, mysterySolved, resetHistory, resetAll, toasts, pushToast, dismissToast, storageWarning],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
