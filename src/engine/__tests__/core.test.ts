import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '../rng';
import { normaliseText, textMatches } from '../answers';
import type { Csp } from '../logic/csp';
import { countSolutions, deduce } from '../logic/csp';
import { allNets, foldNet, freeNetCount, isValidView, validViews } from '../spatial/cube';
import { evaluate, singleMoves } from '../generators/riddle/matchsticks';
import { candidateAnswers } from '../generators/riddle/sequences';
import { countShapes } from '../generators/riddle/squares';
import { inferMatrixCell, inferSequenceValue, attrDef } from '../visual/attributes';
import { figureKey, mirrorFigure, rotateFigure } from '../visual/shapes';
import { KB } from '../generators/riddle/words';
import { AUTHORED_RIDDLES } from '../content/riddles';
import { LATERAL_CASES } from '../content/lateral';
import { GENERATORS } from '../generators';
import { buildPuzzle } from '../registry';
import { RejectCandidate } from '../util';

describe('seeded randomness', () => {
  it('is reproducible and seed-sensitive', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    const c = createRng('abd');
    const sa = Array.from({ length: 20 }, () => a.next());
    expect(sa).toEqual(Array.from({ length: 20 }, () => b.next()));
    expect(sa).not.toEqual(Array.from({ length: 20 }, () => c.next()));
    expect(hashString('x')).toBe(hashString('x'));
  });
  it('int stays in range and covers it', () => {
    const r = createRng('range');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });
});

describe('free-text answer matching', () => {
  it('normalises articles, case, punctuation and plurals', () => {
    expect(normaliseText('A Clock!')).toBe('clock');
    expect(normaliseText('the boxes')).toBe('box');
    expect(textMatches('Footprints', ['footsteps', 'footprints'])).toBe(true);
    expect(textMatches("it's a clock", ['clock'])).toBe(true);
  });
  it('tolerates one typo in longer words but not wrong answers', () => {
    expect(textMatches('umbrela', ['umbrella'])).toBe(true);
    expect(textMatches('cat', ['bat'])).toBe(false);
    expect(textMatches('not a clock', ['clock'])).toBe(false);
    expect(textMatches('', ['clock'])).toBe(false);
  });
});

describe('constraint solver', () => {
  const tiny = (extra: Csp['constraints']): Csp => ({
    vars: ['A', 'B', 'C'].map((name) => ({ name, domain: [0, 1, 2] })),
    constraints: extra,
    groups: [{ vars: [0, 1, 2], bijective: true }],
    phrasing: {
      elim: (v, xs) => `${v}≠${xs}`,
      assign: (v, x) => `${v} must be ${x}`,
      fact: (v, x) => `${v} is ${x}`,
      name: (v) => String(v),
    },
  });
  it('counts permutations', () => {
    expect(countSolutions(tiny([]), 10).count).toBe(6);
  });
  it('finds the unique solution and deduces it step by step', () => {
    const csp = tiny([
      { vars: [0, 1], test: ([a, b]) => a < b, clue: 1, text: 'A before B' },
      { vars: [2], test: ([c]) => c === 0, clue: 2, text: 'C first' },
    ]);
    const res = countSolutions(csp, 5);
    expect(res.count).toBe(1);
    expect(res.solutions[0]).toEqual([1, 2, 0]);
    const d = deduce(csp, false);
    expect(d.solved).toBe(true);
    expect(d.domains.map((x) => x[0])).toEqual([1, 2, 0]);
  });
  it('stops at the node budget instead of running forever', () => {
    const big: Csp = {
      vars: Array.from({ length: 9 }, (_, i) => ({ name: `v${i}`, domain: [0, 1, 2, 3, 4, 5, 6, 7, 8] })),
      constraints: [],
      groups: [{ vars: [0, 1, 2, 3, 4, 5, 6, 7, 8], bijective: true }],
      phrasing: { elim: () => '', assign: () => '', fact: () => '', name: () => '' },
    };
    const res = countSolutions(big, 1e9, 1000);
    expect(res.exhausted).toBe(true);
  });
});

describe('cube nets', () => {
  it('finds exactly the 11 cube nets', () => {
    expect(freeNetCount()).toBe(11);
    for (const net of allNets()) expect(new Set(foldNet(net)).size).toBe(6);
  });
  it('accepts 24 corner views (8 corners × 3 rotations) and rejects mirror images', () => {
    const views = validViews();
    expect(views.length).toBe(24);
    for (const [l, r, t] of views) expect(isValidView(r, l, t)).toBe(false);
  });
});

describe('matchsticks', () => {
  it('evaluates equations', () => {
    expect(evaluate('3+5=8')).toBe(true);
    expect(evaluate('9-4=5')).toBe(true);
    expect(evaluate('3+5=9')).toBe(false);
  });
  it('moves conserve sticks', () => {
    const count = (eq: string) => eq.split('').reduce((n, ch) => n + ({ '0': 6, '1': 2, '2': 5, '3': 5, '4': 4, '5': 5, '6': 6, '7': 3, '8': 7, '9': 6, '+': 2, '-': 1, '=': 0 } as Record<string, number>)[ch], 0);
    for (const m of singleMoves('6+4=4')) expect(count(m.result)).toBe(count('6+4=4'));
  });
});

describe('sequence rule library', () => {
  it('agrees on unambiguous sequences', () => {
    expect([...candidateAnswers([2, 4, 6, 8, 10, null]).keys()]).toEqual([12]);
    expect([...candidateAnswers([1, 1, 2, 3, 5, 8, null]).keys()]).toEqual([13]);
  });
  it('reports ambiguity when two rules disagree', () => {
    // 1, 2, 4 could be doubling (8) or +1,+2,+3 (7)
    expect(candidateAnswers([1, 2, 4, null]).size).toBeGreaterThan(1);
  });
});

describe('figure counting', () => {
  it('counts squares in a 3×3 grid', () => {
    const cells: [number, number][] = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push([x, y]);
    const total = [...countShapes(cells, 3, 3, true).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(14);
    const rects = [...countShapes(cells, 3, 3, false).values()].reduce((a, b) => a + b, 0);
    expect(rects).toBe(36);
  });
});

describe('visual rule inference', () => {
  const ctx = { layout: 'count' as const, shapes: ['circle' as const], sidesOrdinal: false, innerShapes: [] };
  const count = attrDef('count', ctx);
  it('predicts progressions and arithmetic', () => {
    expect([...inferMatrixCell([1, 2, 3, 2, 3, 4, 3, 4, 0], count)]).toEqual([5]);
    expect([...inferMatrixCell([1, 2, 3, 2, 2, 4, 3, 1, 0], count)]).toEqual([4]);
  });
  it('flags conflicting hypotheses', () => {
    // a single row of (1,2,3) twice is consistent with constant columns and +1 rows: both predict 3
    expect([...inferMatrixCell([1, 2, 3, 1, 2, 3, 1, 2, 0], count)]).toEqual([3]);
  });
  it('requires visible repetition before accepting a cycle', () => {
    expect([...inferSequenceValue([1, 2, 3, 4, null], 4, count)]).toEqual([5]);
  });
  it('rotations and mirrors are tracked exactly', () => {
    const f = { glyphs: [{ shape: 'lshape' as const, x: 22, y: 22, r: 10, rot: 1, shade: 2 }] };
    expect(figureKey(rotateFigure(rotateFigure(f, 2), 6))).toBe(figureKey(f));
    expect(figureKey(mirrorFigure(mirrorFigure(f)))).toBe(figureKey(f));
    expect(figureKey(mirrorFigure(f))).not.toBe(figureKey(f));
  });
});

describe('authored content integrity', () => {
  it('every authored riddle is complete', () => {
    const ids = new Set<string>();
    for (const r of AUTHORED_RIDDLES) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
      expect(r.accepted.length).toBeGreaterThan(0);
      expect(r.hints).toHaveLength(3);
      expect(r.wrong).toHaveLength(3);
      for (const [opt] of r.wrong) expect(textMatches(opt, r.accepted)).toBe(false);
    }
  });
  it('every authored riddle can appear in a valid puzzle', () => {
    const def = GENERATORS.find((g) => g.id === 'riddle.classic')!;
    const seen = new Set<string>();
    for (let i = 0; i < 1500 && seen.size < AUTHORED_RIDDLES.length; i++) {
      for (const d of [1, 2, 3, 4] as const) {
        try {
          const p = buildPuzzle(def, `cover${i}`, d);
          seen.add((p.hidden as { id: string }).id);
        } catch (e) {
          if (!(e instanceof RejectCandidate)) throw e;
        }
      }
    }
    expect([...AUTHORED_RIDDLES.map((r) => r.id)].filter((id) => !seen.has(id))).toEqual([]);
  });
  it('every lateral case is consistent', () => {
    for (const c of LATERAL_CASES) {
      expect(c.facts.length).toBeGreaterThanOrEqual(4);
      expect(c.wrong).toHaveLength(3);
      expect(c.keyPoints.length).toBeGreaterThan(0);
      for (const [, a] of c.facts) expect(['yes', 'no', 'irrelevant']).toContain(a);
    }
  });
  it('the riddle knowledge base has unique ids', () => {
    expect(new Set(KB.map((o) => o.id)).size).toBe(KB.length);
  });
});

describe('answers cannot be found by surface cues', () => {
  // A player should not be able to beat a generator by always picking the
  // longest written option. Chance level is roughly 1 in 4.
  it('the correct text option is not systematically the longest', () => {
    for (const def of GENERATORS) {
      let n = 0;
      let longest = 0;
      for (const d of [1, 2, 3, 4] as const) {
        if ((def.minDifficulty ?? 1) > d) continue;
        for (let i = 0; i < 25; i++) {
          let p;
          try {
            p = buildPuzzle(def, `len${d}-${i}`, d);
          } catch (e) {
            if (e instanceof RejectCandidate) continue;
            throw e;
          }
          const inter = p.interaction;
          const choices = inter.type === 'choice' || inter.type === 'investigation' ? inter.choices : inter.type === 'text' || inter.type === 'number' ? inter.fallback : undefined;
          if (!choices?.length || choices.some((c) => !c.text || c.visual)) continue;
          const correctId = p.answer.type === 'choice' ? p.answer.correct : 'fallbackCorrect' in p.answer ? p.answer.fallbackCorrect : undefined;
          const lens = choices.map((c) => c.text!.length);
          const max = Math.max(...lens);
          n++;
          const right = choices.find((c) => c.id === correctId);
          if (right && right.text!.length === max && lens.filter((l) => l === max).length === 1) longest++;
        }
      }
      if (n >= 20) expect({ id: def.id, rate: longest / n < 0.45 }).toEqual({ id: def.id, rate: true });
    }
  });

  it('matchstick options include true equations that need more than one move', () => {
    const def = GENERATORS.find((g) => g.id === 'riddle.matchsticks')!;
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      let p;
      try {
        p = buildPuzzle(def, `ms-${i}`, 3);
      } catch (e) {
        if (e instanceof RejectCandidate) continue;
        throw e;
      }
      if (p.interaction.type !== 'choice') continue;
      const trueOptions = p.interaction.choices.filter((c) => c.visual?.kind === 'matchsticks' && evaluate(c.visual.text));
      expect(trueOptions.length).toBeGreaterThanOrEqual(3);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
