/**
 * Number sequences. Every rule family in the library is fitted to the shown
 * terms; for a missing middle term every candidate value is tried. The
 * puzzle is accepted only when all fitting rules agree on the answer.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { reject } from '../../util';

interface Family {
  id: string;
  /** Returns a function predicting term i (0-based) if the terms fit, else null. */
  fit(t: number[]): ((i: number) => number) | null;
  describe(t: number[]): string;
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

const diffs = (t: number[]) => t.slice(1).map((x, i) => x - t[i]);
const allEq = (xs: number[]) => xs.every((x) => x === xs[0]);
const isInt = (x: number) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;

export const FAMILIES: Family[] = [
  {
    id: 'arith',
    fit: (t) => {
      const d = diffs(t);
      return allEq(d) ? (i) => t[0] + d[0] * i : null;
    },
    describe: (t) => `add ${t[1] - t[0]} each time`,
  },
  {
    id: 'geom',
    fit: (t) => {
      if (t[0] === 0) return null;
      const r = t[1] / t[0];
      if (!isInt(r) || Math.abs(r) < 2) return null;
      return t.every((x, i) => x === t[0] * r ** i) ? (i) => t[0] * r ** i : null;
    },
    describe: (t) => `multiply by ${t[1] / t[0]} each time`,
  },
  {
    id: 'quad',
    fit: (t) => {
      const d2 = diffs(diffs(t));
      if (!allEq(d2) || d2[0] === 0) return null;
      return (i) => {
        // extend using constant second difference
        const seq = t.slice();
        while (seq.length <= i) {
          const n = seq.length;
          seq.push(seq[n - 1] + (seq[n - 1] - seq[n - 2]) + d2[0]);
        }
        return seq[i];
      };
    },
    describe: (t) => {
      const d = diffs(t);
      return `the gap grows by ${d[1] - d[0]} each time (${d.join(', ')}, …)`;
    },
  },
  {
    id: 'cubic',
    fit: (t) => {
      if (t.length < 5) return null;
      const d3 = diffs(diffs(diffs(t)));
      if (!allEq(d3) || d3[0] === 0) return null;
      return (i) => {
        const seq = t.slice();
        while (seq.length <= i) {
          const d1 = diffs(seq);
          const d2 = diffs(d1);
          const n2 = d2[d2.length - 1] + d3[0];
          const n1 = d1[d1.length - 1] + n2;
          seq.push(seq[seq.length - 1] + n1);
        }
        return seq[i];
      };
    },
    describe: () => 'the differences of the differences grow steadily (a cubic pattern)',
  },
  {
    id: 'fib',
    fit: (t) => (t.slice(2).every((x, i) => x === t[i] + t[i + 1]) ? (i) => { const s = t.slice(); while (s.length <= i) s.push(s[s.length - 1] + s[s.length - 2]); return s[i]; } : null),
    describe: () => 'each term is the sum of the two before it',
  },
  {
    id: 'trib',
    fit: (t) => (t.length >= 5 && t.slice(3).every((x, i) => x === t[i] + t[i + 1] + t[i + 2]) ? (i) => { const s = t.slice(); while (s.length <= i) s.push(s[s.length - 1] + s[s.length - 2] + s[s.length - 3]); return s[i]; } : null),
    describe: () => 'each term is the sum of the three before it',
  },
  {
    id: 'rec',
    fit: (t) => {
      if (t[1] === t[0]) return null;
      const p = (t[2] - t[1]) / (t[1] - t[0]);
      if (!isInt(p) || p < 2) return null;
      const q = t[1] - p * t[0];
      return t.slice(1).every((x, i) => x === p * t[i] + q) ? (i) => { const s = t.slice(); while (s.length <= i) s.push(p * s[s.length - 1] + q); return s[i]; } : null;
    },
    describe: (t) => {
      const p = (t[2] - t[1]) / (t[1] - t[0]);
      const q = t[1] - p * t[0];
      return `multiply by ${p}${q ? ` then ${q > 0 ? 'add' : 'subtract'} ${Math.abs(q)}` : ''}`;
    },
  },
  {
    id: 'alt',
    fit: (t) => {
      const d = diffs(t);
      if (d.length < 3 || d[0] === d[1]) return null;
      return d.every((x, i) => x === d[i % 2]) ? (i) => { const s = t.slice(); while (s.length <= i) s.push(s[s.length - 1] + d[(s.length - 1) % 2]); return s[i]; } : null;
    },
    describe: (t) => {
      const d = diffs(t);
      return `the steps alternate: ${d[0] >= 0 ? '+' : '−'}${Math.abs(d[0])}, ${d[1] >= 0 ? '+' : '−'}${Math.abs(d[1])}, …`;
    },
  },
  {
    id: 'interleave',
    fit: (t) => {
      const ev = t.filter((_, i) => i % 2 === 0);
      const od = t.filter((_, i) => i % 2 === 1);
      if (ev.length < 3 || od.length < 2) return null;
      const de = diffs(ev);
      const dod = diffs(od);
      if (!allEq(de) || !allEq(dod) || de[0] === dod[0]) return null;
      return (i) => (i % 2 === 0 ? ev[0] + de[0] * (i / 2) : od[0] + dod[0] * ((i - 1) / 2));
    },
    describe: (t) => {
      const ev = t.filter((_, i) => i % 2 === 0);
      const od = t.filter((_, i) => i % 2 === 1);
      return `two sequences are interleaved: ${ev.join(', ')} (step ${ev[1] - ev[0]}) and ${od.join(', ')} (step ${od[1] - od[0]})`;
    },
  },
  {
    id: 'growmul',
    fit: (t) => {
      if (t.some((x) => x === 0)) return null;
      const r = t.slice(1).map((x, i) => x / t[i]);
      if (!r.every(isInt) || !allEq(diffs(r)) || diffs(r)[0] !== 1) return null;
      return (i) => { const s = t.slice(); while (s.length <= i) s.push(s[s.length - 1] * (r[0] + s.length - 1)); return s[i]; };
    },
    describe: (t) => `multiply by ${t[1] / t[0]}, then ${t[1] / t[0] + 1}, then ${t[1] / t[0] + 2}, …`,
  },
  {
    id: 'primes',
    fit: (t) => {
      const s = PRIMES.indexOf(t[0]);
      if (s < 0) return null;
      return t.every((x, i) => PRIMES[s + i] === x) ? (i) => PRIMES[s + i] ?? NaN : null;
    },
    describe: () => 'consecutive prime numbers',
  },
];

function generateTerms(rng: Rng, fam: string, n: number): number[] | null {
  const out: number[] = [];
  switch (fam) {
    case 'arith': {
      const a = rng.int(-10, 30);
      const d = rng.pick([-7, -5, -4, -3, 3, 4, 5, 6, 7, 8, 9, 11, 12]);
      for (let i = 0; i < n; i++) out.push(a + d * i);
      return out;
    }
    case 'geom': {
      const a = rng.int(1, 5);
      const r = rng.pick([2, 3, -2]);
      for (let i = 0; i < n; i++) out.push(a * r ** i);
      return out;
    }
    case 'quad': {
      let x = rng.int(1, 10);
      let d = rng.int(1, 5);
      const dd = rng.pick([1, 2, 3]);
      for (let i = 0; i < n; i++) {
        out.push(x);
        x += d;
        d += dd;
      }
      return out;
    }
    case 'cubic': {
      const s = rng.int(1, 3);
      const c = rng.int(-2, 3);
      for (let i = 0; i < n; i++) out.push((i + s) ** 3 + c);
      return out;
    }
    case 'fib': {
      const a = rng.int(1, 5);
      const b = rng.int(a, a + 5);
      out.push(a, b);
      while (out.length < n) out.push(out[out.length - 1] + out[out.length - 2]);
      return out;
    }
    case 'trib': {
      out.push(rng.int(0, 2), rng.int(1, 3), rng.int(1, 4));
      while (out.length < n) out.push(out[out.length - 1] + out[out.length - 2] + out[out.length - 3]);
      return out;
    }
    case 'rec': {
      const p = rng.pick([2, 3]);
      const q = rng.pick([-2, -1, 1, 2, 3]);
      out.push(rng.int(1, 5));
      while (out.length < n) out.push(p * out[out.length - 1] + q);
      return out;
    }
    case 'alt': {
      const a = rng.pick([2, 3, 4, 5, 7, 10]);
      const b = rng.pick([-1, -2, -3, 1]);
      out.push(rng.int(1, 20));
      while (out.length < n) out.push(out[out.length - 1] + (out.length % 2 === 1 ? a : b));
      return out;
    }
    case 'interleave': {
      const e0 = rng.int(1, 10);
      const de = rng.pick([2, 3, 5]);
      const o0 = rng.int(10, 30);
      const dod = rng.pick([-1, -2, -3, 4]);
      for (let i = 0; i < n; i++) out.push(i % 2 === 0 ? e0 + de * (i / 2) : o0 + dod * ((i - 1) / 2));
      return out;
    }
    case 'growmul': {
      out.push(rng.int(1, 3));
      let m = rng.int(1, 2);
      while (out.length < n) out.push(out[out.length - 1] * m++);
      return out;
    }
    case 'primes': {
      const s = rng.int(0, 8);
      return PRIMES.slice(s, s + n);
    }
  }
  return null;
}

const RULE_TYPE: Record<string, string> = {
  arith: 'a constant step between terms',
  geom: 'a constant multiplier',
  quad: 'gaps that grow by the same amount each time',
  cubic: 'cubes of consecutive numbers, slightly adjusted',
  fib: 'each term is built from the two terms before it',
  trib: 'each term is built from the three terms before it',
  rec: 'multiply the previous term, then add or subtract a constant',
  alt: 'two different steps used in turn',
  interleave: 'two separate sequences woven together',
  growmul: 'a multiplier that grows by one each time',
  primes: 'numbers with exactly two divisors',
};

const LEVEL: Record<string, number> = { arith: 1, geom: 1, quad: 2, alt: 2, fib: 2, rec: 3, interleave: 3, primes: 3, growmul: 4, trib: 4, cubic: 4 };

/** All values a missing position could take under some library rule. */
export function candidateAnswers(shown: (number | null)[]): Map<number, string[]> {
  const missing = shown.indexOf(null);
  const out = new Map<number, string[]>();
  const known = shown.filter((x): x is number => x !== null);
  if (missing === shown.length - 1) {
    for (const f of FAMILIES) {
      const pred = f.fit(known);
      if (pred) {
        const v = pred(missing);
        if (Number.isFinite(v)) out.set(v, [...(out.get(v) ?? []), f.id]);
      }
    }
    return out;
  }
  const lo = Math.min(...known) - 300;
  const hi = Math.max(...known) + 300;
  for (let v = lo; v <= hi; v++) {
    const full = shown.map((x) => (x === null ? v : x));
    for (const f of FAMILIES) if (f.fit(full)) out.set(v, [...(out.get(v) ?? []), f.id]);
  }
  return out;
}

interface SeqHidden {
  family: string;
  terms: number[];
  missing: number;
  [k: string]: unknown;
}

export const riddleSequence: GeneratorDef = {
  id: 'riddle.sequence',
  category: 'riddle',
  version: 1,
  family: 'Number sequences',
  description: 'Find the rule behind a number sequence.',
  weight: 1.1,
  candidates: 5,
  generate({ rng, difficulty }) {
    const fams = Object.keys(LEVEL).filter((f) => LEVEL[f] <= difficulty && (difficulty < 3 || LEVEL[f] >= 2));
    const fam = rng.pick(fams);
    const len = difficulty <= 2 ? 6 : 7;
    const terms = generateTerms(rng, fam, len);
    if (!terms || terms.some((x) => Math.abs(x) > 5000)) reject('terms out of range');
    const missing = difficulty === 4 && rng.chance(0.4) ? rng.int(2, len - 2) : len - 1;
    const shown = terms.map((x, i) => (i === missing ? null : x));
    const cands = candidateAnswers(shown);
    if (cands.size !== 1 || !cands.has(terms[missing])) reject('ambiguous sequence');
    const answer = terms[missing];
    const famDef = FAMILIES.find((f) => f.id === fam)!;
    const ruleText = famDef.describe(terms);
    const known = shown.filter((x): x is number => x !== null);
    const traps = new Map<number, string>();
    const d = diffs(known);
    if (missing === len - 1) {
      traps.set(known[known.length - 1] + d[d.length - 1], `${known[known.length - 1] + d[d.length - 1]} repeats the last gap (${d[d.length - 1]}) instead of following the rule.`);
      traps.set(known[known.length - 1] + 2 * d[d.length - 1] - d[d.length - 2], `${known[known.length - 1] + 2 * d[d.length - 1] - d[d.length - 2]} assumes the gaps change steadily, which does not fit every term.`);
    }
    traps.set(answer + 1, `${answer + 1} is one too many.`);
    traps.set(answer - 1, `${answer - 1} is one too few.`);
    traps.set(answer + 2, `${answer + 2} is an arithmetic slip.`);
    traps.delete(answer);
    const distractors = [...traps.entries()].slice(0, 3);
    const built = buildChoices(
      { key: String(answer), text: String(answer) },
      distractors.map(([v, why]) => ({ key: String(v), text: String(v), reason: why })),
      rng,
    );
    const display = shown.map((x) => (x === null ? '?' : String(x))).join(', ');
    return {
      title: missing === len - 1 ? 'Next in the sequence' : 'Missing term',
      prompt: missing === len - 1 ? `What number comes next?` : `What number replaces the question mark?`,
      display: { blocks: [{ type: 'text', text: display, tone: 'lead' }] },
      interaction: { type: 'number', placeholder: 'Number', fallback: built.choices },
      answer: { type: 'number', value: answer, fallbackCorrect: built.correctId },
      hints: [
        'Write down the differences between neighbouring terms.',
        fam === 'interleave' ? 'Look at every other term.' : fam === 'fib' || fam === 'trib' ? 'Compare each term with the terms just before it — not only the one before.' : fam === 'geom' || fam === 'rec' || fam === 'growmul' ? 'Try ratios: how many times bigger is each term?' : fam === 'primes' ? 'These numbers have something special in common — what can’t you divide them by?' : 'If the differences are not constant, look at the differences of the differences.',
        `Rule type: ${RULE_TYPE[fam]}.`,
      ],
      explanation: {
        answer: `${answer}`,
        rule: `The rule: ${ruleText}.`,
        steps: [`Sequence: ${terms.join(', ')}.`, `Rule: ${ruleText}.`, `So the ${missing === len - 1 ? 'next term' : 'missing term'} is ${answer}.`, 'Every other rule in the library that fits the visible terms gives the same answer.'],
        alternatives: built.alternatives,
        skills: ['numerical reasoning', 'pattern recognition'],
      },
      metrics: { rules: 1, steps: LEVEL[fam] + (missing === len - 1 ? 0 : 1), choices: built.choices.length },
      fingerprint: { structure: `nseq|${fam}|${missing === len - 1 ? 'next' : 'gap'}`, features: [`seq:${fam}`, missing === len - 1 ? 'ask:next' : 'ask:gap'], detail: terms.join(',') },
      hidden: { family: fam, terms, missing } satisfies SeqHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as SeqHidden;
    const shown = h.terms.map((x, i) => (i === h.missing ? null : x));
    const c = candidateAnswers(shown);
    if (c.size !== 1 || p.answer.type !== 'number' || !c.has(p.answer.value)) return ['sequence answer not unique'];
    return [];
  },
};

