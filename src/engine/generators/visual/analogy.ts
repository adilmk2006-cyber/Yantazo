/**
 * 2×2 analogy matrices: A → B across the row, A → C down the column, and the
 * missing cell applies both changes. Transformations come from different
 * families (geometry, shading, size, shape, decoration) so they commute; the
 * validator enumerates every rival composition that explains the visible cells.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Difficulty, Figure, Glyph, Puzzle, ShapeKind, Visual } from '../../types';
import { figureKey, flipFigure, mirrorFigure, rotateFigure, shapeInfo, PLAIN_SHAPES, ORIENTABLE_SHAPES, CHIRAL_SHAPES } from '../../visual/shapes';
import { slotXY } from '../../visual/attributes';
import { capitalize, reject } from '../../util';
import type { Rng } from '../../rng';

type Cat = 'geometry' | 'shade' | 'size' | 'shape' | 'dot';

interface Op {
  id: string;
  cat: Cat;
  desc: string;
  apply(f: Figure): Figure | null;
}

const DOT_R = 6;
const SIZES = [9, 12, 15];

const isDot = (g: Glyph) => g.r === DOT_R;

function mapGlyphs(f: Figure, fn: (g: Glyph) => Glyph | null): Figure | null {
  const out: Glyph[] = [];
  for (const g of f.glyphs) {
    if (isDot(g)) {
      out.push(g);
      continue;
    }
    const n = fn(g);
    if (!n) return null;
    out.push(n);
  }
  return { ...f, glyphs: out };
}

const GEOMETRY: Op[] = [
  { id: 'rot90', cat: 'geometry', desc: 'rotate the whole panel 90° clockwise', apply: (f) => rotateFigure(f, 2) },
  { id: 'rot270', cat: 'geometry', desc: 'rotate the whole panel 90° anticlockwise', apply: (f) => rotateFigure(f, 6) },
  { id: 'rot180', cat: 'geometry', desc: 'turn the whole panel through 180°', apply: (f) => rotateFigure(f, 4) },
  { id: 'mirror', cat: 'geometry', desc: 'mirror the panel left ↔ right', apply: (f) => mirrorFigure(f) },
  { id: 'flip', cat: 'geometry', desc: 'flip the panel top ↔ bottom', apply: (f) => flipFigure(f) },
];

const SHADE_OPS: Op[] = [
  { id: 'darken', cat: 'shade', desc: 'make every shape one shade darker (outlined → dotted → striped → solid)', apply: (f) => mapGlyphs(f, (g) => (g.shade >= 3 ? null : { ...g, shade: g.shade + 1 })) },
  { id: 'lighten', cat: 'shade', desc: 'make every shape one shade lighter', apply: (f) => mapGlyphs(f, (g) => (g.shade <= 0 ? null : { ...g, shade: g.shade - 1 })) },
  { id: 'invert', cat: 'shade', desc: 'invert the shading (outlined ↔ solid, dotted ↔ striped)', apply: (f) => mapGlyphs(f, (g) => ({ ...g, shade: 3 - g.shade })) },
];

const SIZE_OPS: Op[] = [
  { id: 'grow', cat: 'size', desc: 'make every shape one size larger', apply: (f) => mapGlyphs(f, (g) => { const i = SIZES.indexOf(g.r); return i < 0 || i >= SIZES.length - 1 ? null : { ...g, r: SIZES[i + 1] }; }) },
  { id: 'shrink', cat: 'size', desc: 'make every shape one size smaller', apply: (f) => mapGlyphs(f, (g) => { const i = SIZES.indexOf(g.r); return i <= 0 ? null : { ...g, r: SIZES[i - 1] }; }) },
];

const DOT_OP: Op = {
  id: 'dot',
  cat: 'dot',
  desc: 'add a small solid dot in the centre',
  apply: (f) => (f.glyphs.some((g) => isDot(g) || (Math.abs(g.x - 50) < 1 && Math.abs(g.y - 50) < 1)) ? null : { ...f, glyphs: [...f.glyphs, { shape: 'circle', x: 50, y: 50, r: DOT_R, rot: 0, shade: 3 }] }),
};

function swapOp(from: ShapeKind, to: ShapeKind): Op {
  return {
    id: `swap:${from}>${to}`,
    cat: 'shape',
    desc: `replace every ${shapeInfo(from).name} with ${shapeInfo(to).name === 'X' ? 'an X' : `a ${shapeInfo(to).name}`}`,
    apply: (f) => {
      if (!f.glyphs.some((g) => g.shape === from && !isDot(g)) || f.glyphs.some((g) => g.shape === to && !isDot(g))) return null;
      return mapGlyphs(f, (g) => (g.shape === from ? { ...g, shape: to } : g));
    },
  };
}

function compose(ops: Op[]): Op {
  return {
    id: ops.map((o) => o.id).join('+'),
    cat: ops[0].cat,
    desc: ops.map((o) => o.desc).join(', and '),
    apply: (f) => {
      let cur: Figure | null = f;
      for (const o of ops) {
        if (!cur) return null;
        cur = o.apply(cur);
      }
      return cur;
    },
  };
}

const CONFUSABLE: Record<string, string[]> = {
  rot90: ['rot270', 'mirror', 'rot180'],
  rot270: ['rot90', 'flip', 'rot180'],
  rot180: ['flip', 'mirror', 'rot90'],
  mirror: ['flip', 'rot180', 'rot90'],
  flip: ['mirror', 'rot180', 'rot270'],
  darken: ['invert', 'lighten'],
  lighten: ['invert', 'darken'],
  invert: ['darken', 'lighten'],
  grow: ['shrink'],
  shrink: ['grow'],
};

function opById(id: string, swaps: Op[]): Op | undefined {
  return [...GEOMETRY, ...SHADE_OPS, ...SIZE_OPS, DOT_OP, ...swaps].find((o) => o.id === id);
}

function baseFigure(rng: Rng, difficulty: Difficulty, needShapes: number): Figure {
  const count = difficulty === 1 ? rng.int(1, 2) : difficulty === 2 ? 2 : rng.int(2, 3);
  const slots = rng.sample([0, 1, 2, 3, 5, 6, 7, 8], count);
  const pool = rng.chance(0.5) ? [...ORIENTABLE_SHAPES, ...rng.sample(PLAIN_SHAPES, 3)] : [...CHIRAL_SHAPES, ...rng.sample(PLAIN_SHAPES, 4)];
  const shapes = rng.sample(pool, Math.max(needShapes, count));
  return {
    glyphs: slots.map((slot, i) => {
      const [x, y] = slotXY(slot);
      return {
        shape: shapes[i % shapes.length],
        x,
        y,
        r: SIZES[1],
        rot: shapeInfo(shapes[i % shapes.length]).orientable ? rng.int(0, 7) : 0,
        shade: rng.int(0, 3),
      } satisfies Glyph;
    }),
  };
}

function figVisual(f: Figure): Visual {
  return { kind: 'figure', figure: f };
}

interface AnalogyHidden {
  base: Figure;
  row: string[];
  col: string[];
  [k: string]: unknown;
}

function pickFamilyOps(cat: Cat, rng: Rng, base: Figure): Op | null {
  switch (cat) {
    case 'geometry':
      return rng.pick(GEOMETRY);
    case 'shade':
      return rng.pick(SHADE_OPS);
    case 'size':
      return rng.pick(SIZE_OPS);
    case 'dot':
      return DOT_OP;
    case 'shape': {
      const present = [...new Set(base.glyphs.map((g) => g.shape))].filter((s) => !shapeInfo(s).orientable);
      if (present.length === 0) return null;
      const from = rng.pick(present);
      const to = rng.pick(PLAIN_SHAPES.filter((s) => !base.glyphs.some((g) => g.shape === s)));
      return swapOp(from, to);
    }
  }
}

function catHint(cats: Cat[]): string {
  const words: Record<Cat, string> = {
    geometry: 'the positions and directions of the shapes',
    shade: 'the shading',
    size: 'the sizes',
    shape: 'which shapes appear',
    dot: 'whether anything new appears',
  };
  return cats.map((c) => words[c]).join(' and ');
}

export const visualAnalogy: GeneratorDef = {
  id: 'visual.analogy',
  category: 'visual',
  version: 1,
  family: 'Visual analogies',
  description: '2×2 analogies where row and column transformations combine.',
  weight: 1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const nRow = difficulty >= 3 ? 2 : 1;
    const nCol = difficulty === 4 ? 2 : 1;
    const cats = rng.shuffle<Cat>(['geometry', 'shade', 'size', 'shape', 'dot']);
    // geometry should almost always feature: it is the most visual change
    if (!cats.slice(0, nRow + nCol).includes('geometry') && rng.chance(0.75)) {
      cats.splice(cats.indexOf('geometry'), 1);
      cats.unshift('geometry');
    }
    const rowCats = cats.slice(0, nRow);
    const colCats = cats.slice(nRow, nRow + nCol);
    const base = baseFigure(rng, difficulty, 2);
    const rowOps: Op[] = [];
    const colOps: Op[] = [];
    for (const c of rowCats) {
      const op = pickFamilyOps(c, rng, base);
      if (!op) reject('no op');
      rowOps.push(op);
    }
    for (const c of colCats) {
      const op = pickFamilyOps(c, rng, base);
      if (!op) reject('no op');
      colOps.push(op);
    }
    const T = compose(rowOps);
    const U = compose(colOps);
    const B = T.apply(base);
    const C = U.apply(base);
    if (!B || !C) reject('transform not applicable');
    const D1 = T.apply(C);
    const D2 = U.apply(B);
    if (!D1 || !D2 || figureKey(D1) !== figureKey(D2)) reject('transforms do not commute');
    const D = D1;
    const keyA = figureKey(base);
    const keyB = figureKey(B);
    const keyC = figureKey(C);
    const keyD = figureKey(D);
    if (new Set([keyA, keyB, keyC, keyD]).size !== 4) reject('degenerate cells');

    // Rival hypotheses: every op composition (≤2 ops, distinct families) that maps A→B and A→C.
    const shapesSeen = [...new Set([...base.glyphs, ...B.glyphs, ...C.glyphs].map((g) => g.shape))];
    const swaps: Op[] = [];
    for (const from of shapesSeen) for (const to of shapesSeen) if (from !== to) swaps.push(swapOp(from, to));
    const singles: Op[] = [...GEOMETRY, ...SHADE_OPS, ...SIZE_OPS, DOT_OP, ...swaps];
    const library: Op[] = [...singles];
    for (let i = 0; i < singles.length; i++)
      for (let j = 0; j < singles.length; j++) if (singles[i].cat !== singles[j].cat) library.push(compose([singles[i], singles[j]]));
    const fitsB = library.filter((o) => { const r = o.apply(base); return r && figureKey(r) === keyB; });
    const fitsC = library.filter((o) => { const r = o.apply(base); return r && figureKey(r) === keyC; });
    const predictions = new Set<string>();
    for (const t of fitsB)
      for (const u of fitsC) {
        const p1 = t.apply(C);
        const p2 = u.apply(B);
        if (p1) predictions.add(figureKey(p1));
        if (p2) predictions.add(figureKey(p2));
      }
    if (predictions.size !== 1 || !predictions.has(keyD)) reject('ambiguous analogy');

    // Distractors from near-miss reasoning.
    const wantDistractors = difficulty === 1 ? 3 : difficulty === 2 ? 5 : 7;
    const cands: { fig: Figure; why: string }[] = [];
    const seen = new Set([keyD]);
    const tryAdd = (f: Figure | null, why: string) => {
      if (!f) return;
      const k = figureKey(f);
      if (seen.has(k)) return;
      seen.add(k);
      cands.push({ fig: f, why });
    };
    const allOps = [...rowOps.map((o) => ({ o, side: 'row' as const })), ...colOps.map((o) => ({ o, side: 'col' as const }))];
    for (const { o, side } of rng.shuffle(allOps)) {
      for (const altId of CONFUSABLE[o.id] ?? []) {
        const alt = opById(altId, swaps);
        if (!alt) continue;
        const r2 = side === 'row' ? compose(rowOps.map((x) => (x === o ? alt : x))) : compose(colOps.map((x) => (x === o ? alt : x)));
        const f = side === 'row' ? (U.apply(base) ? r2.apply(U.apply(base)!) : null) : r2.apply(T.apply(base)!);
        tryAdd(f, `This would need you to ${alt.desc} instead of ${o.desc}.`);
      }
    }
    tryAdd(B, 'This is the top-right panel unchanged: it applies the left-to-right change but ignores the top-to-bottom change.');
    tryAdd(C, 'This is the bottom-left panel unchanged: it ignores the left-to-right change.');
    for (const { o } of allOps) {
      const without = compose([...rowOps, ...colOps].filter((x) => x !== o));
      tryAdd(without.apply(base), `This leaves out one change: it forgets to ${o.desc}.`);
    }
    tryAdd(T.apply(T.apply(C) ?? base), `This applies the left-to-right change twice (${T.desc}).`);
    if (cands.length < wantDistractors) reject('not enough distractors');
    const chosen = cands.slice(0, wantDistractors);

    const built = buildChoices(
      { key: keyD, visual: figVisual(D) },
      chosen.map((c) => ({ key: figureKey(c.fig), visual: figVisual(c.fig), reason: c.why })),
      rng,
    );

    return {
      title: 'Complete the analogy',
      prompt: 'The top-left panel changes into the top-right panel in one way, and into the bottom-left panel in another way. Which option completes the square?',
      display: { blocks: [{ type: 'matrix', cols: 2, cells: [figVisual(base), figVisual(B), figVisual(C), null] }] },
      interaction: { type: 'choice', choices: built.choices, columns: 4 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        'Compare the top-left panel with the top-right panel, then compare it with the bottom-left panel. Treat the two changes separately.',
        `Left → right, look at ${catHint(rowCats)}. Top → bottom, look at ${catHint(colCats)}.`,
        `The left-to-right change is: ${T.desc}. Apply it to the bottom-left panel.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}.`,
        answerVisual: figVisual(D),
        rule: `Left → right: ${T.desc}. Top → bottom: ${U.desc}.`,
        steps: [
          `From the top-left to the top-right panel: ${T.desc}.`,
          `From the top-left to the bottom-left panel: ${U.desc}.`,
          `The two changes affect different properties, so their order does not matter. Applying the left-to-right change to the bottom-left panel (or the top-to-bottom change to the top-right panel) gives option ${built.correctLabel}.`,
          'No other combination of simple transformations explains both visible changes and leads to a different picture — the generator checked every alternative in its library.',
        ],
        alternatives: built.alternatives,
        skills: ['abstract reasoning', 'mental rotation', 'pattern recognition'],
      },
      metrics: { rules: rowOps.length + colOps.length, steps: rowOps.length + colOps.length + 1, choices: built.choices.length },
      fingerprint: {
        structure: `m2|${rowCats.join('+')}|${colCats.join('+')}`,
        features: [...rowOps.map((o) => `op:${o.id.split(':')[0]}`), ...colOps.map((o) => `op:${o.id.split(':')[0]}`), `cats:${[...rowCats, ...colCats].sort().join('+')}`],
        detail: keyA,
      },
      hidden: { base, row: rowOps.map((o) => o.id), col: colOps.map((o) => o.id) } satisfies AnalogyHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as AnalogyHidden;
    const allShapes = [...PLAIN_SHAPES, ...ORIENTABLE_SHAPES];
    const swaps: Op[] = [];
    for (const a of allShapes) for (const b of allShapes) if (a !== b) swaps.push(swapOp(a, b));
    const find = (id: string) => opById(id, swaps);
    const T = compose(h.row.map((id) => find(id)!));
    const U = compose(h.col.map((id) => find(id)!));
    const D = T.apply(U.apply(h.base)!);
    if (!D) return ['answer could not be recomputed'];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const key = figureKey(D);
    const matches = p.interaction.choices.filter((c) => c.visual?.kind === 'figure' && figureKey(c.visual.figure) === key);
    if (matches.length !== 1 || matches[0].id !== p.answer.correct) return [capitalize('recomputed answer does not match exactly one option')];
    return [];
  },
};
