import type { Block } from '../../engine/types';
import { shapeInfo } from '../../engine/visual/shapes';
import { VisualView } from './VisualView';
import { shapePath } from './shapes';

function QuestionMark({ size = 'md' }: { size?: string }) {
  return (
    <div className={`viz-missing viz-${size}`} role="img" aria-label="missing panel">
      ?
    </div>
  );
}

function EqToken({ t }: { t: string }) {
  if (t.startsWith('sym:')) {
    const shape = t.slice(4);
    return (
      <svg viewBox="-1.2 -1.2 2.4 2.4" className={`eq-sym token-${shape}`} role="img" aria-label={shapeInfo(shape as never).name}>
        <path d={shapePath(shape as never)} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  return <span className={`eq-op${/^\d+$/.test(t) || t === '?' ? ' eq-num' : ''}`}>{t}</span>;
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return <p className={`blk-text tone-${block.tone ?? 'plain'}`}>{block.text}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <div className="blk-list">
          {block.title && <h3 className="blk-title">{block.title}</h3>}
          <Tag>
            {block.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </Tag>
        </div>
      );
    }
    case 'matrix':
      return (
        <div className="blk-matrix" style={{ gridTemplateColumns: `repeat(${block.cols}, minmax(0, 1fr))` }} role="group" aria-label={`${block.cols} by ${Math.ceil(block.cells.length / block.cols)} matrix`}>
          {block.cells.map((c, i) => (
            <div className="matrix-cell" key={i}>
              {c ? <VisualView v={c} size="md" /> : <QuestionMark />}
            </div>
          ))}
        </div>
      );
    case 'sequence':
      return (
        <div className="blk-sequence" role="group" aria-label="sequence">
          {block.items.map((c, i) => (
            <div className="seq-cell" key={i}>
              <span className="seq-index" aria-hidden>
                {i + 1}
              </span>
              {c ? <VisualView v={c} size="sm" /> : <QuestionMark size="sm" />}
            </div>
          ))}
        </div>
      );
    case 'gallery':
      return (
        <div className={`blk-gallery gallery-${block.size ?? 'md'}`}>
          {block.items.map((it, i) => (
            <figure key={i} className={`gallery-item${it.tag ? ` tag-${it.tag}` : ''}`}>
              <VisualView v={it.visual} size={block.size === 'lg' ? 'md' : 'sm'} />
              {(it.caption || it.tag) && (
                <figcaption>
                  {it.caption && <span>{it.caption}</span>}
                  {it.tag && <span className={`badge badge-${it.tag}`}>{it.tag === 'accepted' ? '✓ Accepted' : '✗ Rejected'}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      );
    case 'pairs':
      return (
        <div className="blk-pairs">
          {block.caption && <p className="blk-caption">{block.caption}</p>}
          {block.pairs.map((p, i) => (
            <div className={`pair-row${p.output ? '' : ' is-query'}`} key={i}>
              <VisualView v={p.input} size="sm" />
              <span className="pair-arrow" aria-label="becomes">
                →
              </span>
              {p.output ? <VisualView v={p.output} size="sm" /> : <span className="pair-q">?</span>}
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="blk-table-wrap">
          <table className="blk-table">
            {block.caption && <caption>{block.caption}</caption>}
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={c === '?' ? 'is-q' : undefined}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'visual':
      return (
        <figure className={`blk-visual visual-${block.size ?? 'md'}`}>
          <VisualView v={block.visual} size={block.size ?? 'md'} />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'equations':
      return (
        <div className="blk-equations" role="list">
          {block.lines.map((line, i) => (
            <div className={`eq-line${i === block.lines.length - 1 ? ' is-query' : ''}`} role="listitem" key={i}>
              {line.map((t, j) => (
                <EqToken t={t} key={j} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'statements':
      return (
        <div className="blk-statements">
          {block.items.map((s, i) => (
            <blockquote className="statement" key={i}>
              <span className="statement-speaker">{s.speaker}</span>
              <span className="statement-text">“{s.text}”</span>
            </blockquote>
          ))}
        </div>
      );
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => (
        <BlockView block={b} key={i} />
      ))}
    </div>
  );
}
