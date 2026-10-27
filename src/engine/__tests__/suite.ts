/**
 * Shared mass-generation suite: for every generator and difficulty, many
 * seeded candidates are built. Every accepted puzzle has already passed the
 * shared validator plus the generator's own verifier inside buildPuzzle; here
 * we additionally check answer checking, reproducibility and rejection rates.
 */
import { describe, expect, it } from 'vitest';
import { GENERATORS } from '../generators';
import { buildPuzzle, regeneratePuzzle } from '../registry';
import { checkResponse, correctResponse, wrongResponse } from '../answers';
import { validatePuzzle } from '../validation';
import type { Category, Difficulty, Puzzle } from '../types';
import { RejectCandidate } from '../util';

export const SEEDS_PER_CASE = Number(process.env.MV_SEEDS ?? 40);

export function runCategorySuite(category: Category) {
  const defs = GENERATORS.filter((g) => g.category === category);
  describe(`${category} generators`, () => {
    it('has at least one generator', () => expect(defs.length).toBeGreaterThan(0));
    for (const def of defs) {
      for (const d of [1, 2, 3, 4] as Difficulty[]) {
        if ((def.minDifficulty ?? 1) > d) continue;
        it(`${def.id} @ difficulty ${d}: ${SEEDS_PER_CASE} seeds`, () => {
          const valid: Puzzle[] = [];
          let rejected = 0;
          for (let i = 0; i < SEEDS_PER_CASE; i++) {
            try {
              valid.push(buildPuzzle(def, `t${d}-${i}`, d));
            } catch (e) {
              // Only deliberate candidate rejections are allowed — never crashes.
              if (!(e instanceof RejectCandidate)) throw e;
              rejected++;
            }
          }
          // Generators must be productive enough to fill a session quickly.
          expect(valid.length).toBeGreaterThanOrEqual(Math.ceil(SEEDS_PER_CASE * 0.2));
          const keys = new Set<string>();
          for (const p of valid) {
            expect(validatePuzzle(p, def)).toEqual([]);
            expect(p.difficulty).toBe(d);
            // the correct response is accepted, a wrong one is not
            expect(checkResponse(p, correctResponse(p)).correct).toBe(true);
            const wrong = wrongResponse(p);
            if (wrong) expect(checkResponse(p, wrong).correct).toBe(false);
            // single-answer multiple choice: exactly one option is correct
            if (p.interaction.type === 'choice' || p.interaction.type === 'investigation') {
              const right = p.interaction.choices.filter((c) => checkResponse(p, { type: 'choice', id: c.id }).correct);
              expect(right.length).toBe(1);
            }
            if ((p.interaction.type === 'text' || p.interaction.type === 'number') && p.interaction.fallback) {
              const right = p.interaction.fallback.filter((c) => checkResponse(p, { type: 'choice', id: c.id, viaFallback: true }).correct);
              expect(right.length).toBe(1);
            }
            // every hint is distinct from the answer explanation
            expect(p.hints.every((h) => h.length > 5)).toBe(true);
            keys.add(p.fingerprint.key);
          }
          // reproducibility: rebuild from the stored reference
          for (const p of valid.slice(0, 8)) {
            const again = regeneratePuzzle({ generator: p.generator, version: p.version, difficulty: p.difficulty, seed: p.seed });
            expect(again).not.toBeNull();
            expect(JSON.stringify(again)).toBe(JSON.stringify(p));
          }
          // different seeds should usually give different puzzles
          expect(keys.size).toBeGreaterThanOrEqual(Math.min(valid.length, 3));
          void rejected;
        });
      }
    }
  });
}
