/**
 * Truth-tellers and liars, and "exactly N statements are true" suspect
 * elimination. Both are solved exhaustively (2^n or n cases), and the
 * explanation lists every case with the statement that rules it out.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { listJoin, numberWord, range, reject } from '../../util';
import { pickNames } from '../../logic/names';

/* ---------------- knights & knaves ---------------- */

interface KStatement {
  kind: 'liar' | 'honest' | 'same' | 'diff' | 'count' | 'atLeastOneLiar' | 'bothHonest' | 'implies';
  targets: number[];
  k?: number;
}

function kTruth(st: KStatement, honest: boolean[]): boolean {
  const [t, u] = st.targets;
  switch (st.kind) {
    case 'liar':
      return !honest[t];
    case 'honest':
      return honest[t];
    case 'same':
      return honest[t] === honest[u];
    case 'diff':
      return honest[t] !== honest[u];
    case 'count':
      return honest.filter((h) => !h).length === st.k;
    case 'atLeastOneLiar':
      return !honest[t] || !honest[u];
    case 'bothHonest':
      return honest[t] && honest[u];
    case 'implies':
      return !honest[t] || honest[u];
  }
}

function kText(st: KStatement, speaker: number, names: string[]): string {
  const N = (i: number) => (i === speaker ? 'I' : names[i]);
  const [t, u] = st.targets;
  const isAre = (i: number) => (i === speaker ? 'am' : 'is');
  switch (st.kind) {
    case 'liar':
      return `${N(t)} ${isAre(t)} a liar.`;
    case 'honest':
      return `${N(t)} always tell${t === speaker ? '' : 's'} the truth.`;
    case 'same':
      return `${N(t)} and ${N(u) === 'I' ? 'I' : N(u)} are the same type.`.replace(/^I and (\w+) are/, '$1 and I are');
    case 'diff':
      return `${N(t)} and ${N(u)} are different types.`.replace(/^I and (\w+) are/, '$1 and I are');
    case 'count':
      return `Exactly ${numberWord(st.k!)} of us ${st.k === 1 ? 'is a liar' : 'are liars'}.`;
    case 'atLeastOneLiar': {
      const [x, y] = t === speaker ? [u, t] : [t, u];
      return `At least one of ${names[x]} and ${y === speaker ? 'me' : names[y]} is a liar.`;
    }
    case 'bothHonest':
      return `${N(t)} and ${N(u)} both tell the truth.`.replace(/^I and (\w+)/, '$1 and I');
    case 'implies':
      return `If ${N(t)} tell${t === speaker ? '' : 's'} the truth, then so ${u === speaker ? 'do I' : `does ${names[u]}`}.`;
  }
}

function randomStatement(rng: Rng, n: number, speaker: number, difficulty: number): KStatement {
  const kinds: KStatement['kind'][] = ['liar', 'liar', 'honest', 'same', 'diff'];
  if (difficulty >= 2) kinds.push('count', 'atLeastOneLiar');
  if (difficulty >= 3) kinds.push('bothHonest', 'count');
  if (difficulty >= 4) kinds.push('implies');
  const kind = rng.pick(kinds);
  const others = range(n).filter((i) => i !== speaker);
  if (kind === 'count') return { kind, targets: [], k: rng.int(1, n - 1) };
  if (kind === 'liar' || kind === 'honest') return { kind, targets: [rng.pick(others)] };
  const pair = rng.chance(0.4) ? [speaker, rng.pick(others)] : rng.sample(others, 2);
  if (pair.length < 2) return { kind: 'liar', targets: [rng.pick(others)] };
  return { kind, targets: rng.shuffle(pair) };
}

function consistentAssignments(statements: KStatement[], n: number): boolean[][] {
  const out: boolean[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const honest = range(n).map((i) => !!((mask >> i) & 1));
    if (statements.every((st, s) => kTruth(st, honest) === honest[s])) out.push(honest);
  }
  return out;
}

interface KnightHidden {
  mode: 'knights';
  names: string[];
  statements: KStatement[];
  [k: string]: unknown;
}

function buildKnights(rng: Rng, difficulty: number): ReturnType<GeneratorDef['generate']> {
  const n = difficulty === 1 ? 3 : difficulty === 2 ? 3 : difficulty === 3 ? 4 : 4;
  const names = pickNames(rng, n);
  const honest = range(n).map(() => rng.chance(0.5));
  const liars = honest.filter((h) => !h).length;
  if (liars === 0 || liars === n) reject('need a mix of liars and truth-tellers');
  const statements: KStatement[] = [];
  for (let s = 0; s < n; s++) {
    let st: KStatement | null = null;
    for (let t = 0; t < 40 && !st; t++) {
      const cand = randomStatement(rng, n, s, difficulty);
      if (kTruth(cand, honest) === honest[s]) st = cand;
    }
    if (!st) reject('no consistent statement');
    statements.push(st);
  }
  let sols = consistentAssignments(statements, n);
  for (let t = 0; t < 40 && sols.length > 1; t++) {
    const s = rng.int(0, n - 1);
    const cand = randomStatement(rng, n, s, difficulty);
    if (kTruth(cand, honest) !== honest[s]) continue;
    const trial = statements.slice();
    trial[s] = cand;
    const ts = consistentAssignments(trial, n);
    if (ts.length >= 1 && ts.length <= sols.length) {
      statements[s] = cand;
      sols = ts;
    }
  }
  if (sols.length !== 1) reject('not uniquely solvable');
  if (sols[0].some((h, i) => h !== honest[i])) reject('solver disagrees');
  if (difficulty === 4 && statements.every((s) => s.kind === 'liar' || s.kind === 'honest')) reject('too plain for Mastermind');

  const texts = statements.map((st, s) => kText(st, s, names));
  const label = (h: boolean[]) => names.map((nm, i) => `${nm} ${h[i] ? '✓' : '✗'}`).join(', ');
  const caseLines: string[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const h = range(n).map((i) => !!((mask >> i) & 1));
    const bad = statements.findIndex((st, s) => kTruth(st, h) !== h[s]);
    caseLines.push(
      bad < 0
        ? `${label(h)} → consistent ✔`
        : `${label(h)} → fails: ${names[bad]} would be ${h[bad] ? 'a truth-teller' : 'a liar'}, yet "${texts[bad]}" would be ${kTruth(statements[bad], h) ? 'true' : 'false'}.`,
    );
  }
  const liarNames = names.filter((_, i) => !honest[i]);
  const choices = buildChoicesForPeople(names, honest, statements, texts, rng);
  const firstLiarStmt = statements.findIndex((st) => st.kind === 'liar' || st.kind === 'diff' || st.kind === 'same');

  return {
    title: 'Truth-tellers and liars',
    prompt: `Each of ${listJoin(names)} either always tells the truth or always lies. Select everyone who is a liar.`,
    display: { blocks: [{ type: 'statements', items: names.map((nm, i) => ({ speaker: nm, text: texts[i] })) }] },
    interaction: { type: 'multi', choices: choices.choices, instruction: 'Select every liar (at least one person is lying).' },
    answer: { type: 'multi', correct: choices.correct },
    hints: [
      'A truth-teller’s statement must be true and a liar’s statement must be false — test each person both ways.',
      firstLiarStmt >= 0 ? `${names[firstLiarStmt]}’s statement links two people. If those two were the same type, what would that imply?` : 'Count how many liars each possibility would create and compare with the statements about numbers.',
      `There are only ${2 ** n} combinations; try assuming ${names[0]} tells the truth and follow the consequences.`,
    ],
    explanation: {
      answer: `Liars: ${listJoin(liarNames)}. Truth-tellers: ${listJoin(names.filter((_, i) => honest[i]))}.`,
      rule: 'Every statement must be true when its speaker is a truth-teller and false when its speaker is a liar.',
      steps: [
        `Check the solution: ${names.map((nm, i) => `${nm} is ${honest[i] ? 'honest, and "' + texts[i] + '" is true' : 'a liar, and "' + texts[i] + '" is false'}`).join('; ')}.`,
        `All ${2 ** n} combinations (✓ = truth-teller, ✗ = liar):`,
        ...caseLines,
      ],
      alternatives: choices.alternatives,
      skills: ['deduction', 'hypothesis testing', 'verbal reasoning'],
    },
    metrics: { rules: n, steps: n + (difficulty >= 3 ? 2 : 1), choices: n },
    fingerprint: {
      structure: `truth|knights|${n}|${[...new Set(statements.map((s) => s.kind))].sort().join('+')}`,
      features: ['truth:knights', ...new Set(statements.map((s) => `stmt:${s.kind}`))],
      detail: `${honest.map(Number).join('')}|${texts.join('|')}`,
    },
    hidden: { mode: 'knights', names, statements } satisfies KnightHidden,
  };
}

function buildChoicesForPeople(names: string[], honest: boolean[], statements: KStatement[], texts: string[], rng: Rng) {
  void rng;
  const choices = names.map((nm, i) => ({ id: `p${i}`, label: String.fromCharCode(65 + i), text: nm }));
  const correct = choices.filter((_, i) => !honest[i]).map((c) => c.id);
  const alternatives = names.map((nm, i) => {
    const flipped = honest.slice();
    flipped[i] = !flipped[i];
    const bad = statements.findIndex((st, s) => kTruth(st, flipped) !== flipped[s]);
    return {
      label: `${nm} as ${honest[i] ? 'a liar' : 'a truth-teller'}`,
      reason: `If ${nm} were ${honest[i] ? 'a liar' : 'a truth-teller'} (everyone else unchanged), ${names[bad]}'s statement "${texts[bad]}" would be ${kTruth(statements[bad], flipped) ? 'true' : 'false'}, which is impossible for ${flipped[bad] ? 'a truth-teller' : 'a liar'}.`,
      choiceId: `p${i}`,
    };
  });
  return { choices, correct, alternatives };
}

/* ---------------- one culprit, N true statements ---------------- */

interface CStatement {
  kind: 'notMe' | 'didIt' | 'didNot' | 'either';
  targets: number[];
}

function cTruth(st: CStatement, speaker: number, culprit: number): boolean {
  switch (st.kind) {
    case 'notMe':
      return culprit !== speaker;
    case 'didIt':
      return culprit === st.targets[0];
    case 'didNot':
      return culprit !== st.targets[0];
    case 'either':
      return culprit === st.targets[0] || culprit === st.targets[1];
  }
}

function cText(st: CStatement, speaker: number, names: string[]): string {
  const N = (i: number) => (i === speaker ? 'I' : names[i]);
  switch (st.kind) {
    case 'notMe':
      return 'I did not take it.';
    case 'didIt':
      return `${N(st.targets[0])} took it.`;
    case 'didNot':
      return `${N(st.targets[0])} did not take it.`;
    case 'either':
      return `It was either ${N(st.targets[0]) === 'I' ? 'me' : N(st.targets[0])} or ${N(st.targets[1]) === 'I' ? 'me' : N(st.targets[1])}.`;
  }
}

interface CulpritHidden {
  mode: 'culprit';
  names: string[];
  statements: CStatement[];
  trueCount: number;
  [k: string]: unknown;
}

function culpritCases(statements: CStatement[], n: number, trueCount: number): number[] {
  return range(n).filter((c) => statements.filter((st, s) => cTruth(st, s, c)).length === trueCount);
}

function buildCulprit(rng: Rng, difficulty: number): ReturnType<GeneratorDef['generate']> {
  const n = difficulty <= 2 ? 4 : 5;
  const names = pickNames(rng, n);
  const trueCount = rng.chance(0.5) ? 1 : n - 1;
  const culprit = rng.int(0, n - 1);
  let statements: CStatement[] = [];
  let found = false;
  for (let attempt = 0; attempt < 200 && !found; attempt++) {
    statements = range(n).map((s) => {
      const others = range(n).filter((i) => i !== s);
      const kind = rng.pick<CStatement['kind']>(difficulty >= 3 ? ['notMe', 'didIt', 'didNot', 'either'] : ['notMe', 'didIt', 'didNot']);
      if (kind === 'notMe') return { kind, targets: [] };
      if (kind === 'either') return { kind, targets: rng.sample(range(n), 2) };
      return { kind, targets: [rng.pick(others)] };
    });
    const cases = culpritCases(statements, n, trueCount);
    found = cases.length === 1 && cases[0] === culprit;
  }
  if (!found) reject('no unique culprit');
  const texts = statements.map((st, s) => cText(st, s, names));
  const counts = range(n).map((c) => statements.filter((st, s) => cTruth(st, s, c)).length);
  const built = buildChoices(
    { key: names[culprit], text: names[culprit] },
    names
      .map((nm, i) => ({ nm, i }))
      .filter(({ i }) => i !== culprit)
      .map(({ nm, i }) => ({ key: nm, text: nm, reason: `If ${nm} took it, ${counts[i]} statement${counts[i] === 1 ? ' would be' : 's would be'} true — not exactly ${trueCount}.` })),
    rng,
  );
  const which = trueCount === 1 ? 'Exactly one of them is telling the truth.' : 'Exactly one of them is lying.';
  return {
    title: 'Who took the vault key?',
    prompt: `The vault key has vanished, and one of ${listJoin(names)} took it. Each makes one statement. ${which} Who took the key?`,
    display: { blocks: [{ type: 'statements', items: names.map((nm, i) => ({ speaker: nm, text: texts[i] })) }] },
    interaction: { type: 'choice', choices: built.choices, columns: n },
    answer: { type: 'choice', correct: built.correctId },
    hints: [
      'Do not try to decide who is lying first — instead assume each suspect in turn is the thief.',
      `For each possible thief, count how many of the ${n} statements would be true.`,
      `Only one suspect gives exactly ${numberWord(trueCount)} true statement${trueCount === 1 ? '' : 's'}.`,
    ],
    explanation: {
      answer: `Option ${built.correctLabel}: ${names[culprit]} took the key.`,
      rule: `${which} Test every suspect as the thief and count the true statements.`,
      steps: [
        ...range(n).map(
          (c) =>
            `If ${names[c]} took it: ${statements.map((st, s) => `${names[s]} ${cTruth(st, s, c) ? '✓' : '✗'}`).join(', ')} → ${counts[c]} true${counts[c] === trueCount ? ' ✔ matches' : ''}.`,
        ),
        `Only ${names[culprit]} as the thief gives exactly ${trueCount} true statement${trueCount === 1 ? '' : 's'}.`,
      ],
      alternatives: built.alternatives,
      skills: ['deduction', 'hypothesis testing', 'verbal reasoning'],
    },
    metrics: { rules: n + 1, steps: n, choices: n },
    fingerprint: {
      structure: `truth|culprit|${n}|${trueCount === 1 ? 'one-true' : 'one-false'}`,
      features: ['truth:culprit', trueCount === 1 ? 'count:one-true' : 'count:one-false', ...new Set(statements.map((s) => `stmt:${s.kind}`))],
      detail: `${culprit}|${texts.join('|')}`,
    },
    hidden: { mode: 'culprit', names, statements, trueCount } satisfies CulpritHidden,
  };
}

export const logicTruth: GeneratorDef = {
  id: 'logic.truth',
  category: 'logic',
  version: 1,
  family: 'Truth & lies',
  description: 'Truth-tellers and liars, or find the culprit when exactly one statement is true or false.',
  weight: 1,
  candidates: 5,
  generate({ rng, difficulty }) {
    return rng.chance(0.55) ? buildKnights(rng, difficulty) : buildCulprit(rng, difficulty);
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as KnightHidden | CulpritHidden;
    if (h.mode === 'knights') {
      const sols = consistentAssignments(h.statements, h.names.length);
      if (sols.length !== 1) return [`${sols.length} consistent assignments`];
      if (p.answer.type !== 'multi') return ['wrong answer type'];
      const liars = sols[0].map((v, i) => (v ? null : `p${i}`)).filter(Boolean);
      if (JSON.stringify(liars) !== JSON.stringify(p.answer.correct)) return ['answer mismatch'];
      return [];
    }
    const cases = culpritCases(h.statements, h.names.length, h.trueCount);
    if (cases.length !== 1) return [`${cases.length} possible culprits`];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const ans = p.interaction.choices.find((c) => c.id === (p.answer as { correct: string }).correct);
    if (ans?.text !== h.names[cases[0]]) return ['answer mismatch'];
    return [];
  },
};
