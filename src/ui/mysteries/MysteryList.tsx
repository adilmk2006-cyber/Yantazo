import { CASES } from '../../mysteries/cases';
import { DIFFICULTY_NAMES } from '../../engine/types';
import { useGame } from '../GameContext';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { Portrait } from './Portrait';

export default function MysteryList() {
  const { cases } = useGame();
  const solved = CASES.filter((c) => cases[c.id]?.solved).length;
  return (
    <div className="screen mysteries">
      <h1>
        <Icon name="mystery" size={26} /> Murder mysteries
      </h1>
      <p className="lead">
        A finite campaign of {CASES.length} hand-crafted investigations, separate from endless play. Every case has been checked so that the complete evidence points to exactly one culprit. Interview suspects, inspect evidence, link contradictions on the board and name the killer.
      </p>
      <p className="muted">
        {solved} of {CASES.length} solved. Your first accusation in each case is recorded separately from replays.
      </p>
      <div className="case-grid">
        {CASES.map((c, i) => {
          const prog = cases[c.id];
          const status = prog?.solved ? 'Solved' : prog?.revealed ? 'Solution revealed' : prog && (prog.inspected.length || prog.interviewed.length) ? 'In progress' : 'New case';
          return (
            <a key={c.id} className={`case-card${prog?.solved ? ' is-solved' : ''}`} href={href(`/mysteries/${c.id}`)}>
              <div className="case-top">
                <span className="case-number">Case {i + 1}</span>
                <span className={`case-status status-${status.split(' ')[0].toLowerCase()}`}>{status}</span>
              </div>
              <h2>{c.title}</h2>
              <p className="case-subtitle">{c.subtitle}</p>
              <div className="case-faces" aria-hidden>
                {c.suspects.map((s) => (
                  <Portrait key={s.id} p={s.portrait} size={36} label={s.name} />
                ))}
              </div>
              <p className="muted small">{c.structure}</p>
              <div className="case-meta">
                <span className="meta-pill">{DIFFICULTY_NAMES[c.difficulty]}</span>
                <span className="meta-pill">{c.suspects.length} suspects</span>
                <span className="meta-pill">{c.evidence.length} pieces of evidence</span>
                {prog?.firstResult && <span className={`meta-pill pill-${prog.firstResult}`}>First accusation: {prog.firstResult}</span>}
                {prog?.replays ? <span className="meta-pill pill-replay">Replays: {prog.replayCorrect}/{prog.replays}</span> : null}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
