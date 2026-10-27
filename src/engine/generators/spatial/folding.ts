/**
 * Paper folding and hole punching. A 4×4 sheet is folded 1–3 times (halves
 * and diagonals), punched, and unfolded. The hole pattern is computed by
 * mapping every original cell through the folds; distractors come from
 * classic mistakes (translating instead of reflecting, forgetting a layer …).
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Block, Puzzle, Visual } from '../../types';
import type { Rng } from '../../rng';
import { reject } from '../../util';

const N = 4;
type FoldId = 'L' | 'R' | 'T' | 'B' | 'D1' | 'D2';

interface Region {
  x0: number;
  y0: number;
  w: number;
  h: number;
  tri?: 'D1' | 'D2';
}

const FOLD_TEXT: Record<FoldId, string> = {
  L: 'fold the left half over onto the right half',
  R: 'fold the right half over onto the left half',
  T: 'fold the top half down onto the bottom half',
  B: 'fold the bottom half up onto the top half',
  D1: 'fold the bottom-left triangle up onto the top-right triangle (along the diagonal)',
  D2: 'fold the top-left triangle down onto the bottom-right triangle (along the diagonal)',
};

/** Where a cell of the current folded sheet lands after one fold. */
function foldCell(f: FoldId, r: Region, [x, y]: [number, number]): [number, number] {
  switch (f) {
    case 'L': {
      const mid = r.x0 + r.w / 2;
      return x < mid ? [2 * mid - 1 - x, y] : [x, y];
    }
    case 'R': {
      const mid = r.x0 + r.w / 2;
      return x >= mid ? [2 * mid - 1 - x, y] : [x, y];
    }
    case 'T': {
      const mid = r.y0 + r.h / 2;
      return y < mid ? [x, 2 * mid - 1 - y] : [x, y];
    }
    case 'B': {
      const mid = r.y0 + r.h / 2;
      return y >= mid ? [x, 2 * mid - 1 - y] : [x, y];
    }
    case 'D1': {
      const dx = x - r.x0;
      const dy = y - r.y0;
      return dy > dx ? [r.x0 + dy, r.y0 + dx] : [x, y];
    }
    case 'D2': {
      const s = r.w - 1;
      const dx = x - r.x0;
      const dy = y - r.y0;
      return dx + dy < s ? [r.x0 + s - dy, r.y0 + s - dx] : [x, y];
    }
  }
}

/** Mistaken unfold: slide instead of reflecting. */
function slideCell(f: FoldId, r: Region, [x, y]: [number, number]): [number, number] {
  switch (f) {
    case 'L':
      return x < r.x0 + r.w / 2 ? [x + r.w / 2, y] : [x, y];
    case 'R':
      return x >= r.x0 + r.w / 2 ? [x - r.w / 2, y] : [x, y];
    case 'T':
      return y < r.y0 + r.h / 2 ? [x, y + r.h / 2] : [x, y];
    case 'B':
      return y >= r.y0 + r.h / 2 ? [x, y - r.h / 2] : [x, y];
    default:
      return foldCell(f, r, [x, y]);
  }
}

function nextRegion(f: FoldId, r: Region): Region {
  switch (f) {
    case 'L':
      return { ...r, x0: r.x0 + r.w / 2, w: r.w / 2 };
    case 'R':
      return { ...r, w: r.w / 2 };
    case 'T':
      return { ...r, y0: r.y0 + r.h / 2, h: r.h / 2 };
    case 'B':
      return { ...r, h: r.h / 2 };
    case 'D1':
    case 'D2':
      return { ...r, tri: f };
  }
}

function regionPolygon(r: Region): [number, number][] {
  const { x0, y0, w, h } = r;
  if (r.tri === 'D1') return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h]];
  if (r.tri === 'D2') return [[x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
  return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
}

function foldLine(f: FoldId, r: Region): [number, number, number, number] {
  const { x0, y0, w, h } = r;
  if (f === 'L' || f === 'R') return [x0 + w / 2, y0, x0 + w / 2, y0 + h];
  if (f === 'T' || f === 'B') return [x0, y0 + h / 2, x0 + w, y0 + h / 2];
  if (f === 'D1') return [x0, y0, x0 + w, y0 + h];
  return [x0 + w, y0, x0, y0 + h];
}

function foldArrow(f: FoldId, r: Region): [number, number, number, number] {
  const { x0, y0, w, h } = r;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  switch (f) {
    case 'L':
      return [x0 + w / 4, cy, x0 + (3 * w) / 4, cy];
    case 'R':
      return [x0 + (3 * w) / 4, cy, x0 + w / 4, cy];
    case 'T':
      return [cx, y0 + h / 4, cx, y0 + (3 * h) / 4];
    case 'B':
      return [cx, y0 + (3 * h) / 4, cx, y0 + h / 4];
    case 'D1':
      return [x0 + w / 4, y0 + (3 * h) / 4, x0 + (3 * w) / 4, y0 + h / 4];
    case 'D2':
      return [x0 + w / 4, y0 + h / 4, x0 + (3 * w) / 4, y0 + (3 * h) / 4];
  }
}

function cellsIn(r: Region): [number, number][] {
  const out: [number, number][] = [];
  for (let y = r.y0; y < r.y0 + r.h; y++)
    for (let x = r.x0; x < r.x0 + r.w; x++) {
      const dx = x - r.x0;
      const dy = y - r.y0;
      if (r.tri === 'D1' && dy >= dx) continue; // strictly above the diagonal (holes on a fold line are avoided)
      if (r.tri === 'D2' && dx + dy <= r.w - 1) continue;
      out.push([x, y]);
    }
  return out;
}

type Mapper = (f: FoldId, r: Region, c: [number, number]) => [number, number];

/** Original cells whose folded position is one of the punched cells. */
function unfold(folds: FoldId[], punches: [number, number][], mapper: Mapper = foldCell, skip = -1): number[] {
  const result: number[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let r: Region = { x0: 0, y0: 0, w: N, h: N };
      let c: [number, number] = [x, y];
      folds.forEach((f, i) => {
        if (i !== skip) c = mapper(f, r, c);
        r = nextRegion(f, r);
      });
      if (punches.some((p) => p[0] === c[0] && p[1] === c[1])) result.push(y * N + x);
    }
  return result.sort((a, b) => a - b);
}

function holesVisual(cells: number[]): Visual {
  return {
    kind: 'paper',
    n: N,
    region: [[0, 0], [N, 0], [N, N], [0, N]],
    holes: cells.map((i) => ({ x: (i % N) + 0.5, y: Math.floor(i / N) + 0.5 })),
  };
}

function pickFolds(rng: Rng, difficulty: number): FoldId[] {
  const v = rng.pick<FoldId>(['L', 'R']);
  const h = rng.pick<FoldId>(['T', 'B']);
  const d = rng.pick<FoldId>(['D1', 'D2']);
  switch (difficulty) {
    case 1:
      return [rng.pick([v, h])];
    case 2:
      return rng.shuffle([v, h]);
    case 3:
      return rng.chance(0.5) ? [...rng.shuffle([v, h]), d] : [v, h, rng.pick<FoldId>(['L', 'R'])].slice(0, 3) as FoldId[];
    default:
      return rng.chance(0.5) ? [...rng.shuffle([v, h]), d] : [v, rng.pick<FoldId>(['L', 'R']), h];
  }
}

interface FoldHidden {
  folds: FoldId[];
  punches: [number, number][];
  [k: string]: unknown;
}

export const spatialFolding: GeneratorDef = {
  id: 'spatial.folding',
  category: 'spatial',
  version: 1,
  family: 'Paper folding',
  description: 'Fold a square sheet, punch it, and predict the unfolded hole pattern.',
  weight: 1.1,
  candidates: 5,
  generate({ rng, difficulty }) {
    const folds = pickFolds(rng, difficulty);
    // diagonal folds need a square region
    let r: Region = { x0: 0, y0: 0, w: N, h: N };
    const regions: Region[] = [r];
    for (const f of folds) {
      if ((f === 'D1' || f === 'D2') && r.w !== r.h) reject('diagonal fold needs a square');
      if ((f === 'L' || f === 'R') && r.w < 2) reject('too narrow');
      if ((f === 'T' || f === 'B') && r.h < 2) reject('too short');
      r = nextRegion(f, r);
      regions.push(r);
    }
    const final = regions[regions.length - 1];
    const avail = cellsIn(final);
    if (avail.length === 0) reject('no punchable cell');
    const nPunch = difficulty === 4 && avail.length > 1 && rng.chance(0.5) ? 2 : 1;
    const punches = rng.sample(avail, nPunch);
    const truth = unfold(folds, punches);
    const key = (c: number[]) => c.join(',');

    const distractors: { holes: number[]; why: string }[] = [];
    const seen = new Set([key(truth)]);
    const add = (h: number[], why: string) => {
      if (h.length === 0 || seen.has(key(h))) return;
      seen.add(key(h));
      distractors.push({ holes: h, why });
    };
    add(unfold(folds, punches, slideCell), 'This slides the punched layer across instead of mirroring it across each fold line.');
    for (let i = 0; i < folds.length; i++) add(unfold(folds, punches, foldCell, i), `This forgets the layer created by fold ${i + 1}, so it has too few holes.`);
    add(truth.map((i) => (i % N) + (N - 1 - Math.floor(i / N)) * N).sort((a, b) => a - b), 'This pattern is upside down relative to the real one.');
    add(truth.map((i) => (N - 1 - (i % N)) + Math.floor(i / N) * N).sort((a, b) => a - b), 'This pattern is mirrored left-to-right relative to the real one.');
    add(truth.map((i) => Math.floor(i / N) + (i % N) * N).sort((a, b) => a - b), 'This pattern is reflected across the wrong diagonal.');
    // shifted copy
    add(truth.map((i) => ((i % N) + 1) % N + Math.floor(i / N) * N).sort((a, b) => a - b), 'Every hole here is one column off from where the punch passes through the layers.');
    const nOpts = difficulty <= 2 ? 4 : 5;
    if (distractors.length < nOpts - 1) reject('not enough distractors');
    const chosen = distractors.slice(0, nOpts - 1);
    const built = buildChoices(
      { key: key(truth), visual: holesVisual(truth) },
      chosen.map((d) => ({ key: key(d.holes), visual: holesVisual(d.holes), reason: d.why })),
      rng,
    );

    const stepVisuals: Visual[] = folds.map((f, i) => ({
      kind: 'paper',
      n: N,
      region: regionPolygon(regions[i]),
      ghost: i > 0,
      foldLine: foldLine(f, regions[i]),
      arrow: foldArrow(f, regions[i]),
      holes: [],
    }));
    const punched: Visual = { kind: 'paper', n: N, region: regionPolygon(final), ghost: true, holes: punches.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })) };
    const blocks: Block[] = [
      {
        type: 'gallery',
        size: 'sm',
        items: [...stepVisuals.map((v, i) => ({ visual: v, caption: `Fold ${i + 1}` })), { visual: punched, caption: nPunch === 1 ? 'Punch' : 'Punch ×2' }],
      },
      { type: 'list', ordered: true, items: [...folds.map((f) => FOLD_TEXT[f].charAt(0).toUpperCase() + FOLD_TEXT[f].slice(1) + '.'), `Punch ${nPunch === 1 ? 'a hole' : 'two holes'} through every layer, then unfold completely.`] },
    ];
    const layers = 2 ** folds.length;
    return {
      title: 'Fold, punch, unfold',
      prompt: 'A square sheet of paper is folded as shown, then punched. Which option shows the sheet when it is completely unfolded?',
      display: { blocks },
      interaction: { type: 'choice', choices: built.choices, columns: nOpts },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        `Each fold doubles the layers under the punch — expect up to ${layers * nPunch} holes (fewer only if a hole sits exactly where layers coincide).`,
        'Unfold one step at a time, starting with the last fold. Every hole gets a mirror-image partner across that fold line.',
        `Undo fold ${folds.length} first: reflect the punched hole across its fold line, then keep going backwards.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${truth.length} holes.`,
        answerVisual: holesVisual(truth),
        rule: 'Unfolding reflects every hole across each fold line, in reverse order of folding.',
        steps: [
          `The sheet ends up ${folds.length} fold${folds.length > 1 ? 's' : ''} thick in the punched area (${layers} layers).`,
          ...[...folds].reverse().map((f, i) => `Undo fold ${folds.length - i} (${FOLD_TEXT[f].replace(/^fold /, '')}): mirror every hole across that fold line.`),
          `Result: ${truth.length} holes, matching option ${built.correctLabel}. The answer was computed by tracing every square of the sheet through the folds.`,
        ],
        alternatives: built.alternatives,
        skills: ['spatial visualisation', 'mental rotation'],
      },
      metrics: { rules: folds.length, steps: folds.length + nPunch, choices: nOpts },
      fingerprint: {
        structure: `fold|${folds.map((f) => (f.startsWith('D') ? 'D' : f === 'L' || f === 'R' ? 'V' : 'H')).join('')}|${nPunch}`,
        features: folds.map((f) => `fold:${f.startsWith('D') ? 'diag' : f === 'L' || f === 'R' ? 'vert' : 'horiz'}`).concat(`punches:${nPunch}`),
        detail: `${folds.join('')}|${punches.map((p) => p.join(',')).join(';')}`,
      },
      hidden: { folds, punches } satisfies FoldHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as FoldHidden;
    const truth = unfold(h.folds, h.punches).join(',');
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const match = p.interaction.choices.filter((c) => c.visual?.kind === 'paper' && c.visual.holes.map((o) => Math.floor(o.y) * N + Math.floor(o.x)).sort((a, b) => a - b).join(',') === truth);
    if (match.length !== 1 || match[0].id !== p.answer.correct) return ['recomputed holes do not match exactly one option'];
    return [];
  },
};

