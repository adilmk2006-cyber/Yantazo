import type { Figure, Glyph, ShapeKind } from '../types';
import { mod } from '../util';

/**
 * Geometric metadata for every glyph shape.
 *
 * period:   rotational symmetry measured in 45° steps (1 = looks the same at any angle,
 *           2 = every 90°, 4 = every 180°, 8 = only after a full turn).
 * achiral:  the shape is mirror-symmetric about its vertical axis when unrotated,
 *           so reflecting it is the same as rotating it.
 * orientable: rotation is clearly visible, so rotation rules may use it.
 */
export interface ShapeInfo {
  kind: ShapeKind;
  name: string;
  plural: string;
  period: number;
  achiral: boolean;
  orientable: boolean;
  /** Number of straight sides (0 for curved shapes). */
  sides: number;
}

const INFO: Record<ShapeKind, ShapeInfo> = {
  circle: { kind: 'circle', name: 'circle', plural: 'circles', period: 1, achiral: true, orientable: false, sides: 0 },
  square: { kind: 'square', name: 'square', plural: 'squares', period: 2, achiral: true, orientable: false, sides: 4 },
  triangle: { kind: 'triangle', name: 'triangle', plural: 'triangles', period: 8, achiral: true, orientable: false, sides: 3 },
  diamond: { kind: 'diamond', name: 'diamond', plural: 'diamonds', period: 4, achiral: true, orientable: false, sides: 4 },
  pentagon: { kind: 'pentagon', name: 'pentagon', plural: 'pentagons', period: 8, achiral: true, orientable: false, sides: 5 },
  hexagon: { kind: 'hexagon', name: 'hexagon', plural: 'hexagons', period: 4, achiral: true, orientable: false, sides: 6 },
  star: { kind: 'star', name: 'star', plural: 'stars', period: 8, achiral: true, orientable: false, sides: 10 },
  cross: { kind: 'cross', name: 'cross', plural: 'crosses', period: 2, achiral: true, orientable: false, sides: 12 },
  heart: { kind: 'heart', name: 'heart', plural: 'hearts', period: 8, achiral: true, orientable: false, sides: 0 },
  arrow: { kind: 'arrow', name: 'arrow', plural: 'arrows', period: 8, achiral: true, orientable: true, sides: 7 },
  semicircle: { kind: 'semicircle', name: 'half-disc', plural: 'half-discs', period: 8, achiral: true, orientable: true, sides: 1 },
  drop: { kind: 'drop', name: 'teardrop', plural: 'teardrops', period: 8, achiral: true, orientable: true, sides: 0 },
  lshape: { kind: 'lshape', name: 'L-shape', plural: 'L-shapes', period: 8, achiral: false, orientable: true, sides: 6 },
  flag: { kind: 'flag', name: 'flag', plural: 'flags', period: 8, achiral: false, orientable: true, sides: 5 },
  ring: { kind: 'ring', name: 'ring', plural: 'rings', period: 1, achiral: true, orientable: false, sides: 0 },
  xmark: { kind: 'xmark', name: 'X', plural: 'Xs', period: 2, achiral: true, orientable: false, sides: 12 },
  star4: { kind: 'star4', name: 'four-point star', plural: 'four-point stars', period: 2, achiral: true, orientable: false, sides: 8 },
  dots4: { kind: 'dots4', name: 'four dots', plural: 'four-dot groups', period: 2, achiral: true, orientable: false, sides: 0 },
};

export function shapeInfo(kind: ShapeKind): ShapeInfo {
  return INFO[kind];
}

/** Symmetric, easy to tell apart shapes for nominal rules. */
export const PLAIN_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross', 'heart'];
/** Shapes whose rotation is unambiguous. */
export const ORIENTABLE_SHAPES: ShapeKind[] = ['arrow', 'semicircle', 'drop', 'lshape', 'flag'];
/** Shapes that look different in a mirror (cannot be matched by rotation alone). */
export const CHIRAL_SHAPES: ShapeKind[] = ['lshape', 'flag'];
/** Polygons ordered by number of sides – usable as an ordinal "sides" attribute. */
export const SIDE_SERIES: ShapeKind[] = ['triangle', 'square', 'pentagon', 'hexagon'];

export const SHADE_NAMES = ['outlined', 'dotted', 'striped', 'solid'] as const;
export const SHADE_NOUNS = ['outline only', 'dotted fill', 'striped fill', 'solid fill'] as const;

const SIZE_RADII = [15, 21, 27, 34];
export const SIZE_NAMES = ['small', 'medium', 'large', 'extra-large'] as const;

export function sizeRadius(size: number): number {
  return SIZE_RADII[Math.max(0, Math.min(SIZE_RADII.length - 1, size))];
}

const DIRECTIONS = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left'];

export function directionName(rot: number): string {
  return DIRECTIONS[mod(rot, 8)];
}

export function rotationDegrees(rot: number): number {
  return mod(rot, 8) * 45;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Visual identity of a glyph: two glyphs with the same key look identical. */
export function glyphKey(g: Glyph): string {
  const info = INFO[g.shape];
  const rot = mod(g.rot, info.period);
  const mirror = !info.achiral && g.mirror ? 1 : 0;
  return `${g.shape}:${round1(g.x)},${round1(g.y)}:${round1(g.r)}:${rot}:${mirror}:${g.shade}`;
}

/** Visual identity of a whole figure (order of glyphs does not matter). */
export function figureKey(f: Figure): string {
  const keys = f.glyphs.map(glyphKey).sort();
  const lines = (f.lines ?? [])
    .map((l) => [round1(l.x1), round1(l.y1), round1(l.x2), round1(l.y2), l.dashed ? 1 : 0].join(','))
    .sort();
  return `${f.frame ?? 'none'}|${keys.join(';')}|${lines.join(';')}`;
}

/** Rotate the whole panel clockwise about its centre by `steps` × 45°. */
export function rotateFigure(f: Figure, steps: number): Figure {
  const theta = (mod(steps, 8) * Math.PI) / 4;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotPoint = (x: number, y: number): [number, number] => {
    const dx = x - 50;
    const dy = y - 50;
    return [round1(50 + dx * cos - dy * sin), round1(50 + dx * sin + dy * cos)];
  };
  return {
    ...f,
    glyphs: f.glyphs.map((g) => {
      const [x, y] = rotPoint(g.x, g.y);
      return { ...g, x, y, rot: mod(g.rot + steps, 8) };
    }),
    lines: f.lines?.map((l) => {
      const [x1, y1] = rotPoint(l.x1, l.y1);
      const [x2, y2] = rotPoint(l.x2, l.y2);
      return { ...l, x1, y1, x2, y2 };
    }),
  };
}

/** Reflect the whole panel left↔right. */
export function mirrorFigure(f: Figure): Figure {
  return {
    ...f,
    glyphs: f.glyphs.map((g) => ({ ...g, x: round1(100 - g.x), rot: mod(-g.rot, 8), mirror: !g.mirror })),
    lines: f.lines?.map((l) => ({ ...l, x1: round1(100 - l.x1), x2: round1(100 - l.x2) })),
  };
}

/** Reflect the whole panel top↔bottom (a left↔right mirror followed by a half turn). */
export function flipFigure(f: Figure): Figure {
  return rotateFigure(mirrorFigure(f), 4);
}

export function describeGlyph(g: Glyph, opts: { size?: boolean; orientation?: boolean } = {}): string {
  const info = INFO[g.shape];
  const parts: string[] = [];
  if (opts.size) {
    const idx = SIZE_RADII.indexOf(g.r);
    if (idx >= 0) parts.push(SIZE_NAMES[idx]);
  }
  parts.push(SHADE_NAMES[g.shade] ?? 'plain');
  parts.push(info.name);
  let text = parts.join(' ');
  if (opts.orientation !== false && info.orientable) {
    if (info.achiral) text += ` pointing ${directionName(g.rot)}`;
    else text += `${g.mirror ? ' (mirrored)' : ''} turned ${rotationDegrees(g.rot)}°`;
  }
  return text;
}

/** Article helper: "a striped arrow", "an outlined hexagon". */
export function withArticle(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}
