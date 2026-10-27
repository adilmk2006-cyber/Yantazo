/**
 * Logic-grid puzzles (matching people to attributes, optionally along an
 * ordered row of rooms). Built solution-first; clues are derived from the
 * solution, added until the solver proves uniqueness, then pruned.
 */
import type { Rng } from '../rng';
import type { Difficulty, PuzzleDraft } from '../types';
import { capitalize, listJoin, range, reject } from '../util';
import type { Constraint, Csp } from './csp';
import { countSolutions, deduce, pruneClues } from './csp';
import { pickNames } from './names';

interface Value {
  name: string;
  /** subject phrase: "the cat owner" */
  who: string;
  /** predicate: "owns the cat" */
  has: string;
  hasNot: string;
}

interface Category {
  id: string;
  label: string;
  values: Value[];
}

const ATTRIBUTE_CATEGORIES: { id: string; label: string; values: [string, string, string, string][] }[] = [
  {
    id: 'pet', label: 'Pet',
    values: [
      ['cat', 'the cat owner', 'owns the cat', 'does not own the cat'],
      ['parrot', 'the parrot owner', 'owns the parrot', 'does not own the parrot'],
      ['tortoise', 'the tortoise owner', 'owns the tortoise', 'does not own the tortoise'],
      ['rabbit', 'the rabbit owner', 'owns the rabbit', 'does not own the rabbit'],
      ['goldfish', 'the goldfish owner', 'owns the goldfish', 'does not own the goldfish'],
    ],
  },
  {
    id: 'drink', label: 'Drink',
    values: [
      ['tea', 'the tea drinker', 'drinks tea', 'does not drink tea'],
      ['coffee', 'the coffee drinker', 'drinks coffee', 'does not drink coffee'],
      ['cocoa', 'the cocoa drinker', 'drinks cocoa', 'does not drink cocoa'],
      ['juice', 'the juice drinker', 'drinks juice', 'does not drink juice'],
      ['water', 'the water drinker', 'drinks water', 'does not drink water'],
    ],
  },
  {
    id: 'coat', label: 'Coat',
    values: [
      ['red', 'the person in the red coat', 'wears the red coat', 'does not wear the red coat'],
      ['blue', 'the person in the blue coat', 'wears the blue coat', 'does not wear the blue coat'],
      ['green', 'the person in the green coat', 'wears the green coat', 'does not wear the green coat'],
      ['yellow', 'the person in the yellow coat', 'wears the yellow coat', 'does not wear the yellow coat'],
      ['grey', 'the person in the grey coat', 'wears the grey coat', 'does not wear the grey coat'],
    ],
  },
  {
    id: 'tool', label: 'Tool',
    values: [
      ['lockpick', 'the person with the lockpick', 'carries the lockpick', 'does not carry the lockpick'],
      ['torch', 'the person with the torch', 'carries the torch', 'does not carry the torch'],
      ['magnifier', 'the person with the magnifier', 'carries the magnifier', 'does not carry the magnifier'],
      ['stethoscope', 'the person with the stethoscope', 'carries the stethoscope', 'does not carry the stethoscope'],
      ['notebook', 'the person with the notebook', 'carries the notebook', 'does not carry the notebook'],
    ],
  },
  {
    id: 'city', label: 'Home city',
    values: [
      ['Oslo', 'the person from Oslo', 'comes from Oslo', 'does not come from Oslo'],
      ['Lima', 'the person from Lima', 'comes from Lima', 'does not come from Lima'],
      ['Cairo', 'the person from Cairo', 'comes from Cairo', 'does not come from Cairo'],
      ['Seoul', 'the person from Seoul', 'comes from Seoul', 'does not come from Seoul'],
      ['Quito', 'the person from Quito', 'comes from Quito', 'does not come from Quito'],
    ],
  },
];

export interface GridClueSpec {
  kind: 'same' | 'notSame' | 'either' | 'at' | 'notAt' | 'left' | 'justLeft' | 'nextTo';
  /** [category, value] references */
  refs: [number, number][];
  param?: number;
}

export interface GridSetup {
  ordered: boolean;
  n: number;
  categories: Category[];
  /** In matching mode category 0 is "people" and acts as the slot set. */
  solution: number[][];
}

/** Variables: one per (category, value), except the slot category in matching mode. */
function varIndex(setup: GridSetup, c: number, v: number): number {
  const first = setup.ordered ? 0 : 1;
  return (c - first) * setup.n + v;
}

function varCats(setup: GridSetup): number[] {
  return range(setup.categories.length).filter((c) => setup.ordered || c > 0);
}

function slotName(setup: GridSetup, s: number): string {
  return setup.ordered ? `room ${s + 1}` : setup.categories[0].values[s].name;
}

function makeConstraint(setup: GridSetup, spec: GridClueSpec): Constraint {
  const cats = setup.categories;
  const ref = (i: number) => cats[spec.refs[i][0]].values[spec.refs[i][1]];
  const isSlot = (i: number) => !setup.ordered && spec.refs[i][0] === 0;
  const vi = (i: number) => varIndex(setup, spec.refs[i][0], spec.refs[i][1]);
  const C = (vars: number[], test: (v: number[]) => boolean, text: string): Constraint => ({ vars, test, text, clue: 0 });
  const A = ref(0);
  switch (spec.kind) {
    case 'same': {
      const B = ref(1);
      if (isSlot(0)) {
        const p = spec.refs[0][1];
        return C([vi(1)], ([x]) => x === p, `${A.who} ${B.has}`);
      }
      return C([vi(0), vi(1)], ([x, y]) => x === y, `${A.who} ${B.has}`);
    }
    case 'notSame': {
      const B = ref(1);
      if (isSlot(0)) {
        const p = spec.refs[0][1];
        return C([vi(1)], ([x]) => x !== p, `${A.who} ${B.hasNot}`);
      }
      return C([vi(0), vi(1)], ([x, y]) => x !== y, `${A.who} ${B.hasNot}`);
    }
    case 'either': {
      // refs: [person/slot-value, v1, v2] — subject has v1 or v2 (same category)
      const B = ref(1);
      const D = ref(2);
      if (isSlot(0)) {
        const p = spec.refs[0][1];
        return C([vi(1), vi(2)], ([x, y]) => x === p || y === p, `${A.who} either ${B.has} or ${D.has}`);
      }
      return C([vi(0), vi(1), vi(2)], ([x, y, z]) => x === y || x === z, `${A.who} either ${B.has} or ${D.has}`);
    }
    case 'at':
      return C([vi(0)], ([x]) => x === spec.param, `${A.who} is in room ${spec.param! + 1}`);
    case 'notAt':
      return C([vi(0)], ([x]) => x !== spec.param, `${A.who} is not in room ${spec.param! + 1}`);
    case 'left':
      return C([vi(0), vi(1)], ([x, y]) => x < y, `${A.who} is somewhere to the left of ${ref(1).who}`);
    case 'justLeft':
      return C([vi(0), vi(1)], ([x, y]) => y === x + 1, `${A.who} is in the room directly to the left of ${ref(1).who}`);
    case 'nextTo':
      return C([vi(0), vi(1)], ([x, y]) => Math.abs(x - y) === 1, `${A.who} is in a room next to ${ref(1).who}`);
  }
}

function buildCsp(setup: GridSetup, specs: GridClueSpec[]): Csp {
  const vars: Csp['vars'] = [];
  for (const c of varCats(setup)) for (const v of setup.categories[c].values) vars.push({ name: v.who, domain: range(setup.n) });
  return {
    vars,
    constraints: specs.map((s, i) => ({ ...makeConstraint(setup, s), clue: i + 1 })),
    groups: varCats(setup).map((c) => ({ vars: range(setup.n).map((v) => varIndex(setup, c, v)), bijective: true })),
    phrasing: {
      elim: (v, xs) => `${capitalize(vars[v].name)} ${setup.ordered ? `is not in ${listJoin(xs.map((x) => slotName(setup, x)), 'or')}` : `is not ${listJoin(xs.map((x) => slotName(setup, x)), 'or')}`}`,
      assign: (v, x) => `${vars[v].name} ${setup.ordered ? `must be in ${slotName(setup, x)}` : `must be ${slotName(setup, x)}`}`,
      fact: (v, x) => `${vars[v].name} ${setup.ordered ? `is in ${slotName(setup, x)}` : `is ${slotName(setup, x)}`}`,
      name: (v) => vars[v].name,
    },
  };
}

function solutionVector(setup: GridSetup): number[] {
  const out: number[] = [];
  for (const c of varCats(setup))
    for (let v = 0; v < setup.n; v++) {
      // slot holding value v of category c
      out.push(setup.solution[c].indexOf(v));
    }
  return out;
}

function trueClues(setup: GridSetup): { spec: GridClueSpec; weight: number[] }[] {
  const { n, categories, solution, ordered } = setup;
  const slotOf = (c: number, v: number) => solution[c].indexOf(v);
  const out: { spec: GridClueSpec; weight: number[] }[] = [];
  const cats = range(categories.length);
  for (const c1 of cats)
    for (const c2 of cats) {
      if (c1 >= c2 && !(ordered && c1 !== c2)) continue;
      if (c1 === c2) continue;
      for (let v1 = 0; v1 < n; v1++)
        for (let v2 = 0; v2 < n; v2++) {
          const s1 = slotOf(c1, v1);
          const s2 = slotOf(c2, v2);
          const refs: [number, number][] = [[c1, v1], [c2, v2]];
          if (c1 < c2) {
            if (s1 === s2) out.push({ spec: { kind: 'same', refs }, weight: [5, 4, 3, 2.5] });
            else out.push({ spec: { kind: 'notSame', refs }, weight: [1, 2, 2.5, 3] });
          }
          if (ordered) {
            if (s2 === s1 + 1) out.push({ spec: { kind: 'justLeft', refs }, weight: [2, 2, 2.5, 2.5] });
            if (s1 < s2 && s2 > s1 + 1) out.push({ spec: { kind: 'left', refs }, weight: [1, 1.5, 2, 2.5] });
            if (Math.abs(s1 - s2) === 1 && c1 < c2) out.push({ spec: { kind: 'nextTo', refs }, weight: [1, 1.5, 2, 2.5] });
          }
        }
    }
  // either/or about a subject and two values of another category
  for (const c1 of cats)
    for (const c2 of cats) {
      if (c1 === c2 || c2 === 0) continue;
      for (let v1 = 0; v1 < n; v1++) {
        const s1 = slotOf(c1, v1);
        const actual = solution[c2][s1];
        for (let w = 0; w < n; w++) {
          if (w === actual) continue;
          const pair = [actual, w].sort((a, b) => a - b);
          out.push({ spec: { kind: 'either', refs: [[c1, v1], [c2, pair[0]], [c2, pair[1]]] }, weight: [0, 1, 2, 2.5] });
        }
      }
    }
  if (ordered) {
    for (const c of cats)
      for (let v = 0; v < n; v++) {
        out.push({ spec: { kind: 'at', refs: [[c, v]], param: slotOf(c, v) }, weight: [3, 2, 1, 0.6] });
        for (let k = 0; k < n; k++) if (k !== slotOf(c, v)) out.push({ spec: { kind: 'notAt', refs: [[c, v]], param: k }, weight: [0.5, 1, 1, 1] });
      }
  }
  return out;
}

export interface GridHidden {
  setup: { ordered: boolean; n: number; categories: { id: string }[]; solution: number[][]; names: string[] };
  clues: GridClueSpec[];
  [k: string]: unknown;
}

function rebuildSetup(h: GridHidden['setup']): GridSetup {
  const categories: Category[] = h.categories.map((c) => (c.id === 'people' ? peopleCategory(h.names) : attributeCategory(c.id, h.n)));
  return { ordered: h.ordered, n: h.n, categories, solution: h.solution };
}

function peopleCategory(names: string[]): Category {
  return { id: 'people', label: 'Person', values: names.map((nm) => ({ name: nm, who: nm, has: `is ${nm}`, hasNot: `is not ${nm}` })) };
}

function attributeCategory(id: string, n: number): Category {
  const def = ATTRIBUTE_CATEGORIES.find((c) => c.id === id)!;
  return { id, label: def.label, values: def.values.slice(0, n).map(([name, who, has, hasNot]) => ({ name, who, has, hasNot })) };
}

export function verifyGrid(h: GridHidden, answer: number[][]): string[] {
  const setup = rebuildSetup(h.setup);
  const res = countSolutions(buildCsp(setup, h.clues), 2);
  if (res.exhausted || res.count !== 1) return [`expected unique grid solution, found ${res.count}`];
  // convert solver vector back into the answer table
  const vec = res.solutions[0];
  const table = answerTable({ ...setup, solution: tableFromVector(setup, vec) });
  if (JSON.stringify(table) !== JSON.stringify(answer)) return ['stored answer differs from solver'];
  return [];
}

function tableFromVector(setup: GridSetup, vec: number[]): number[][] {
  const sol: number[][] = setup.categories.map(() => new Array(setup.n).fill(-1));
  if (!setup.ordered) sol[0] = range(setup.n);
  for (const c of varCats(setup)) for (let v = 0; v < setup.n; v++) sol[c][vec[varIndex(setup, c, v)]] = v;
  return sol;
}

/** Answer table: one row per slot, one column per category (value index). */
function answerTable(setup: GridSetup): number[][] {
  const cols = setup.ordered ? range(setup.categories.length) : range(setup.categories.length).slice(1);
  return range(setup.n).map((s) => cols.map((c) => setup.solution[c][s]));
}

export function buildGrid(rng: Rng, difficulty: Difficulty): PuzzleDraft {
  const ordered = difficulty >= 2 && rng.chance(difficulty === 2 ? 0.3 : 0.45);
  const n = difficulty === 1 ? 3 : difficulty === 2 ? (ordered ? 3 : 4) : difficulty === 3 ? 4 : rng.pick([4, 5]);
  const nAttr = difficulty === 1 ? 2 : difficulty === 2 ? (ordered ? 2 : 2) : ordered ? 2 : 3;
  const names = pickNames(rng, n);
  const attrIds = rng.sample(ATTRIBUTE_CATEGORIES.map((c) => c.id), nAttr);
  const categories = [peopleCategory(names), ...attrIds.map((id) => attributeCategory(id, n))];
  // solution[c][slot] = value index of category c in that slot
  const solution = categories.map((_, c) => (c === 0 && !ordered ? range(n) : rng.shuffle(range(n))));
  const setup: GridSetup = { ordered, n, categories, solution };

  const pool = trueClues(setup)
    .filter((c) => c.weight[difficulty - 1] > 0)
    .map((c) => ({ c: c.spec, key: rng.next() ** (1 / c.weight[difficulty - 1]) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.c);
  const chosen: GridClueSpec[] = [];
  let unique = false;
  for (const spec of pool) {
    chosen.push(spec);
    if (chosen.length < 2) continue;
    const res = countSolutions(buildCsp(setup, chosen), 2, 300000);
    if (res.exhausted) reject('solver budget exceeded');
    if (res.count === 1) {
      unique = true;
      break;
    }
    if (chosen.length > 40) break;
  }
  if (!unique) reject('no unique clue set');
  const wrapped = chosen.map((spec) => ({ spec, constraint: makeConstraint(setup, spec) }));
  let clues = pruneClues(wrapped, (s) => buildCsp(setup, s.map((x) => x.spec)), rng.shuffle(wrapped)).map((x) => x.spec);
  clues = rng.shuffle(clues);
  const allowContra = difficulty >= 3;
  let csp = buildCsp(setup, clues);
  let ded = deduce(csp, allowContra);
  for (let extra = 0; !ded.solved && extra < 3; extra++) {
    const more = pool.find((c) => !clues.includes(c) && (c.kind === 'same' || c.kind === 'at'));
    if (!more) break;
    clues = [...clues, more];
    csp = buildCsp(setup, clues);
    ded = deduce(csp, allowContra);
  }
  if (!ded.solved) reject('not solvable step by step');
  const check = countSolutions(csp, 2);
  if (check.count !== 1 || check.exhausted) reject('lost uniqueness');
  if (JSON.stringify(check.solutions[0]) !== JSON.stringify(solutionVector(setup))) reject('solver disagrees with construction');
  if (clues.length > (difficulty === 4 ? 18 : 16)) reject('too many clues to read comfortably');

  const clueTexts = clues.map((c) => capitalize(makeConstraint(setup, c).text) + '.');
  const cols = ordered ? range(categories.length) : range(categories.length).slice(1);
  const table = answerTable(setup);
  const rowsLabel = range(n).map((s) => (ordered ? `Room ${s + 1}` : names[s]));
  const answerText = rowsLabel
    .map((r, s) => `${r}: ${cols.map((c) => categories[c].values[solution[c][s]].name).join(', ')}`)
    .join('; ');

  const alternatives: { label: string; reason: string }[] = [];
  for (const c of rng.shuffle(cols.filter((c) => c > 0 || ordered))) {
    if (alternatives.length >= 3) break;
    const [s1, s2] = rng.sample(range(n), 2);
    const swapped = solution.map((row) => row.slice());
    [swapped[c][s1], swapped[c][s2]] = [swapped[c][s2], swapped[c][s1]];
    const vec = solutionVector({ ...setup, solution: swapped });
    const broken = csp.constraints.find((k) => !k.test(k.vars.map((v) => vec[v])));
    if (broken)
      alternatives.push({
        label: `Swapping the ${categories[c].label.toLowerCase()} of ${rowsLabel[s1]} and ${rowsLabel[s2]}`,
        reason: `breaks clue ${broken.clue}: ${broken.text}.`,
      });
  }
  const firstClue = csp.constraints.find((k) => ded.steps[0]?.startsWith(`Clue ${k.clue}`)) ?? csp.constraints[0];
  const keyDeduction = ded.steps
    .find((s) => s.includes(' must '))
    ?.match(/([^:;—]+ must [^.;—]+)/)?.[1]
    ?.trim()
    .replace(/^so\s+/, '');

  return {
    title: ordered ? 'Corridor logic grid' : 'Logic grid',
    prompt: ordered
      ? `${listJoin(names)} each occupy one of ${n} rooms in a row, numbered 1 to ${n} from left to right. Each also has a different ${listJoin(categories.slice(1).map((c) => c.label.toLowerCase()))}. Work out who is in each room and what they have.`
      : `${listJoin(names)} each have a different ${listJoin(categories.slice(1).map((c) => c.label.toLowerCase()))}. Use the clues to match everything up.`,
    display: {
      blocks: [
        { type: 'list', ordered: true, title: 'Clues', items: clueTexts },
        { type: 'text', tone: 'note', text: `Options: ${categories.slice(ordered ? 0 : 1).map((c) => `${c.label} — ${c.values.map((v) => v.name).join(', ')}`).join(' · ')}` },
      ],
    },
    interaction: {
      type: 'assign',
      rows: rowsLabel,
      rowHeader: ordered ? 'Room' : 'Person',
      columns: cols.map((c) => ({ name: categories[c].label, options: categories[c].values.map((v) => v.name) })),
    },
    answer: { type: 'assign', solution: table },
    hints: [
      `Start from clue ${firstClue.clue} and mark the eliminations in a grid.`,
      `Every value is used exactly once per category, so when only one option is left in a row or column it must be the answer${ded.contradictions ? '; one step needs you to test a possibility and see it fail' : ''}.`,
      keyDeduction ? `Key deduction: ${capitalize(keyDeduction)}.` : `Combine clue ${firstClue.clue} with another clue about the same value.`,
    ],
    explanation: {
      answer: answerText,
      rule: `Only one assignment satisfies every clue: ${answerText}. A solver confirmed there is no second solution.`,
      steps: [...ded.steps, 'All clues are satisfied and every category is filled.'],
      alternatives,
      skills: ['deduction', 'constraint satisfaction', 'working memory'],
    },
    metrics: { rules: clues.length, steps: ded.steps.length + ded.contradictions * 2 },
    fingerprint: {
      structure: `grid|${ordered ? 'ordered' : 'match'}|${n}x${categories.length}|${[...new Set(clues.map((c) => c.kind))].sort().join('+')}`,
      features: [ordered ? 'grid:ordered' : 'grid:match', `n:${n}`, ...new Set(clues.map((c) => `clue:${c.kind}`)), ded.contradictions ? 'needs:case-analysis' : 'needs:direct'],
      detail: `${attrIds.join(',')}|${JSON.stringify(solution)}|${clueTexts.join('|')}`,
    },
    hidden: {
      setup: { ordered, n, categories: categories.map((c) => ({ id: c.id })), solution, names },
      clues,
    } satisfies GridHidden,
  };
}
