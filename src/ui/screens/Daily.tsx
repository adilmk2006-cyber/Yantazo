import { useMemo, useState } from 'react';
import { regeneratePuzzle } from '../../engine/registry';
import type { Puzzle } from '../../engine/types';
import { CATEGORY_INFO, DIFFICULTY_NAMES } from '../../engine/types';
import { DAILY_SIZE, dailyRefs } from '../../state/daily';
import { todayString } from '../../state/progress';
import { useGame } from '../GameContext';
import { PuzzlePlayer } from '../play/PuzzlePlayer';
import { Icon } from '../components/Icon';

export function DailyScreen() {
  const game = useGame();
  const date = todayString();
  const { puzzles, error } = useMemo(() => {
    try {
      return { puzzles: dailyRefs(date).map((r) => regeneratePuzzle(r)), error: null as string | null };
    } catch (e) {
      return { puzzles: [] as (Puzzle | null)[], error: (e as Error).message };
    }
  }, [date]);
  const record = game.daily.find((d) => d.date === date);
  const [active, setActive] = useState<number | null>(null);
  const results = record?.results ?? new Array(DAILY_SIZE).fill(null);
  const firstOpen = results.findIndex((r) => !r);

  if (active !== null && puzzles[active]) {
    const p = puzzles[active] as Puzzle;
    const replay = !!results[active];
    return (
      <div className="screen play">
        <div className="session-bar">
          <div className="session-info">
            <strong>Daily challenge · {date}</strong>
            <span className="session-count">
              Puzzle {active + 1} / {DAILY_SIZE}
            </span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setActive(null)}>
            <Icon name="back" /> All daily puzzles
          </button>
        </div>
        <PuzzlePlayer
          key={p.id + String(replay)}
          puzzle={p}
          hintsEnabled
          timeLimitSec={null}
          replay={replay}
          mode="daily"
          onFinished={(rec, res) => {
            if (!replay) game.setDailyResult(date, active, rec.outcome, DAILY_SIZE, res.xp);
          }}
          nextLabel={active + 1 < DAILY_SIZE ? 'Next daily puzzle' : 'Back to the daily overview'}
          onNext={() => setActive(active + 1 < DAILY_SIZE ? active + 1 : null)}
          onSkip={() => {
            if (!replay) game.setDailyResult(date, active, 'skipped', DAILY_SIZE, 0);
            setActive(active + 1 < DAILY_SIZE ? active + 1 : null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="screen narrow">
      <h1>
        <Icon name="calendar" size={26} /> Daily challenge
      </h1>
      <p className="lead">
        Five puzzles from different categories, rising in difficulty. Everyone playing MINDVAULT gets the same set today — it is generated from the date, entirely on your device. Your first attempt at each puzzle counts; replays are recorded separately.
      </p>
      <p>
        Current streak: <strong>{game.profile.daily.streak}</strong> day{game.profile.daily.streak === 1 ? '' : 's'} · Best: <strong>{game.profile.daily.best}</strong>
      </p>
      {error && <p className="warn">Could not prepare today’s puzzles: {error}</p>}
      <ol className="daily-list">
        {puzzles.map((p, i) =>
          p ? (
            <li key={p.id} className={`daily-item cat-${p.category}`}>
              <div>
                <span className={`cat-chip chip-${p.category}`}>
                  <Icon name={CATEGORY_INFO[p.category].icon} /> {CATEGORY_INFO[p.category].short}
                </span>
                <strong>{p.family}</strong> <span className="muted">· {DIFFICULTY_NAMES[p.difficulty]}</span>
              </div>
              <div className="row-actions">
                {results[i] ? <span className={`outcome outcome-${results[i]}`}>{results[i]}</span> : <span className="muted">not played</span>}
                <button type="button" className={`btn ${i === firstOpen ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActive(i)}>
                  {results[i] ? 'Replay' : 'Play'}
                </button>
              </div>
            </li>
          ) : (
            <li key={i} className="daily-item">
              This puzzle could not be rebuilt (the generator has changed since it was created).
            </li>
          ),
        )}
      </ol>
      {record?.completed && <p className="success-note">All five done today. Come back tomorrow for a new set!</p>}
    </div>
  );
}
