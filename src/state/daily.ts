/**
 * Daily challenge: five puzzles chosen deterministically from the date, so
 * every player gets the same set on the same day without any server.
 */
import { generatePuzzle } from '../engine/registry';
import { createRng } from '../engine/rng';
import type { Category, Difficulty, Puzzle, PuzzleRef } from '../engine/types';
import { CATEGORIES } from '../engine/types';

export const DAILY_SIZE = 5;
const RAMP: Difficulty[] = [1, 2, 2, 3, 4];

const cache = new Map<string, PuzzleRef[]>();

export function dailyRefs(date: string): PuzzleRef[] {
  const hit = cache.get(date);
  if (hit) return hit;
  const rng = createRng(`daily|${date}`);
  const cats: Category[] = rng.sample(CATEGORIES, DAILY_SIZE);
  const refs = cats.map((category, i) => {
    // one valid candidate, no time budget → identical on every device
    const rep = generatePuzzle({ category, difficulty: RAMP[i], rng, maxCandidates: 1, timeBudgetMs: 1e9 });
    const p: Puzzle = rep.puzzle;
    return { generator: p.generator, version: p.version, difficulty: p.difficulty, seed: p.seed };
  });
  cache.clear();
  cache.set(date, refs);
  return refs;
}
