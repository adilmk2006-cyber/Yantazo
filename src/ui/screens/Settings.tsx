import { useState } from 'react';
import { usageBytes } from '../../state/storage';
import { useGame } from '../GameContext';

export function SettingsScreen() {
  const game = useGame();
  const s = game.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="screen narrow settings">
      <h1>Settings</h1>

      <section className="panel">
        <h2>Display &amp; accessibility</h2>
        <label className="field">
          <span className="field-label">Text size</span>
          <select value={s.textSize} onChange={(e) => game.setSettings({ textSize: e.target.value as typeof s.textSize })}>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="xlarge">Extra large</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Motion</span>
          <select value={s.reducedMotion} onChange={(e) => game.setSettings({ reducedMotion: e.target.value as typeof s.reducedMotion })}>
            <option value="system">Follow my system setting</option>
            <option value="on">Reduce motion</option>
            <option value="off">Allow animations</option>
          </select>
        </label>
        <label className="switch">
          <input type="checkbox" checked={s.highContrast} onChange={(e) => game.setSettings({ highContrast: e.target.checked })} />
          <span>
            <strong>High contrast</strong>
            <span className="muted small">Brighter outlines and text. Shading is always shown with patterns as well as colour.</span>
          </span>
        </label>
      </section>

      <section className="panel">
        <h2>Puzzles</h2>
        <label className="switch">
          <input type="checkbox" checked={s.defaultHints} onChange={(e) => game.setSettings({ defaultHints: e.target.checked })} />
          <span>
            <strong>Hints on by default</strong>
          </span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={s.confirmReveal} onChange={(e) => game.setSettings({ confirmReveal: e.target.checked })} />
          <span>
            <strong>Ask before revealing an answer</strong>
          </span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={s.defaultTimed} onChange={(e) => game.setSettings({ defaultTimed: e.target.checked })} />
          <span>
            <strong>Timed sessions by default</strong>
          </span>
        </label>
        <label className="field">
          <span className="field-label">Default seconds per timed puzzle: {s.timerSeconds}</span>
          <input type="range" min={20} max={600} step={10} value={s.timerSeconds} onChange={(e) => game.setSettings({ timerSeconds: Number(e.target.value) })} />
        </label>
      </section>

      <section className="panel">
        <h2>Observation &amp; memory</h2>
        <label className="field">
          <span className="field-label">Memorisation time: ×{s.exposureMultiplier.toFixed(2)}</span>
          <input type="range" min={0.5} max={3} step={0.25} value={s.exposureMultiplier} onChange={(e) => game.setSettings({ exposureMultiplier: Number(e.target.value) })} />
          <span className="field-help">Longer exposure makes memory puzzles easier. Observation results are always tracked separately from logic and reasoning.</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={s.observationPractice} onChange={(e) => game.setSettings({ observationPractice: e.target.checked })} />
          <span>
            <strong>Practice mode</strong>
            <span className="muted small">Lets you view a memorised scene again; those attempts are recorded as practice, not as first attempts.</span>
          </span>
        </label>
      </section>

      <section className="panel">
        <h2>Data</h2>
        <p className="muted small">
          Everything is stored on this device only ({(usageBytes() / 1024).toFixed(1)} KB used). Puzzles are stored as seeds, not copies. {game.persistent ? '' : 'Storage is currently unavailable, so data lasts only for this tab.'}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            game.resetHistory();
            game.pushToast({ title: 'Recent puzzle memory cleared', tone: 'info' });
          }}
        >
          Reset recent-puzzle memory
        </button>
        {!confirmReset ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Reset all progress…
          </button>
        ) : (
          <div className="confirm" role="alertdialog" aria-label="Confirm reset">
            <span>This permanently deletes your statistics, achievements, saved puzzles, mystery progress and settings.</span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                game.resetAll();
                setConfirmReset(false);
                game.pushToast({ title: 'All progress reset', tone: 'warning' });
              }}
            >
              Delete everything
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
