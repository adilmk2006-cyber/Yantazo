/**
 * Symbol equations: hidden whole-number values for symbols, revealed by a set
 * of equations that can be solved one step at a time. A brute-force solver
 * confirms the solution is unique before the puzzle is shown.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { capitalize, reject } from '../../util';
import { shapeInfo } from '../../visual/shapes';

const SYMS = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];
const MAXV = 15;

/** An equation is a list of signed products of symbols plus a constant right-hand side. */
interface Term {
  sign: 1 | -1;
  syms: number[];
}
interface Eq {
  terms: Term[];
  rhs: number;
  /** explanation of the step that solves it */
  solveText: string;
}

function evalTerms(terms: Term[], v: number[]): number {
  let s = 0;
  for (const t of terms) s += t.sign * t.syms.reduce((p, i) => p * v[i], 1);
  return s;
}

function eqTokens(terms: Term[], names: string[]): string[] {
  const out: string[] = [];
  terms.forEach((t, i) => {
    if (i > 0) out.push(t.sign > 0 ? '+' : '−');
    t.syms.forEach((s, j) => {
      if (j > 0) out.push('×');
      out.push(`sym:${names[s]}`);
    });
  });
  return out;
}

function eqText(terms: Term[], names: string[]): string {
  return eqTokens(terms, names)
    .map((t) => (t.startsWith('sym:') ? shapeInfo(t.slice(4) as never).name : t))
    .join(' ');
}

interface Query {
  tokens: (n: string[]) => string[];
  value(v: number[]): number;
  text(n: string[], v: number[]): string;
  leftToRight?(v: number[]): number;
  needs: number;
}

const QUERIES: Record<number, Query[]> = {
  1: [
    { needs: 2, tokens: ([a, b]) => [`sym:${a}`, '+', `sym:${b}`], value: ([a, b]) => a + b, text: (_n, v) => `${v[0]} + ${v[1]} = ${v[0] + v[1]}` },
    { needs: 2, tokens: ([a, b]) => [`sym:${a}`, '+', `sym:${a}`, '+', `sym:${b}`], value: ([a, b]) => 2 * a + b, text: (_n, v) => `${v[0]} + ${v[0]} + ${v[1]} = ${2 * v[0] + v[1]}` },
  ],
  2: [
    { needs: 3, tokens: ([a, b, c]) => [`sym:${a}`, '×', `sym:${b}`, '+', `sym:${c}`], value: ([a, b, c]) => a * b + c, text: (_n, v) => `${v[0]} × ${v[1]} + ${v[2]} = ${v[0] * v[1] + v[2]}` },
    { needs: 3, tokens: ([a, b, c]) => [`sym:${a}`, '+', `sym:${b}`, '×', `sym:${c}`], value: ([a, b, c]) => a + b * c, leftToRight: ([a, b, c]) => (a + b) * c, text: (_n, v) => `${v[0]} + ${v[1]} × ${v[2]} = ${v[0] + v[1] * v[2]} (multiplication first)` },
  ],
  3: [
    { needs: 3, tokens: ([a, b, c]) => ['(', `sym:${a}`, '+', `sym:${b}`, ')', '×', `sym:${c}`], value: ([a, b, c]) => (a + b) * c, text: (_n, v) => `(${v[0]} + ${v[1]}) × ${v[2]} = ${(v[0] + v[1]) * v[2]}` },
    { needs: 3, tokens: ([a, b, c]) => [`sym:${a}`, '×', `sym:${b}`, '−', `sym:${c}`], value: ([a, b, c]) => a * b - c, text: (_n, v) => `${v[0]} × ${v[1]} − ${v[2]} = ${v[0] * v[1] - v[2]}` },
    { needs: 3, tokens: ([a, b, c]) => [`sym:${a}`, '+', `sym:${b}`, '×', `sym:${c}`, '−', `sym:${a}`], value: ([, b, c]) => b * c, leftToRight: ([a, b, c]) => (a + b) * c - a, text: (n, v) => `${v[0]} + ${v[1]} × ${v[2]} − ${v[0]} = ${v[1] * v[2]} (multiplication first; the ${shapeInfo(n[0] as never).name}s cancel)` },
  ],
  4: [
    { needs: 4, tokens: ([a, b, c, d]) => [`sym:${a}`, '×', `sym:${b}`, '+', `sym:${c}`, '×', `sym:${d}`], value: ([a, b, c, d]) => a * b + c * d, leftToRight: ([a, b, c, d]) => (a * b + c) * d, text: (_n, v) => `${v[0]} × ${v[1]} + ${v[2]} × ${v[3]} = ${v[0] * v[1] + v[2] * v[3]}` },
    { needs: 4, tokens: ([a, b, c, d]) => ['(', `sym:${a}`, '−', `sym:${b}`, ')', '×', `sym:${c}`, '+', `sym:${d}`], value: ([a, b, c, d]) => (a - b) * c + d, text: (_n, v) => `(${v[0]} − ${v[1]}) × ${v[2]} + ${v[3]} = ${(v[0] - v[1]) * v[2] + v[3]}` },
  ],
};

function nm(names: string[], i: number): string {
  return shapeInfo(names[i] as never).name;
}

/** Equation that determines symbol x given the already-known symbols. */
function introduce(rng: Rng, x: number, known: number[], v: number[], names: string[], difficulty: number): Eq | null {
  const X = nm(names, x);
  if (known.length === 0) {
    const forms = difficulty >= 2 ? ['xx', 'xxx', 'x*x'] : ['xx', 'xxx'];
    const f = rng.pick(forms);
    if (f === 'xx') return { terms: [{ sign: 1, syms: [x] }, { sign: 1, syms: [x] }], rhs: 2 * v[x], solveText: `two ${X}s make ${2 * v[x]}, so ${X} = ${v[x]}` };
    if (f === 'xxx') return { terms: [{ sign: 1, syms: [x] }, { sign: 1, syms: [x] }, { sign: 1, syms: [x] }], rhs: 3 * v[x], solveText: `three ${X}s make ${3 * v[x]}, so ${X} = ${v[x]}` };
    return { terms: [{ sign: 1, syms: [x, x] }], rhs: v[x] * v[x], solveText: `${X} × ${X} = ${v[x] * v[x]}, and only ${v[x]} × ${v[x]} gives that, so ${X} = ${v[x]}` };
  }
  const y = rng.pick(known);
  const Y = nm(names, y);
  const forms = ['x+y', 'x+x+y'];
  if (v[x] > v[y]) forms.push('x-y');
  if (difficulty >= 2) forms.push('x*y');
  if (difficulty >= 3 && v[x] > 1) forms.push('x*y-y');
  const f = rng.pick(forms);
  switch (f) {
    case 'x+y':
      return { terms: [{ sign: 1, syms: [x] }, { sign: 1, syms: [y] }], rhs: v[x] + v[y], solveText: `${X} + ${Y} = ${v[x] + v[y]} and ${Y} = ${v[y]}, so ${X} = ${v[x]}` };
    case 'x+x+y':
      return { terms: [{ sign: 1, syms: [x] }, { sign: 1, syms: [x] }, { sign: 1, syms: [y] }], rhs: 2 * v[x] + v[y], solveText: `${X} + ${X} + ${Y} = ${2 * v[x] + v[y]} and ${Y} = ${v[y]}, so two ${X}s make ${2 * v[x]} and ${X} = ${v[x]}` };
    case 'x-y':
      return { terms: [{ sign: 1, syms: [x] }, { sign: -1, syms: [y] }], rhs: v[x] - v[y], solveText: `${X} − ${Y} = ${v[x] - v[y]} and ${Y} = ${v[y]}, so ${X} = ${v[x]}` };
    case 'x*y':
      return { terms: [{ sign: 1, syms: [x, y] }], rhs: v[x] * v[y], solveText: `${X} × ${Y} = ${v[x] * v[y]} and ${Y} = ${v[y]}, so ${X} = ${v[x] * v[y]} ÷ ${v[y]} = ${v[x]}` };
    case 'x*y-y':
      return { terms: [{ sign: 1, syms: [x, y] }, { sign: -1, syms: [y] }], rhs: v[x] * v[y] - v[y], solveText: `${X} × ${Y} − ${Y} = ${v[x] * v[y] - v[y]} with ${Y} = ${v[y]}: ${X} × ${v[y]} = ${v[x] * v[y]}, so ${X} = ${v[x]}` };
  }
  return null;
}

function countSolutions(eqs: Eq[], k: number, limit = 2): number[][] {
  const sols: number[][] = [];
  const v = new Array(k).fill(1);
  const rec = (i: number) => {
    if (sols.length >= limit) return;
    if (i === k) {
      if (eqs.every((e) => evalTerms(e.terms, v) === e.rhs)) sols.push(v.slice());
      return;
    }
    for (let x = 1; x <= MAXV; x++) {
      v[i] = x;
      rec(i + 1);
    }
  };
  rec(0);
  return sols;
}

interface EqHidden {
  names: string[];
  values: number[];
  eqs: { terms: Term[]; rhs: number }[];
  queryTokens: string[];
  [k: string]: unknown;
}

/** Tiny recursive-descent evaluator for displayed token lines (+, −, ×, parentheses). */
export function evalTokens(tokens: string[], valueOf: (name: string) => number): number {
  let i = 0;
  const atom = (): number => {
    const t = tokens[i++];
    if (t === '(') {
      const v = expr();
      i++; // ')'
      return v;
    }
    if (t.startsWith('sym:')) return valueOf(t.slice(4));
    return Number(t);
  };
  const term = (): number => {
    let v = atom();
    while (tokens[i] === '×') {
      i++;
      v *= atom();
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (tokens[i] === '+' || tokens[i] === '−') {
      const op = tokens[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  return expr();
}

export const fluidEquations: GeneratorDef = {
  id: 'fluid.equations',
  category: 'fluid',
  version: 1,
  family: 'Symbol equations',
  description: 'Deduce hidden symbol values from interlocking equations.',
  weight: 0.9,
  candidates: 5,
  generate({ rng, difficulty }) {
    const k = difficulty === 1 ? 2 : difficulty === 4 ? 4 : 3;
    const names = rng.sample(SYMS, k);
    const values = rng.sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], k);
    const order = rng.shuffle([...Array(k).keys()]);
    const eqs: Eq[] = [];
    const known: number[] = [];
    let start = 0;
    if (difficulty === 4 && values[order[0]] !== values[order[1]]) {
      // simultaneous pair: sum and difference
      const [a, b] = values[order[0]] > values[order[1]] ? [order[0], order[1]] : [order[1], order[0]];
      const A = nm(names, a);
      const B = nm(names, b);
      eqs.push({ terms: [{ sign: 1, syms: [a] }, { sign: 1, syms: [b] }], rhs: values[a] + values[b], solveText: '' });
      eqs.push({
        terms: [{ sign: 1, syms: [a] }, { sign: -1, syms: [b] }],
        rhs: values[a] - values[b],
        solveText: `Adding "${A} + ${B} = ${values[a] + values[b]}" and "${A} − ${B} = ${values[a] - values[b]}" cancels the ${B}: two ${A}s make ${2 * values[a]}, so ${A} = ${values[a]} and ${B} = ${values[a] + values[b]} − ${values[a]} = ${values[b]}`,
      });
      known.push(a, b);
      start = 2;
    }
    for (let i = start; i < k; i++) {
      const eq = introduce(rng, order[i], known, values, names, difficulty);
      if (!eq) reject('no equation form');
      eqs.push(eq);
      known.push(order[i]);
    }
    const solutions = countSolutions(eqs, k);
    if (solutions.length !== 1) reject('equations not uniquely solvable');
    if (solutions[0].some((x, i) => x !== values[i])) reject('solver disagrees');

    const q = rng.pick(QUERIES[difficulty].filter((x) => x.needs <= k));
    let qOrder: number[] = [];
    for (let t = 0; t < 8; t++) {
      qOrder = rng.shuffle([...Array(k).keys()]).slice(0, q.needs);
      const val = q.value(qOrder.map((i) => values[i]));
      if (val >= 0 && val <= 400) break;
    }
    const qNames = qOrder.map((i) => names[i]);
    const qVals = qOrder.map((i) => values[i]);
    const answer = q.value(qVals);
    if (answer < 0 || answer > 400) reject('query out of range');

    const shownOrder = difficulty >= 3 ? rng.shuffle([...eqs.keys()]) : [...eqs.keys()];
    const distractors: { v: number; why: string }[] = [];
    const seen = new Set([answer]);
    const add = (v: number, why: string) => {
      if (!seen.has(v) && v >= 0 && distractors.length < 3) {
        seen.add(v);
        distractors.push({ v, why });
      }
    };
    if (q.leftToRight) add(q.leftToRight(qVals), 'This works the expression strictly left to right; multiplication must be done before addition or subtraction.');
    if (qVals.length >= 2 && qVals[0] !== qVals[1]) {
      const swapped = qVals.slice();
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      add(q.value(swapped), `This swaps the values of the ${shapeInfo(qNames[0] as never).name} and the ${shapeInfo(qNames[1] as never).name}.`);
    }
    for (const d of [answer + 1, answer - 1, answer + 2, answer + values[order[0]]]) add(d, `An arithmetic slip — the correct working is ${q.text(qNames, qVals)}.`);
    const built = buildChoices(
      { key: String(answer), text: String(answer) },
      distractors.map((d) => ({ key: String(d.v), text: String(d.v), reason: `${d.v}: ${d.why}` })),
      rng,
    );
    const solveSteps = eqs.filter((e) => e.solveText).map((e) => `Equation ${shownOrder.indexOf(eqs.indexOf(e)) + 1}: ${capitalize(e.solveText)}.`);
    const firstEq = eqs[0];

    return {
      title: 'Symbol equations',
      prompt: 'Each symbol stands for a different whole number. Work out the values, then evaluate the final expression. Multiplication is done before addition and subtraction.',
      display: {
        blocks: [{ type: 'equations', lines: [...shownOrder.map((i) => [...eqTokens(eqs[i].terms, names), '=', String(eqs[i].rhs)]), [...q.tokens(qNames), '=', '?']] }],
      },
      interaction: { type: 'number', placeholder: 'Value of the last line', fallback: built.choices },
      answer: { type: 'number', value: answer, fallbackCorrect: built.correctId },
      hints: [
        difficulty === 4 ? 'Two of the equations share the same two symbols — combine them.' : 'Find an equation that contains only one kind of symbol and solve that first.',
        `Start with: ${eqText(firstEq.terms, names)} = ${firstEq.rhs}. Each solved symbol unlocks another equation.`,
        `Once you know every symbol, remember that × is evaluated before + and −.`,
      ],
      explanation: {
        answer: `${answer}`,
        rule: `Values: ${names.map((n, i) => `${shapeInfo(n as never).name} = ${values[i]}`).join(', ')}.`,
        steps: [...solveSteps, `Final line: ${q.text(qNames, qVals)}.`, 'A brute-force check over every whole number from 1 to 15 confirms these are the only values that satisfy all the equations.'],
        alternatives: built.alternatives,
        skills: ['fluid reasoning', 'numerical reasoning', 'deduction'],
      },
      metrics: { rules: eqs.length, steps: eqs.length + 1, choices: built.choices.length },
      fingerprint: {
        structure: `eq|${k}|${difficulty === 4 && start === 2 ? 'simul' : 'chain'}|${q.needs}`,
        features: [`symbols:${k}`, start === 2 ? 'form:simultaneous' : 'form:chain', q.leftToRight ? 'query:precedence' : 'query:plain'],
        detail: `${values.join(',')}|${eqs.map((e) => e.rhs).join(',')}`,
      },
      hidden: { names, values, eqs: eqs.map((e) => ({ terms: e.terms, rhs: e.rhs })), queryTokens: q.tokens(qNames) } satisfies EqHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as EqHidden;
    const sols = countSolutions(h.eqs.map((e) => ({ ...e, solveText: '' })), h.names.length);
    if (sols.length !== 1) return ['not uniquely solvable'];
    const value = evalTokens(h.queryTokens, (n) => sols[0][h.names.indexOf(n)]);
    if (p.answer.type !== 'number' || p.answer.value !== value) return ['answer mismatch'];
    const block = p.display.blocks[0];
    if (block.type !== 'equations') return ['missing equations'];
    for (const line of block.lines.slice(0, -1)) {
      const eq = line.indexOf('=');
      if (evalTokens(line.slice(0, eq), (n) => sols[0][h.names.indexOf(n)]) !== Number(line[eq + 1])) return ['displayed equation is false'];
    }
    return [];
  },
};
