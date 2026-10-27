import { useGame } from '../GameContext';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { CATEGORIES, CATEGORY_INFO } from '../../engine/types';
import { levelFor, todayString } from '../../state/progress';
import { DAILY_SIZE } from '../../state/daily';
import { CASES } from '../../mysteries/cases';

export function Home() {
  const { profile, daily, cases } = useGame();
  const lvl = levelFor(profile.xp);
  const today = daily.find((d) => d.date === todayString());
  const doneToday = today ? today.results.filter(Boolean).length : 0;
  const solvedCases = CASES.filter((c) => cases[c.id]?.solved).length;
  return (
    <div className="screen home">
      <section className="hero">
        <div className="hero-glow" aria-hidden />
        <p className="eyebrow">Endless reasoning · Curated mysteries</p>
        <h1 className="logo" aria-label="MINDVAULT">
          MIND<span>VAULT</span>
        </h1>
        <p className="tagline">A vault of puzzles that never runs dry: every challenge is generated on demand, checked for a single defensible answer, and explained step by step.</p>
        <div className="hero-stats" aria-label="Your progress">
          <span>
            <Icon name="star" /> Level {lvl.level}
          </span>
          <span>
            <Icon name="check" /> {profile.totalSolved} solved
          </span>
          <span>
            <Icon name="flame" /> Best streak {profile.streak.best}
          </span>
        </div>
      </section>

      <section className="entrances" aria-label="Choose a mode">
        <a className="entrance entrance-endless" href={href('/endless')}>
          <div className="entrance-art" aria-hidden>
            <Icon name="infinity" size={42} />
          </div>
          <h2>Endless Reasoning</h2>
          <p>Visual matrices, fluid reasoning, logic, lateral thinking, riddles, spatial and memory puzzles — freshly generated, with no fixed question bank.</p>
          <span className="entrance-cta">
            Enter the vault <Icon name="arrow" />
          </span>
        </a>
        <a className="entrance entrance-mystery" href={href('/mysteries')}>
          <div className="entrance-art" aria-hidden>
            <Icon name="mystery" size={42} />
          </div>
          <h2>Murder Mysteries</h2>
          <p>
            {CASES.length} hand-crafted investigations: interview suspects, inspect evidence, expose contradictions and name the killer.
          </p>
          <span className="entrance-cta">
            {solvedCases ? `${solvedCases} of ${CASES.length} solved` : 'Open the case files'} <Icon name="arrow" />
          </span>
        </a>
      </section>

      <section className="home-row">
        <a className="card daily-card" href={href('/daily')}>
          <h3>
            <Icon name="calendar" /> Daily challenge
          </h3>
          <p>
            {doneToday === DAILY_SIZE ? 'Completed today — come back tomorrow.' : `${doneToday} of ${DAILY_SIZE} puzzles done today.`} Streak: {profile.daily.streak} day{profile.daily.streak === 1 ? '' : 's'}.
          </p>
        </a>
        <a className="card" href={href('/dashboard')}>
          <h3>
            <Icon name="chart" /> Progress
          </h3>
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={lvl.needed} aria-valuenow={lvl.into} aria-label={`Level ${lvl.level} progress`}>
            <span style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
          </div>
          <p>
            {lvl.into} / {lvl.needed} XP to level {lvl.level + 1}
          </p>
        </a>
      </section>

      <section aria-labelledby="quick-start">
        <h2 id="quick-start" className="section-title">
          Quick start a focused session
        </h2>
        <div className="category-grid">
          {CATEGORIES.map((c) => {
            const info = CATEGORY_INFO[c];
            const s = profile.categories[c];
            return (
              <a key={c} className={`category-card cat-${c}`} href={href(`/endless?focus=${c}`)}>
                <span className="category-icon" aria-hidden>
                  <Icon name={info.icon} size={26} />
                </span>
                <h3>{info.name}</h3>
                <p>{info.blurb}</p>
                <span className="muted small">
                  {s.attempts ? `${s.correct}/${s.attempts} solved · tier ${s.level}` : 'Not tried yet'}
                </span>
              </a>
            );
          })}
          <a className="category-card cat-mixed" href={href('/endless?focus=mixed')}>
            <span className="category-icon" aria-hidden>
              <Icon name="shuffle" size={26} />
            </span>
            <h3>Mixed Challenge</h3>
            <p>An uninterrupted mix of every category that never repeats a category twice in a row.</p>
            <span className="muted small">Adaptive difficulty per category</span>
          </a>
        </div>
      </section>
    </div>
  );
}
