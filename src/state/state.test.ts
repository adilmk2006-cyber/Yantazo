import { describe, expect, it, beforeEach } from 'vitest';
import type { AttemptRecord, Profile } from './progress';
import { emptyProfile, levelFor, recordAttempt, recordDailyCompletion, sanitizeProfile, shiftDate, xpFor } from './progress';
import type { KeyValueStore } from './storage';
import { PREFIX, clearAll, lastStorageError, load, onQuotaPressure, save, setStorageBackend, usageBytes } from './storage';
import { DEFAULT_SETTINGS, LIMITS, pushBounded, sanitizeCases, sanitizeHistory, sanitizeSettings } from './stores';
import { dailyRefs, DAILY_SIZE } from './daily';
import { regeneratePuzzle, generatePuzzle } from '../engine/registry';
import { HISTORY_LIMITS, historyEntryFor, pushHistory } from '../engine/diversity';
import type { HistoryEntry } from '../engine/diversity';
import { createRng } from '../engine/rng';

function attempt(over: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    ref: { generator: 'logic.truth', version: 1, difficulty: 1, seed: 's' },
    category: 'logic',
    family: 'Truth & lies',
    title: 'Who took the key?',
    difficulty: 1,
    outcome: 'correct',
    score: 1,
    hintsUsed: 0,
    timeMs: 20_000,
    replay: false,
    mode: 'endless',
    ...over,
  };
}

function apply(p: Profile, ...recs: AttemptRecord[]): Profile {
  for (const r of recs) p = recordAttempt(p, r).profile;
  return p;
}

/** In-memory store that can be told to fail like a full or broken localStorage. */
class FlakyStore implements KeyValueStore {
  map = new Map<string, string>();
  failWrites = 0;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites > 0) {
      this.failWrites--;
      throw new Error('QuotaExceededError');
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

describe('XP and levels', () => {
  it('scales with difficulty and is reduced by hints, replays and reveals', () => {
    expect(xpFor(attempt())).toBe(10);
    expect(xpFor(attempt({ difficulty: 4 }))).toBe(55);
    expect(xpFor(attempt({ hintsUsed: 2 }))).toBe(6);
    expect(xpFor(attempt({ replay: true }))).toBeLessThan(xpFor(attempt()));
    expect(xpFor(attempt({ mode: 'daily' }))).toBe(15);
    expect(xpFor(attempt({ outcome: 'revealed' }))).toBe(0);
    expect(xpFor(attempt({ outcome: 'skipped' }))).toBe(0);
  });

  it('uses a quadratic level curve', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(49).level).toBe(1);
    expect(levelFor(50).level).toBe(2);
    expect(levelFor(200).level).toBe(3);
    const l = levelFor(120);
    expect(l.into + (50 * (l.level - 1) ** 2)).toBe(120);
  });
});

describe('recording attempts', () => {
  it('does not mutate the previous profile', () => {
    const p = emptyProfile(0);
    const before = JSON.stringify(p);
    recordAttempt(p, attempt());
    expect(JSON.stringify(p)).toBe(before);
  });

  it('counts first attempts, replays and practice separately', () => {
    const p = apply(emptyProfile(0), attempt(), attempt({ replay: true }), attempt({ replay: true, outcome: 'incorrect', score: 0 }), attempt({ practice: true }));
    const s = p.categories.logic;
    expect(s.attempts).toBe(1);
    expect(s.correct).toBe(1);
    expect(s.replay).toEqual({ attempts: 2, correct: 1 });
    expect(s.practice).toEqual({ attempts: 1, correct: 1 });
    expect(p.totalSolved).toBe(1);
  });

  it('treats a skip as neither right nor wrong', () => {
    let p = apply(emptyProfile(0), attempt(), attempt());
    p = apply(p, attempt({ outcome: 'skipped' }));
    expect(p.categories.logic.attempts).toBe(2);
    expect(p.categories.logic.skips).toBe(1);
    expect(p.streak.current).toBe(2);
  });

  it('counts a reveal as an unsolved attempt that breaks the streak', () => {
    const p = apply(emptyProfile(0), attempt(), attempt({ outcome: 'revealed', score: 0 }));
    expect(p.categories.logic.attempts).toBe(2);
    expect(p.categories.logic.correct).toBe(1);
    expect(p.categories.logic.reveals).toBe(1);
    expect(p.streak.current).toBe(0);
    expect(p.streak.best).toBe(1);
  });

  it('unlocks an achievement exactly once', () => {
    const first = recordAttempt(emptyProfile(0), attempt());
    expect(first.unlocked.map((a) => a.id)).toContain('first-solve');
    const second = recordAttempt(first.profile, attempt());
    expect(second.unlocked.map((a) => a.id)).not.toContain('first-solve');
  });
});

describe('adaptive difficulty', () => {
  it('promotes after a run of clean first-attempt solves', () => {
    let p = emptyProfile(0);
    let promoted = null;
    for (let i = 0; i < 5; i++) {
      const r = recordAttempt(p, attempt());
      p = r.profile;
      promoted = r.adaptive ?? promoted;
    }
    expect(promoted).toEqual({ from: 1, to: 2 });
    expect(p.categories.logic.level).toBe(2);
  });

  it('demotes after repeated failures and ignores replays', () => {
    let p = emptyProfile(0);
    p.categories.logic.level = 3;
    p = apply(p, ...Array.from({ length: 6 }, () => attempt({ difficulty: 3, replay: true, outcome: 'incorrect', score: 0 })));
    expect(p.categories.logic.level).toBe(3);
    p = apply(p, ...Array.from({ length: 4 }, () => attempt({ difficulty: 3, outcome: 'incorrect', score: 0 })));
    expect(p.categories.logic.level).toBe(2);
  });

  it('adapts each category independently', () => {
    let p = emptyProfile(0);
    p = apply(p, ...Array.from({ length: 5 }, () => attempt()));
    expect(p.categories.logic.level).toBe(2);
    expect(p.categories.visual.level).toBe(1);
  });
});

describe('daily streaks', () => {
  it('extends on consecutive days, resets after a gap and ignores repeats', () => {
    let p = emptyProfile(0);
    p = recordDailyCompletion(p, '2026-03-01').profile;
    p = recordDailyCompletion(p, '2026-03-02').profile;
    p = recordDailyCompletion(p, '2026-03-02').profile;
    expect(p.daily.streak).toBe(2);
    expect(p.daily.completed).toBe(2);
    p = recordDailyCompletion(p, '2026-03-05').profile;
    expect(p.daily.streak).toBe(1);
    expect(p.daily.best).toBe(2);
  });

  it('handles month and leap-year boundaries', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('builds the same daily set for the same date, and every puzzle rebuilds', () => {
    const a = dailyRefs('2026-10-27');
    expect(a).toEqual(dailyRefs('2026-10-27'));
    expect(a).toHaveLength(DAILY_SIZE);
    expect(dailyRefs('2026-10-28')).not.toEqual(a);
    for (const ref of a) expect(regeneratePuzzle(ref)).not.toBeNull();
  });
});

describe('sanitising saved data', () => {
  it('rejects garbage and repairs partial profiles', () => {
    expect(sanitizeProfile('nonsense')).toBeNull();
    expect(sanitizeProfile([1, 2])).toBeNull();
    const repaired = sanitizeProfile({ xp: 'lots', categories: { logic: { attempts: 3, recent: 7, window: 'x', level: 9, families: [] } } });
    expect(repaired).not.toBeNull();
    expect(repaired!.xp).toBe(0);
    expect(repaired!.categories.visual.attempts).toBe(0);
    expect(repaired!.categories.logic.attempts).toBe(3);
    expect(repaired!.categories.logic.recent).toEqual([]);
    expect(repaired!.categories.logic.level).toBe(1);
    // A repaired profile can keep being played without errors.
    expect(() => recordAttempt(repaired!, attempt())).not.toThrow();
  });

  it('clamps settings into their allowed ranges', () => {
    const s = sanitizeSettings({ timerSeconds: 99999, exposureMultiplier: -4, textSize: 'huge' })!;
    expect(s.timerSeconds).toBe(600);
    expect(s.exposureMultiplier).toBe(0.5);
    expect(s.textSize).toBe('normal');
    expect(sanitizeSettings(null)).toBeNull();
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps case progress usable when fields are missing or malformed', () => {
    const c = sanitizeCases({ lighthouse: { solved: true, accusations: 'x', notes: 5 }, bad: 3 })!;
    expect(c.lighthouse.solved).toBe(true);
    expect(c.lighthouse.accusations).toEqual([]);
    expect(c.lighthouse.notes).toEqual({});
    expect(c.bad).toBeUndefined();
  });
});

describe('bounded memory', () => {
  it('caps generic lists', () => {
    let list: number[] = [];
    for (let i = 0; i < 500; i++) list = pushBounded(list, i, LIMITS.recentPuzzles);
    expect(list).toHaveLength(LIMITS.recentPuzzles);
    expect(list[list.length - 1]).toBe(499);
  });

  it('keeps the anti-repetition history small however long someone plays', () => {
    let history: HistoryEntry[] = [];
    for (let i = 0; i < 400; i++) {
      const { puzzle } = generatePuzzle({ difficulty: 2, categories: ['visual', 'logic', 'riddle', 'spatial'], recent: history, rng: createRng(`mem-${i}`), maxCandidates: 1 });
      history = pushHistory(history, historyEntryFor(puzzle, i));
    }
    expect(history.length).toBeLessThanOrEqual(HISTORY_LIMITS.total);
    // Stored entries are short references, not puzzles: a full history stays well under 100 KB.
    expect(JSON.stringify(history).length).toBeLessThan(100_000);
    // Loading an oversized history from storage trims it as well.
    expect(sanitizeHistory([...history, ...history, ...history])!.length).toBeLessThanOrEqual(LIMITS.structural);
  });
});

describe('storage wrapper', () => {
  let store: FlakyStore;
  beforeEach(() => {
    store = new FlakyStore();
    setStorageBackend(store);
  });

  it('round-trips values under a namespaced key', () => {
    expect(save('thing', { a: 1 })).toBe(true);
    expect(store.map.has(`${PREFIX}thing`)).toBe(true);
    expect(load('thing', null)).toEqual({ a: 1 });
    expect(usageBytes()).toBeGreaterThan(0);
  });

  it('falls back to defaults on corrupted data instead of crashing', () => {
    store.map.set(`${PREFIX}profile`, '{not json');
    expect(load('profile', 'default')).toBe('default');
    expect(lastStorageError()).toMatch(/profile/);
  });

  it('runs prune hooks and retries when the quota is hit', () => {
    let pruned = 0;
    onQuotaPressure(() => pruned++);
    store.failWrites = 1;
    expect(save('big', [1, 2, 3])).toBe(true);
    expect(pruned).toBeGreaterThan(0);
    expect(load('big', null)).toEqual([1, 2, 3]);
  });

  it('reports a failed write without throwing', () => {
    store.failWrites = 5;
    expect(save('big', [1])).toBe(false);
    expect(lastStorageError()).toMatch(/memory only/);
  });

  it('refuses values that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(save('cyclic', cyclic)).toBe(false);
  });

  it('clears only its own keys', () => {
    store.map.set('someone-else', 'keep');
    save('a', 1);
    save('b', 2);
    clearAll();
    expect([...store.map.keys()]).toEqual(['someone-else']);
  });
});
