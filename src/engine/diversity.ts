/**
 * Anti-repetition: compact structural history plus selection weights that
 * favour under-used generators, structures and rule families.
 */
import type { GeneratorDef } from './generator';
import type { Rng } from './rng';
import type { Category, Difficulty, Fingerprint, Puzzle } from './types';

export interface HistoryEntry {
  /** Exact fingerprint key. */
  k: string;
  /** Structural class. */
  s: string;
  /** Generator id. */
  g: string;
  c: Category;
  d: Difficulty;
  v: number;
  seed: string;
  /** Feature tokens (rule families, mechanisms), capped in length. */
  f: string[];
  t: number;
}

/** Bounded history sizes. Change here to tune memory/storage use. */
export const HISTORY_LIMITS = {
  perCategory: 40,
  total: 220,
  featuresPerEntry: 8,
  /** Entries considered when penalising repeated structures. */
  structureWindow: 20,
  /** Entries considered when penalising over-used feature tokens. */
  featureWindow: 12,
};

export function historyEntryFor(p: Puzzle, now = Date.now()): HistoryEntry {
  return {
    k: p.fingerprint.key,
    s: p.fingerprint.structure,
    g: p.generator,
    c: p.category,
    d: p.difficulty,
    v: p.version,
    seed: p.seed,
    f: p.fingerprint.features.slice(0, HISTORY_LIMITS.featuresPerEntry),
    t: now,
  };
}

/** Appends and trims so that no category exceeds its cap and the total stays bounded. */
export function pushHistory(list: readonly HistoryEntry[], entry: HistoryEntry, limits = HISTORY_LIMITS): HistoryEntry[] {
  const next = [...list, entry];
  const perCat = new Map<Category, number>();
  const keep: HistoryEntry[] = [];
  for (let i = next.length - 1; i >= 0; i--) {
    const e = next[i];
    const n = perCat.get(e.c) ?? 0;
    if (n >= limits.perCategory) continue;
    if (keep.length >= limits.total) break;
    perCat.set(e.c, n + 1);
    keep.push(e);
  }
  return keep.reverse();
}

/** Higher = more repetitive. History is ordered oldest → newest. */
export function noveltyPenalty(fp: Fingerprint, generator: string, category: Category, recent: readonly HistoryEntry[]): number {
  let pen = 0;
  if (recent.some((e) => e.k === fp.key)) pen += 100;
  const sameCat = recent.filter((e) => e.c === category);
  const lastFew = sameCat.slice(-4);
  if (lastFew.some((e) => e.s === fp.structure)) pen += 10;
  const window = sameCat.slice(-HISTORY_LIMITS.structureWindow);
  pen += 1.5 * window.filter((e) => e.s === fp.structure).length;
  const sameGen = recent.filter((e) => e.g === generator).slice(-HISTORY_LIMITS.featureWindow);
  for (const f of fp.features) pen += 0.6 * sameGen.filter((e) => e.f.includes(f)).length;
  return pen;
}

/** Picks one candidate, strongly preferring the least repetitive. */
export function chooseCandidate<T extends { fingerprint: Fingerprint; generator: string; category: Category }>(
  candidates: readonly T[],
  recent: readonly HistoryEntry[],
  rng: Rng,
): { chosen: T; penalty: number } {
  const pens = candidates.map((c) => noveltyPenalty(c.fingerprint, c.generator, c.category, recent));
  const best = Math.min(...pens);
  const weights = pens.map((p) => Math.exp(-(p - best) / 2.5));
  const chosen = rng.weighted(candidates, weights);
  return { chosen, penalty: pens[candidates.indexOf(chosen)] };
}

export function pickGenerator(
  defs: readonly GeneratorDef[],
  category: Category,
  difficulty: Difficulty,
  recent: readonly HistoryEntry[],
  rng: Rng,
  exclude: ReadonlySet<string> = new Set(),
): GeneratorDef | null {
  const eligible = defs.filter((d) => d.category === category && (d.minDifficulty ?? 1) <= difficulty && !exclude.has(d.id));
  if (eligible.length === 0) return null;
  const sameCat = recent.filter((e) => e.c === category);
  const last = sameCat[sameCat.length - 1]?.g;
  const window = sameCat.slice(-8);
  const weights = eligible.map((d) => {
    const used = window.filter((e) => e.g === d.id).length;
    return (d.weight ?? 1) * (1 / (1 + 0.8 * used)) * (d.id === last && eligible.length > 1 ? 0.25 : 1);
  });
  return rng.weighted(eligible, weights);
}

/** Mixed mode: never the same category twice in a row when there is a choice. */
export function pickCategory(categories: readonly Category[], recent: readonly HistoryEntry[], rng: Rng): Category {
  if (categories.length === 1) return categories[0];
  const last = recent[recent.length - 1]?.c;
  const window = recent.slice(-categories.length * 2);
  const weights = categories.map((c) => (c === last ? 0 : 1 / (1 + window.filter((e) => e.c === c).length)));
  return rng.weighted(categories, weights);
}
