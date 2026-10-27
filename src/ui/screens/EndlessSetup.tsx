import { useState } from 'react';
import type { Category, Difficulty } from '../../engine/types';
import { CATEGORIES, CATEGORY_INFO, DIFFICULTIES, DIFFICULTY_BLURBS, DIFFICULTY_NAMES } from '../../engine/types';
import { generatorsFor } from '../../engine/registry';
import { Icon } from '../components/Icon';
import { navigate } from '../router';
import type { SessionConfig } from '../sessionConfig';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../sessionConfig';
import { useGame } from '../GameContext';

export function EndlessSetup({ preset }: { preset: string | null }) {
  const { settings } = useGame();
  const [cfg, setCfg] = useState<SessionConfig>(() => {
    const base = loadConfig();
    // first visit this tab: start from the player's default settings
    const withDefaults = base === DEFAULT_CONFIG ? { ...base, hints: settings.defaultHints, timed: settings.defaultTimed, timerSeconds: settings.timerSeconds } : base;
    if (preset === 'mixed') return { ...withDefaults, categories: [...CATEGORIES] };
    if (preset && CATEGORIES.includes(preset as Category)) return { ...withDefaults, categories: [preset as Category] };
    return withDefaults;
  });
  const set = (p: Partial<SessionConfig>) => setCfg((c) => ({ ...c, ...p }));
  const toggleCat = (c: Category) => set({ categories: cfg.categories.includes(c) ? cfg.categories.filter((x) => x !== c) : [...cfg.categories, c] });
  const start = () => {
    if (!cfg.categories.length) return;
    saveConfig(cfg);
    navigate('/play');
  };
  return (
    <div className="screen setup">
      <h1>Endless reasoning</h1>
      <p className="lead">Choose what to practise. Puzzles are generated one at a time as you play — there is no fixed total.</p>

      <section className="panel" aria-labelledby="cat-h">
        <div className="panel-head">
          <h2 id="cat-h">Categories</h2>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => set({ categories: [...CATEGORIES] })}>
              Select all (mixed)
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => set({ categories: [] })}>
              Clear
            </button>
          </div>
        </div>
        <div className="toggle-grid">
          {CATEGORIES.map((c) => {
            const on = cfg.categories.includes(c);
            return (
              <label key={c} className={`toggle-card cat-${c}${on ? ' is-on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggleCat(c)} />
                <Icon name={CATEGORY_INFO[c].icon} size={22} />
                <span>
                  <strong>{CATEGORY_INFO[c].name}</strong>
                  <span className="muted small">{generatorsFor(c).map((g) => g.family).join(' · ')}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="muted small" role="status">
          {cfg.categories.length === 0
            ? 'Pick at least one category.'
            : cfg.categories.length === 1
              ? 'Focused session: puzzles rotate between the families of this category.'
              : 'Mixed session: the same category never appears twice in a row.'}
        </p>
      </section>

      <section className="panel" aria-labelledby="diff-h">
        <h2 id="diff-h">Difficulty</h2>
        <div className="radio-cards" role="radiogroup" aria-labelledby="diff-h">
          <label className={`radio-card${cfg.difficulty === 'adaptive' ? ' is-on' : ''}`}>
            <input type="radio" name="difficulty" checked={cfg.difficulty === 'adaptive'} onChange={() => set({ difficulty: 'adaptive' })} />
            <strong>Adaptive</strong>
            <span className="muted small">Each category adjusts separately to your recent first-attempt results and hint use.</span>
          </label>
          {DIFFICULTIES.map((d: Difficulty) => (
            <label key={d} className={`radio-card${cfg.difficulty === d ? ' is-on' : ''}`}>
              <input type="radio" name="difficulty" checked={cfg.difficulty === d} onChange={() => set({ difficulty: d })} />
              <strong>{DIFFICULTY_NAMES[d]}</strong>
              <span className="muted small">{DIFFICULTY_BLURBS[d]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel options-grid" aria-label="Session options">
        <label className="switch">
          <input type="checkbox" checked={cfg.hints} onChange={(e) => set({ hints: e.target.checked })} />
          <span>
            <strong>Hints available</strong>
            <span className="muted small">Three progressive hints per puzzle.</span>
          </span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={cfg.timed} onChange={(e) => set({ timed: e.target.checked })} />
          <span>
            <strong>Timed play</strong>
            <span className="muted small">Each puzzle ends when its timer runs out.</span>
          </span>
        </label>
        {cfg.timed && (
          <label className="field inline">
            <span className="field-label">Seconds per puzzle</span>
            <input type="number" min={20} max={600} step={10} value={cfg.timerSeconds} onChange={(e) => set({ timerSeconds: Math.min(600, Math.max(20, Number(e.target.value) || 120)) })} />
          </label>
        )}
        <fieldset className="field inline">
          <legend className="field-label">Session length</legend>
          <div className="seg">
            {[
              { v: 10, l: 'Short (10)' },
              { v: 25, l: 'Standard (25)' },
              { v: null, l: 'Unlimited' },
            ].map((o) => (
              <label key={String(o.v)} className={`seg-btn${cfg.length === o.v ? ' is-on' : ''}`}>
                <input type="radio" name="length" checked={cfg.length === o.v} onChange={() => set({ length: o.v })} />
                {o.l}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={!cfg.categories.length}>
          <Icon name="play" /> Start session
        </button>
      </div>
    </div>
  );
}
