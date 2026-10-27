/**
 * Composable attribute model for abstract visual panels.
 *
 * A panel is described by integer attribute values (shape index, shading,
 * size, rotation, count, position mask …) inside a layout. Rules act on one
 * attribute at a time; several rules on different attributes interact to form
 * a puzzle. Because the answer is computed from these values and every
 * attribute is checked against a library of rival hypotheses, the visual
 * answer is always derived from the governing rule rather than invented.
 */
import type { Figure, Glyph, ShapeKind } from '../types';
import type { Rng } from '../rng';
import { listJoin, mod, range } from '../util';
import { SHADE_NAMES, SIZE_NAMES, directionName, shapeInfo, sizeRadius } from './shapes';

export type AttrName = 'shape' | 'shade' | 'size' | 'rot' | 'count' | 'mask' | 'inner' | 'innerShade' | 'orbit';
export type LayoutId = 'single' | 'count' | 'grid' | 'nested' | 'orbit';
export type Values = Partial<Record<AttrName, number>>;

export interface PanelCtx {
  layout: LayoutId;
  shapes: ShapeKind[];
  /** Shapes are ordered by number of sides, so "shape" behaves like an ordinal value. */
  sidesOrdinal: boolean;
  innerShapes: ShapeKind[];
}

export interface AttrDef {
  name: AttrName;
  label: string;
  min: number;
  max: number;
  cyclic: boolean;
  ordinal: boolean;
  arithmetic: boolean;
  setValued: boolean;
  describe(v: number): string;
}

const POSITION_NAMES = ['top-left', 'top-centre', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-centre', 'bottom-right'];

export function maskPositions(mask: number): number[] {
  return range(9).filter((i) => (mask >> i) & 1);
}

export function describeMask(mask: number): string {
  const pos = maskPositions(mask);
  if (pos.length === 0) return 'an empty grid';
  return `${listJoin(pos.map((p) => POSITION_NAMES[p]))} filled`;
}

export function attrDef(name: AttrName, ctx: PanelCtx): AttrDef {
  switch (name) {
    case 'shape':
      return {
        name,
        label: ctx.layout === 'nested' ? 'outer shape' : 'shape',
        min: 0,
        max: ctx.shapes.length - 1,
        cyclic: false,
        ordinal: ctx.sidesOrdinal,
        arithmetic: false,
        setValued: false,
        describe: (v) => {
          const info = shapeInfo(ctx.shapes[v]);
          return ctx.sidesOrdinal ? `${info.name} (${info.sides} sides)` : info.name;
        },
      };
    case 'inner':
      return {
        name,
        label: 'inner shape',
        min: 0,
        max: ctx.innerShapes.length - 1,
        cyclic: false,
        ordinal: false,
        arithmetic: false,
        setValued: false,
        describe: (v) => shapeInfo(ctx.innerShapes[v]).name,
      };
    case 'shade':
    case 'innerShade':
      return {
        name,
        label: name === 'shade' ? 'shading' : 'inner shading',
        min: 0,
        max: 3,
        cyclic: false,
        ordinal: true,
        arithmetic: false,
        setValued: false,
        describe: (v) => SHADE_NAMES[v],
      };
    case 'size':
      return {
        name,
        label: 'size',
        min: 0,
        max: 3,
        cyclic: false,
        ordinal: true,
        arithmetic: false,
        setValued: false,
        describe: (v) => SIZE_NAMES[v],
      };
    case 'rot':
      return {
        name,
        label: 'rotation',
        min: 0,
        max: 7,
        cyclic: true,
        ordinal: true,
        arithmetic: false,
        setValued: false,
        describe: (v) =>
          ctx.shapes.every((s) => shapeInfo(s).achiral) ? `pointing ${directionName(v)}` : `turned ${mod(v, 8) * 45}°`,
      };
    case 'orbit':
      return {
        name,
        label: 'dot position',
        min: 0,
        max: 7,
        cyclic: true,
        ordinal: true,
        arithmetic: false,
        setValued: false,
        describe: (v) => `dot at the ${directionName(v)} position`,
      };
    case 'count':
      return {
        name,
        label: 'number of shapes',
        min: 1,
        max: 9,
        cyclic: false,
        ordinal: true,
        arithmetic: true,
        setValued: false,
        describe: (v) => `${v}`,
      };
    case 'mask':
      return {
        name,
        label: 'pattern',
        min: 1,
        max: 511,
        cyclic: false,
        ordinal: false,
        arithmetic: false,
        setValued: true,
        describe: describeMask,
      };
  }
}

export const LAYOUT_ATTRS: Record<LayoutId, AttrName[]> = {
  single: ['shape', 'shade', 'size', 'rot'],
  count: ['count', 'shape', 'shade'],
  grid: ['mask', 'shape', 'shade'],
  nested: ['shape', 'inner', 'innerShade'],
  orbit: ['shape', 'rot', 'shade', 'orbit'],
};

/** Attributes that are visible (rotation only matters for orientable shapes). */
export function relevantAttrs(ctx: PanelCtx): AttrName[] {
  const orientable = ctx.shapes.every((s) => shapeInfo(s).orientable);
  return LAYOUT_ATTRS[ctx.layout].filter((a) => a !== 'rot' || orientable);
}

const COUNT_SLOTS: number[][] = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
  [0, 2, 3, 4, 5, 6, 8],
  [0, 1, 2, 3, 5, 6, 7, 8],
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
];

export function slotXY(i: number): [number, number] {
  return [22 + 28 * (i % 3), 22 + 28 * Math.floor(i / 3)];
}

export function orbitXY(pos: number): [number, number] {
  const a = (mod(pos, 8) * Math.PI) / 4;
  return [Math.round((50 + 38 * Math.sin(a)) * 10) / 10, Math.round((50 - 38 * Math.cos(a)) * 10) / 10];
}

export function renderPanel(values: Values, ctx: PanelCtx): Figure {
  const v = (a: AttrName, d = 0) => values[a] ?? d;
  const shape = ctx.shapes[v('shape')] ?? ctx.shapes[0];
  switch (ctx.layout) {
    case 'single':
      return {
        glyphs: [{ shape, x: 50, y: 50, r: sizeRadius(v('size', 2)), rot: v('rot'), shade: v('shade') }],
      };
    case 'count': {
      const n = v('count', 1);
      return {
        glyphs: COUNT_SLOTS[n].map((slot) => {
          const [x, y] = slotXY(slot);
          return { shape, x, y, r: 10, rot: 0, shade: v('shade') } satisfies Glyph;
        }),
      };
    }
    case 'grid':
      return {
        frame: 'grid3',
        glyphs: maskPositions(v('mask', 1)).map((slot) => {
          const [x, y] = slotXY(slot);
          return { shape, x, y, r: 9, rot: 0, shade: v('shade') } satisfies Glyph;
        }),
      };
    case 'nested':
      return {
        glyphs: [
          { shape, x: 50, y: 52, r: 42, rot: 0, shade: 0 },
          { shape: ctx.innerShapes[v('inner')] ?? ctx.innerShapes[0], x: 50, y: 54, r: 12, rot: 0, shade: v('innerShade') },
        ],
      };
    case 'orbit': {
      const [x, y] = orbitXY(v('orbit'));
      return {
        frame: 'ring8',
        glyphs: [
          { shape, x: 50, y: 50, r: 20, rot: v('rot'), shade: v('shade') },
          { shape: 'circle', x, y, r: 6, rot: 0, shade: 3 },
        ],
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3×3 matrix rules                                                    */
/* ------------------------------------------------------------------ */

export type MatrixRuleKind =
  | 'constant'
  | 'row-constant'
  | 'progression'
  | 'col-progression'
  | 'distribute'
  | 'arith-add'
  | 'arith-sub'
  | 'xor'
  | 'or'
  | 'and';

export interface MatrixRule {
  attr: AttrName;
  kind: MatrixRuleKind;
  step?: number;
  /** Latin-square direction for "distribute". */
  dir?: number;
  values: number[];
}

export function matrixRuleKinds(def: AttrDef): MatrixRuleKind[] {
  const kinds: MatrixRuleKind[] = ['row-constant', 'distribute'];
  if (def.ordinal) kinds.push('progression', 'col-progression');
  if (def.arithmetic) kinds.push('arith-add', 'arith-sub');
  if (def.setValued) return ['distribute', 'xor', 'or', 'and'];
  return kinds;
}

function stepsFor(def: AttrDef): number[] {
  if (def.cyclic) return [1, 2, 3, -1, -2];
  if (def.name === 'count') return [1, 2, -1];
  return [1, -1];
}

function inDomain(v: number, def: AttrDef): boolean {
  return def.cyclic || (v >= def.min && v <= def.max);
}

function norm(v: number, def: AttrDef): number {
  return def.cyclic ? mod(v, def.max + 1) : v;
}

function randomMask(rng: Rng, minBits: number, maxBits: number): number {
  const bits = rng.int(minBits, maxBits);
  return rng.sample(range(9), bits).reduce((m, b) => m | (1 << b), 0);
}

/** Build the 9 values of a rule; returns null if the random parameters do not fit. */
export function buildMatrixRule(kind: MatrixRuleKind, def: AttrDef, rng: Rng): MatrixRule | null {
  const domain = range(def.max - def.min + 1, def.min);
  const vals = new Array<number>(9).fill(0);
  const set = (r: number, c: number, v: number) => (vals[r * 3 + c] = v);
  switch (kind) {
    case 'constant': {
      const v = def.setValued ? randomMask(rng, 2, 4) : rng.pick(domain);
      vals.fill(v);
      return { attr: def.name, kind, values: vals };
    }
    case 'row-constant': {
      const rows = def.setValued ? [randomMask(rng, 2, 4), randomMask(rng, 2, 4), randomMask(rng, 2, 4)] : rng.sample(domain, 3);
      if (new Set(rows).size < 3) return null;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) set(r, c, rows[r]);
      return { attr: def.name, kind, values: vals };
    }
    case 'progression':
    case 'col-progression': {
      const step = rng.pick(stepsFor(def));
      for (let line = 0; line < 3; line++) {
        const starts = domain.filter((s) => inDomain(s + 2 * step, def) && inDomain(s, def));
        if (starts.length === 0) return null;
        const s = rng.pick(starts);
        for (let k = 0; k < 3; k++) {
          const v = norm(s + k * step, def);
          if (kind === 'progression') set(line, k, v);
          else set(k, line, v);
        }
      }
      // Avoid all three lines being identical when that would make it look constant per column/row.
      return { attr: def.name, kind, step, values: vals };
    }
    case 'distribute': {
      const three = def.setValued ? [randomMask(rng, 2, 4), randomMask(rng, 2, 4), randomMask(rng, 2, 4)] : rng.sample(domain, 3);
      if (new Set(three).size < 3) return null;
      const dir = rng.pick([1, -1]);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) set(r, c, three[mod(c + dir * r, 3)]);
      return { attr: def.name, kind, dir, values: vals };
    }
    case 'arith-add':
    case 'arith-sub': {
      for (let r = 0; r < 3; r++) {
        let a: number;
        let b: number;
        if (kind === 'arith-add') {
          a = rng.int(1, 5);
          b = rng.int(1, Math.min(5, 9 - a));
          set(r, 2, a + b);
        } else {
          a = rng.int(3, 9);
          b = rng.int(1, a - 1);
          set(r, 2, a - b);
        }
        set(r, 0, a);
        set(r, 1, b);
      }
      return { attr: def.name, kind, values: vals };
    }
    case 'xor':
    case 'or':
    case 'and': {
      for (let r = 0; r < 3; r++) {
        const a = randomMask(rng, 2, 5);
        const b = randomMask(rng, 2, 5);
        const c = kind === 'xor' ? a ^ b : kind === 'or' ? a | b : a & b;
        if (c === 0 || a === b || c === a || c === b) return null;
        set(r, 0, a);
        set(r, 1, b);
        set(r, 2, c);
      }
      return { attr: def.name, kind, values: vals };
    }
  }
}

/**
 * Every value that any hypothesis from the rule library predicts for the
 * missing bottom-right cell, given the other eight values.
 */
export function inferMatrixCell(vals: readonly number[], def: AttrDef): Set<number> {
  const out = new Set<number>();
  const v = (r: number, c: number) => vals[r * 3 + c];
  const rowOf = (r: number) => [v(r, 0), v(r, 1), v(r, 2)];
  const colOf = (c: number) => [v(0, c), v(1, c), v(2, c)];
  const lines = (byRow: boolean) => (byRow ? [rowOf(0), rowOf(1)] : [colOf(0), colOf(1)]);
  const lastKnown = (byRow: boolean) => (byRow ? [v(2, 0), v(2, 1)] : [v(0, 2), v(1, 2)]);

  for (const byRow of [true, false]) {
    const full = lines(byRow);
    const [a, b] = lastKnown(byRow);
    // constant within the line
    if (full.every((l) => l[0] === l[1] && l[1] === l[2]) && a === b) out.add(a);
    // distribute three
    const s0 = new Set(full[0]);
    if (s0.size === 3 && full[1].every((x) => s0.has(x)) && new Set(full[1]).size === 3 && a !== b && s0.has(a) && s0.has(b)) {
      for (const x of s0) if (x !== a && x !== b) out.add(x);
    }
    if (def.ordinal) {
      const diff = (x: number, y: number) => (def.cyclic ? mod(y - x, def.max + 1) : y - x);
      const k = diff(full[0][0], full[0][1]);
      const consistent = full.every((l) => diff(l[0], l[1]) === k && diff(l[1], l[2]) === k) && diff(a, b) === k;
      if (consistent) {
        const p = norm(b + k, def);
        if (inDomain(p, def)) out.add(p);
      }
    }
    if (def.arithmetic) {
      if (full.every((l) => l[0] + l[1] === l[2]) && inDomain(a + b, def)) out.add(a + b);
      if (full.every((l) => l[0] - l[1] === l[2]) && inDomain(a - b, def)) out.add(a - b);
    }
    if (def.setValued) {
      if (full.every((l) => (l[0] ^ l[1]) === l[2])) out.add(a ^ b);
      if (full.every((l) => (l[0] | l[1]) === l[2])) out.add(a | b);
      if (full.every((l) => (l[0] & l[1]) === l[2])) out.add(a & b);
    }
  }
  return out;
}

/** Plausible wrong values for the missing cell (copying, overshooting, wrong operation …). */
export function matrixAlternatives(rule: MatrixRule, def: AttrDef, rng: Rng): number[] {
  const v = rule.values;
  const correct = v[8];
  const cands: number[] = [];
  const add = (x: number) => {
    const n = norm(x, def);
    if (inDomain(n, def) && n !== correct && (def.setValued ? n > 0 : true) && !cands.includes(n)) cands.push(n);
  };
  switch (rule.kind) {
    case 'progression':
    case 'col-progression':
      add(correct + (rule.step ?? 1));
      add(v[7]);
      add(v[5]);
      add(correct - 2 * (rule.step ?? 1));
      break;
    case 'distribute':
      add(v[7]);
      add(v[6]);
      add(v[5]);
      break;
    case 'row-constant':
      add(v[5]);
      add(v[2]);
      break;
    case 'arith-add':
      add(v[6] - v[7]);
      add(correct + 1);
      add(correct - 1);
      break;
    case 'arith-sub':
      add(v[6] + v[7]);
      add(correct + 1);
      add(correct - 1);
      break;
    case 'xor':
      add(v[6] | v[7]);
      add(v[6] & v[7]);
      add(correct ^ (1 << rng.int(0, 8)));
      break;
    case 'or':
      add(v[6] ^ v[7]);
      add(v[6] & v[7]);
      add(correct ^ (1 << rng.int(0, 8)));
      break;
    case 'and':
      add(v[6] | v[7]);
      add(v[6] ^ v[7]);
      add(correct ^ (1 << rng.int(0, 8)));
      break;
    case 'constant':
      break;
  }
  if (def.setValued) {
    for (let i = 0; i < 4; i++) add(correct ^ (1 << rng.int(0, 8)));
  } else {
    for (const x of rng.shuffle(range(def.max - def.min + 1, def.min))) add(x);
  }
  return cands;
}

function stepWords(def: AttrDef, step: number): string {
  if (def.name === 'rot') return `${Math.abs(step) * 45}° ${step > 0 ? 'clockwise' : 'anticlockwise'}`;
  if (def.name === 'orbit') return `${Math.abs(step)} position${Math.abs(step) > 1 ? 's' : ''} ${step > 0 ? 'clockwise' : 'anticlockwise'}`;
  if (def.name === 'shade' || def.name === 'innerShade')
    return step > 0 ? `${Math.abs(step)} step${Math.abs(step) > 1 ? 's' : ''} darker (outlined → dotted → striped → solid)` : `${Math.abs(step)} step${Math.abs(step) > 1 ? 's' : ''} lighter (solid → striped → dotted → outlined)`;
  if (def.name === 'size') return step > 0 ? 'one size larger' : 'one size smaller';
  if (def.name === 'shape') return step > 0 ? `one more side` : `one fewer side`;
  return `${step > 0 ? '+' : '−'}${Math.abs(step)}`;
}

export function describeMatrixRule(rule: MatrixRule, def: AttrDef): string {
  const L = def.label;
  const vals = rule.values;
  switch (rule.kind) {
    case 'constant':
      return `The ${L} never changes: every panel shows ${def.describe(vals[0])}.`;
    case 'row-constant':
      return `The ${L} is the same within each row but differs between rows (top: ${def.describe(vals[0])}, middle: ${def.describe(vals[3])}, bottom: ${def.describe(vals[6])}).`;
    case 'progression':
      return `Moving left to right along every row, the ${L} changes by the same step: ${stepWords(def, rule.step ?? 1)} each time.`;
    case 'col-progression':
      return `Moving down every column, the ${L} changes by the same step: ${stepWords(def, rule.step ?? 1)} each time.`;
    case 'distribute': {
      const three = [vals[0], vals[1], vals[2]].map((x) => def.describe(x));
      return `Each row (and each column) contains ${listJoin(three)} exactly once for the ${L}; the order shifts by one place from row to row.`;
    }
    case 'arith-add':
      return `In every row, the ${L} in the third panel equals the first panel's plus the second panel's.`;
    case 'arith-sub':
      return `In every row, the ${L} in the third panel equals the first panel's minus the second panel's.`;
    case 'xor':
      return 'In every row, a position is filled in the third panel only if it is filled in exactly one of the first two panels — positions filled in both cancel out.';
    case 'or':
      return 'In every row, the third panel combines the first two: a position is filled if it is filled in either of them.';
    case 'and':
      return 'In every row, the third panel keeps only the positions that are filled in both of the first two panels.';
  }
}

export function ruleHintPhrase(kind: MatrixRuleKind | SeqRuleKind, label: string): string {
  switch (kind) {
    case 'constant':
      return `the ${label} may simply stay fixed`;
    case 'row-constant':
      return `compare the ${label} within a row with the ${label} between rows`;
    case 'progression':
    case 'col-progression':
      return `the ${label} changes by a steady amount from panel to panel`;
    case 'distribute':
      return `the same three ${label} values reappear in every row, each used once`;
    case 'arith-add':
    case 'arith-sub':
      return `the ${label} in the third panel is calculated from the first two`;
    case 'xor':
    case 'or':
    case 'and':
      return `the third panel's ${label} combine the first two panels like overlaying transparencies`;
    case 'alternate':
      return `the ${label} switches back and forth`;
    case 'cycle3':
      return `the ${label} repeats in a cycle of three`;
    case 'march':
      return `the ${label} move around the outer ring of the grid`;
  }
}

/* ------------------------------------------------------------------ */
/* Sequence rules                                                      */
/* ------------------------------------------------------------------ */

export type SeqRuleKind = 'constant' | 'progression' | 'alternate' | 'cycle3' | 'march';

export interface SeqRule {
  attr: AttrName;
  kind: SeqRuleKind;
  step?: number;
  values: number[];
}

const PERIMETER = [0, 1, 2, 5, 8, 7, 6, 3];

/** Move every filled outer position `k` steps clockwise around the 3×3 grid (centre stays). */
export function marchMask(mask: number, k: number): number {
  let out = mask & (1 << 4);
  PERIMETER.forEach((pos, i) => {
    if ((mask >> pos) & 1) out |= 1 << PERIMETER[mod(i + k, 8)];
  });
  return out;
}

export function seqRuleKinds(def: AttrDef): SeqRuleKind[] {
  if (def.setValued) return ['march', 'alternate'];
  const kinds: SeqRuleKind[] = ['alternate', 'cycle3'];
  if (def.ordinal) kinds.push('progression');
  return kinds;
}

export function buildSeqRule(kind: SeqRuleKind, def: AttrDef, rng: Rng, length: number): SeqRule | null {
  const domain = range(def.max - def.min + 1, def.min);
  const vals: number[] = [];
  switch (kind) {
    case 'constant': {
      const v = def.setValued ? randomMask(rng, 2, 3) : rng.pick(domain);
      for (let i = 0; i < length; i++) vals.push(v);
      return { attr: def.name, kind, values: vals };
    }
    case 'progression': {
      const step = rng.pick(stepsFor(def));
      const starts = domain.filter((s) => inDomain(s + (length - 1) * step, def));
      if (starts.length === 0) return null;
      const s = rng.pick(starts);
      for (let i = 0; i < length; i++) vals.push(norm(s + i * step, def));
      return { attr: def.name, kind, step, values: vals };
    }
    case 'alternate': {
      const pair = def.setValued ? [randomMask(rng, 2, 4), randomMask(rng, 2, 4)] : rng.sample(domain, 2);
      if (pair[0] === pair[1]) return null;
      for (let i = 0; i < length; i++) vals.push(pair[i % 2]);
      return { attr: def.name, kind, values: vals };
    }
    case 'cycle3': {
      const three = rng.sample(domain, 3);
      if (three.length < 3) return null;
      for (let i = 0; i < length; i++) vals.push(three[i % 3]);
      return { attr: def.name, kind, values: vals };
    }
    case 'march': {
      const step = rng.pick([1, 1, 2, -1]);
      let m = randomMask(rng, 2, 3) & ~(1 << 4);
      if (m === 0 || marchMask(m, step) === m || marchMask(m, 2 * step) === m) return null;
      for (let i = 0; i < length; i++) {
        vals.push(m);
        m = marchMask(m, step);
      }
      return { attr: def.name, kind, step, values: vals };
    }
  }
}

/** Predictions for the unknown position `missing` from every consistent sequence hypothesis. */
export function inferSequenceValue(vals: readonly (number | null)[], missing: number, def: AttrDef): Set<number> {
  const out = new Set<number>();
  const n = vals.length;
  const known = range(n).filter((i) => i !== missing);
  const at = (i: number) => vals[i] as number;
  // constant
  if (known.every((i) => at(i) === at(known[0]))) out.add(at(known[0]));
  // periodic with period 2, 3, 4
  for (const p of [2, 3, 4]) {
    // A cycle only counts as a hypothesis once at least one repetition is visible.
    const witnessed = known.some((i) => known.some((j) => j > i && (j - i) % p === 0));
    if (!witnessed) continue;
    const ok = known.every((i) => known.every((j) => (i % p === j % p ? at(i) === at(j) : true)));
    const anchor = known.find((i) => i % p === missing % p);
    if (ok && anchor !== undefined) out.add(at(anchor));
  }
  if (def.ordinal) {
    // arithmetic progression (cyclic when the attribute wraps)
    const size = def.max + 1;
    const i0 = known[0];
    const i1 = known[1];
    const span = i1 - i0;
    for (let k = -(def.cyclic ? size : def.max); k <= (def.cyclic ? size : def.max); k++) {
      if (def.cyclic && (k <= -size / 2 || k > size / 2)) continue;
      const predicted = (i: number) => (def.cyclic ? mod(at(i0) + (i - i0) * k, size) : at(i0) + (i - i0) * k);
      if (span !== 0 && known.every((i) => predicted(i) === at(i))) {
        const p = predicted(missing);
        if (inDomain(p, def)) out.add(p);
      }
    }
  }
  if (def.setValued) {
    for (let k = -3; k <= 4; k++) {
      if (k === 0) continue;
      // values must be consistent with marching k per step
      const base = at(known[0]);
      const ok = known.every((i) => marchMask(base, k * (i - known[0])) === at(i));
      if (ok) out.add(marchMask(base, k * (missing - known[0])));
    }
  }
  return out;
}

export function seqAlternatives(rule: SeqRule, missing: number, def: AttrDef, rng: Rng): number[] {
  const v = rule.values;
  const correct = v[missing];
  const cands: number[] = [];
  const add = (x: number) => {
    const n = norm(x, def);
    if (inDomain(n, def) && n !== correct && (def.setValued ? n > 0 : true) && !cands.includes(n)) cands.push(n);
  };
  const prev = missing > 0 ? v[missing - 1] : v[missing + 1];
  switch (rule.kind) {
    case 'progression':
      add(correct + (rule.step ?? 1));
      add(prev);
      add(correct - 2 * (rule.step ?? 1));
      break;
    case 'alternate':
      add(prev);
      break;
    case 'cycle3':
      add(prev);
      add(v[(missing + 1) % v.length]);
      break;
    case 'march':
      add(marchMask(correct, rule.step ?? 1));
      add(marchMask(correct, -(rule.step ?? 1)));
      add(prev);
      break;
    case 'constant':
      break;
  }
  if (def.setValued) for (let i = 0; i < 4; i++) add(correct ^ (1 << PERIMETER[rng.int(0, 7)]));
  else for (const x of rng.shuffle(range(def.max - def.min + 1, def.min))) add(x);
  return cands;
}

export function describeSeqRule(rule: SeqRule, def: AttrDef): string {
  const L = def.label;
  switch (rule.kind) {
    case 'constant':
      return `The ${L} stays the same in every panel (${def.describe(rule.values[0])}).`;
    case 'progression':
      return `The ${L} changes by ${stepWords(def, rule.step ?? 1)} from each panel to the next.`;
    case 'alternate':
      return `The ${L} alternates between ${def.describe(rule.values[0])} and ${def.describe(rule.values[1])}.`;
    case 'cycle3':
      return `The ${L} repeats in a cycle of three: ${listJoin(rule.values.slice(0, 3).map((x) => def.describe(x)))}, then again.`;
    case 'march':
      return `The filled positions travel ${Math.abs(rule.step ?? 1)} step${Math.abs(rule.step ?? 1) > 1 ? 's' : ''} ${(rule.step ?? 1) > 0 ? 'clockwise' : 'anticlockwise'} around the outer ring of the grid each panel.`;
  }
}

/* ------------------------------------------------------------------ */
/* Balanced answer sets                                                */
/* ------------------------------------------------------------------ */

export interface ChoiceCombo {
  values: Values;
  /** Attributes that deviate from the correct answer. */
  wrong: AttrName[];
}

/**
 * Builds answer options in the spirit of balanced "attribute trees": each
 * perturbed attribute takes the correct value in some options and a plausible
 * wrong value in others, so no single attribute gives the answer away by
 * majority vote. Exactly one combination is fully correct.
 */
export function balancedCombos(
  correct: Values,
  perturb: { attr: AttrName; alts: number[] }[],
): ChoiceCombo[] {
  let combos: ChoiceCombo[] = [{ values: { ...correct }, wrong: [] }];
  for (const p of perturb) {
    const next: ChoiceCombo[] = [];
    for (const c of combos) {
      next.push(c);
      for (const alt of p.alts) next.push({ values: { ...c.values, [p.attr]: alt }, wrong: [...c.wrong, p.attr] });
    }
    combos = next;
  }
  return combos;
}
