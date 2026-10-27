import type { Rng } from '../../rng';
import type { Difficulty, ShapeKind } from '../../types';
import type { AttrName, LayoutId, PanelCtx, Values } from '../../visual/attributes';
import { attrDef, describeMask } from '../../visual/attributes';
import { ORIENTABLE_SHAPES, PLAIN_SHAPES, SHADE_NAMES, SIDE_SERIES, SIZE_NAMES, directionName, shapeInfo, withArticle } from '../../visual/shapes';
import { mod } from '../../util';

const NEST_OUTER: ShapeKind[] = ['circle', 'square', 'hexagon', 'pentagon', 'diamond', 'triangle'];
const NEST_INNER: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'cross', 'heart', 'diamond'];
const SMALL_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'cross'];

/** Creates the shape palette for a layout. */
export function makePanelCtx(layout: LayoutId, rng: Rng, opts: { orientable?: boolean; sides?: boolean } = {}): PanelCtx {
  switch (layout) {
    case 'single':
      if (opts.sides) return { layout, shapes: SIDE_SERIES.slice(), sidesOrdinal: true, innerShapes: [] };
      if (opts.orientable) return { layout, shapes: rng.sample(ORIENTABLE_SHAPES, 3), sidesOrdinal: false, innerShapes: [] };
      return { layout, shapes: rng.sample(PLAIN_SHAPES, 3), sidesOrdinal: false, innerShapes: [] };
    case 'count':
    case 'grid':
      return { layout, shapes: rng.sample(SMALL_SHAPES, 3), sidesOrdinal: false, innerShapes: [] };
    case 'nested': {
      const outer = rng.sample(NEST_OUTER, 3);
      const inner = rng.sample(NEST_INNER, 3);
      return { layout, shapes: outer, sidesOrdinal: false, innerShapes: inner };
    }
    case 'orbit':
      return { layout, shapes: rng.sample(ORIENTABLE_SHAPES, 3), sidesOrdinal: false, innerShapes: [] };
  }
}

/** Natural-language description of a panel. */
export function describePanel(values: Values, ctx: PanelCtx): string {
  const v = (a: AttrName, d = 0) => values[a] ?? d;
  const shape = shapeInfo(ctx.shapes[v('shape')] ?? ctx.shapes[0]);
  const shade = SHADE_NAMES[v('shade')];
  switch (ctx.layout) {
    case 'single': {
      let s = `${SIZE_NAMES[v('size', 2)]} ${shade} ${shape.name}`;
      if (shape.orientable) s += shape.achiral ? ` pointing ${directionName(v('rot'))}` : ` turned ${mod(v('rot'), 8) * 45}°`;
      return withArticle(s);
    }
    case 'count': {
      const n = v('count', 1);
      return `${n} ${shade} ${n === 1 ? shape.name : shape.plural}`;
    }
    case 'grid':
      return `${shade} ${shape.plural} with ${describeMask(v('mask', 1))}`;
    case 'nested': {
      const inner = shapeInfo(ctx.innerShapes[v('inner')] ?? ctx.innerShapes[0]);
      return `${withArticle(`outlined ${shape.name}`)} containing ${withArticle(`${SHADE_NAMES[v('innerShade')]} ${inner.name}`)}`;
    }
    case 'orbit':
      return `${withArticle(`${shade} ${shape.name}`)} pointing ${directionName(v('rot'))}, with the dot at the ${directionName(v('orbit'))} position`;
  }
}

/** One-line comparison used in "why this option is wrong" text. */
export function describeDeviation(attr: AttrName, wrong: number, correct: number, ctx: PanelCtx): string {
  const def = attrDef(attr, ctx);
  return `its ${def.label} is ${def.describe(wrong)}, but the rule requires ${def.describe(correct)}`;
}

export function choiceCountFor(difficulty: Difficulty): number[] {
  // number of alternative values per perturbed attribute
  switch (difficulty) {
    case 1:
      return [1, 1];
    case 2:
      return [2, 1];
    case 3:
      return [1, 1, 1];
    case 4:
      return [1, 1, 1];
  }
}
