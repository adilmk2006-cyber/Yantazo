/**
 * Investigation interface for one authored case: briefing, interrogations,
 * evidence, an evidence board for linking contradictions, a reconstructed
 * timeline, the accusation and — only after solving or giving up — the full
 * solution.
 */
import { useMemo, useState } from 'react';
import { caseById } from '../../mysteries/cases';
import type { Evidence, MysteryCase, Statement, Suspect } from '../../mysteries/types';
import { toMinutes } from '../../mysteries/verify';
import { DIFFICULTY_NAMES } from '../../engine/types';
import type { Accusation, CaseProgress } from '../../state/stores';
import { emptyCaseProgress } from '../../state/stores';
import { useGame } from '../GameContext';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { Portrait } from './Portrait';

type Tab = 'briefing' | 'suspects' | 'evidence' | 'board' | 'timeline' | 'accuse' | 'solution';

const KIND_LABEL: Record<Evidence['kind'], string> = {
  physical: 'Physical',
  document: 'Document',
  forensic: 'Forensic',
  testimony: 'Testimony',
  record: 'Record',
  photo: 'Photo / video',
};

export default function CaseScreen({ caseId }: { caseId: string }) {
  const c = caseById(caseId);
  const game = useGame();
  const [tab, setTab] = useState<Tab>('briefing');
  if (!c)
    return (
      <div className="screen narrow">
        <h1>Case not found</h1>
        <a href={href('/mysteries')}>Back to the case files</a>
      </div>
    );
  const prog = game.cases[c.id] ?? emptyCaseProgress();
  const update = (fn: (p: CaseProgress) => CaseProgress) => game.updateCase(c.id, fn);
  const closed = prog.solved || prog.revealed;
  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: 'briefing', label: 'Briefing' },
    { id: 'suspects', label: 'Suspects', badge: `${prog.interviewed.length}/${c.suspects.length}` },
    { id: 'evidence', label: 'Evidence', badge: `${prog.inspected.length}/${c.evidence.length}` },
    { id: 'board', label: 'Board', badge: `${prog.contradictions.length}` },
    { id: 'timeline', label: 'Timeline' },
    { id: 'accuse', label: 'Accuse' },
    ...(closed && !prog.replaying ? [{ id: 'solution' as Tab, label: 'Solution' }] : []),
  ];

  return (
    <div className="screen case-screen">
      <a className="back-link" href={href('/mysteries')}>
        <Icon name="back" /> All cases
      </a>
      <header className="case-header">
        <div>
          <p className="eyebrow">
            {DIFFICULTY_NAMES[c.difficulty]} · {c.setting}
          </p>
          <h1>{c.title}</h1>
          <p className="case-subtitle">{c.subtitle}</p>
        </div>
        {closed && (
          <div className="case-closed">
            <span className={`meta-pill pill-${prog.solved ? 'correct' : 'revealed'}`}>{prog.solved ? 'Solved' : 'Solution revealed'}</span>
            {!prog.replaying && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  update((p) => ({ ...p, inspected: [], interviewed: [], contradictions: [], board: [], timelinePlaced: {}, replaying: true, replays: p.replays + 1 }));
                  setTab('briefing');
                }}
              >
                <Icon name="restart" /> Replay case
              </button>
            )}
          </div>
        )}
      </header>
      {prog.replaying && <p className="banner banner-info">Replay: your original first-accusation result is kept; this run is recorded separately.</p>}

      <div className="tabs case-tabs" role="tablist" aria-label="Investigation">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="case-panel">
        {tab === 'briefing' && <Briefing c={c} onStart={() => setTab('suspects')} />}
        {tab === 'suspects' && <Suspects c={c} prog={prog} update={update} />}
        {tab === 'evidence' && <EvidenceTab c={c} prog={prog} update={update} />}
        {tab === 'board' && <Board c={c} prog={prog} update={update} />}
        {tab === 'timeline' && <Timeline c={c} prog={prog} update={update} />}
        {tab === 'accuse' && <Accuse c={c} prog={prog} update={update} onSolution={() => setTab('solution')} />}
        {tab === 'solution' && <Solution c={c} prog={prog} />}
      </div>
    </div>
  );
}

function Briefing({ c, onStart }: { c: MysteryCase; onStart(): void }) {
  return (
    <div className="briefing">
      <p className="lead">{c.synopsis}</p>
      <div className="two-col">
        <section className="panel">
          <h2>The victim</h2>
          <p>
            <strong>{c.victim.name}</strong>
          </p>
          <p>{c.victim.description}</p>
          <p className="muted">{c.victim.found}</p>
        </section>
        <section className="panel">
          <h2>The scene</h2>
          <p>{c.scene}</p>
          <p className="muted small">Investigative angle: {c.structure}</p>
        </section>
      </div>
      <section className="panel">
        <h2>How to investigate</h2>
        <ol>
          <li>Interview every suspect and inspect the evidence — new timeline entries appear as you go.</li>
          <li>On the board, pair a statement with a piece of evidence to test whether it exposes a lie.</li>
          <li>When you can explain who had the means, the access and the opportunity, make your accusation with the method and your key evidence.</li>
        </ol>
        <button type="button" className="btn btn-primary" onClick={onStart}>
          Begin the investigation <Icon name="arrow" />
        </button>
      </section>
    </div>
  );
}

function toggle<T>(list: T[], x: T): T[] {
  return list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
}

function Suspects({ c, prog, update }: { c: MysteryCase; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void }) {
  const [open, setOpen] = useState<string | null>(null);
  const s = c.suspects.find((x) => x.id === open);
  return (
    <div className="suspects-layout">
      <ul className="suspect-list">
        {c.suspects.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              className={`suspect-btn${open === x.id ? ' is-on' : ''}`}
              onClick={() => {
                setOpen(x.id);
                if (!prog.interviewed.includes(x.id)) update((p) => ({ ...p, interviewed: [...p.interviewed, x.id] }));
              }}
              aria-expanded={open === x.id}
            >
              <Portrait p={x.portrait} size={48} label={`Portrait of ${x.name}`} />
              <span>
                <strong>{x.name}</strong>
                <span className="muted small">{x.role}</span>
              </span>
              {prog.interviewed.includes(x.id) && <Icon name="check" className="done-mark" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="suspect-detail">
        {!s ? (
          <p className="muted">Choose a suspect to read their file and interview them.</p>
        ) : (
          <SuspectFile s={s} prog={prog} update={update} />
        )}
      </div>
    </div>
  );
}

function SuspectFile({ s, prog, update }: { s: Suspect; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void }) {
  return (
    <article className="panel suspect-file">
      <header className="suspect-head">
        <Portrait p={s.portrait} size={96} label={`Portrait of ${s.name}`} />
        <div>
          <h2>{s.name}</h2>
          <p className="muted">{s.role}</p>
          <p>{s.bio}</p>
        </div>
      </header>
      <dl className="kv">
        <dt>Relationship</dt>
        <dd>{s.relationship}</dd>
        <dt>Possible motive</dt>
        <dd>{s.motive}</dd>
        <dt>Alibi given</dt>
        <dd>{s.alibi}</dd>
      </dl>
      <h3>Interview</h3>
      <ul className="interview">
        {s.statements.map((st) => (
          <li key={st.id}>
            <p className="q">Q: {st.question}</p>
            <p className="a">“{st.answer}”</p>
            <button type="button" className={`pin-btn${prog.board.includes(st.id) ? ' is-on' : ''}`} onClick={() => update((p) => ({ ...p, board: toggle(p.board, st.id) }))} aria-pressed={prog.board.includes(st.id)}>
              <Icon name="pin" size={14} /> {prog.board.includes(st.id) ? 'Pinned' : 'Pin to board'}
            </button>
          </li>
        ))}
      </ul>
      <label className="field">
        <span className="field-label">Your notes on {s.name}</span>
        <textarea rows={3} value={prog.notes[s.id] ?? ''} onChange={(e) => update((p) => ({ ...p, notes: { ...p.notes, [s.id]: e.target.value } }))} />
      </label>
    </article>
  );
}

function EvidenceTab({ c, prog, update }: { c: MysteryCase; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="evidence-grid">
      {c.evidence.map((e) => {
        const seen = prog.inspected.includes(e.id);
        const isOpen = open === e.id;
        return (
          <article key={e.id} className={`evidence-card kind-${e.kind}${seen ? ' is-seen' : ''}${isOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="evidence-head"
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(isOpen ? null : e.id);
                if (!seen) update((p) => ({ ...p, inspected: [...p.inspected, e.id] }));
              }}
            >
              <span className="evidence-kind">{KIND_LABEL[e.kind]}</span>
              <strong>{e.title}</strong>
              <span className="muted small">{e.location}</span>
              <span className="muted small">{e.summary}</span>
              {!seen && <span className="new-dot">Uninspected</span>}
            </button>
            {isOpen && (
              <div className="evidence-body">
                <p>{e.details}</p>
                <button type="button" className={`pin-btn${prog.board.includes(e.id) ? ' is-on' : ''}`} onClick={() => update((p) => ({ ...p, board: toggle(p.board, e.id) }))} aria-pressed={prog.board.includes(e.id)}>
                  <Icon name="pin" size={14} /> {prog.board.includes(e.id) ? 'Pinned' : 'Pin to board'}
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Board({ c, prog, update }: { c: MysteryCase; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void }) {
  const statements = c.suspects.filter((s) => prog.interviewed.includes(s.id)).flatMap((s) => s.statements.map((st) => ({ s, st })));
  const evidence = c.evidence.filter((e) => prog.inspected.includes(e.id));
  const [stId, setStId] = useState('');
  const [evId, setEvId] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const pinned = prog.board;
  const describe = (id: string) => {
    const st = c.suspects.flatMap((s) => s.statements.map((x) => ({ s, x }))).find((y) => y.x.id === id);
    if (st) return { title: `${st.s.name}: “${st.x.answer}”`, kind: 'Statement' };
    const ev = c.evidence.find((e) => e.id === id);
    return ev ? { title: `${ev.title} — ${ev.summary}`, kind: KIND_LABEL[ev.kind] } : null;
  };
  const test = () => {
    const k = c.contradictions.find((x) => x.statementId === stId && x.evidenceId === evId);
    if (k) {
      if (!prog.contradictions.includes(k.id)) update((p) => ({ ...p, contradictions: [...p.contradictions, k.id] }));
      setFeedback({ ok: true, text: k.explanation });
    } else setFeedback({ ok: false, text: 'These two do not contradict each other. Look for a statement about where someone was, or what they knew, that a record or witness proves false.' });
  };
  return (
    <div className="board">
      <section className="panel">
        <h2>Test for a contradiction</h2>
        <p className="muted small">Only interviewed statements and inspected evidence are available.</p>
        <div className="board-pickers">
          <label className="field">
            <span className="field-label">Statement</span>
            <select value={stId} onChange={(e) => setStId(e.target.value)}>
              <option value="">— choose a statement —</option>
              {statements.map(({ s, st }) => (
                <option key={st.id} value={st.id}>
                  {s.name}: {st.answer.slice(0, 80)}
                  {st.answer.length > 80 ? '…' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Evidence</span>
            <select value={evId} onChange={(e) => setEvId(e.target.value)}>
              <option value="">— choose evidence —</option>
              {evidence.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={!stId || !evId} onClick={test}>
            <Icon name="link" /> Do these conflict?
          </button>
        </div>
        {feedback && (
          <p className={feedback.ok ? 'success-note' : 'warn'} role="status">
            {feedback.ok ? 'Contradiction found: ' : ''}
            {feedback.text}
          </p>
        )}
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Contradictions found ({prog.contradictions.length})</h2>
          {prog.contradictions.length === 0 ? (
            <p className="muted">None yet.</p>
          ) : (
            <ul className="found-list">
              {prog.contradictions.map((id) => {
                const k = c.contradictions.find((x) => x.id === id);
                return k ? <li key={id}>{k.explanation}</li> : null;
              })}
            </ul>
          )}
          <p className="muted small">Not every lie is a confession: some suspects hide things that have nothing to do with the murder.</p>
        </section>
        <section className="panel">
          <h2>Pinned items</h2>
          {pinned.length === 0 ? (
            <p className="muted">Pin statements and evidence from the other tabs to keep them in view here.</p>
          ) : (
            <ul className="pinned">
              {pinned.map((id) => {
                const d = describe(id);
                return d ? (
                  <li key={id} className="pin-card">
                    <span className="evidence-kind">{d.kind}</span>
                    <span>{d.title}</span>
                    <button type="button" className="icon-btn" onClick={() => update((p) => ({ ...p, board: p.board.filter((x) => x !== id) }))} aria-label="Unpin">
                      <Icon name="cross" size={14} />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Timeline({ c, prog, update }: { c: MysteryCase; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void }) {
  const known = new Set([...prog.inspected, ...c.suspects.filter((s) => prog.interviewed.includes(s.id)).flatMap((s) => s.statements.map((st: Statement) => st.id))]);
  const events = c.timeline.filter((t) => t.sources.some((src) => known.has(src))).sort((a, b) => toMinutes(a.time, c.crossesMidnight) - toMinutes(b.time, c.crossesMidnight));
  const hidden = c.timeline.length - events.length;
  return (
    <section className="panel">
      <h2>Reconstructed timeline</h2>
      <p className="muted small">Established facts come from records and independent witnesses; claims come from suspects. Mark each claim as you test it.</p>
      <ol className="timeline">
        {events.map((t) => (
          <li key={t.id} className={`tl-item tl-${t.kind}`}>
            <time>{t.time}</time>
            <div>
              <span className={`tl-kind`}>{t.kind === 'established' ? 'Established' : 'Claim'}</span>
              <p>{t.text}</p>
              {t.kind === 'claimed' && (
                <div className="seg small" role="group" aria-label="Your assessment">
                  {(['supported', 'doubtful'] as const).map((v) => (
                    <button
                      type="button"
                      key={v}
                      className={`seg-btn${prog.timelinePlaced[t.id] === v ? ' is-on' : ''}`}
                      aria-pressed={prog.timelinePlaced[t.id] === v}
                      onClick={() => update((p) => ({ ...p, timelinePlaced: { ...p.timelinePlaced, [t.id]: p.timelinePlaced[t.id] === v ? '' : v } }))}
                    >
                      {v === 'supported' ? 'Supported' : 'Doubtful'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {hidden > 0 && <p className="muted">{hidden} more event{hidden === 1 ? '' : 's'} will appear as you interview suspects and inspect evidence.</p>}
    </section>
  );
}

function Accuse({ c, prog, update, onSolution }: { c: MysteryCase; prog: CaseProgress; update(fn: (p: CaseProgress) => CaseProgress): void; onSolution(): void }) {
  const game = useGame();
  const [culprit, setCulprit] = useState('');
  const [method, setMethod] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confirmThin, setConfirmThin] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  // An accusation made in this visit keeps its verdict on screen even though
  // a correct one closes the case.
  const [accusedHere, setAccusedHere] = useState(false);
  const last = prog.accusations[prog.accusations.length - 1];
  const thin = prog.inspected.length < Math.ceil(c.evidence.length * 0.6) || prog.interviewed.length < c.suspects.length;
  const inspected = c.evidence.filter((e) => prog.inspected.includes(e.id));
  const closedFirst = (prog.solved || prog.revealed) && !prog.replaying;
  const result = useMemo(() => last, [last]);

  const submit = () => {
    if (thin && !confirmThin) {
      setConfirmThin(true);
      return;
    }
    const acc: Accusation = {
      culprit,
      method: method || null,
      evidence: evidence || null,
      correct: culprit === c.truth.culprit,
      methodCorrect: method === c.truth.method,
      evidenceCorrect: c.truth.keyEvidence.includes(evidence),
      at: Date.now(),
    };
    const firstEver = prog.firstResult === null;
    const wasSolved = prog.solved;
    update((p) => ({
      ...p,
      accusations: [...p.accusations, acc].slice(-20),
      solved: p.solved || acc.correct,
      firstResult: p.firstResult ?? (acc.correct ? 'correct' : 'incorrect'),
      replayCorrect: p.replaying && acc.correct ? p.replayCorrect + 1 : p.replayCorrect,
      replaying: acc.correct ? false : p.replaying,
    }));
    if (acc.correct) game.mysterySolved(firstEver && acc.methodCorrect && acc.evidenceCorrect, !wasSolved);
    setConfirmThin(false);
    setAccusedHere(true);
  };

  const verdict = result && (
    <section className={`panel accusation-result ${result.correct ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
      {result.correct ? (
        <>
          <h2>
            <Icon name="check" /> Case solved
          </h2>
          <p>
            {c.suspects.find((s) => s.id === result.culprit)?.name} is the culprit.{' '}
            {result.methodCorrect ? 'You identified the method correctly.' : 'Your method was not quite right.'}{' '}
            {result.evidenceCorrect ? 'Your key evidence is decisive.' : 'Your chosen evidence is not the decisive piece, but the conclusion is right.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={onSolution}>
            Read the full solution
          </button>
        </>
      ) : (
        <>
          <h2>
            <Icon name="cross" /> The case collapses
          </h2>
          <p>The evidence does not support charging {c.suspects.find((s) => s.id === result.culprit)?.name}. Re-examine the alibis against the murder window, and who could really reach the scene.</p>
        </>
      )}
    </section>
  );

  if (closedFirst)
    return accusedHere && verdict ? (
      <div className="accuse">{verdict}</div>
    ) : (
      <section className="panel">
        <p>This case is closed. Read the solution, or replay the case to investigate it again.</p>
        <button type="button" className="btn btn-primary" onClick={onSolution}>
          Read the solution
        </button>
      </section>
    );

  return (
    <div className="accuse">
      <section className="panel">
        <h2>Who did it?</h2>
        <div className="accuse-suspects" role="radiogroup" aria-label="Culprit">
          {c.suspects.map((s) => (
            <label key={s.id} className={`accuse-card${culprit === s.id ? ' is-on' : ''}`}>
              <input type="radio" name="culprit" value={s.id} checked={culprit === s.id} onChange={() => setCulprit(s.id)} className="sr-only" />
              <Portrait p={s.portrait} size={64} label="" />
              <strong>{s.name}</strong>
              <span className="muted small">{s.role}</span>
            </label>
          ))}
        </div>
        <fieldset className="field">
          <legend className="field-label">How was it done?</legend>
          {c.methods.map((m) => (
            <label key={m.id} className="radio-line">
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} /> {m.text}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span className="field-label">Your key piece of evidence</span>
          <select value={evidence} onChange={(e) => setEvidence(e.target.value)}>
            <option value="">— choose from inspected evidence —</option>
            {inspected.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        {confirmThin && (
          <p className="warn" role="alert">
            You have interviewed {prog.interviewed.length} of {c.suspects.length} suspects and inspected {prog.inspected.length} of {c.evidence.length} pieces of evidence. Press “Make the accusation” again to accuse anyway.
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={!culprit || !method} onClick={submit}>
            Make the accusation
          </button>
          {!confirmReveal ? (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReveal(true)}>
              Give up and reveal the solution
            </button>
          ) : (
            <span className="confirm">
              Revealing ends this investigation.
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  update((p) => ({ ...p, revealed: true, replaying: false, firstResult: p.firstResult ?? 'revealed' }));
                  onSolution();
                }}
              >
                Reveal
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReveal(false)}>
                Keep investigating
              </button>
            </span>
          )}
        </div>
      </section>
      {verdict}
    </div>
  );
}

function Solution({ c, prog }: { c: MysteryCase; prog: CaseProgress }) {
  const name = (id: string) => c.suspects.find((s) => s.id === id)?.name ?? id;
  const ev = (id: string) => c.evidence.find((e) => e.id === id)?.title ?? c.suspects.flatMap((s) => s.statements).find((st) => st.id === id)?.question ?? id;
  return (
    <div className="solution">
      <section className="panel">
        <h2>
          Solution: {name(c.truth.culprit)}, {c.methods.find((m) => m.id === c.truth.method)?.text.toLowerCase()}
        </h2>
        <p className="lead">{c.solution.summary}</p>
        <p>
          <strong>Motive:</strong> {c.truth.motive}
        </p>
        {prog.firstResult && (
          <p className="muted">
            Your first accusation: {prog.firstResult}. Total accusations: {prog.accusations.length}.
          </p>
        )}
      </section>
      <div className="two-col">
        <section className="panel">
          <h3>What really happened</h3>
          <ol className="timeline">
            {c.truth.narrative.map((n, i) => (
              <li key={i} className="tl-item tl-established">
                <time>{n.time}</time>
                <p>{n.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel">
          <h3>Decisive evidence</h3>
          <ul className="found-list">
            {c.solution.decisive.map((d) => (
              <li key={d.evidenceId}>
                <strong>{ev(d.evidenceId)}:</strong> {d.why}
              </li>
            ))}
          </ul>
          <h3>Why the others are innocent</h3>
          <ul className="found-list">
            {c.solution.eliminations.map((e) => (
              <li key={e.suspectId}>
                <strong>{name(e.suspectId)}:</strong> {e.reason} <span className="muted small">({e.evidence.map(ev).join(', ')})</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel">
        <h3>Red herrings explained</h3>
        <ul className="found-list">
          {c.solution.redHerrings.map((r) => (
            <li key={r.ref}>
              <strong>{ev(r.ref)}:</strong> {r.explanation}
            </li>
          ))}
        </ul>
        <h3>Every contradiction in the case</h3>
        <ul className="found-list">
          {c.contradictions.map((k) => (
            <li key={k.id}>
              {k.redHerring ? <span className="meta-pill">red herring</span> : <span className="meta-pill pill-incorrect">incriminating</span>} {k.explanation}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
