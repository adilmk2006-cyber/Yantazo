/**
 * Positional logic puzzles (queues, towers, races, round tables, weekly
 * schedules). A random arrangement is created first; true clues are derived
 * from it, added until the solver proves a unique solution, then pruned.
 */
import type { Rng } from '../rng';
import type { Difficulty, PuzzleDraft } from '../types';
import { listJoin, mod, ordinal, range, reject } from '../util';
import type { Constraint, Csp } from './csp';
import { countSolutions, deduce, pruneClues } from './csp';
import { DAYS, pickNames } from './names';

export type Geometry = 'line' | 'circle' | 'week';

interface ThemeText {
  id: string;
  geometry: Geometry;
  intro(names: string[], n: number, m: number): string;
  slot(i: number, m: number): string;
  at(a: string, i: number, m: number): string;
  notAt(a: string, i: number, m: number): string;
  before(a: string, b: string): string;
  justBefore(a: string, b: string): string;
  adjacent(a: string, b: string): string;
  notAdjacent(a: string, b: string): string;
  gap(a: string, b: string, g: number): string;
  end?(a: string): string;
  notEnd?(a: string): string;
  between?(a: string, b: string, c: string): string;
  opposite?(a: string, b: string): string;
  free?(i: number, m: number): string;
  gapAfter?(a: string, b: string, k: number): string;
  elim(a: string, slots: string[]): string;
  assign(a: string, slot: string): string;
  fact(a: string, slot: string): string;
  question: string;
}

const LINE_THEMES: ThemeText[] = [
  {
    id: 'queue', geometry: 'line',
    intro: (names, n) => `${listJoin(names)} are queuing at the vault door, one behind another. Position 1 is the front of the queue and position ${n} is the back.`,
    slot: (i) => `position ${i + 1}`,
    at: (a, i) => `${a} is ${ordinal(i + 1)} in the queue`,
    notAt: (a, i) => `${a} is not ${ordinal(i + 1)} in the queue`,
    before: (a, b) => `${a} is somewhere ahead of ${b}`,
    justBefore: (a, b) => `${a} is directly in front of ${b}`,
    adjacent: (a, b) => `${a} and ${b} are standing next to each other`,
    notAdjacent: (a, b) => `${a} and ${b} are not next to each other`,
    gap: (a, b, g) => `exactly ${g === 1 ? 'one person stands' : `${g} people stand`} between ${a} and ${b}`,
    end: (a) => `${a} is at one end of the queue`,
    notEnd: (a) => `${a} is not at either end of the queue`,
    between: (a, b, c) => `${a} is somewhere between ${b} and ${c}`,
    elim: (a, s) => `${a} cannot be in ${listJoin(s, 'or')}`,
    assign: (a, s) => `${a} must be in ${s}`,
  fact: (a, s) => `${a} is in ${s}`,
    question: 'Who stands in each position?',
  },
  {
    id: 'tower', geometry: 'line',
    intro: (names, n) => `${listJoin(names)} each live on a different floor of a narrow ${n}-storey tower. Floor 1 is at the bottom.`,
    slot: (i) => `floor ${i + 1}`,
    at: (a, i) => `${a} lives on floor ${i + 1}`,
    notAt: (a, i) => `${a} does not live on floor ${i + 1}`,
    before: (a, b) => `${a} lives somewhere below ${b}`,
    justBefore: (a, b) => `${a} lives on the floor directly below ${b}`,
    adjacent: (a, b) => `${a} and ${b} live on neighbouring floors`,
    notAdjacent: (a, b) => `${a} and ${b} do not live on neighbouring floors`,
    gap: (a, b, g) => `exactly ${g === 1 ? 'one floor separates' : `${g} floors separate`} ${a} and ${b}`,
    end: (a) => `${a} lives on either the top or the bottom floor`,
    notEnd: (a) => `${a} lives on neither the top nor the bottom floor`,
    between: (a, b, c) => `${a} lives somewhere between ${b} and ${c}`,
    elim: (a, s) => `${a} cannot live on ${listJoin(s, 'or')}`,
    assign: (a, s) => `${a} must live on ${s}`,
  fact: (a, s) => `${a} lives on ${s}`,
    question: 'Who lives on each floor?',
  },
  {
    id: 'race', geometry: 'line',
    intro: (names) => `${listJoin(names)} ran a midnight race through the archive corridors. There were no ties.`,
    slot: (i) => `${ordinal(i + 1)} place`,
    at: (a, i) => `${a} finished ${ordinal(i + 1)}`,
    notAt: (a, i) => `${a} did not finish ${ordinal(i + 1)}`,
    before: (a, b) => `${a} finished ahead of ${b}`,
    justBefore: (a, b) => `${a} finished immediately ahead of ${b}`,
    adjacent: (a, b) => `${a} and ${b} finished in consecutive places`,
    notAdjacent: (a, b) => `${a} and ${b} did not finish in consecutive places`,
    gap: (a, b, g) => `exactly ${g === 1 ? 'one runner' : `${g} runners`} finished between ${a} and ${b}`,
    end: (a) => `${a} finished either first or last`,
    notEnd: (a) => `${a} finished neither first nor last`,
    between: (a, b, c) => `${a} finished somewhere between ${b} and ${c}`,
    elim: (a, s) => `${a} cannot have finished in ${listJoin(s, 'or')}`,
    assign: (a, s) => `${a} must have finished in ${s}`,
  fact: (a, s) => `${a} finished in ${s}`,
    question: 'Who finished in each place?',
  },
  {
    id: 'lockers', geometry: 'line',
    intro: (names, n) => `${listJoin(names)} each use one locker in a row numbered 1 to ${n} from left to right.`,
    slot: (i) => `locker ${i + 1}`,
    at: (a, i) => `${a} uses locker ${i + 1}`,
    notAt: (a, i) => `${a} does not use locker ${i + 1}`,
    before: (a, b) => `${a}'s locker is somewhere to the left of ${b}'s`,
    justBefore: (a, b) => `${a}'s locker is immediately to the left of ${b}'s`,
    adjacent: (a, b) => `${a} and ${b} have neighbouring lockers`,
    notAdjacent: (a, b) => `${a} and ${b} do not have neighbouring lockers`,
    gap: (a, b, g) => `exactly ${g === 1 ? 'one locker lies' : `${g} lockers lie`} between ${a}'s and ${b}'s`,
    end: (a) => `${a}'s locker is at one end of the row`,
    notEnd: (a) => `${a}'s locker is not at either end of the row`,
    between: (a, b, c) => `${a}'s locker is somewhere between ${b}'s and ${c}'s`,
    elim: (a, s) => `${a} cannot use ${listJoin(s, 'or')}`,
    assign: (a, s) => `${a} must use ${s}`,
  fact: (a, s) => `${a} uses ${s}`,
    question: 'Who uses each locker?',
  },
];

const CIRCLE_THEME: ThemeText = {
  id: 'table', geometry: 'circle',
  intro: (names, n) => `${listJoin(names)} sit around a round table for a code-breaking session. The seats are numbered 1 to ${n} clockwise.`,
  slot: (i) => `seat ${i + 1}`,
  at: (a, i) => `${a} sits in seat ${i + 1}`,
  notAt: (a, i) => `${a} does not sit in seat ${i + 1}`,
  before: (a, b) => `${b} sits immediately clockwise of ${a}`,
  justBefore: (a, b) => `${b} sits immediately clockwise of ${a}`,
  adjacent: (a, b) => `${a} sits next to ${b}`,
  notAdjacent: (a, b) => `${a} does not sit next to ${b}`,
  gap: (a, b) => `exactly one seat separates ${a} and ${b}`,
  opposite: (a, b) => `${a} sits directly opposite ${b}`,
  elim: (a, s) => `${a} cannot sit in ${listJoin(s, 'or')}`,
  assign: (a, s) => `${a} must sit in ${s}`,
  fact: (a, s) => `${a} sits in ${s}`,
  question: 'Who sits in each seat?',
};

const WEEK_THEME: ThemeText = {
  id: 'week', geometry: 'week',
  intro: (names, n, m) => `${listJoin(names)} each inspect the vault on a different day between ${DAYS[0]} and ${DAYS[m - 1]}. ${m - n === 1 ? 'One of those days has' : `${m - n} of those days have`} no inspection.`,
  slot: (i) => DAYS[i],
  at: (a, i) => `${a} inspects on ${DAYS[i]}`,
  notAt: (a, i) => `${a} does not inspect on ${DAYS[i]}`,
  before: (a, b) => `${a} inspects earlier in the week than ${b}`,
  justBefore: (a, b) => `${a} inspects the day before ${b}`,
  adjacent: (a, b) => `${a} and ${b} inspect on consecutive days`,
  notAdjacent: (a, b) => `${a} and ${b} do not inspect on consecutive days`,
  gap: (a, b, g) => `exactly ${g === 1 ? 'one day' : `${g} days`} lie between ${a}'s and ${b}'s inspections`,
  gapAfter: (a, b, k) => `${b} inspects exactly ${k} days after ${a}`,
  free: (i) => `nobody inspects on ${DAYS[i]}`,
  elim: (a, s) => `${a} cannot inspect on ${listJoin(s, 'or')}`,
  assign: (a, s) => `${a} must inspect on ${s}`,
  fact: (a, s) => `${a} inspects on ${s}`,
  question: 'On which day does each person inspect?',
};

export interface ClueSpec {
  kind: string;
  items: number[];
  param?: number;
}

export interface Clue extends ClueSpec {
  constraint: Constraint;
}

/** Turns a structured clue into a solver constraint plus its wording. */
export function makeConstraint(spec: ClueSpec, theme: ThemeText, names: string[], m: number): Constraint {
  const circ = theme.geometry === 'circle';
  const dist = (x: number, y: number) => (circ ? Math.min(mod(x - y, m), mod(y - x, m)) : Math.abs(x - y));
  const [a, b, c] = spec.items;
  const N = (i: number) => names[i];
  const k = spec.param ?? 0;
  const C = (vars: number[], test: (v: number[]) => boolean, text: string, forEach = false): Constraint => ({ vars, test, text, clue: 0, forEach });
  switch (spec.kind) {
    case 'at':
      return C([a], ([p]) => p === k, theme.at(N(a), k, m));
    case 'notAt':
      return C([a], ([p]) => p !== k, theme.notAt(N(a), k, m));
    case 'before':
      return C([a, b], ([x, y]) => x < y, theme.before(N(a), N(b)));
    case 'justBefore':
      return C([a, b], ([x, y]) => (circ ? mod(y - x, m) === 1 : y === x + 1), theme.justBefore(N(a), N(b)));
    case 'adjacent':
      return C([a, b], ([x, y]) => dist(x, y) === 1, theme.adjacent(N(a), N(b)));
    case 'notAdjacent':
      return C([a, b], ([x, y]) => dist(x, y) > 1, theme.notAdjacent(N(a), N(b)));
    case 'gap':
      return C([a, b], ([x, y]) => dist(x, y) === k + 1, theme.gap(N(a), N(b), k));
    case 'end':
      return C([a], ([p]) => p === 0 || p === m - 1, theme.end!(N(a)));
    case 'notEnd':
      return C([a], ([p]) => p !== 0 && p !== m - 1, theme.notEnd!(N(a)));
    case 'between':
      return C([a, b, c], ([x, y, z]) => (x > y && x < z) || (x < y && x > z), theme.between!(N(a), N(b), N(c)));
    case 'opposite':
      return C([a, b], ([x, y]) => dist(x, y) === m / 2, theme.opposite!(N(a), N(b)));
    case 'free':
      return C(range(names.length), ([p]) => p !== k, theme.free!(k, m), true);
    case 'gapAfter':
      return C([a, b], ([x, y]) => y - x === k, theme.gapAfter!(N(a), N(b), k));
  }
  throw new Error(`unknown clue kind ${spec.kind}`);
}

type ClueMaker = { kind: string; weight: number[]; make: () => ClueSpec[] };

function clueFactory(theme: ThemeText, n: number, pos: number[], m: number): ClueMaker[] {
  const items = range(n);
  const pairs: [number, number][] = [];
  for (const a of items) for (const b of items) if (a !== b) pairs.push([a, b]);
  const circ = theme.geometry === 'circle';
  const dist = (x: number, y: number) => (circ ? Math.min(mod(x - y, m), mod(y - x, m)) : Math.abs(x - y));
  const makers: ClueMaker[] = [];
  const add = (kind: string, weight: number[], make: () => ClueSpec[]) => makers.push({ kind, weight, make });

  add('at', [6, 3, 1.5, 1], () => items.map((a) => ({ kind: 'at', items: [a], param: pos[a] })));
  add('notAt', [1, 2, 2, 2], () => items.flatMap((a) => range(m).filter((k) => k !== pos[a]).map((k) => ({ kind: 'notAt', items: [a], param: k }))));
  if (!circ) add('before', [3, 3, 3, 3], () => pairs.filter(([a, b]) => pos[a] < pos[b]).map(([a, b]) => ({ kind: 'before', items: [a, b] })));
  add('justBefore', [4, 3, 2, 2], () =>
    pairs.filter(([a, b]) => (circ ? mod(pos[b] - pos[a], m) === 1 : pos[b] === pos[a] + 1)).map(([a, b]) => ({ kind: 'justBefore', items: [a, b] })),
  );
  add('adjacent', [2, 2, 2, 2], () => pairs.filter(([a, b]) => a < b && dist(pos[a], pos[b]) === 1).map(([a, b]) => ({ kind: 'adjacent', items: [a, b] })));
  add('notAdjacent', [1, 2, 3, 3], () => pairs.filter(([a, b]) => a < b && dist(pos[a], pos[b]) > 1).map(([a, b]) => ({ kind: 'notAdjacent', items: [a, b] })));
  add('gap', [1, 2, 3, 3], () =>
    pairs
      .filter(([a, b]) => a < b && (circ ? dist(pos[a], pos[b]) === 2 : dist(pos[a], pos[b]) >= 2 && dist(pos[a], pos[b]) <= 3))
      .map(([a, b]) => ({ kind: 'gap', items: [a, b], param: dist(pos[a], pos[b]) - 1 })),
  );
  if (theme.end && theme.geometry === 'line') {
    add('end', [2, 2, 1, 1], () => items.filter((a) => pos[a] === 0 || pos[a] === m - 1).map((a) => ({ kind: 'end', items: [a] })));
    add('notEnd', [1, 2, 2, 2], () => items.filter((a) => pos[a] !== 0 && pos[a] !== m - 1).map((a) => ({ kind: 'notEnd', items: [a] })));
  }
  if (theme.between) {
    add('between', [0, 1, 2, 3], () => {
      const out: ClueSpec[] = [];
      for (const a of items)
        for (const b of items)
          for (const c of items) {
            if (a === b || a === c || b >= c) continue;
            if ((pos[a] > pos[b] && pos[a] < pos[c]) || (pos[a] < pos[b] && pos[a] > pos[c])) out.push({ kind: 'between', items: [a, b, c] });
          }
      return out;
    });
  }
  if (theme.opposite && circ && m % 2 === 0)
    add('opposite', [3, 3, 2, 2], () => pairs.filter(([a, b]) => a < b && dist(pos[a], pos[b]) === m / 2).map(([a, b]) => ({ kind: 'opposite', items: [a, b] })));
  if (theme.free && m > n) {
    const used = new Set(pos);
    add('free', [3, 2, 2, 1], () => range(m).filter((d) => !used.has(d)).map((d) => ({ kind: 'free', items: [], param: d })));
  }
  if (theme.gapAfter)
    add('gapAfter', [1, 2, 3, 3], () => pairs.filter(([a, b]) => pos[b] - pos[a] >= 2).map(([a, b]) => ({ kind: 'gapAfter', items: [a, b], param: pos[b] - pos[a] })));
  return makers;
}

export function themeById(id: string): ThemeText {
  return [...LINE_THEMES, CIRCLE_THEME, WEEK_THEME].find((t) => t.id === id)!;
}

function buildCsp(theme: ThemeText, names: string[], m: number, clues: Clue[]): Csp {
  return {
    vars: names.map((name) => ({ name, domain: range(m) })),
    constraints: clues.map((c, i) => ({ ...c.constraint, clue: i + 1 })),
    groups: [{ vars: range(names.length), bijective: m === names.length }],
    phrasing: {
      elim: (v, xs) => theme.elim(names[v], xs.map((x) => theme.slot(x, m))),
      assign: (v, x) => theme.assign(names[v], theme.slot(x, m)),
      fact: (v, x) => theme.fact(names[v], theme.slot(x, m)),
      name: (v) => names[v],
    },
  };
}

export interface PositionalConfig {
  geometry: Geometry;
  n: number;
  m: number;
}

export function positionalConfig(geometry: Geometry, d: Difficulty, rng: Rng): PositionalConfig {
  if (geometry === 'circle') {
    const n = d === 1 ? 4 : d === 2 ? 5 : d === 3 ? 6 : rng.pick([6, 7]);
    return { geometry, n, m: n };
  }
  if (geometry === 'week') {
    const n = d === 1 ? 3 : d === 2 ? 4 : d === 3 ? 5 : 5;
    return { geometry, n, m: d === 4 ? n + 2 : n + 1 };
  }
  const n = d === 1 ? 4 : d === 2 ? 5 : d === 3 ? rng.pick([5, 6]) : rng.pick([6, 7]);
  return { geometry, n, m: n };
}

export interface PositionalHidden {
  geometry: Geometry;
  names: string[];
  pos: number[];
  m: number;
  theme: string;
  clues: ClueSpec[];
  [k: string]: unknown;
}

/** Independent check used by the generator verifiers. */
export function verifyPositional(h: PositionalHidden, answerPos: number[]): string[] {
  const theme = themeById(h.theme);
  const clues = h.clues.map((c) => ({ ...c, constraint: makeConstraint(c, theme, h.names, h.m) }));
  const res = countSolutions(buildCsp(theme, h.names, h.m, clues), 2);
  if (res.exhausted || res.count !== 1) return [`expected a unique solution, solver found ${res.count}${res.exhausted ? ' (budget exhausted)' : ''}`];
  if (res.solutions[0].some((p, i) => p !== answerPos[i])) return ['stored answer differs from the solver'];
  return [];
}

export function buildPositional(rng: Rng, difficulty: Difficulty, geometry: Geometry): PuzzleDraft {
  const cfg = positionalConfig(geometry, difficulty, rng);
  const { n, m } = cfg;
  const theme = geometry === 'circle' ? CIRCLE_THEME : geometry === 'week' ? WEEK_THEME : rng.pick(LINE_THEMES);
  const names = pickNames(rng, n);
  const pos = geometry === 'week' ? rng.sample(range(m), n) : rng.shuffle(range(m));
  const makers = clueFactory(theme, n, pos, m);
  const di = difficulty - 1;
  // weighted random ordering of every true clue
  const pool: { clue: Clue; key: number }[] = [];
  for (const mk of makers) {
    const w = mk.weight[di];
    if (w <= 0) continue;
    for (const spec of mk.make()) pool.push({ clue: { ...spec, constraint: makeConstraint(spec, theme, names, m) }, key: rng.next() ** (1 / w) });
  }
  pool.sort((a, b) => b.key - a.key);
  const ordered = pool.map((p) => p.clue);
  const chosen: Clue[] = [];
  let unique = false;
  for (const c of ordered) {
    chosen.push(c);
    if (chosen.length < 2) continue;
    const res = countSolutions(buildCsp(theme, names, m, chosen), 2);
    if (res.exhausted) reject('solver budget exceeded');
    if (res.count === 1) {
      unique = true;
      break;
    }
    if (chosen.length > 24) break;
  }
  if (!unique) reject('no unique clue set');
  let clues = pruneClues(chosen, (s) => buildCsp(theme, names, m, s), rng.shuffle(chosen));
  clues = rng.shuffle(clues);
  let csp = buildCsp(theme, names, m, clues);
  const allowContra = difficulty >= 3;
  let ded = deduce(csp, allowContra);
  // Make sure the human-style deduction reaches the answer; add a supporting clue if needed.
  for (let extra = 0; !ded.solved && extra < 3; extra++) {
    const more = ordered.find((c) => !clues.includes(c) && (c.kind === 'at' || c.kind === 'justBefore' || c.kind === 'free'));
    if (!more) break;
    clues = [...clues, more];
    csp = buildCsp(theme, names, m, clues);
    ded = deduce(csp, allowContra);
  }
  if (!ded.solved) reject('not solvable by step-by-step deduction');
  const final = countSolutions(csp, 2);
  if (final.count !== 1 || final.exhausted) reject('lost uniqueness');
  const solvedPos = final.solutions[0];
  if (solvedPos.some((p, i) => p !== pos[i])) reject('solver disagrees with construction');
  if (difficulty === 4 && ded.contradictions === 0 && clues.filter((c) => c.kind === 'at').length > 1) reject('too direct for Mastermind');
  if (difficulty === 1 && clues.length > 6) reject('too long for Initiate');

  const slotLabels = range(m).map((i) => theme.slot(i, m));
  const capitalSlot = slotLabels.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const clueTexts = clues.map((c) => c.constraint.text.charAt(0).toUpperCase() + c.constraint.text.slice(1) + '.');

  // "Why not": swapping two people breaks a specific clue.
  const alternatives: { label: string; reason: string }[] = [];
  for (const [a, b] of rng.shuffle(range(n).flatMap((a) => range(n).filter((b) => b > a).map((b) => [a, b] as [number, number])))) {
    if (alternatives.length >= 3) break;
    const swapped = pos.slice();
    [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
    const broken = csp.constraints.find((c) => (c.forEach ? c.vars.some((v) => !c.test([swapped[v]])) : !c.test(c.vars.map((v) => swapped[v]))));
    if (broken) alternatives.push({ label: `Swapping ${names[a]} and ${names[b]}`, reason: `breaks clue ${broken.clue}: ${broken.text}.` });
  }

  const firstClue = csp.constraints.find((c) => ded.steps[0]?.startsWith(`Clue ${c.clue} `)) ?? csp.constraints[0];
  const firstAssign = ded.steps.find((s) => s.includes(' must '));
  const assignMatch = firstAssign?.match(/([A-Z][a-z]+ must [^.;—]+)/);
  const arrangement = slotLabels
    .map((s, i) => {
      const who = pos.indexOf(i);
      return `${s.charAt(0).toUpperCase() + s.slice(1)}: ${who >= 0 ? names[who] : 'nobody'}`;
    })
    .join(', ');

  const isWeek = geometry === 'week';
  return {
    title: geometry === 'circle' ? 'Round-table seating' : isWeek ? 'Inspection schedule' : 'Order of events',
    prompt: `${theme.intro(names, n, m)} Use the clues to work out the full arrangement. ${theme.question}`,
    display: { blocks: [{ type: 'list', ordered: true, title: 'Clues', items: clueTexts }] },
    interaction: isWeek
      ? { type: 'assign', rows: names, rowHeader: 'Inspector', columns: [{ name: 'Day', options: slotLabels.map((s) => s) }] }
      : { type: 'order', items: names, slots: capitalSlot, circular: geometry === 'circle' },
    answer: isWeek ? { type: 'assign', solution: names.map((_, i) => [pos[i]]) } : { type: 'order', solution: range(m).map((slot) => pos.indexOf(slot)) },
    hints: [
      `Begin with clue ${firstClue.clue} — it narrows things down immediately.`,
      `Keep a grid of who can still go where and cross out options after every clue; ${ded.contradictions ? 'at one point you will need to test a possibility and see it fail.' : 'no guessing is needed.'}`,
      assignMatch ? `A key early deduction: ${assignMatch[1].trim()}.` : `Combine clue ${firstClue.clue} with the clue that mentions the same person.`,
    ],
    explanation: {
      answer: arrangement,
      rule: `The clues allow exactly one arrangement — ${arrangement}. A solver checked every possible arrangement to confirm this.`,
      steps: [...ded.steps, `Every clue is now satisfied, and no other arrangement satisfies them all.`],
      alternatives,
      skills: ['deduction', 'constraint satisfaction', 'working memory'],
    },
    metrics: { rules: clues.length, steps: ded.steps.length + ded.contradictions * 2 },
    fingerprint: {
      structure: `pos|${geometry}|${n}|${[...new Set(clues.map((c) => c.kind))].sort().join('+')}`,
      features: [`geometry:${geometry}`, `n:${n}`, ...[...new Set(clues.map((c) => `clue:${c.kind}`))], ded.contradictions ? 'needs:case-analysis' : 'needs:direct'],
      detail: `${theme.id}|${pos.join(',')}|${clueTexts.join('|')}`,
    },
    hidden: { geometry, names, pos, m, theme: theme.id, clues: clues.map(({ kind, items, param }) => (param === undefined ? { kind, items } : { kind, items, param })) } satisfies PositionalHidden,
  };
}
