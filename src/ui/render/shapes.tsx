/**
 * SVG geometry for every glyph shape (radius ≈ 1, centred, pointing up)
 * and the shading patterns. Shading is always encoded twice — a fill pattern
 * and a colour — so it never relies on colour alone.
 */
import { useId } from 'react';
import type { CubeSymbol, Glyph, ShapeKind } from '../../engine/types';

const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join('L')}Z`;

function regular(n: number, r: number, start = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
  });
}

function star(points: number, outer: number, inner: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

const PATHS: Record<ShapeKind, string> = {
  circle: 'M0,-0.9A0.9,0.9 0 1 1 0,0.9A0.9,0.9 0 1 1 0,-0.9Z',
  square: poly([[-0.72, -0.72], [0.72, -0.72], [0.72, 0.72], [-0.72, 0.72]]),
  triangle: poly(regular(3, 1)),
  diamond: poly([[0, -1], [0.62, 0], [0, 1], [-0.62, 0]]),
  pentagon: poly(regular(5, 0.95)),
  hexagon: poly(regular(6, 0.92, 0)),
  star: poly(star(5, 1, 0.45)),
  cross: poly([[-0.3, -0.92], [0.3, -0.92], [0.3, -0.3], [0.92, -0.3], [0.92, 0.3], [0.3, 0.3], [0.3, 0.92], [-0.3, 0.92], [-0.3, 0.3], [-0.92, 0.3], [-0.92, -0.3], [-0.3, -0.3]]),
  heart: 'M0,0.85C-0.95,0.15 -0.95,-0.75 -0.42,-0.75C-0.15,-0.75 0,-0.5 0,-0.35C0,-0.5 0.15,-0.75 0.42,-0.75C0.95,-0.75 0.95,0.15 0,0.85Z',
  arrow: poly([[0, -1], [0.62, -0.12], [0.22, -0.12], [0.22, 0.95], [-0.22, 0.95], [-0.22, -0.12], [-0.62, -0.12]]),
  semicircle: 'M-0.92,0.38A0.92,0.92 0 0 1 0.92,0.38Z',
  drop: 'M0,-1C0.3,-0.45 0.72,-0.05 0.72,0.3C0.72,0.72 0.38,0.95 0,0.95C-0.38,0.95 -0.72,0.72 -0.72,0.3C-0.72,-0.05 -0.3,-0.45 0,-1Z',
  lshape: poly([[-0.62, -0.95], [-0.15, -0.95], [-0.15, 0.45], [0.7, 0.45], [0.7, 0.92], [-0.62, 0.92]]),
  flag: poly([[-0.6, -0.95], [0.78, -0.55], [-0.38, -0.12], [-0.38, 0.95], [-0.6, 0.95]]),
  ring: 'M0,-0.9A0.9,0.9 0 1 1 0,0.9A0.9,0.9 0 1 1 0,-0.9ZM0,-0.48A0.48,0.48 0 1 0 0,0.48A0.48,0.48 0 1 0 0,-0.48Z',
  xmark: poly([[-0.85, -0.55], [-0.55, -0.85], [0, -0.3], [0.55, -0.85], [0.85, -0.55], [0.3, 0], [0.85, 0.55], [0.55, 0.85], [0, 0.3], [-0.55, 0.85], [-0.85, 0.55], [-0.3, 0]]),
  star4: poly(star(4, 1, 0.36)),
  dots4: [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, y]) => `M${x},${y - 0.3}A0.3,0.3 0 1 1 ${x},${y + 0.3}A0.3,0.3 0 1 1 ${x},${y - 0.3}Z`).join(''),
};

export function shapePath(kind: ShapeKind): string {
  return PATHS[kind];
}

/** Shade colours, also exposed as CSS variables in the stylesheet. */
export const SHADE_COLORS = ['var(--shade-0)', 'var(--shade-1)', 'var(--shade-2)', 'var(--shade-3)'];

/**
 * <defs> with the dotted and striped patterns for one SVG. Glyph paths are
 * unit-sized and scaled by a transform, so the patterns are sized relative to
 * each shape's bounding box; user-space units would be scaled up with the
 * glyph and turn the stripes into one big half-fill.
 */
export function ShadeDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-dots`} width="0.2" height="0.2" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox">
        <circle cx="0.1" cy="0.1" r="0.045" fill="var(--shade-1)" />
      </pattern>
      <pattern id={`${id}-stripes`} width="0.16" height="0.16" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" patternTransform="rotate(45)">
        <rect width="0.07" height="0.16" fill="var(--shade-2)" />
      </pattern>
    </defs>
  );
}

export function shadeFill(id: string, shade: number): string {
  switch (shade) {
    case 1:
      return `url(#${id}-dots)`;
    case 2:
      return `url(#${id}-stripes)`;
    case 3:
      return 'var(--shade-3)';
    default:
      return 'var(--panel-ink)';
  }
}

export function GlyphShape({ g, defsId, onClick, selected, label }: { g: Glyph; defsId: string; onClick?: () => void; selected?: boolean; label?: string }) {
  const transform = `translate(${g.x} ${g.y}) rotate(${(g.rot % 8) * 45}) scale(${g.mirror ? -g.r : g.r} ${g.r})`;
  const stroke = SHADE_COLORS[g.shade] ?? SHADE_COLORS[0];
  const interactive = !!onClick;
  // The fill pattern lives in the glyph's local space, so turning or flipping
  // the glyph would turn its stripes too. Counter-rotate them so stripes always
  // run at the same screen angle and never look like a separate attribute.
  const localId = `st${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const turn = (g.rot % 8) * 45;
  const stripeAngle = g.mirror ? 135 + turn : 45 - turn;
  const ownStripes = g.shade === 2 && (turn !== 0 || g.mirror);
  return (
    <g
      className={interactive ? `glyph-hit${selected ? ' is-selected' : ''}` : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      aria-pressed={interactive ? !!selected : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {interactive && <circle cx={g.x} cy={g.y} r={g.r + 4} className="glyph-target" />}
      {ownStripes && (
        <defs>
          <pattern id={localId} width="0.16" height="0.16" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" patternTransform={`rotate(${stripeAngle})`}>
            <rect width="0.07" height="0.16" fill="var(--shade-2)" />
          </pattern>
        </defs>
      )}
      <path d={PATHS[g.shape]} transform={transform} fill={ownStripes ? `url(#${localId})` : shadeFill(defsId, g.shade)} fillRule="evenodd" stroke={stroke} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {(g.highlight || selected) && <circle cx={g.x} cy={g.y} r={g.r + 4.5} className={selected ? 'glyph-selected-ring' : 'glyph-highlight'} />}
    </g>
  );
}

const CUBE_SHAPE: Record<CubeSymbol, ShapeKind> = {
  circle: 'circle',
  ring: 'ring',
  cross: 'cross',
  xmark: 'xmark',
  square: 'square',
  diamond: 'diamond',
  dots4: 'dots4',
  star4: 'star4',
};

export function cubeSymbolShape(s: CubeSymbol): ShapeKind {
  return CUBE_SHAPE[s];
}
