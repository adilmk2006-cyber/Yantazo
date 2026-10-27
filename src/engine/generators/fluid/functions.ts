/**
 * Number machines: infer a numeric rule from input → output examples
 * (one, two or three inputs) and apply it. Every family in the library is fitted
 * to the examples; all fitting rules must agree on the query.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Block, Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { range, reject } from '../../util';

export interface NumRule {
  id: string;
  arity: 1 | 2 | 3;
  params: number[];
  f(xs: number[]): number;
  text: string;
  calc(xs: number[]): string;
}

function signed(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${-n}`;
}

/** Families with parameter grids; `level` = earliest difficulty that uses it as the true rule. */
interface Family {
  id: string;
  arity: 1 | 2 | 3;
  level: number;
  grid: number[][];
  make(p: number[]): NumRule;
}

const R = (a: number, b: number) => range(b - a + 1, a);

const FAMILIES: Family[] = [
  {
    id: 'lin', arity: 1, level: 1,
    grid: R(1, 9).flatMap((a) => R(-12, 12).map((b) => [a, b])),
    make: ([a, b]) => ({ id: `lin:${a},${b}`, arity: 1, params: [a, b], f: ([x]) => a * x + b, text: `multiply by ${a} then ${b >= 0 ? 'add' : 'subtract'} ${Math.abs(b)}`, calc: ([x]) => `${a} × ${x} ${signed(b)} = ${a * x + b}` }),
  },
  {
    id: 'sq', arity: 1, level: 2,
    grid: R(-9, 9).map((b) => [b]),
    make: ([b]) => ({ id: `sq:${b}`, arity: 1, params: [b], f: ([x]) => x * x + b, text: `square the number then ${b >= 0 ? 'add' : 'subtract'} ${Math.abs(b)}`, calc: ([x]) => `${x}² ${signed(b)} = ${x * x + b}` }),
  },
  {
    id: 'pron', arity: 1, level: 3,
    grid: R(-3, 3).map((k) => [k]),
    make: ([k]) => ({ id: `pron:${k}`, arity: 1, params: [k], f: ([x]) => x * (x + 1) + k, text: `multiply the number by the next number up${k ? `, then ${k > 0 ? 'add' : 'subtract'} ${Math.abs(k)}` : ''}`, calc: ([x]) => `${x} × ${x + 1}${k ? ` ${signed(k)}` : ''} = ${x * (x + 1) + k}` }),
  },
  {
    id: 'cube', arity: 1, level: 4,
    grid: R(-5, 5).map((b) => [b]),
    make: ([b]) => ({ id: `cube:${b}`, arity: 1, params: [b], f: ([x]) => x * x * x + b, text: `cube the number${b ? ` then ${b > 0 ? 'add' : 'subtract'} ${Math.abs(b)}` : ''}`, calc: ([x]) => `${x}³${b ? ` ${signed(b)}` : ''} = ${x ** 3 + b}` }),
  },
  {
    id: 'pow2', arity: 1, level: 3,
    grid: R(-5, 5).map((b) => [b]),
    make: ([b]) => ({ id: `pow2:${b}`, arity: 1, params: [b], f: ([x]) => 2 ** x + b, text: `raise 2 to the power of the number${b ? ` then ${b > 0 ? 'add' : 'subtract'} ${Math.abs(b)}` : ''}`, calc: ([x]) => `2^${x}${b ? ` ${signed(b)}` : ''} = ${2 ** x + b}` }),
  },
  {
    id: 'sum', arity: 2, level: 1,
    grid: R(-9, 9).map((k) => [k]),
    make: ([k]) => ({ id: `sum:${k}`, arity: 2, params: [k], f: ([a, b]) => a + b + k, text: `add the two numbers${k ? ` then ${k > 0 ? 'add' : 'subtract'} ${Math.abs(k)}` : ''}`, calc: ([a, b]) => `${a} + ${b}${k ? ` ${signed(k)}` : ''} = ${a + b + k}` }),
  },
  {
    id: 'prod', arity: 2, level: 2,
    grid: R(-9, 9).map((k) => [k]),
    make: ([k]) => ({ id: `prod:${k}`, arity: 2, params: [k], f: ([a, b]) => a * b + k, text: `multiply the two numbers${k ? ` then ${k > 0 ? 'add' : 'subtract'} ${Math.abs(k)}` : ''}`, calc: ([a, b]) => `${a} × ${b}${k ? ` ${signed(k)}` : ''} = ${a * b + k}` }),
  },
  {
    id: 'sqplus', arity: 2, level: 3,
    grid: [[0]],
    make: () => ({ id: 'sqplus', arity: 2, params: [], f: ([a, b]) => a * a + b, text: 'square the first number and add the second', calc: ([a, b]) => `${a}² + ${b} = ${a * a + b}` }),
  },
  {
    id: 'diffsq', arity: 2, level: 4,
    grid: [[0]],
    make: () => ({ id: 'diffsq', arity: 2, params: [], f: ([a, b]) => a * a - b * b, text: 'subtract the square of the second number from the square of the first', calc: ([a, b]) => `${a}² − ${b}² = ${a * a - b * b}` }),
  },
  {
    id: 'scaledsum', arity: 2, level: 2,
    grid: R(2, 5).map((m) => [m]),
    make: ([m]) => ({ id: `scaledsum:${m}`, arity: 2, params: [m], f: ([a, b]) => (a + b) * m, text: `add the two numbers then multiply by ${m}`, calc: ([a, b]) => `(${a} + ${b}) × ${m} = ${(a + b) * m}` }),
  },
  {
    id: 'scaleddiff', arity: 2, level: 3,
    grid: R(1, 5).map((m) => [m]),
    make: ([m]) => ({ id: `scaleddiff:${m}`, arity: 2, params: [m], f: ([a, b]) => (a - b) * m, text: `subtract the second number from the first${m > 1 ? ` then multiply by ${m}` : ''}`, calc: ([a, b]) => `(${a} − ${b})${m > 1 ? ` × ${m}` : ''} = ${(a - b) * m}` }),
  },
  {
    id: 'prodsum', arity: 2, level: 4,
    grid: [[0]],
    make: () => ({ id: 'prodsum', arity: 2, params: [], f: ([a, b]) => a * b + a + b, text: 'multiply the two numbers, then add both of them', calc: ([a, b]) => `${a} × ${b} + ${a} + ${b} = ${a * b + a + b}` }),
  },
  {
    id: 'firstmul', arity: 2, level: 3,
    grid: R(2, 4).flatMap((m) => R(-3, 3).map((k) => [m, k])),
    make: ([m, k]) => ({ id: `firstmul:${m},${k}`, arity: 2, params: [m, k], f: ([a, b]) => a * m + b + k, text: `multiply the first number by ${m} and add the second${k ? `, then ${k > 0 ? 'add' : 'subtract'} ${Math.abs(k)}` : ''}`, calc: ([a, b]) => `${a} × ${m} + ${b}${k ? ` ${signed(k)}` : ''} = ${a * m + b + k}` }),
  },
  {
    id: 't-sum', arity: 3, level: 1,
    grid: R(-6, 6).map((k) => [k]),
    make: ([k]) => ({ id: `t-sum:${k}`, arity: 3, params: [k], f: ([a, b, c]) => a + b + c + k, text: `add the three corner numbers${k ? ` then ${k > 0 ? 'add' : 'subtract'} ${Math.abs(k)}` : ''}`, calc: ([a, b, c]) => `${a} + ${b} + ${c}${k ? ` ${signed(k)}` : ''} = ${a + b + c + k}` }),
  },
  {
    id: 't-abc', arity: 3, level: 2,
    grid: [[0], [1], [2]],
    make: ([o]) => {
      const fs = [
        { f: (a: number, b: number, c: number) => a * b - c, t: 'multiply the top two corners and subtract the third', s: (a: number, b: number, c: number) => `${a} × ${b} − ${c}` },
        { f: (a: number, b: number, c: number) => (a + b) * c, t: 'add the top two corners and multiply by the third', s: (a: number, b: number, c: number) => `(${a} + ${b}) × ${c}` },
        { f: (a: number, b: number, c: number) => a * b + c, t: 'multiply the top two corners and add the third', s: (a: number, b: number, c: number) => `${a} × ${b} + ${c}` },
      ][o];
      return { id: `t-abc:${o}`, arity: 3, params: [o], f: ([a, b, c]) => fs.f(a, b, c), text: fs.t, calc: ([a, b, c]) => `${fs.s(a, b, c)} = ${fs.f(a, b, c)}` };
    },
  },
  {
    id: 't-perm', arity: 3, level: 3,
    grid: [[0], [1], [2]],
    make: ([o]) => {
      const fs = [
        { f: (a: number, b: number, c: number) => a * c - b, t: 'multiply the left and right corners and subtract the top', s: (a: number, b: number, c: number) => `${a} × ${c} − ${b}` },
        { f: (a: number, b: number, c: number) => (b + c) * a, t: 'add the bottom corners and multiply by the top', s: (a: number, b: number, c: number) => `(${b} + ${c}) × ${a}` },
        { f: (a: number, b: number, c: number) => a * b * c, t: 'multiply all three corners', s: (a: number, b: number, c: number) => `${a} × ${b} × ${c}` },
      ][o];
      return { id: `t-perm:${o}`, arity: 3, params: [o], f: ([a, b, c]) => fs.f(a, b, c), text: fs.t, calc: ([a, b, c]) => `${fs.s(a, b, c)} = ${fs.f(a, b, c)}` };
    },
  },
];

export function allRules(arity: 1 | 2 | 3): NumRule[] {
  return FAMILIES.filter((f) => f.arity === arity).flatMap((f) => f.grid.map((p) => f.make(p)));
}

function randomInputs(rng: Rng, arity: number, ruleId: string): number[] {
  if (arity === 1) return [ruleId.startsWith('pow2') || ruleId.startsWith('cube') ? rng.int(1, 7) : rng.int(1, 12)];
  if (arity === 2) {
    const a = rng.int(2, 9);
    return [a, rng.int(1, ruleId.startsWith('scaleddiff') ? a - 1 : 9)];
  }
  return [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)];
}

interface FnHidden {
  rule: string;
  arity: number;
  examples: { x: number[]; y: number }[];
  query: number[];
  [k: string]: unknown;
}

export const fluidFunction: GeneratorDef = {
  id: 'fluid.function',
  category: 'fluid',
  version: 1,
  family: 'Number machines',
  description: 'Infer a numeric rule from examples and apply it to a new input.',
  weight: 1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const arity = rng.pick<1 | 2 | 3>(difficulty === 1 ? [1, 2, 3] : [1, 2, 2, 3]);
    const fams = FAMILIES.filter((f) => f.arity === arity && f.level <= difficulty && (difficulty < 3 || f.level >= 2));
    if (!fams.length) reject('no family');
    const fam = rng.pick(fams);
    const rule = fam.make(rng.pick(fam.grid));
    if (rule.id === 'lin:1,0' || rule.id === 'sum:0' && difficulty > 1) reject('trivial');
    const nEx = arity === 1 ? 3 : 3;
    const examples: { x: number[]; y: number }[] = [];
    const used = new Set<string>();
    for (let t = 0; examples.length < nEx && t < 40; t++) {
      const x = randomInputs(rng, arity, rule.id);
      if (used.has(x.join(','))) continue;
      used.add(x.join(','));
      examples.push({ x, y: rule.f(x) });
    }
    let query: number[] = [];
    for (let t = 0; t < 40; t++) {
      query = randomInputs(rng, arity, rule.id);
      if (!used.has(query.join(','))) break;
    }
    const answer = rule.f(query);
    if (Math.abs(answer) > 999 || examples.some((e) => Math.abs(e.y) > 999)) reject('numbers too large');
    const lib = allRules(arity);
    const fits = (r: NumRule, exs: typeof examples) => exs.every((e) => r.f(e.x) === e.y);
    let consistent = lib.filter((r) => fits(r, examples));
    // add an example if rivals disagree
    if (new Set(consistent.map((r) => r.f(query))).size > 1) {
      for (let t = 0; t < 30; t++) {
        const x = randomInputs(rng, arity, rule.id);
        if (used.has(x.join(',')) || x.join(',') === query.join(',')) continue;
        used.add(x.join(','));
        examples.push({ x, y: rule.f(x) });
        break;
      }
      consistent = lib.filter((r) => fits(r, examples));
    }
    const preds = new Set(consistent.map((r) => r.f(query)));
    if (preds.size !== 1 || !preds.has(answer)) reject('ambiguous number rule');

    // Distractors: rules that fit some but not all examples, plus slips.
    const near = lib
      .filter((r) => !fits(r, examples) && fits(r, examples.slice(0, 1)) && r.f(query) !== answer)
      .map((r) => ({ v: r.f(query), r }));
    const distractors: { v: number; reason: string }[] = [];
    const seen = new Set([answer]);
    for (const { v, r } of rng.shuffle(near)) {
      if (distractors.length >= 3) break;
      if (seen.has(v) || Math.abs(v) > 9999) continue;
      const fail = examples.find((e) => r.f(e.x) !== e.y)!;
      seen.add(v);
      distractors.push({ v, reason: `${v} comes from the rule "${r.text}", which fits the first example but fails another: ${r.calc(fail.x)}, not ${fail.y}.` });
    }
    for (const d of [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10]) {
      if (distractors.length >= 3) break;
      if (!seen.has(d)) {
        seen.add(d);
        distractors.push({ v: d, reason: `${d} is close, but it is an arithmetic slip: the rule gives ${rule.calc(query)}.` });
      }
    }
    const built = buildChoices(
      { key: String(answer), text: String(answer) },
      distractors.map((d) => ({ key: String(d.v), text: String(d.v), reason: d.reason })),
      rng,
    );

    const blocks: Block[] =
      arity === 3
        ? [
            {
              type: 'gallery',
              size: 'sm',
              items: [
                ...examples.map((e) => ({ visual: { kind: 'num-triangle' as const, corners: e.x.map(String) as [string, string, string], center: String(e.y) } })),
                { visual: { kind: 'num-triangle' as const, corners: query.map(String) as [string, string, string], center: '?' } },
              ],
            },
          ]
        : [
            {
              type: 'table',
              headers: arity === 1 ? ['In', 'Out'] : ['First', 'Second', 'Out'],
              rows: [...examples.map((e) => [...e.x.map(String), String(e.y)]), [...query.map(String), '?']],
              caption: 'The machine applies the same rule every time.',
            },
          ];
    const featureWord = arity === 1 ? 'input' : arity === 2 ? 'pair of inputs' : 'triangle';

    return {
      title: arity === 3 ? 'Number triangles' : 'Number machine',
      prompt:
        arity === 3
          ? 'The number in the middle of each triangle is calculated from its three corners in the same way. What number replaces the question mark?'
          : `The machine turns each ${featureWord} into an output using one hidden rule. What does it output for the last row?`,
      display: { blocks },
      interaction: { type: 'number', placeholder: 'Your answer', fallback: built.choices },
      answer: { type: 'number', value: answer, fallbackCorrect: built.correctId },
      hints: [
        arity === 1 ? 'Look at how fast the outputs grow compared with the inputs.' : 'Try simple combinations of the inputs (sum, difference, product) and compare them with the output.',
        fam.id === 'lin' || fam.id === 'sum' || fam.id === 't-sum'
          ? 'One basic operation is applied, then a fixed adjustment.'
          : fam.id.includes('sq') || fam.id === 'cube' || fam.id === 'pron' || fam.id === 'pow2' || fam.id === 'diffsq'
            ? 'The outputs grow faster than any fixed multiple would — think about powers.'
            : 'Multiplication is involved.',
        `Check this rule on the first example: ${rule.text}.`,
      ],
      explanation: {
        answer: `${answer}`,
        rule: `Rule: ${rule.text}.`,
        steps: [...examples.map((e) => `Check: ${rule.calc(e.x)} ✓`), `Apply it: ${rule.calc(query)}.`, consistent.length > 1 ? 'Every other rule in the library that fits all examples gives the same result.' : 'No other rule in the library fits all of the examples.'],
        alternatives: built.alternatives,
        skills: ['fluid reasoning', 'numerical reasoning', 'rule induction'],
      },
      metrics: { rules: 1, steps: fam.level + 1, choices: built.choices.length },
      fingerprint: {
        structure: `fn|${arity}|${fam.id}`,
        features: [`arity:${arity}`, `fam:${fam.id}`],
        detail: `${rule.id}|${examples.map((e) => e.x.join(',')).join(';')}|${query.join(',')}`,
      },
      hidden: { rule: rule.id, arity, examples, query } satisfies FnHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as FnHidden;
    const rule = allRules(h.arity as 1 | 2 | 3).find((r) => r.id === h.rule);
    if (!rule) return ['unknown rule'];
    if (h.examples.some((e) => rule.f(e.x) !== e.y)) return ['examples inconsistent'];
    if (p.answer.type !== 'number' || p.answer.value !== rule.f(h.query)) return ['answer mismatch'];
    return [];
  },
};
