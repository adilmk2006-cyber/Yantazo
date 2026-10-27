import { CATEGORIES, CATEGORY_INFO, DIFFICULTY_NAMES } from '../../engine/types';
import type { Difficulty } from '../../engine/types';
import { ACHIEVEMENTS, accuracy, levelFor } from '../../state/progress';
import { CASES } from '../../mysteries/cases';
import { useGame } from '../GameContext';
import { Icon } from '../components/Icon';
import { Stat } from './EndlessSession';
import { href } from '../router';

function pct(x: number | null): string {
  return x === null ? '—' : `${Math.round(x * 100)}%`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted small">Not enough data yet</span>;
  const w = 120;
  const h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - v * (h - 4)}`).join(' ');
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" role="img" aria-label={`Recent results: average ${Math.round(avg * 100)}% over the last ${values.length} puzzles`}>
      <polyline points={pts} />
    </svg>
  );
}

export function Dashboard() {
  const { profile, cases, saved } = useGame();
  const lvl = levelFor(profile.xp);
  const totals = CATEGORIES.reduce(
    (t, c) => {
      const s = profile.categories[c];
      return { attempts: t.attempts + s.attempts, correct: t.correct + s.correct, hints: t.hints + s.hintsUsed, skips: t.skips + s.skips, reveals: t.reveals + s.reveals };
    },
    { attempts: 0, correct: 0, hints: 0, skips: 0, reveals: 0 },
  );
  const families = CATEGORIES.flatMap((c) => Object.entries(profile.categories[c].families).map(([f, t]) => ({ f, c, ...t }))).sort((a, b) => b.attempts - a.attempts);
  const solvedCases = CASES.filter((c) => cases[c.id]?.solved).length;

  return (
    <div className="screen dashboard">
      <h1>Your progress</h1>
      <p className="muted">These are practice statistics to track your own improvement. They are not an IQ score or a scientifically validated measure of intelligence, and solving speed is shown separately from accuracy on purpose.</p>

      <section className="panel level-panel">
        <div>
          <span className="eyebrow">Level</span>
          <span className="big-number">{lvl.level}</span>
        </div>
        <div className="grow">
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={lvl.needed} aria-valuenow={lvl.into} aria-label="Experience towards next level">
            <span style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
          </div>
          <p className="muted small">
            {profile.xp} XP total · {lvl.needed - lvl.into} XP to level {lvl.level + 1}
          </p>
        </div>
      </section>

      <div className="summary-grid">
        <Stat label="Puzzles attempted (first tries)" value={totals.attempts} />
        <Stat label="Solved" value={totals.correct} />
        <Stat label="Overall accuracy" value={pct(totals.attempts ? totals.correct / totals.attempts : null)} />
        <Stat label="Hints per puzzle" value={totals.attempts ? (totals.hints / totals.attempts).toFixed(2) : '—'} />
        <Stat label="Current / best streak" value={`${profile.streak.current} / ${profile.streak.best}`} />
        <Stat label="Mysteries solved" value={`${solvedCases} / ${CASES.length}`} />
        <Stat label="Daily streak (best)" value={`${profile.daily.streak} (${profile.daily.best})`} />
        <Stat label="Saved puzzles" value={saved.length} />
      </div>

      <h2 className="section-title">By category</h2>
      <div className="stats-grid">
        {CATEGORIES.map((c) => {
          const s = profile.categories[c];
          const info = CATEGORY_INFO[c];
          return (
            <section key={c} className={`panel stat-card cat-${c}`} aria-labelledby={`st-${c}`}>
              <h3 id={`st-${c}`}>
                <Icon name={info.icon} /> {info.name}
              </h3>
              <dl className="kv">
                <dt>Accuracy</dt>
                <dd>{pct(accuracy(s))}</dd>
                <dt>First attempts</dt>
                <dd>
                  {s.correct} / {s.attempts}
                </dd>
                <dt>Completion rate</dt>
                <dd>{pct(s.attempts + s.skips ? (s.attempts - s.reveals) / (s.attempts + s.skips) : null)}</dd>
                <dt>Hints used</dt>
                <dd>{s.hintsUsed}</dd>
                <dt>Reveals / skips</dt>
                <dd>
                  {s.reveals} / {s.skips}
                </dd>
                <dt>Average time</dt>
                <dd>{s.answered ? `${Math.round(s.answeredTimeMs / s.answered / 1000)} s` : '—'}</dd>
                <dt>Fastest solve</dt>
                <dd>{s.fastestCorrectMs !== null ? `${Math.round(s.fastestCorrectMs / 1000)} s` : '—'}</dd>
                <dt>Hardest tier solved</dt>
                <dd>{s.maxSolved ? DIFFICULTY_NAMES[s.maxSolved as Difficulty] : '—'}</dd>
                <dt>Adaptive tier</dt>
                <dd>{DIFFICULTY_NAMES[s.level]}</dd>
                <dt>Best streak</dt>
                <dd>{s.bestStreak}</dd>
                <dt>Replays</dt>
                <dd>
                  {s.replay.correct} / {s.replay.attempts}
                </dd>
                {c === 'observation' && (
                  <>
                    <dt>Practice-mode</dt>
                    <dd>
                      {s.practice.correct} / {s.practice.attempts}
                    </dd>
                  </>
                )}
              </dl>
              <div className="by-diff" aria-label="Accuracy by difficulty">
                {([1, 2, 3, 4] as Difficulty[]).map((d) => (
                  <span key={d} className="diff-cell" title={DIFFICULTY_NAMES[d]}>
                    <span className="muted small">{DIFFICULTY_NAMES[d].slice(0, 4)}</span> {pct(accuracy(s.byDifficulty[d]))}
                  </span>
                ))}
              </div>
              <Sparkline values={s.recent} />
            </section>
          );
        })}
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Reasoning families you practise most</h2>
          {families.length === 0 ? (
            <p className="muted">Play a few puzzles to see this.</p>
          ) : (
            <ul className="family-list">
              {families.slice(0, 12).map((f) => (
                <li key={`${f.c}-${f.f}`}>
                  <span>{f.f}</span>
                  <span className="muted">
                    {f.correct}/{f.attempts}
                  </span>
                  <span className="bar" aria-hidden>
                    <span style={{ width: `${(f.attempts / families[0].attempts) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Achievements</h2>
          <ul className="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = profile.achievements[a.id];
              return (
                <li key={a.id} className={got ? 'is-earned' : 'is-locked'}>
                  <Icon name={got ? 'trophy' : 'lock'} />
                  <span>
                    <strong>{a.name}</strong>
                    <span className="muted small">{a.description}</span>
                  </span>
                  <span className="sr-only">{got ? 'earned' : 'not yet earned'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <p>
        <a href={href('/history')}>See session history and saved puzzles →</a>
      </p>
    </div>
  );
}
