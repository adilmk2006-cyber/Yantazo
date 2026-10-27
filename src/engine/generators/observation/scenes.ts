/** Scene helpers for observation puzzles. */
import type { Rng } from '../../rng';
import type { Figure, Glyph, ShapeKind } from '../../types';
import { describeGlyph, directionName, shapeInfo, PLAIN_SHAPES } from '../../visual/shapes';

export const SCENE_SHAPES: ShapeKind[] = [...PLAIN_SHAPES, 'arrow', 'drop', 'semicircle'];

/** Non-overlapping jittered positions on a cols×rows lattice. */
export function scatter(rng: Rng, n: number, cols = 4, rows = 4): [number, number][] {
  const slots: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([c, r]);
  const cw = 100 / cols;
  const ch = 100 / rows;
  return rng.sample(slots, n).map(([c, r]) => [Math.round((c + 0.5) * cw + rng.int(-3, 3)), Math.round((r + 0.5) * ch + rng.int(-3, 3))]);
}

export function randomScene(rng: Rng, n: number, cols = 4, rows = 4, r = 8): Figure {
  const pos = scatter(rng, n, cols, rows);
  return {
    glyphs: pos.map(([x, y]) => {
      const shape = rng.pick(SCENE_SHAPES);
      return { shape, x, y, r, rot: shapeInfo(shape).orientable ? rng.int(0, 7) : 0, shade: rng.int(0, 3) } satisfies Glyph;
    }),
  };
}

export function whereIs(g: Glyph): string {
  const v = g.y < 34 ? 'top' : g.y > 66 ? 'bottom' : 'middle';
  const h = g.x < 34 ? 'left' : g.x > 66 ? 'right' : 'centre';
  if (v === 'middle' && h === 'centre') return 'in the centre';
  if (v === 'middle') return `on the ${h}`;
  return `at the ${v}${h === 'centre' ? '' : ` ${h}`}`;
}

export type Change =
  | { kind: 'shade'; index: number; to: number }
  | { kind: 'shape'; index: number; to: ShapeKind }
  | { kind: 'rotate'; index: number; to: number }
  | { kind: 'size'; index: number; to: number }
  | { kind: 'add'; glyph: Glyph };

export function applyChange(f: Figure, c: Change): Figure {
  if (c.kind === 'add') return { ...f, glyphs: [...f.glyphs, c.glyph] };
  return {
    ...f,
    glyphs: f.glyphs.map((g, i) => {
      if (i !== c.index) return g;
      if (c.kind === 'shade') return { ...g, shade: c.to };
      if (c.kind === 'shape') return { ...g, shape: c.to, rot: shapeInfo(c.to).orientable ? g.rot : 0 };
      if (c.kind === 'rotate') return { ...g, rot: c.to };
      return { ...g, r: c.to };
    }),
  };
}

export function describeChange(before: Figure, c: Change): string {
  if (c.kind === 'add') return `A new ${describeGlyph(c.glyph, { orientation: false })} appeared ${whereIs(c.glyph)}.`;
  const g = before.glyphs[c.index];
  const what = `The ${describeGlyph(g, { orientation: false })} ${whereIs(g)}`;
  switch (c.kind) {
    case 'shade':
      return `${what} became ${['outlined', 'dotted', 'striped', 'solid'][c.to]}.`;
    case 'shape':
      return `${what} turned into ${shapeInfo(c.to).name === 'X' ? 'an X' : `a ${shapeInfo(c.to).name}`}.`;
    case 'rotate':
      return `${what} now points ${directionName(c.to)}.`;
    case 'size':
      return `${what} became ${c.to > g.r ? 'larger' : 'smaller'}.`;
  }
}

/** A random visible change to one glyph (or an added glyph). */
export function randomChange(rng: Rng, f: Figure, kinds: Change['kind'][], freeSpot?: [number, number]): Change | null {
  const kind = rng.pick(kinds);
  if (kind === 'add') {
    if (!freeSpot) return null;
    const shape = rng.pick(SCENE_SHAPES);
    return { kind, glyph: { shape, x: freeSpot[0], y: freeSpot[1], r: f.glyphs[0]?.r ?? 8, rot: shapeInfo(shape).orientable ? rng.int(0, 7) : 0, shade: rng.int(0, 3) } };
  }
  const index = rng.int(0, f.glyphs.length - 1);
  const g = f.glyphs[index];
  switch (kind) {
    case 'shade':
      return { kind, index, to: rng.pick([0, 1, 2, 3].filter((s) => s !== g.shade)) };
    case 'shape':
      return { kind, index, to: rng.pick(SCENE_SHAPES.filter((s) => s !== g.shape && !shapeInfo(s).orientable)) };
    case 'rotate':
      if (!shapeInfo(g.shape).orientable) return null;
      return { kind, index, to: rng.pick([0, 2, 4, 6].filter((r) => r !== g.rot)) };
    case 'size':
      return { kind, index, to: g.r >= 9 ? g.r - 3 : g.r + 3 };
  }
}

