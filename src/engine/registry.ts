/**
 * Puzzle generation entry point.
 *
 * generatePuzzle({ difficulty, category | categories | generator, seed?, recent })
 *
 * Puzzles are generated on demand. A handful of validated candidates are
 * built for the chosen generator, the least repetitive one (according to the
 * bounded structural history) is kept, and every other candidate is dropped
 * immediately, so memory use does not grow with the number of puzzles played.
 */
import { GENERATORS } from './generators';
import type { GeneratorDef } from './generator';
import type { HistoryEntry } from './diversity';
import { chooseCandidate, pickCategory, pickGenerator } from './diversity';
import type { Rng } from './rng';
import { createRng, randomSeed, shortHash } from './rng';
import type { Category, Difficulty, Puzzle, PuzzleRef } from './types';
import { CATEGORIES } from './types';
import { RejectCandidate } from './util';
import { validatePuzzle } from './validation';

const BY_ID = new Map(GENERATORS.map((g) => [g.id, g]));

export function getGenerator(id: string): GeneratorDef | undefined {
  return BY_ID.get(id);
}

export function generatorsFor(category: Category): GeneratorDef[] {
  return GENERATORS.filter((g) => g.category === category);
}

export function puzzleId(ref: PuzzleRef): string {
  return `${ref.generator}~${ref.version}~${ref.difficulty}~${ref.seed}`;
}

/** Deterministically builds and validates one puzzle. Throws RejectCandidate when invalid. */
export function buildPuzzle(def: GeneratorDef, seed: string, difficulty: Difficulty): Puzzle {
  const rng = createRng(`${def.id}|${difficulty}|${seed}`);
  const draft = def.generate({ rng, difficulty });
  const { structure, features, detail } = draft.fingerprint;
  const key = shortHash(`${def.id}|${structure}|${features.slice().sort().join(',')}|${detail ?? ''}`);
  const puzzle: Puzzle = {
    ...draft,
    id: puzzleId({ generator: def.id, version: def.version, difficulty, seed }),
    seed,
    generator: def.id,
    version: def.version,
    category: def.category,
    difficulty,
    family: def.family,
    fingerprint: { structure, features, key },
  };
  const problems = validatePuzzle(puzzle, def);
  if (problems.length) throw new RejectCandidate(`${def.id}: ${problems.join('; ')}`);
  return puzzle;
}

/** Rebuilds a saved puzzle. Returns null when the generator changed since it was saved. */
export function regeneratePuzzle(ref: PuzzleRef): Puzzle | null {
  const def = BY_ID.get(ref.generator);
  if (!def || def.version !== ref.version) return null;
  try {
    return buildPuzzle(def, ref.seed, ref.difficulty);
  } catch {
    return null;
  }
}

export interface GenerateOptions {
  difficulty: Difficulty;
  /** Focus on one category. */
  category?: Category;
  /** Mixed mode: choose among these categories. */
  categories?: readonly Category[];
  /** Force a specific generator. */
  generator?: string;
  /** Exact reproduction (requires `generator`). */
  seed?: string;
  /** Bounded structural history, oldest first. */
  recent?: readonly HistoryEntry[];
  /** Randomness for selection (seeded in tests). */
  rng?: Rng;
  /** Valid candidates to compare for diversity. */
  maxCandidates?: number;
  /** Soft time budget once at least one candidate is valid. */
  timeBudgetMs?: number;
}

export interface GenerationReport {
  puzzle: Puzzle;
  attempts: number;
  rejected: number;
  candidates: number;
  penalty: number;
  ms: number;
  rejectReasons: string[];
}

const MAX_ATTEMPTS_PER_GENERATOR = 80;
const HARD_TIME_LIMIT_MS = 4000;

function seedFrom(rng: Rng): string {
  const alphabet = '0123456789abcdefghijkmnpqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[rng.int(0, alphabet.length - 1)];
  return s;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function generatePuzzle(opts: GenerateOptions): GenerationReport {
  const start = now();
  const { difficulty } = opts;
  if (opts.seed) {
    if (!opts.generator) throw new Error('A seed requires a generator id');
    const def = BY_ID.get(opts.generator);
    if (!def) throw new Error(`Unknown generator ${opts.generator}`);
    const puzzle = buildPuzzle(def, opts.seed, difficulty);
    return { puzzle, attempts: 1, rejected: 0, candidates: 1, penalty: 0, ms: now() - start, rejectReasons: [] };
  }
  const sel = opts.rng ?? createRng(randomSeed());
  const recent = opts.recent ?? [];
  const tried = new Set<string>();
  let attempts = 0;
  let rejected = 0;
  const rejectReasons: string[] = [];

  for (let round = 0; round < 6; round++) {
    let def: GeneratorDef | null | undefined;
    if (opts.generator) {
      def = BY_ID.get(opts.generator);
      if (!def) throw new Error(`Unknown generator ${opts.generator}`);
    } else {
      const pool = opts.category ? [opts.category] : opts.categories?.length ? opts.categories : CATEGORIES;
      const category = pickCategory(pool, recent, sel);
      def = pickGenerator(GENERATORS, category, difficulty, recent, sel, tried);
      if (!def) {
        // every generator in that category was exhausted; fall back to any untried one in the pool
        def = GENERATORS.find((g) => pool.includes(g.category) && !tried.has(g.id) && (g.minDifficulty ?? 1) <= difficulty) ?? null;
      }
    }
    if (!def) break;
    tried.add(def.id);

    const target = Math.max(1, opts.maxCandidates ?? def.candidates ?? 6);
    const budget = opts.timeBudgetMs ?? 350;
    const valid: Puzzle[] = [];
    const genStart = now();
    for (let i = 0; i < MAX_ATTEMPTS_PER_GENERATOR && valid.length < target; i++) {
      attempts++;
      try {
        valid.push(buildPuzzle(def, seedFrom(sel), difficulty));
      } catch (e) {
        rejected++;
        if (rejectReasons.length < 20) rejectReasons.push((e as Error).message);
        if (!(e instanceof RejectCandidate)) {
          // Unexpected error: record it and treat as an invalid candidate rather than crashing the session.
          if (rejectReasons.length < 20) rejectReasons.push(`unexpected: ${(e as Error).stack ?? e}`);
        }
      }
      const elapsed = now() - genStart;
      if (valid.length > 0 && elapsed > budget) break;
      if (now() - start > HARD_TIME_LIMIT_MS) break;
    }
    if (valid.length > 0) {
      const { chosen, penalty } = chooseCandidate(valid, recent, sel);
      return { puzzle: chosen, attempts, rejected, candidates: valid.length, penalty, ms: now() - start, rejectReasons };
    }
    if (opts.generator || now() - start > HARD_TIME_LIMIT_MS) break;
  }
  throw new Error(`Could not generate a valid puzzle (${attempts} attempts). ${rejectReasons.slice(0, 3).join(' | ')}`);
}
