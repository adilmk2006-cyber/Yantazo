import { buildPuzzle } from '../registry';
import type { GeneratorDef } from '../generator';
import type { Difficulty, Puzzle } from '../types';
import { RejectCandidate } from '../util';

export interface SweepResult {
  puzzles: Puzzle[];
  rejected: number;
  reasons: Map<string, number>;
  unexpected: string[];
}

/** Builds puzzles for seeds s0…sN, counting rejected candidates. */
export function sweep(def: GeneratorDef, difficulty: Difficulty, n: number, prefix = 'seed'): SweepResult {
  const puzzles: Puzzle[] = [];
  const reasons = new Map<string, number>();
  const unexpected: string[] = [];
  let rejected = 0;
  for (let i = 0; i < n; i++) {
    try {
      puzzles.push(buildPuzzle(def, `${prefix}${i}`, difficulty));
    } catch (e) {
      rejected++;
      const msg = (e as Error).message.replace(/[0-9]+/g, '#').slice(0, 90);
      reasons.set(msg, (reasons.get(msg) ?? 0) + 1);
      if (!(e instanceof RejectCandidate)) unexpected.push((e as Error).stack ?? String(e));
    }
  }
  return { puzzles, rejected, reasons, unexpected };
}
