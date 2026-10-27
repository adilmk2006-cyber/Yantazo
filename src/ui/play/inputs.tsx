/** Answer inputs for every interaction type. All are keyboard accessible. */
import { useMemo, useState } from 'react';
import type { Choice, Interaction, PlayerResponse } from '../../engine/types';
import { FigureView, PathGrid, VisualView } from '../render/VisualView';

type Of<T extends Interaction['type']> = Extract<Interaction, { type: T }>;

export interface InputProps<T extends Interaction['type']> {
  interaction: Of<T>;
  value: PlayerResponse | null;
  onChange(r: PlayerResponse | null): void;
  disabled: boolean;
  /** For result display: which option is correct */
  correctId?: string;
}

export function ChoiceGrid({
  choices,
  selected,
  onSelect,
  disabled,
  columns,
  multi,
  correctIds,
  name,
}: {
  choices: Choice[];
  selected: string[];
  onSelect(id: string): void;
  disabled: boolean;
  columns?: number;
  multi?: boolean;
  correctIds?: string[];
  name: string;
}) {
  const hasVisual = choices.some((c) => c.visual);
  return (
    <fieldset className={`choices ${hasVisual ? 'choices-visual' : 'choices-text'}`} style={columns && hasVisual ? ({ '--cols': columns } as React.CSSProperties) : undefined} disabled={disabled}>
      <legend className="sr-only">{multi ? 'Select all that apply' : 'Choose one option'}</legend>
      {choices.map((c) => {
        const isSel = selected.includes(c.id);
        const isRight = correctIds?.includes(c.id);
        const state = correctIds ? (isRight ? ' is-correct' : isSel ? ' is-wrong' : ' is-dim') : '';
        return (
          <label key={c.id} className={`choice${isSel ? ' is-selected' : ''}${state}`}>
            <input type={multi ? 'checkbox' : 'radio'} name={name} value={c.id} checked={isSel} onChange={() => onSelect(c.id)} className="sr-only" />
            <span className="choice-label" aria-hidden>
              {c.label}
            </span>
            {c.visual && <VisualView v={c.visual} size="sm" />}
            {c.text && <span className="choice-text">{c.text}</span>}
            <span className="sr-only">{`Option ${c.label}${c.text ? `: ${c.text}` : ''}`}</span>
            {correctIds && isRight && <span className="choice-flag">✓ correct</span>}
            {correctIds && isSel && !isRight && <span className="choice-flag">✗ your choice</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

export function ChoiceInput({ interaction, value, onChange, disabled, correctId }: InputProps<'choice'>) {
  const sel = value?.type === 'choice' ? [value.id] : [];
  return <ChoiceGrid name="choice" choices={interaction.choices} columns={interaction.columns} selected={sel} onSelect={(id) => onChange({ type: 'choice', id })} disabled={disabled} correctIds={correctId ? [correctId] : undefined} />;
}

export function MultiInput({ interaction, value, onChange, disabled, correctIds }: InputProps<'multi'> & { correctIds?: string[] }) {
  const sel = value?.type === 'multi' ? value.ids : [];
  return (
    <div>
      <p className="input-instruction">{interaction.instruction}</p>
      <ChoiceGrid
        name="multi"
        multi
        choices={interaction.choices}
        selected={sel}
        onSelect={(id) => {
          const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
          onChange({ type: 'multi', ids: next });
        }}
        disabled={disabled}
        correctIds={correctIds}
      />
    </div>
  );
}

function FallbackToggle({ fallback, value, onChange, disabled, render }: { fallback?: Choice[]; value: PlayerResponse | null; onChange(r: PlayerResponse | null): void; disabled: boolean; render: () => React.ReactNode }) {
  const [useFallback, setUseFallback] = useState(value?.type === 'choice');
  return (
    <div>
      {!useFallback && render()}
      {fallback && !disabled && (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setUseFallback(!useFallback);
            onChange(null);
          }}
        >
          {useFallback ? 'Type my own answer instead' : 'Answer by multiple choice instead'}
        </button>
      )}
      {useFallback && fallback && (
        <ChoiceGrid name="fallback" choices={fallback} selected={value?.type === 'choice' ? [value.id] : []} onSelect={(id) => onChange({ type: 'choice', id, viaFallback: true })} disabled={disabled} />
      )}
    </div>
  );
}

export function TextInput({ interaction, value, onChange, disabled }: InputProps<'text'>) {
  return (
    <FallbackToggle
      fallback={interaction.fallback}
      value={value}
      onChange={onChange}
      disabled={disabled}
      render={() => (
        <label className="field">
          <span className="field-label">Your answer</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={interaction.placeholder}
            value={value?.type === 'text' ? value.text : ''}
            onChange={(e) => onChange(e.target.value.trim() ? { type: 'text', text: e.target.value } : null)}
            disabled={disabled}
          />
          <span className="field-help">Different wordings of the same answer are accepted where the game knows them.</span>
        </label>
      )}
    />
  );
}

export function NumberInput({ interaction, value, onChange, disabled }: InputProps<'number'>) {
  const [raw, setRaw] = useState(value?.type === 'number' ? String(value.value) : '');
  return (
    <FallbackToggle
      fallback={interaction.fallback}
      value={value}
      onChange={onChange}
      disabled={disabled}
      render={() => (
        <label className="field">
          <span className="field-label">Your answer</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={interaction.placeholder}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              const n = Number(e.target.value.replace(/[^0-9.-]/g, ''));
              onChange(e.target.value.trim() && Number.isFinite(n) ? { type: 'number', value: n } : null);
            }}
            disabled={disabled}
          />
        </label>
      )}
    />
  );
}

export function OrderInput({ interaction, value, onChange, disabled }: InputProps<'order'>) {
  const slots = value?.type === 'order' ? value.slots : interaction.slots.map(() => null);
  const counts = new Map<number, number>();
  for (const s of slots) if (s !== null) counts.set(s, (counts.get(s) ?? 0) + 1);
  const dup = [...counts.values()].some((c) => c > 1);
  const set = (i: number, v: number | null) => {
    const next = slots.slice();
    next[i] = v;
    onChange({ type: 'order', slots: next });
  };
  return (
    <div className="order-input">
      {interaction.circular && <SeatDiagram slots={interaction.slots} values={slots} items={interaction.items} />}
      <div className="order-rows">
        {interaction.slots.map((label, i) => (
          <label className="order-row" key={label}>
            <span className="order-slot">{label}</span>
            <select value={slots[i] ?? ''} onChange={(e) => set(i, e.target.value === '' ? null : Number(e.target.value))} disabled={disabled}>
              <option value="">— choose —</option>
              {interaction.items.map((it, j) => (
                <option value={j} key={it}>
                  {it}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {dup && <p className="warn" role="status">Someone is placed twice — each person goes in exactly one position.</p>}
    </div>
  );
}

function SeatDiagram({ slots, values, items }: { slots: string[]; values: (number | null)[]; items: string[] }) {
  const n = slots.length;
  return (
    <svg viewBox="0 0 120 120" className="seat-diagram" role="img" aria-label="Round table with numbered seats, clockwise">
      <circle cx="60" cy="60" r="30" className="seat-table" />
      {slots.map((_, i) => {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2;
        const x = 60 + 46 * Math.cos(a);
        const y = 60 + 46 * Math.sin(a);
        const who = values[i] !== null && values[i] !== undefined ? items[values[i]!] : `${i + 1}`;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="11" className="seat" />
            <text x={x} y={y + 3} textAnchor="middle" className="seat-text">
              {who.length > 5 ? who.slice(0, 4) + '…' : who}
            </text>
          </g>
        );
      })}
      <text x="60" y="63" textAnchor="middle" className="seat-caption">
        clockwise ↻
      </text>
    </svg>
  );
}

export function AssignInput({ interaction, value, onChange, disabled }: InputProps<'assign'>) {
  const table = value?.type === 'assign' ? value.table : interaction.rows.map(() => interaction.columns.map(() => null));
  const [showNotes, setShowNotes] = useState(false);
  const set = (r: number, c: number, v: number | null) => {
    const next = table.map((row) => row.slice());
    next[r][c] = v;
    onChange({ type: 'assign', table: next });
  };
  return (
    <div className="assign-input">
      <div className="table-scroll">
        <table className="assign-table">
          <thead>
            <tr>
              <th scope="col">{interaction.rowHeader}</th>
              {interaction.columns.map((c) => (
                <th scope="col" key={c.name}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {interaction.rows.map((row, r) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {interaction.columns.map((col, c) => (
                  <td key={col.name}>
                    <select aria-label={`${col.name} for ${row}`} value={table[r][c] ?? ''} onChange={(e) => set(r, c, e.target.value === '' ? null : Number(e.target.value))} disabled={disabled}>
                      <option value="">—</option>
                      {col.options.map((o, k) => (
                        <option key={o} value={k}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="link-btn" onClick={() => setShowNotes((s) => !s)} aria-expanded={showNotes}>
        {showNotes ? 'Hide note grid' : 'Open note grid (mark ✓ / ✗ while you reason)'}
      </button>
      {showNotes && <NotesGrid rows={interaction.rows} columns={interaction.columns} />}
    </div>
  );
}

/** Logic-grid notepad: click cycles blank → ✗ → ✓. Purely for the player's notes. */
function NotesGrid({ rows, columns }: { rows: string[]; columns: { name: string; options: string[] }[] }) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const cycle = (k: string) => setMarks((m) => ({ ...m, [k]: ((m[k] ?? 0) + 1) % 3 }));
  return (
    <div className="notes-grids">
      {columns.map((col) => (
        <div className="table-scroll" key={col.name}>
          <table className="notes-grid">
            <caption>{col.name}</caption>
            <thead>
              <tr>
                <th />
                {col.options.map((o) => (
                  <th scope="col" key={o}>
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th scope="row">{r}</th>
                  {col.options.map((o) => {
                    const k = `${col.name}|${r}|${o}`;
                    const m = marks[k] ?? 0;
                    return (
                      <td key={o}>
                        <button type="button" className={`note-cell note-${m}`} onClick={() => cycle(k)} aria-label={`${r} – ${o}: ${['blank', 'ruled out', 'confirmed'][m]}`}>
                          {['', '✗', '✓'][m]}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function CellInput({ interaction, value, onChange, disabled, correctIndex }: InputProps<'cell'> & { correctIndex?: number }) {
  const sel = value?.type === 'cell' ? value.index : null;
  const base = interaction.base;
  if (base.kind === 'path-grid') {
    return (
      <div className="cell-input">
        <PathGrid v={base} size="lg" onCell={disabled ? undefined : (i) => onChange({ type: 'cell', index: i })} selected={correctIndex ?? sel} />
        {sel !== null && <p className="input-instruction">Selected: {String.fromCharCode(65 + (sel % interaction.cols))}{Math.floor(sel / interaction.cols) + 1}</p>}
      </div>
    );
  }
  return (
    <div className="cell-overlay-wrap">
      <VisualView v={base} size="lg" />
      <div className="cell-overlay" style={{ gridTemplateColumns: `repeat(${interaction.cols}, 1fr)`, gridTemplateRows: `repeat(${interaction.rows}, 1fr)` }} role="group" aria-label="Choose a square">
        {Array.from({ length: interaction.rows * interaction.cols }, (_, i) => (
          <button
            type="button"
            key={i}
            className={`overlay-cell${sel === i ? ' is-selected' : ''}${correctIndex === i ? ' is-correct' : ''}`}
            aria-label={`Column ${String.fromCharCode(65 + (i % interaction.cols))}, row ${Math.floor(i / interaction.cols) + 1}`}
            aria-pressed={sel === i}
            onClick={() => onChange({ type: 'cell', index: i })}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export function SequenceInput({ interaction, value, onChange, disabled }: InputProps<'sequence'>) {
  const items = value?.type === 'sequence' ? value.items : [];
  const push = (id: string) => {
    if (items.length >= interaction.length) return;
    onChange({ type: 'sequence', items: [...items, id] });
  };
  const byId = useMemo(() => new Map(interaction.palette.map((p) => [p.id, p])), [interaction.palette]);
  return (
    <div className="sequence-input">
      <ol className="seq-slots" aria-label="Your sequence">
        {Array.from({ length: interaction.length }, (_, i) => (
          <li key={i} className={`seq-slot${items[i] ? ' is-filled' : ''}`}>
            {items[i] ? <VisualView v={byId.get(items[i])!.visual} size="xs" /> : <span aria-hidden>{i + 1}</span>}
            <span className="sr-only">{items[i] ? byId.get(items[i])!.name : 'empty'}</span>
          </li>
        ))}
      </ol>
      <div className="seq-palette" role="group" aria-label="Symbols">
        {interaction.palette.map((p) => (
          <button type="button" key={p.id} className="palette-btn" onClick={() => push(p.id)} disabled={disabled || items.length >= interaction.length} aria-label={`Add ${p.name}`}>
            <VisualView v={p.visual} size="xs" />
          </button>
        ))}
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onChange(items.length > 1 ? { type: 'sequence', items: items.slice(0, -1) } : null)} disabled={disabled || !items.length}>
          Undo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onChange(null)} disabled={disabled || !items.length}>
          Clear
        </button>
      </div>
    </div>
  );
}

export function GlyphInput({ interaction, value, onChange, disabled, correct }: InputProps<'glyphs'> & { correct?: number[] }) {
  const sel = value?.type === 'glyphs' ? value.indices : [];
  const toggle = (i: number) => {
    if (disabled) return;
    if (sel.includes(i)) onChange(sel.length > 1 ? { type: 'glyphs', indices: sel.filter((x) => x !== i) } : null);
    else onChange({ type: 'glyphs', indices: [...sel, i].slice(-interaction.count) });
  };
  return (
    <div className="glyph-input">
      <FigureView figure={correct ? { ...interaction.figure, glyphs: interaction.figure.glyphs.map((g, i) => ({ ...g, highlight: correct.includes(i) })) } : interaction.figure} size="lg" onGlyph={disabled ? undefined : toggle} selected={sel} label="Changed scene" />
      <p className="input-instruction" role="status">
        {sel.length} of {interaction.count} selected
      </p>
    </div>
  );
}

export function InvestigationInput({ interaction, value, onChange, disabled, correctId }: InputProps<'investigation'>) {
  const [asked, setAsked] = useState<string[]>([]);
  return (
    <div className="investigation">
      <div className="questions" role="list" aria-label="Yes or no questions">
        {interaction.questions.map((q) => {
          const isAsked = asked.includes(q.id);
          return (
            <div role="listitem" key={q.id} className={`question${isAsked ? ' is-asked' : ''}`}>
              <button type="button" className="question-btn" onClick={() => setAsked((a) => (a.includes(q.id) ? a : [...a, q.id]))} disabled={isAsked} aria-expanded={isAsked}>
                {q.text}
              </button>
              {isAsked && (
                <span className={`answer-chip chip-${q.answer}`} role="status">
                  {q.answer === 'yes' ? 'Yes' : q.answer === 'no' ? 'No' : 'Irrelevant'}
                  {q.note ? ` — ${q.note}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="input-instruction">{asked.length} question{asked.length === 1 ? '' : 's'} asked. When you are ready, choose the explanation:</p>
      <ChoiceGrid name="explain" choices={interaction.choices} selected={value?.type === 'choice' ? [value.id] : []} onSelect={(id) => onChange({ type: 'choice', id })} disabled={disabled} correctIds={correctId ? [correctId] : undefined} />
    </div>
  );
}

export function OpenInput({ interaction, value, onChange, disabled }: InputProps<'open'>) {
  return (
    <label className="field">
      <span className="field-label">Your explanation</span>
      <textarea
        rows={4}
        placeholder={interaction.placeholder}
        value={value?.type === 'self' ? value.text : ''}
        onChange={(e) => onChange(e.target.value.trim() ? { type: 'self', text: e.target.value, verdict: 'miss' } : null)}
        disabled={disabled}
      />
      <span className="field-help">You will compare this with the model solution yourself.</span>
    </label>
  );
}
