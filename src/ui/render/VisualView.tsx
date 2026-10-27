/** Renders every Visual kind as accessible inline SVG (no external images). */
import { useId } from 'react';
import type { CubeSymbol, Figure, Visual } from '../../engine/types';
import { DIGIT_SEGMENTS } from '../../engine/generators/riddle/matchsticks';
import { GlyphShape, ShadeDefs, cubeSymbolShape, shapePath } from './shapes';
import { describeGlyph } from '../../engine/visual/shapes';

export type VisualSize = 'xs' | 'sm' | 'md' | 'lg';

function useSvgId() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function describeFigure(f: Figure): string {
  if (!f.glyphs.length) return 'empty panel';
  return f.glyphs.map((g) => describeGlyph(g, { orientation: true })).join(', ');
}

export function FigureView({ figure, size = 'md', onGlyph, selected, label }: { figure: Figure; size?: VisualSize; onGlyph?: (i: number) => void; selected?: number[]; label?: string }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 100 100" className={`viz viz-${size}`} role={onGlyph ? 'group' : 'img'} aria-label={label ?? describeFigure(figure)}>
      <ShadeDefs id={id} />
      <rect x="1" y="1" width="98" height="98" rx="8" className="viz-bg" />
      {figure.frame === 'grid3' && <GridLines n={3} />}
      {figure.frame === 'grid4' && <GridLines n={4} />}
      {figure.frame === 'ring8' && (
        <g className="viz-faint">
          <circle cx="50" cy="50" r="38" fill="none" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <circle key={i} cx={50 + 38 * Math.sin(a)} cy={50 - 38 * Math.cos(a)} r="1.6" />;
          })}
        </g>
      )}
      {figure.lines?.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={l.dashed ? 'viz-line-dashed' : 'viz-line'} />
      ))}
      {figure.glyphs.map((g, i) => (
        <GlyphShape
          key={i}
          g={g}
          defsId={id}
          onClick={onGlyph ? () => onGlyph(i) : undefined}
          selected={selected?.includes(i)}
          label={onGlyph ? `${describeGlyph(g, { orientation: true })} at ${Math.round(g.x)}, ${Math.round(g.y)}` : undefined}
        />
      ))}
    </svg>
  );
}

function GridLines({ n }: { n: number }) {
  const lines = [];
  for (let i = 1; i < n; i++) {
    const p = (i * 100) / n;
    lines.push(<line key={`v${i}`} x1={p} y1="4" x2={p} y2="96" />, <line key={`h${i}`} x1="4" y1={p} x2="96" y2={p} />);
  }
  return <g className="viz-faint">{lines}</g>;
}

function CellsView({ v, size }: { v: Extract<Visual, { kind: 'cells' }>; size: VisualSize }) {
  const s = 20;
  const pad = 4;
  const side = v.frame ? Math.max(v.frame, v.w, v.h) : 0;
  const W = (side || v.w) * s + pad * 2;
  const H = (side || v.h) * s + pad * 2;
  const ox = side ? ((side - v.w) * s) / 2 : 0;
  const oy = side ? ((side - v.h) * s) / 2 : 0;
  const label = v.layers.map((l) => `${l.cells.length} ${l.style} squares`).join(', ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`viz viz-${size} viz-cells`} role="img" aria-label={`Grid shape: ${label}`}>
      {v.layers.map((layer, li) =>
        layer.cells.map(([x, y], i) =>
          // Outline cells share their edges, so the figure reads as one ruled grid
          // (needed when counting rectangles that span several cells).
          layer.style === 'outline' ? (
            <rect key={`${li}-${i}`} x={pad + ox + x * s} y={pad + oy + y * s} width={s} height={s} className="cell cell-outline" />
          ) : (
            <rect key={`${li}-${i}`} x={pad + ox + x * s + 1} y={pad + oy + y * s + 1} width={s - 2} height={s - 2} rx="2.5" className={`cell cell-${layer.style}`} />
          ),
        ),
      )}
      {v.marks?.map((m, i) => (
        <text key={i} x={pad + ox + m.x * s + s / 2} y={pad + oy + m.y * s + s / 2 + 4} textAnchor="middle" className="cell-mark">
          {m.text}
        </text>
      ))}
    </svg>
  );
}

function PaperView({ v, size }: { v: Extract<Visual, { kind: 'paper' }>; size: VisualSize }) {
  const u = 22;
  const pad = 8;
  const S = v.n * u + pad * 2;
  const P = (x: number) => pad + x * u;
  const markerId = `arrow-${useSvgId()}`;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={`viz viz-${size}`} role="img" aria-label={`Paper ${v.holes.length ? `with ${v.holes.length} hole${v.holes.length > 1 ? 's' : ''}` : ''}${v.foldLine ? ', with a fold line' : ''}`}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10Z" className="paper-arrowhead" />
        </marker>
      </defs>
      {v.ghost && <rect x={P(0)} y={P(0)} width={v.n * u} height={v.n * u} className="paper-ghost" />}
      <polygon points={v.region.map(([x, y]) => `${P(x)},${P(y)}`).join(' ')} className="paper" />
      {v.foldLine && <line x1={P(v.foldLine[0])} y1={P(v.foldLine[1])} x2={P(v.foldLine[2])} y2={P(v.foldLine[3])} className="paper-fold" />}
      {v.arrow && <line x1={P(v.arrow[0])} y1={P(v.arrow[1])} x2={P(v.arrow[2])} y2={P(v.arrow[3])} className="paper-arrow" markerEnd={`url(#${markerId})`} />}
      {v.holes.map((h, i) => (
        <circle key={i} cx={P(h.x)} cy={P(h.y)} r={u * 0.22} className="paper-hole" />
      ))}
    </svg>
  );
}

function SymbolInBox({ s }: { s: CubeSymbol }) {
  return <path d={shapePath(cubeSymbolShape(s))} transform="translate(0.5 0.5) scale(0.3)" className="cube-symbol" fillRule="evenodd" vectorEffect="non-scaling-stroke" />;
}

const SYMBOL_LABEL: Record<CubeSymbol, string> = { circle: 'disc', ring: 'ring', cross: 'plus', xmark: 'cross', square: 'square', diamond: 'diamond', dots4: 'four dots', star4: 'star' };

function CubeView({ v, size }: { v: Extract<Visual, { kind: 'cube' }>; size: VisualSize }) {
  const faces: { m: string; pts: string; s: CubeSymbol; cls: string }[] = [
    { m: 'matrix(35 -20 35 20 15 30)', pts: '50,10 85,30 50,50 15,30', s: v.top, cls: 'cube-top' },
    { m: 'matrix(35 20 0 40 15 30)', pts: '15,30 50,50 50,90 15,70', s: v.left, cls: 'cube-left' },
    { m: 'matrix(35 -20 0 40 50 50)', pts: '50,50 85,30 85,70 50,90', s: v.right, cls: 'cube-right' },
  ];
  return (
    <svg viewBox="0 0 100 100" className={`viz viz-${size}`} role="img" aria-label={`Cube showing ${SYMBOL_LABEL[v.top]} on top, ${SYMBOL_LABEL[v.left]} on the left face and ${SYMBOL_LABEL[v.right]} on the right face`}>
      {faces.map((f) => (
        <g key={f.cls}>
          <polygon points={f.pts} className={`cube-face ${f.cls}`} />
          <g transform={f.m}>
            <SymbolInBox s={f.s} />
          </g>
        </g>
      ))}
    </svg>
  );
}

function NetView({ v, size }: { v: Extract<Visual, { kind: 'net' }>; size: VisualSize }) {
  const u = 24;
  const maxX = Math.max(...v.cells.map((c) => c.x)) + 1;
  const maxY = Math.max(...v.cells.map((c) => c.y)) + 1;
  return (
    <svg viewBox={`-2 -2 ${maxX * u + 4} ${maxY * u + 4}`} className={`viz viz-${size} viz-net`} role="img" aria-label={`Cube net with ${v.cells.map((c) => SYMBOL_LABEL[c.symbol]).join(', ')}`}>
      {v.cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x * u} y={c.y * u} width={u} height={u} className="net-cell" />
          <g transform={`matrix(${u} 0 0 ${u} ${c.x * u} ${c.y * u})`}>
            <SymbolInBox s={c.symbol} />
          </g>
        </g>
      ))}
    </svg>
  );
}

function TokensView({ v, size }: { v: Extract<Visual, { kind: 'tokens' }>; size: VisualSize }) {
  const w = 22;
  const total = v.tokens.length * w + 4;
  return (
    <svg viewBox={`0 0 ${Math.max(total, 30)} 26`} className={`viz-tokens viz-tokens-${size}`} role="img" aria-label={v.style === 'letter' ? v.tokens.join(' ') : v.tokens.join(', ')}>
      {v.tokens.map((t, i) => (
        <g key={i} transform={`translate(${2 + i * w} 2)`}>
          <rect width={w - 3} height="22" rx="4" className="token-box" />
          {v.style === 'letter' ? (
            <text x={(w - 3) / 2} y="16" textAnchor="middle" className="token-letter">
              {t}
            </text>
          ) : (
            <path d={shapePath(t as never)} transform={`translate(${(w - 3) / 2} 11) scale(6.5)`} className={`token-glyph token-${t}`} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
          )}
        </g>
      ))}
    </svg>
  );
}

const SEG_GEOM: Record<string, [number, number, number, number]> = {
  a: [4, 2, 22, 2],
  b: [24, 4, 24, 23],
  c: [24, 29, 24, 48],
  d: [4, 50, 22, 50],
  e: [2, 29, 2, 48],
  f: [2, 4, 2, 23],
  g: [4, 26, 22, 26],
};

function MatchView({ v, size }: { v: Extract<Visual, { kind: 'matchsticks' }>; size: VisualSize }) {
  const cw = 34;
  return (
    <svg viewBox={`-4 -4 ${v.text.length * cw + 4} 62`} className={`viz-match viz-match-${size}`} role="img" aria-label={`Matchstick equation ${v.text.replace('-', ' minus ').replace('+', ' plus ').replace('=', ' equals ')}`}>
      {v.text.split('').map((ch, i) => {
        const x0 = i * cw;
        if (ch === '=')
          return (
            <g key={i} transform={`translate(${x0} 0)`}>
              <Stick x1={5} y1={20} x2={22} y2={20} />
              <Stick x1={5} y1={32} x2={22} y2={32} />
            </g>
          );
        if (ch === '+' || ch === '-')
          return (
            <g key={i} transform={`translate(${x0} 0)`}>
              <Stick x1={4} y1={26} x2={23} y2={26} />
              {ch === '+' && <Stick x1={13.5} y1={16} x2={13.5} y2={36} />}
            </g>
          );
        const segs = DIGIT_SEGMENTS[ch] ?? '';
        return (
          <g key={i} transform={`translate(${x0} 0)`}>
            {segs.split('').map((s) => {
              const [x1, y1, x2, y2] = SEG_GEOM[s];
              return <Stick key={s} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function Stick({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="stick" />
      <circle cx={x1} cy={y1} r="2.4" className="stick-head" />
    </g>
  );
}

function NumTriangle({ v, size }: { v: Extract<Visual, { kind: 'num-triangle' }>; size: VisualSize }) {
  return (
    <svg viewBox="0 0 100 92" className={`viz viz-${size}`} role="img" aria-label={`Triangle with corners ${v.corners.join(', ')} and centre ${v.center}`}>
      <polygon points="50,8 92,84 8,84" className="tri" />
      <text x="50" y="22" textAnchor="middle" className="tri-num">{v.corners[0]}</text>
      <text x="18" y="79" textAnchor="middle" className="tri-num">{v.corners[1]}</text>
      <text x="82" y="79" textAnchor="middle" className="tri-num">{v.corners[2]}</text>
      <text x="50" y="62" textAnchor="middle" className={`tri-center${v.center === '?' ? ' is-q' : ''}`}>{v.center}</text>
    </svg>
  );
}

export function PathGrid({ v, size, onCell, selected }: { v: Extract<Visual, { kind: 'path-grid' }>; size: VisualSize; onCell?: (i: number) => void; selected?: number | null }) {
  const u = 16;
  const off = v.labels ? 12 : 2;
  const W = v.cols * u + off + 2;
  const H = v.rows * u + off + 2;
  const blocked = new Set((v.blocked ?? []).map(([x, y]) => `${x},${y}`));
  const [sx, sy] = v.start;
  const rot = v.facing * 90;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`viz viz-${size}`} role={onCell ? 'group' : 'img'} aria-label="Grid map">
      {v.labels &&
        Array.from({ length: v.cols }, (_, x) => (
          <text key={`c${x}`} x={off + x * u + u / 2} y="9" textAnchor="middle" className="grid-label">
            {String.fromCharCode(65 + x)}
          </text>
        ))}
      {v.labels &&
        Array.from({ length: v.rows }, (_, y) => (
          <text key={`r${y}`} x="5" y={off + y * u + u / 2 + 3} textAnchor="middle" className="grid-label">
            {y + 1}
          </text>
        ))}
      {Array.from({ length: v.rows * v.cols }, (_, i) => {
        const x = i % v.cols;
        const y = Math.floor(i / v.cols);
        const isBlocked = blocked.has(`${x},${y}`);
        const cls = `grid-cell${isBlocked ? ' is-blocked' : ''}${selected === i ? ' is-selected' : ''}${onCell && !isBlocked ? ' is-clickable' : ''}`;
        return (
          <rect
            key={i}
            x={off + x * u + 0.6}
            y={off + y * u + 0.6}
            width={u - 1.2}
            height={u - 1.2}
            rx="2"
            className={cls}
            role={onCell && !isBlocked ? 'button' : undefined}
            tabIndex={onCell && !isBlocked ? 0 : undefined}
            aria-label={onCell ? `Square ${String.fromCharCode(65 + x)}${y + 1}${isBlocked ? ' (pillar)' : ''}` : undefined}
            aria-pressed={onCell ? selected === i : undefined}
            onClick={onCell && !isBlocked ? () => onCell(i) : undefined}
            onKeyDown={
              onCell && !isBlocked
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCell(i);
                    }
                  }
                : undefined
            }
          />
        );
      })}
      {v.path && <polyline points={v.path.map(([x, y]) => `${off + x * u + u / 2},${off + y * u + u / 2}`).join(' ')} className="grid-path" />}
      <g transform={`translate(${off + sx * u + u / 2} ${off + sy * u + u / 2}) rotate(${rot})`} className="grid-start">
        <circle r={u * 0.36} />
        <path d="M0,-5 L4,3 L0,1 L-4,3 Z" className="grid-start-arrow" />
      </g>
      {v.end && <circle cx={off + v.end[0] * u + u / 2} cy={off + v.end[1] * u + u / 2} r={u * 0.3} className="grid-end" />}
    </svg>
  );
}

export function VisualView({ v, size = 'md', label }: { v: Visual; size?: VisualSize; label?: string }) {
  switch (v.kind) {
    case 'figure':
      return <FigureView figure={v.figure} size={size} label={label} />;
    case 'cells':
      return <CellsView v={v} size={size} />;
    case 'paper':
      return <PaperView v={v} size={size} />;
    case 'cube':
      return <CubeView v={v} size={size} />;
    case 'net':
      return <NetView v={v} size={size} />;
    case 'tokens':
      return <TokensView v={v} size={size} />;
    case 'matchsticks':
      return <MatchView v={v} size={size} />;
    case 'num-triangle':
      return <NumTriangle v={v} size={size} />;
    case 'path-grid':
      return <PathGrid v={v} size={size} />;
    case 'text':
      return <div className={`viz-text${v.big ? ' is-big' : ''}`}>{v.text}</div>;
  }
}
