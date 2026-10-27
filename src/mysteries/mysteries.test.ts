import { describe, expect, it } from 'vitest';
import { CASES } from './cases';
import { analyseCase, contradictionHolds, uncovered, verifyCase } from './verify';
import type { MysteryCase } from './types';

describe('murder mystery campaign', () => {
  it('has at least six cases with distinct settings, methods and culprits', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(new Set(CASES.map((c) => c.truth.method)).size).toBe(CASES.length);
    expect(new Set(CASES.map((c) => c.structure)).size).toBe(CASES.length);
  });

  for (const c of CASES) {
    describe(c.title, () => {
      it('passes the case verifier', () => {
        expect(verifyCase(c)).toEqual([]);
      });
      it('leaves exactly one suspect possible: the culprit', () => {
        expect(analyseCase(c).candidates).toEqual([c.truth.culprit]);
      });
      it('every suspect has a motive (no suspect is trivially innocent)', () => {
        for (const s of c.suspects) expect(s.motive.length).toBeGreaterThan(10);
      });
      it('every contradiction is genuine', () => {
        for (const k of c.contradictions) expect(contradictionHolds(c, k)).toBe(true);
      });
      it('the culprit stays unique even if any single red-herring record is removed', () => {
        for (const ev of c.evidence) {
          if (!ev.facts.every((f) => f.t === 'record')) continue;
          const trimmed: MysteryCase = { ...c, evidence: c.evidence.filter((e) => e.id !== ev.id) };
          expect(analyseCase(trimmed).candidates).toEqual([c.truth.culprit]);
        }
      });
    });
  }

  it('detects a broken case (a second suspect left without an alibi)', () => {
    const c = CASES[0];
    const broken: MysteryCase = { ...c, evidence: c.evidence.filter((e) => !e.facts.some((f) => f.t === 'elsewhere' && f.who === 'agnes')) };
    expect(analyseCase(broken).candidates.length).toBe(2);
    expect(verifyCase(broken).length).toBeGreaterThan(0);
  });

  it('interval arithmetic', () => {
    expect(uncovered([10, 20], [[0, 12], [15, 30]])).toEqual([[13, 14]]);
    expect(uncovered([10, 20], [[0, 30]])).toEqual([]);
  });
});
