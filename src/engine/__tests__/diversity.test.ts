import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../registry';
import type { HistoryEntry } from '../diversity';
import { HISTORY_LIMITS, historyEntryFor, noveltyPenalty, pickCategory, pushHistory } from '../diversity';
import { createRng } from '../rng';
import type { Category, Difficulty } from '../types';
import { CATEGORIES } from '../types';

function session(opts: { category?: Category; categories?: Category[]; difficulty: Difficulty; n: number; seed: string }) {
  const rng = createRng(opts.seed);
  let recent: HistoryEntry[] = [];
  const out = [];
  for (let i = 0; i < opts.n; i++) {
    const rep = generatePuzzle({ difficulty: opts.difficulty, category: opts.category, categories: opts.categories, recent, rng });
    out.push(rep);
    recent = pushHistory(recent, historyEntryFor(rep.puzzle, i));
  }
  return { reports: out, recent };
}

describe('bounded history', () => {
  it('never exceeds per-category and total limits', () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 1000; i++) {
      const c = CATEGORIES[i % CATEGORIES.length];
      list = pushHistory(list, { k: `k${i}`, s: `s${i % 5}`, g: `${c}.x`, c, d: 1, v: 1, seed: `${i}`, f: [], t: i });
    }
    expect(list.length).toBeLessThanOrEqual(HISTORY_LIMITS.total);
    for (const c of CATEGORIES) expect(list.filter((e) => e.c === c).length).toBeLessThanOrEqual(HISTORY_LIMITS.perCategory);
    // newest entries are kept
    expect(list[list.length - 1].k).toBe('k999');
  });
});

describe('novelty scoring', () => {
  it('penalises exact repeats far more than structural ones', () => {
    const e: HistoryEntry = { k: 'abc', s: 'struct', g: 'visual.matrix', c: 'visual', d: 2, v: 1, seed: 's', f: ['rule:x'], t: 0 };
    const exact = noveltyPenalty({ key: 'abc', structure: 'struct', features: ['rule:x'] }, 'visual.matrix', 'visual', [e]);
    const structural = noveltyPenalty({ key: 'zzz', structure: 'struct', features: ['rule:x'] }, 'visual.matrix', 'visual', [e]);
    const fresh = noveltyPenalty({ key: 'zzz', structure: 'other', features: ['rule:y'] }, 'visual.matrix', 'visual', [e]);
    expect(exact).toBeGreaterThan(structural);
    expect(structural).toBeGreaterThan(fresh);
    expect(fresh).toBe(0);
  });
});

describe('mixed sessions', () => {
  it('never repeats the same category twice in a row when several are allowed', () => {
    const rng = createRng('cats');
    let recent: HistoryEntry[] = [];
    let last: Category | null = null;
    for (let i = 0; i < 200; i++) {
      const c = pickCategory(CATEGORIES, recent, rng);
      expect(c).not.toBe(last);
      last = c;
      recent = pushHistory(recent, { k: `${i}`, s: 's', g: 'g', c, d: 1, v: 1, seed: '', f: [], t: i });
    }
  });

  it('a long mixed session has no exact duplicates and covers every category', () => {
    const { reports } = session({ categories: [...CATEGORIES], difficulty: 2, n: 70, seed: 'mixed' });
    const keys = reports.map((r) => r.puzzle.fingerprint.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(reports.map((r) => r.puzzle.category)).size).toBe(CATEGORIES.length);
    for (let i = 1; i < reports.length; i++) expect(reports[i].puzzle.category).not.toBe(reports[i - 1].puzzle.category);
  });
});

describe('focused sessions avoid structural repetition', () => {
  for (const category of CATEGORIES) {
    it(`${category}: varied generators and structures`, () => {
      const { reports } = session({ category, difficulty: 3, n: 24, seed: `focus-${category}` });
      const structures = reports.map((r) => `${r.puzzle.generator}|${r.puzzle.fingerprint.structure}`);
      let immediateRepeats = 0;
      for (let i = 1; i < structures.length; i++) if (structures[i] === structures[i - 1]) immediateRepeats++;
      expect(immediateRepeats).toBeLessThanOrEqual(2);
      const keys = reports.map((r) => r.puzzle.fingerprint.key);
      expect(new Set(keys).size).toBe(keys.length);
      // many distinct structures (generator + rule/mechanism combination) in a short session
      expect(new Set(structures).size).toBeGreaterThanOrEqual(10);
    });
  }
});

describe('generation performance', () => {
  it('generates within the time budget for every category and difficulty', () => {
    for (const category of CATEGORIES)
      for (const d of [1, 4] as Difficulty[]) {
        const start = performance.now();
        const rep = generatePuzzle({ category, difficulty: d, rng: createRng(`perf-${category}-${d}`) });
        const ms = performance.now() - start;
        expect(rep.puzzle.category).toBe(category);
        expect(ms).toBeLessThan(4500);
      }
  });

  it('difficulty changes structure: higher tiers use more rules or steps on average', () => {
    for (const category of CATEGORIES) {
      const avg = (d: Difficulty) => {
        const { reports } = session({ category, difficulty: d, n: 12, seed: `diff-${category}-${d}` });
        return reports.reduce((s, r) => s + r.puzzle.metrics.rules + r.puzzle.metrics.steps, 0) / reports.length;
      };
      expect(avg(4)).toBeGreaterThan(avg(1));
    }
  });
});
