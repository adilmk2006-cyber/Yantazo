/**
 * An endless session: puzzles are generated one at a time on demand (at
 * most one prepared in advance while the player reads an explanation), so
 * memory use stays flat no matter how long the session runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, Difficulty, Puzzle } from '../../engine/types';
import { CATEGORY_INFO, DIFFICULTY_NAMES } from '../../engine/types';
import { generatePuzzle } from '../../engine/registry';
import { pickCategory } from '../../engine/diversity';
import { createRng, randomSeed } from '../../engine/rng';
import type { Outcome, Profile } from '../../state/progress';
import type { SessionSummary } from '../../state/stores';
import { useGame } from '../GameContext';
import { PuzzlePlayer } from '../play/PuzzlePlayer';
import { loadConfig } from '../sessionConfig';
import { Icon } from '../components/Icon';
import { href, navigate } from '../router';

type Counts = Record<Outcome, number>;
const zero = (): Counts => ({ correct: 0, incorrect: 0, revealed: 0, skipped: 0 });

export function EndlessSession() {
  const game = useGame();
  const [config] = useState(loadConfig);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [status, setStatus] = useState<'generating' | 'playing' | 'error' | 'summary'>('generating');
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>(zero);
  const [xp, setXp] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessionId, setSessionId] = useState(() => randomSeed(8));
  const startedAt = useRef(Date.now());
  const prefetched = useRef<Puzzle | null>(null);
  const selRng = useRef(createRng(randomSeed()));
  const historyRef = useRef(game.history);
  historyRef.current = game.history;
  const profileRef = useRef(game.profile);
  profileRef.current = game.profile;
  const recorded = useRef(false);

  const done = counts.correct + counts.incorrect + counts.revealed + counts.skipped;

  const makePuzzle = useCallback(
    (profile: Profile): Puzzle => {
      const category: Category = pickCategory(config.categories, historyRef.current, selRng.current);
      const difficulty: Difficulty = config.difficulty === 'adaptive' ? profile.categories[category].level : config.difficulty;
      return generatePuzzle({ category, difficulty, recent: historyRef.current, rng: selRng.current }).puzzle;
    },
    [config],
  );

  const showNext = useCallback(() => {
    setStatus('generating');
    setError(null);
    const ready = prefetched.current;
    prefetched.current = null;
    window.setTimeout(() => {
      try {
        const p = ready ?? makePuzzle(profileRef.current);
        game.noteShown(p);
        setPuzzle(p);
        setStatus('playing');
      } catch (e) {
        setError((e as Error).message);
        setStatus('error');
      }
    }, 30);
  }, [makePuzzle, game]);

  useEffect(() => {
    showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const saveSummary = useCallback(() => {
    if (recorded.current || done === 0) return;
    recorded.current = true;
    const s: SessionSummary = {
      id: sessionId,
      mode: 'endless',
      startedAt: startedAt.current,
      endedAt: Date.now(),
      categories: config.categories,
      difficulty: config.difficulty,
      timed: config.timed,
      hints: config.hints,
      counts,
      xp,
    };
    game.addSession(s);
  }, [done, sessionId, config, counts, xp, game]);

  // store the summary if the player navigates away mid-session
  const saveRef = useRef(saveSummary);
  saveRef.current = saveSummary;
  useEffect(() => () => saveRef.current(), []);

  const atLimit = config.length !== null && done >= config.length;

  const next = () => {
    if (atLimit) {
      saveSummary();
      setStatus('summary');
      return;
    }
    showNext();
  };

  const restart = () => {
    saveSummary();
    recorded.current = false;
    prefetched.current = null;
    setCounts(zero());
    setXp(0);
    startedAt.current = Date.now();
    setPaused(false);
    setSessionId(randomSeed(8));
  };

  const end = () => {
    saveSummary();
    setStatus('summary');
  };

  if (status === 'summary') {
    const answered = counts.correct + counts.incorrect + counts.revealed;
    return (
      <div className="screen narrow">
        <h1>Session complete</h1>
        <div className="summary-grid">
          <Stat label="Solved" value={counts.correct} />
          <Stat label="Missed" value={counts.incorrect} />
          <Stat label="Revealed" value={counts.revealed} />
          <Stat label="Skipped" value={counts.skipped} />
          <Stat label="Accuracy" value={answered ? `${Math.round((counts.correct / answered) * 100)}%` : '—'} />
          <Stat label="XP earned" value={xp} />
        </div>
        <p className="muted">Skipped puzzles are not counted as wrong answers.</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={restart}>
            <Icon name="restart" /> New session with the same settings
          </button>
          <a className="btn btn-secondary" href={href('/endless')}>
            Change settings
          </a>
          <a className="btn btn-ghost" href={href('/dashboard')}>
            View progress
          </a>
        </div>
      </div>
    );
  }

  const cats = config.categories.length === 1 ? CATEGORY_INFO[config.categories[0]].name : `Mixed (${config.categories.length} categories)`;

  return (
    <div className="screen play">
      <div className="session-bar" role="region" aria-label="Session controls">
        <div className="session-info">
          <strong>{cats}</strong>
          <span className="muted">{config.difficulty === 'adaptive' ? 'Adaptive difficulty' : DIFFICULTY_NAMES[config.difficulty]}</span>
          <span className="session-count">
            {done + (status === 'playing' ? 1 : 0)}
            {config.length ? ` / ${config.length}` : ''} <span className="muted">{config.length ? '' : '· no limit'}</span>
          </span>
          <span className="session-score" aria-label="Session results">
            <Icon name="check" /> {counts.correct} <Icon name="cross" /> {counts.incorrect + counts.revealed} <Icon name="skip" /> {counts.skipped}
          </span>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            <Icon name={paused ? 'play' : 'pause'} /> {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={restart}>
            <Icon name="restart" /> Restart
          </button>
          <button type="button" className="btn btn-ghost" onClick={end}>
            End session
          </button>
        </div>
      </div>

      {status === 'generating' && (
        <div className="generating" role="status">
          <span className="spinner" aria-hidden /> Generating and validating the next puzzle…
        </div>
      )}
      {status === 'error' && (
        <div className="panel error-panel" role="alert">
          <h2>Could not build a puzzle</h2>
          <p>{error}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={showNext}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/endless')}>
              Change settings
            </button>
          </div>
        </div>
      )}
      {status === 'playing' && puzzle && (
        <div className={`play-area${paused ? ' is-paused' : ''}`}>
          {paused && (
            <div className="pause-overlay" role="dialog" aria-label="Paused">
              <p>Paused — the puzzle is hidden and the timer is stopped.</p>
              <button type="button" className="btn btn-primary" onClick={() => setPaused(false)}>
                <Icon name="play" /> Resume
              </button>
            </div>
          )}
          <div aria-hidden={paused} className="play-content">
            <PuzzlePlayer
              key={puzzle.id}
              puzzle={puzzle}
              hintsEnabled={config.hints}
              timeLimitSec={config.timed ? config.timerSeconds : null}
              replay={false}
              mode="endless"
              paused={paused}
              nextLabel={atLimit ? 'See session summary' : 'Next puzzle'}
              onFinished={(rec, res) => {
                setCounts((c) => ({ ...c, [rec.outcome]: c[rec.outcome] + 1 }));
                setXp((x) => x + res.xp);
                // prepare the next puzzle while the explanation is being read
                window.setTimeout(() => {
                  try {
                    if (!prefetched.current && !(config.length !== null && done + 1 >= config.length)) prefetched.current = makePuzzle(res.profile);
                  } catch {
                    prefetched.current = null;
                  }
                }, 120);
              }}
              onNext={next}
              onSkip={() => {
                setCounts((c) => ({ ...c, skipped: c.skipped + 1 }));
                if (config.length !== null && done + 1 >= config.length) {
                  setStatus('summary');
                  return;
                }
                showNext();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
