/**
 * Plays one puzzle: optional memorisation phase → solving (hints, reveal,
 * skip, save) → result with the correct answer, rule, step-by-step solution,
 * why alternatives fail and the skills involved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkResponse } from '../../engine/answers';
import type { CheckResult, PlayerResponse, Puzzle } from '../../engine/types';
import { CATEGORY_INFO, DIFFICULTY_NAMES } from '../../engine/types';
import type { AttemptRecord, Outcome, RecordResult } from '../../state/progress';
import { useGame } from '../GameContext';
import { Blocks } from '../render/BlockView';
import { VisualView } from '../render/VisualView';
import { Icon } from '../components/Icon';
import { AssignInput, CellInput, ChoiceGrid, ChoiceInput, GlyphInput, InvestigationInput, MultiInput, NumberInput, OpenInput, OrderInput, SequenceInput, TextInput } from './inputs';

export interface PlayerProps {
  puzzle: Puzzle;
  hintsEnabled: boolean;
  timeLimitSec: number | null;
  replay: boolean;
  mode: AttemptRecord['mode'];
  paused?: boolean;
  onFinished?(rec: AttemptRecord, result: RecordResult): void;
  onNext(): void;
  onSkip?(): void;
  nextLabel?: string;
  headerExtra?: React.ReactNode;
}

type Phase = 'memorize' | 'solve' | 'confirm-text' | 'assess' | 'result';

function formatTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function isComplete(p: Puzzle, r: PlayerResponse | null): boolean {
  if (!r) return false;
  switch (r.type) {
    case 'order':
      return r.slots.every((x) => x !== null);
    case 'assign':
      return r.table.every((row) => row.every((x) => x !== null));
    case 'sequence':
      return p.interaction.type === 'sequence' && r.items.length === p.interaction.length;
    case 'glyphs':
      return p.interaction.type === 'glyphs' && r.indices.length === p.interaction.count;
    case 'multi':
      return r.ids.length > 0;
    default:
      return true;
  }
}

export function PuzzlePlayer(props: PlayerProps) {
  const { puzzle, hintsEnabled, timeLimitSec, replay, mode, paused } = props;
  const game = useGame();
  const { settings } = game;
  const memorize = puzzle.display.memorize;
  const [phase, setPhase] = useState<Phase>(memorize ? 'memorize' : 'solve');
  const [response, setResponse] = useState<PlayerResponse | null>(null);
  const [hints, setHints] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [practice, setPractice] = useState(false);
  const [peek, setPeek] = useState(false);
  const [result, setResult] = useState<{ outcome: Outcome; check: CheckResult | null; xp: number; timedOut?: boolean } | null>(null);
  const [memLeft, setMemLeft] = useState(0);
  const finished = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Parents key this component by puzzle id, so state starts fresh for every puzzle.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const exposureMs = memorize ? Math.round(memorize.exposureMs * settings.exposureMultiplier) : 0;
  const memRemaining = useRef(exposureMs);

  // memorisation countdown (pauses with the session)
  useEffect(() => {
    if (phase !== 'memorize' || paused) return;
    const start = Date.now();
    const base = memRemaining.current;
    setMemLeft(base);
    const t = window.setInterval(() => {
      const left = base - (Date.now() - start);
      memRemaining.current = Math.max(0, left);
      setMemLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(t);
        setPhase('solve');
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [phase, paused]);

  // solving timer (pauses with the session or when the tab is hidden)
  useEffect(() => {
    if (phase !== 'solve' || paused) return;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible') setElapsed((e) => e + (now - last));
      last = now;
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, paused]);

  const finish = useCallback(
    (outcome: Outcome, check: CheckResult | null, opts: { timedOut?: boolean; selfAssessed?: boolean } = {}) => {
      if (finished.current) return;
      finished.current = true;
      const rec: AttemptRecord = {
        ref: { generator: puzzle.generator, version: puzzle.version, difficulty: puzzle.difficulty, seed: puzzle.seed },
        category: puzzle.category,
        family: puzzle.family,
        title: puzzle.title,
        difficulty: puzzle.difficulty,
        outcome,
        score: check?.score ?? 0,
        hintsUsed: hints,
        timeMs: elapsed,
        selfAssessed: opts.selfAssessed || check?.selfAssessed,
        replay,
        practice,
        mode,
      };
      const res = game.record(rec, puzzle);
      setResult({ outcome, check, xp: res.xp, timedOut: opts.timedOut });
      setPhase('result');
      props.onFinished?.(rec, res);
      window.setTimeout(() => nextRef.current?.focus(), 50);
    },
    [puzzle, hints, elapsed, replay, practice, mode, game, props],
  );

  // timed mode
  useEffect(() => {
    if (timeLimitSec && phase === 'solve' && elapsed >= timeLimitSec * 1000) finish('incorrect', null, { timedOut: true });
  }, [elapsed, timeLimitSec, phase, finish]);

  const submit = () => {
    if (!response || !isComplete(puzzle, response)) return;
    if (puzzle.interaction.type === 'open') {
      setPhase('assess');
      return;
    }
    const check = checkResponse(puzzle, response);
    if (!check.correct && response.type === 'text') {
      setPhase('confirm-text');
      return;
    }
    finish(check.correct ? 'correct' : 'incorrect', check);
  };

  const reveal = () => {
    setConfirmReveal(false);
    finish('revealed', null);
  };

  const skip = () => {
    if (finished.current) return;
    finished.current = true;
    const rec: AttemptRecord = {
      ref: { generator: puzzle.generator, version: puzzle.version, difficulty: puzzle.difficulty, seed: puzzle.seed },
      category: puzzle.category,
      family: puzzle.family,
      title: puzzle.title,
      difficulty: puzzle.difficulty,
      outcome: 'skipped',
      score: 0,
      hintsUsed: hints,
      timeMs: elapsed,
      replay,
      mode,
    };
    game.record(rec, puzzle);
    props.onSkip?.();
  };

  const saved = game.isSaved({ generator: puzzle.generator, version: puzzle.version, difficulty: puzzle.difficulty, seed: puzzle.seed });
  const info = CATEGORY_INFO[puzzle.category];
  const remaining = timeLimitSec ? timeLimitSec * 1000 - elapsed : null;

  return (
    <article className={`player cat-${puzzle.category}`} aria-labelledby={`title-${puzzle.id}`}>
      <header className="player-head">
        <div className="player-meta">
          <span className={`cat-chip chip-${puzzle.category}`}>
            <Icon name={info.icon} /> {info.short}
          </span>
          <span className="meta-pill">{puzzle.family}</span>
          <span className="meta-pill">{DIFFICULTY_NAMES[puzzle.difficulty]}</span>
          {replay && <span className="meta-pill pill-replay">Replay</span>}
          {props.headerExtra}
        </div>
        <div className="player-tools">
          {phase !== 'memorize' && (
            <span className={`timer${remaining !== null && remaining < 15000 ? ' is-low' : ''}`} aria-live="off" title={remaining !== null ? 'Time remaining' : 'Time spent'}>
              <Icon name="clock" /> {remaining !== null ? formatTime(remaining) : formatTime(elapsed)}
            </span>
          )}
          <button type="button" className={`icon-btn${saved ? ' is-on' : ''}`} onClick={() => game.toggleSave(puzzle)} aria-pressed={saved} title={saved ? 'Remove from saved puzzles' : 'Save this puzzle to replay later'}>
            <Icon name="bookmark" />
            <span className="sr-only">{saved ? 'Saved' : 'Save puzzle'}</span>
          </button>
        </div>
      </header>

      <h2 id={`title-${puzzle.id}`} className="player-title" tabIndex={-1} ref={headingRef}>
        {puzzle.title}
      </h2>

      {phase === 'memorize' && memorize && (
        <section className="memorize" aria-live="polite">
          <p className="memorize-instruction">{memorize.instruction}</p>
          <div className="memorize-bar" role="progressbar" aria-valuemin={0} aria-valuemax={exposureMs} aria-valuenow={memLeft} aria-label="Time left to memorise">
            <span style={{ width: `${(memLeft / Math.max(1, exposureMs)) * 100}%` }} />
          </div>
          <Blocks blocks={memorize.blocks} />
          <button type="button" className="btn btn-secondary" onClick={() => setPhase('solve')}>
            I’m ready <Icon name="arrow" />
          </button>
        </section>
      )}

      {phase !== 'memorize' && (
        <>
          <p className="player-prompt">{puzzle.prompt}</p>
          {peek && memorize && (
            <div className="peek">
              <Blocks blocks={memorize.blocks} />
              <button type="button" className="btn btn-ghost" onClick={() => setPeek(false)}>
                Hide again
              </button>
            </div>
          )}
          <Blocks blocks={puzzle.display.blocks} />
        </>
      )}

      {phase === 'solve' && (
        <section className="answer-area" aria-label="Your answer">
          <AnswerInput puzzle={puzzle} value={response} onChange={setResponse} disabled={false} />
          <HintPanel hints={puzzle.hints} shown={hints} enabled={hintsEnabled} onMore={() => setHints((h) => Math.min(3, h + 1))} />
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={submit} disabled={!isComplete(puzzle, response)}>
              {puzzle.interaction.type === 'open' ? 'Compare with the solution' : 'Submit answer'}
            </button>
            {memorize && settings.observationPractice && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPractice(true);
                  setPeek(true);
                }}
                title="Practice mode: results are recorded separately"
              >
                <Icon name="eye" /> View scene again (practice)
              </button>
            )}
            {!confirmReveal ? (
              <button type="button" className="btn btn-ghost" onClick={() => (settings.confirmReveal ? setConfirmReveal(true) : reveal())}>
                <Icon name="unlock" /> Reveal answer
              </button>
            ) : (
              <div className="confirm" role="alertdialog" aria-label="Confirm reveal">
                <span>Revealing ends this attempt and counts it as not solved.</span>
                <button type="button" className="btn btn-danger" onClick={reveal}>
                  Reveal
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmReveal(false)}>
                  Keep trying
                </button>
              </div>
            )}
            {props.onSkip && (
              <button type="button" className="btn btn-ghost" onClick={skip} title="Skipping does not count as a wrong answer">
                <Icon name="skip" /> Skip
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'confirm-text' && puzzle.answer.type === 'text' && (
        <section className="assess" aria-live="polite">
          <h3>Not recognised as an accepted answer</h3>
          <p>
            You wrote <strong>“{response?.type === 'text' ? response.text : ''}”</strong>. The game accepts: <strong>{[puzzle.answer.canonical, ...(puzzle.answer.alternatives ?? [])].join(' · ')}</strong>
            {puzzle.answer.accepted.length > 1 ? ` (and variants such as ${puzzle.answer.accepted.slice(0, 4).join(', ')})` : ''}.
          </p>
          <p className="muted">A simple text comparison cannot understand every phrasing. If your answer means the same thing, you may count it — it will be marked as self-assessed.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => finish('correct', { correct: true, score: 1, selfAssessed: true }, { selfAssessed: true })}>
              My answer means the same
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => finish('incorrect', { correct: false, score: 0 })}>
              It was different — show the explanation
            </button>
          </div>
        </section>
      )}

      {phase === 'assess' && puzzle.answer.type === 'self' && (
        <section className="assess" aria-live="polite">
          <h3>Compare your explanation</h3>
          <div className="compare-grid">
            <div>
              <h4>You wrote</h4>
              <p className="quote">{response?.type === 'self' ? response.text : ''}</p>
            </div>
            <div>
              <h4>Model solution</h4>
              <p className="quote">{puzzle.answer.model}</p>
              <h4>Key points</h4>
              <ul>
                {puzzle.answer.keyPoints.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="muted">How closely does your explanation match? Your verdict is recorded as self-assessed.</p>
          <div className="actions">
            {(['match', 'partial', 'miss'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`btn ${v === 'match' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const r: PlayerResponse = { type: 'self', text: response?.type === 'self' ? response.text : '', verdict: v };
                  setResponse(r);
                  const check = checkResponse(puzzle, r);
                  finish(check.correct ? 'correct' : 'incorrect', check, { selfAssessed: true });
                }}
              >
                {v === 'match' ? 'It matches' : v === 'partial' ? 'Partly' : 'I missed it'}
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'result' && result && (
        <ResultPanel puzzle={puzzle} response={response} result={result} hintsUsed={hints} elapsed={elapsed} nextRef={nextRef} onNext={props.onNext} nextLabel={props.nextLabel} />
      )}
    </article>
  );
}

function HintPanel({ hints, shown, enabled, onMore }: { hints: string[]; shown: number; enabled: boolean; onMore(): void }) {
  if (!enabled) return <p className="muted small">Hints are switched off for this session.</p>;
  return (
    <div className="hints">
      {shown > 0 && (
        <ol className="hint-list" aria-live="polite">
          {hints.slice(0, shown).map((h, i) => (
            <li key={i}>
              <span className="hint-tag">Hint {i + 1}</span> {h}
            </li>
          ))}
        </ol>
      )}
      {shown < 3 && (
        <button type="button" className="btn btn-ghost" onClick={onMore}>
          <Icon name="bulb" /> {shown === 0 ? 'Show a hint' : 'Stronger hint'} ({shown}/3)
        </button>
      )}
    </div>
  );
}

export function AnswerInput({ puzzle, value, onChange, disabled }: { puzzle: Puzzle; value: PlayerResponse | null; onChange(r: PlayerResponse | null): void; disabled: boolean }) {
  const it = puzzle.interaction;
  switch (it.type) {
    case 'choice':
      return <ChoiceInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'multi':
      return <MultiInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'text':
      return <TextInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'number':
      return <NumberInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'order':
      return <OrderInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'assign':
      return <AssignInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'cell':
      return <CellInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'sequence':
      return <SequenceInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'glyphs':
      return <GlyphInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'investigation':
      return <InvestigationInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
    case 'open':
      return <OpenInput interaction={it} value={value} onChange={onChange} disabled={disabled} />;
  }
}

function yourAnswer(puzzle: Puzzle, r: PlayerResponse | null): string | null {
  if (!r) return null;
  const it = puzzle.interaction;
  switch (r.type) {
    case 'choice': {
      const list = it.type === 'choice' || it.type === 'investigation' ? it.choices : it.type === 'text' || it.type === 'number' ? (it.fallback ?? []) : [];
      const c = list.find((x) => x.id === r.id);
      return c ? `Option ${c.label}${c.text ? ` — ${c.text}` : ''}` : null;
    }
    case 'multi':
      return it.type === 'multi' ? it.choices.filter((c) => r.ids.includes(c.id)).map((c) => c.text ?? c.label).join(', ') || 'nothing selected' : null;
    case 'text':
      return r.text;
    case 'number':
      return String(r.value);
    case 'order':
      return it.type === 'order' ? r.slots.map((s, i) => `${it.slots[i]}: ${s === null ? '—' : it.items[s]}`).join(', ') : null;
    case 'assign':
      return it.type === 'assign' ? r.table.map((row, i) => `${it.rows[i]}: ${row.map((v, j) => (v === null ? '—' : it.columns[j].options[v])).join(', ')}`).join('; ') : null;
    case 'cell':
      return it.type === 'cell' ? `Column ${String.fromCharCode(65 + (r.index % it.cols))}, row ${Math.floor(r.index / it.cols) + 1}` : null;
    case 'sequence':
      return it.type === 'sequence' ? r.items.map((x) => it.palette.find((p) => p.id === x)?.name ?? x).join(', ') : null;
    case 'glyphs':
      return `${r.indices.length} object${r.indices.length === 1 ? '' : 's'} selected`;
    case 'self':
      return r.text;
  }
}

function ResultPanel({
  puzzle,
  response,
  result,
  hintsUsed,
  elapsed,
  nextRef,
  onNext,
  nextLabel,
}: {
  puzzle: Puzzle;
  response: PlayerResponse | null;
  result: { outcome: Outcome; check: CheckResult | null; xp: number; timedOut?: boolean };
  hintsUsed: number;
  elapsed: number;
  nextRef: React.RefObject<HTMLButtonElement | null>;
  onNext(): void;
  nextLabel?: string;
}) {
  const ex = puzzle.explanation;
  const [allSteps, setAllSteps] = useState(ex.steps.length <= 8);
  const headline =
    result.outcome === 'correct'
      ? result.check?.selfAssessed
        ? 'Counted as correct (self-assessed)'
        : 'Correct!'
      : result.outcome === 'revealed'
        ? 'Answer revealed'
        : result.timedOut
          ? 'Time’s up'
          : result.check && result.check.score > 0
            ? 'Partly right'
            : 'Not this time';
  const yours = yourAnswer(puzzle, response);
  const it = puzzle.interaction;
  const correctChoice = puzzle.answer.type === 'choice' ? puzzle.answer.correct : null;
  const choiceList = it.type === 'choice' || it.type === 'investigation' ? it.choices : null;
  const steps = useMemo(() => (allSteps ? ex.steps : ex.steps.slice(0, 6)), [allSteps, ex.steps]);

  return (
    <section className={`result result-${result.outcome}`} aria-live="polite" aria-labelledby="result-heading">
      <div className="result-head">
        <h3 id="result-heading">
          <Icon name={result.outcome === 'correct' ? 'check' : result.outcome === 'revealed' ? 'unlock' : 'cross'} /> {headline}
        </h3>
        <div className="result-stats">
          <span>+{result.xp} XP</span>
          <span>{hintsUsed} hint{hintsUsed === 1 ? '' : 's'}</span>
          <span>{formatTime(elapsed)}</span>
          {result.check?.detail && <span>{result.check.detail}</span>}
        </div>
      </div>

      {yours && result.outcome !== 'revealed' && (
        <p className="your-answer">
          <span className="label">Your answer:</span> {yours}
        </p>
      )}

      <div className="correct-answer">
        <span className="label">Correct answer</span>
        <p className="answer-text">{ex.answer}</p>
        {ex.answerVisual && (
          <div className="answer-visual">
            <VisualView v={ex.answerVisual} size="md" />
          </div>
        )}
      </div>

      {choiceList && correctChoice && (
        <ChoiceGrid name="review" choices={choiceList} selected={response?.type === 'choice' ? [response.id] : []} onSelect={() => undefined} disabled correctIds={[correctChoice]} columns={it.type === 'choice' ? it.columns : undefined} />
      )}
      {it.type === 'glyphs' && puzzle.answer.type === 'glyphs' && <GlyphInput interaction={it} value={response} onChange={() => undefined} disabled correct={puzzle.answer.indices} />}
      {it.type === 'cell' && puzzle.answer.type === 'cell' && <CellInput interaction={it} value={response} onChange={() => undefined} disabled correctIndex={puzzle.answer.index} />}

      <div className="explain">
        <h4>Why</h4>
        <p>{ex.rule}</p>
        <h4>Step by step</h4>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {!allSteps && (
          <button type="button" className="link-btn" onClick={() => setAllSteps(true)}>
            Show all {ex.steps.length} steps
          </button>
        )}
        {ex.alternatives.length > 0 && (
          <>
            <h4>Why the alternatives fail</h4>
            <ul className="alternatives">
              {ex.alternatives.map((a, i) => {
                // Name the option's text too, so the list reads naturally even
                // when the player typed an answer and never saw the options.
                const text = a.choiceId ? optionText(puzzle, a.choiceId) : null;
                return (
                  <li key={i}>
                    <strong>
                      {a.label}
                      {text && !a.label.includes(text) ? ` (“${text}”)` : ''}:
                    </strong>{' '}
                    {a.reason}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <h4>Skills practised</h4>
        <ul className="skills">
          {ex.skills.map((s) => (
            <li key={s} className="skill-chip">
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onNext} ref={nextRef}>
          {nextLabel ?? 'Next puzzle'} <Icon name="arrow" />
        </button>
      </div>
    </section>
  );
}

function optionText(puzzle: Puzzle, choiceId: string): string | null {
  const i = puzzle.interaction;
  const list = i.type === 'choice' || i.type === 'investigation' ? i.choices : i.type === 'text' || i.type === 'number' ? i.fallback : undefined;
  const c = list?.find((x) => x.id === choiceId);
  return c?.text && !c.visual ? c.text : null;
}
