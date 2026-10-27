import { useState } from 'react';
import { CATEGORY_INFO, DIFFICULTY_NAMES } from '../../engine/types';
import { refKey } from '../../state/stores';
import { useGame } from '../GameContext';
import { href } from '../router';
import { Icon } from '../components/Icon';

type Tab = 'recent' | 'saved' | 'sessions';

function when(t: number) {
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function HistoryScreen() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>('recent');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen">
      <h1>History</h1>
      <div className="tabs" role="tablist" aria-label="History views">
        {(['recent', 'saved', 'sessions'] as Tab[]).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} className={`tab${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
            {t === 'recent' ? `Recent puzzles (${game.recent.length})` : t === 'saved' ? `Saved (${game.saved.length})` : `Sessions (${game.sessions.length})`}
          </button>
        ))}
      </div>

      {tab === 'recent' && (
        <section role="tabpanel" className="panel">
          <p className="muted small">Only a compact reference (generator, version, difficulty and seed) is stored for each puzzle, so any of them can be rebuilt exactly. The list keeps the last 100.</p>
          {game.recent.length === 0 ? (
            <p>No puzzles yet.</p>
          ) : (
            <ul className="history-list">
              {[...game.recent].reverse().map((r, i) => (
                <li key={`${refKey(r.ref)}-${i}`}>
                  <span className={`cat-chip chip-${r.category}`}>{CATEGORY_INFO[r.category].short}</span>
                  <span className="grow">
                    <strong>{r.family}</strong> <span className="muted">· {DIFFICULTY_NAMES[r.ref.difficulty]} · {when(r.at)}</span>
                  </span>
                  <span className={`outcome outcome-${r.outcome}`}>{r.outcome}</span>
                  {r.replay && <span className="meta-pill pill-replay">replay</span>}
                  <a className="btn btn-ghost" href={href(`/replay/${encodeURIComponent(refKey(r.ref))}`)}>
                    <Icon name="restart" /> Replay
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="danger-zone">
            {!confirm ? (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
                Reset recent-puzzle memory (anti-repetition history)
              </button>
            ) : (
              <div className="confirm">
                <span>This forgets which puzzle structures you have seen recently. Stats are kept.</span>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    game.resetHistory();
                    setConfirm(false);
                    game.pushToast({ title: 'Recent history cleared', tone: 'info' });
                  }}
                >
                  Reset
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'saved' && (
        <section role="tabpanel" className="panel">
          {game.saved.length === 0 ? (
            <p>
              Use the <Icon name="bookmark" /> button on any puzzle to save it here.
            </p>
          ) : (
            <ul className="history-list">
              {[...game.saved].reverse().map((s) => (
                <li key={refKey(s.ref)}>
                  <span className={`cat-chip chip-${s.category}`}>{CATEGORY_INFO[s.category].short}</span>
                  <span className="grow">
                    <strong>{s.family}</strong> <span className="muted">· {DIFFICULTY_NAMES[s.ref.difficulty]} · saved {when(s.savedAt)}</span>
                  </span>
                  <a className="btn btn-secondary" href={href(`/replay/${encodeURIComponent(refKey(s.ref))}`)}>
                    <Icon name="play" /> Play
                  </a>
                  <button type="button" className="btn btn-ghost" onClick={() => game.removeSaved(s.ref)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'sessions' && (
        <section role="tabpanel" className="panel">
          {game.sessions.length === 0 ? (
            <p>No sessions recorded yet.</p>
          ) : (
            <ul className="history-list">
              {[...game.sessions].reverse().map((s) => {
                const answered = s.counts.correct + s.counts.incorrect + s.counts.revealed;
                return (
                  <li key={s.id}>
                    <span className="grow">
                      <strong>{s.categories.length === 1 ? CATEGORY_INFO[s.categories[0]].name : `Mixed (${s.categories.length})`}</strong>{' '}
                      <span className="muted">
                        · {s.difficulty === 'adaptive' ? 'Adaptive' : DIFFICULTY_NAMES[s.difficulty]} · {when(s.startedAt)} · {Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))} min
                        {s.timed ? ' · timed' : ''}
                        {s.hints ? '' : ' · no hints'}
                      </span>
                    </span>
                    <span>
                      {s.counts.correct}/{answered} solved · {s.counts.skipped} skipped · +{s.xp} XP
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
