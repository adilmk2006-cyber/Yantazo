/**
 * Symbol-string transformation induction.
 *
 * A hidden rule (1–3 composed operations) turns input strings into outputs.
 * The validator enumerates every composition in the operation library: the
 * simplest consistent compositions must all give the same output for the
 * query, so the intended answer is the unique "simplest rule" answer.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle, Visual } from '../../types';
import type { Rng } from '../../rng';
import { LETTERS, capitalize, listJoin, mod, reject } from '../../util';
import { shapeInfo } from '../../visual/shapes';

type Str = string[];

export interface StrOp {
  id: string;
  desc: string;
  family: 'order' | 'length' | 'identity';
  apply(s: Str): Str | null;
}

const SYMBOLS = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'cross', 'hexagon'];

function symName(t: string, mode: 'letter' | 'symbol'): string {
  return mode === 'letter' ? t : shapeInfo(t as never).name;
}

function baseOps(mode: 'letter' | 'symbol', alphabet: string[]): StrOp[] {
  const ops: StrOp[] = [
    { id: 'reverse', desc: 'reverse the order', family: 'order', apply: (s) => s.slice().reverse() },
    { id: 'rotL', desc: 'move the first item to the end', family: 'order', apply: (s) => [...s.slice(1), s[0]] },
    { id: 'rotR', desc: 'move the last item to the front', family: 'order', apply: (s) => [s[s.length - 1], ...s.slice(0, -1)] },
    { id: 'swapEnds', desc: 'swap the first and last items', family: 'order', apply: (s) => (s.length < 2 ? null : [s[s.length - 1], ...s.slice(1, -1), s[0]]) },
    {
      id: 'swapPairs',
      desc: 'swap neighbouring items in pairs (1st↔2nd, 3rd↔4th, …)',
      family: 'order',
      apply: (s) => {
        const o = s.slice();
        for (let i = 0; i + 1 < o.length; i += 2) [o[i], o[i + 1]] = [o[i + 1], o[i]];
        return o;
      },
    },
    { id: 'dropFirst', desc: 'remove the first item', family: 'length', apply: (s) => (s.length < 3 ? null : s.slice(1)) },
    { id: 'dropLast', desc: 'remove the last item', family: 'length', apply: (s) => (s.length < 3 ? null : s.slice(0, -1)) },
    { id: 'dupFirst', desc: 'add a copy of the first item to the end', family: 'length', apply: (s) => (s.length > 7 ? null : [...s, s[0]]) },
    { id: 'dupLast', desc: 'repeat the last item at the front', family: 'length', apply: (s) => (s.length > 7 ? null : [s[s.length - 1], ...s]) },
  ];
  if (mode === 'letter') {
    for (const k of [1, 2, -1]) {
      ops.push({
        id: `shift${k}`,
        desc: `move every letter ${Math.abs(k)} place${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'back'} in the alphabet`,
        family: 'identity',
        apply: (s) => s.map((c) => LETTERS[mod(LETTERS.indexOf(c) + k, 26)]),
      });
    }
    ops.push({ id: 'sort', desc: 'sort the letters into alphabetical order', family: 'order', apply: (s) => s.slice().sort() });
  } else {
    for (const a of alphabet)
      for (const b of alphabet) {
        if (a === b) continue;
        ops.push({ id: `rep:${a}>${b}`, desc: `replace every ${symName(a, mode)} with a ${symName(b, mode)}`, family: 'identity', apply: (s) => s.map((x) => (x === a ? b : x)) });
        if (a < b)
          ops.push({
            id: `swap:${a}<>${b}`,
            desc: `swap ${symName(a, mode)}s and ${symName(b, mode)}s wherever they appear`,
            family: 'identity',
            apply: (s) => s.map((x) => (x === a ? b : x === b ? a : x)),
          });
      }
    for (const a of alphabet)
      ops.push({ id: `del:${a}`, desc: `delete every ${symName(a, mode)}`, family: 'length', apply: (s) => { const o = s.filter((x) => x !== a); return o.length === s.length || o.length < 2 ? null : o; } });
  }
  return ops;
}

export function composeOps(ops: StrOp[]): StrOp {
  return {
    id: ops.map((o) => o.id).join(' ∘ '),
    desc: ops.map((o, i) => (i === 0 ? o.desc : `then ${o.desc}`)).join(', '),
    family: ops[0].family,
    apply: (s) => {
      let cur: Str | null = s;
      for (const o of ops) {
        if (!cur) return null;
        cur = o.apply(cur);
      }
      return cur;
    },
  };
}

const key = (s: Str | null) => (s ? s.join(',') : '∅');

/**
 * All compositions of exactly `depth` ops consistent with the examples.
 * Level-wise enumeration on the first example keeps this cheap.
 */
export function consistentCompositions(lib: StrOp[], examples: { input: Str; output: Str }[], depth: number, cap = 4000): StrOp[][] {
  let frontier: { ops: StrOp[]; val: Str }[] = [{ ops: [], val: examples[0].input }];
  for (let d = 0; d < depth; d++) {
    const next: { ops: StrOp[]; val: Str }[] = [];
    for (const f of frontier)
      for (const op of lib) {
        if (f.ops.length && f.ops[f.ops.length - 1].id === op.id && op.family === 'order' && op.id !== 'rotL' && op.id !== 'rotR') continue;
        const v = op.apply(f.val);
        if (v) next.push({ ops: [...f.ops, op], val: v });
      }
    frontier = next;
  }
  const target = key(examples[0].output);
  const out: StrOp[][] = [];
  for (const f of frontier) {
    if (key(f.val) !== target) continue;
    const comp = composeOps(f.ops);
    if (examples.every((e) => key(comp.apply(e.input)) === key(e.output))) {
      out.push(f.ops);
      if (out.length >= cap) break;
    }
  }
  return out;
}

function tokens(s: Str, mode: 'letter' | 'symbol'): Visual {
  return { kind: 'tokens', tokens: s, style: mode };
}

function randomString(rng: Rng, alphabet: string[], len: number): Str {
  const out: Str = [];
  for (let i = 0; i < len; i++) out.push(rng.pick(alphabet));
  return out;
}

function singleOpHint(op: StrOp): string {
  if (op.id === 'reverse') return 'Read each output from right to left.';
  if (op.id === 'rotL' || op.id === 'rotR') return 'Watch where the first and last items of each input end up.';
  if (op.id === 'swapEnds') return 'Only the two ends of each string are affected.';
  if (op.id === 'swapPairs') return 'Look at the items two at a time.';
  if (op.id.startsWith('drop') || op.id.startsWith('del')) return 'Which item disappears each time?';
  if (op.id.startsWith('dup')) return 'Which item appears twice in each output?';
  if (op.id.startsWith('shift')) return 'Compare each letter with the letter in the same position of the output.';
  if (op.id === 'sort') return 'Look at the order of the letters in each output.';
  return 'Compare which symbols appear in each input and output.';
}

interface TransformHidden {
  mode: 'letter' | 'symbol';
  alphabet: string[];
  rule: string[];
  examples: { input: Str; output: Str }[];
  query: Str;
  [k: string]: unknown;
}

const CONFIG = {
  1: { depth: 1, len: [4, 4], examples: 3, maxExamples: 5, choices: 4 },
  2: { depth: 2, len: [4, 5], examples: 3, maxExamples: 5, choices: 4 },
  3: { depth: 2, len: [5, 5], examples: 3, maxExamples: 6, choices: 5 },
  4: { depth: 3, len: [5, 6], examples: 4, maxExamples: 6, choices: 6 },
} as const;

export const fluidTransform: GeneratorDef = {
  id: 'fluid.transform',
  category: 'fluid',
  version: 1,
  family: 'Transformation rules',
  description: 'Infer a hidden multi-step transformation of symbol or letter strings and apply it.',
  weight: 1.3,
  candidates: 5,
  generate({ rng, difficulty }) {
    const cfg = CONFIG[difficulty];
    const mode: 'letter' | 'symbol' = rng.chance(0.5) ? 'letter' : 'symbol';
    const alphabet = mode === 'letter' ? (() => { const start = rng.int(0, 18); return LETTERS.slice(start, start + rng.int(5, 7)).split(''); })() : rng.sample(SYMBOLS, difficulty <= 2 ? 4 : 5);
    const lib = baseOps(mode, alphabet);
    // the true rule: distinct families where possible so every step is visible
    const rule: StrOp[] = [];
    const families = rng.shuffle(['order', 'identity', 'length', 'order'] as const);
    for (let i = 0; i < cfg.depth; i++) {
      const fam = families[i % families.length];
      const pool = lib.filter((o) => o.family === fam && !rule.some((r) => r.id === o.id) && !(difficulty === 1 && o.id === 'sort'));
      rule.push(rng.pick(pool.length ? pool : lib));
    }
    const ruleOp = composeOps(rule);
    const len = rng.int(cfg.len[0], cfg.len[1]);
    const examples: { input: Str; output: Str }[] = [];
    const seen = new Set<string>();
    const addExample = () => {
      for (let t = 0; t < 20; t++) {
        const input = randomString(rng, alphabet, len + (examples.length % 2 === 1 && difficulty >= 3 ? 1 : 0));
        const output = ruleOp.apply(input);
        if (!output || key(output) === key(input) || seen.has(key(input))) continue;
        seen.add(key(input));
        examples.push({ input, output });
        return true;
      }
      return false;
    };
    for (let i = 0; i < cfg.examples; i++) if (!addExample()) reject('could not build examples');
    let query: Str | null = null;
    for (let t = 0; t < 20 && !query; t++) {
      const q = randomString(rng, alphabet, len);
      const out = ruleOp.apply(q);
      if (out && key(out) !== key(q) && !seen.has(key(q))) query = q;
    }
    if (!query) reject('no query');
    const answer = ruleOp.apply(query)!;

    // Occam check with extra examples when needed.
    let consistent: StrOp[][] = [];
    for (;;) {
      for (let d = 1; d < cfg.depth; d++) if (consistentCompositions(lib, examples, d, 1).length) reject('rule reducible to fewer steps');
      consistent = consistentCompositions(lib, examples, cfg.depth);
      const preds = new Set(consistent.map((ops) => key(composeOps(ops).apply(query!))));
      if (preds.size === 1 && preds.has(key(answer))) break;
      if (examples.length >= cfg.maxExamples || !addExample()) reject('ambiguous rule');
    }

    // Distractors: outputs of near-miss rules that the examples rule out.
    const distractors: { s: Str; why: string }[] = [];
    const seenOut = new Set([key(answer), key(query)]);
    const tryRule = (ops: StrOp[], why: (failText: string) => string) => {
      if (!ops.length) return;
      const comp = composeOps(ops);
      const out = comp.apply(query!);
      if (!out || seenOut.has(key(out))) return;
      const failing = examples.find((e) => key(comp.apply(e.input)) !== key(e.output));
      if (!failing) return;
      const got = comp.apply(failing.input);
      seenOut.add(key(out));
      const fmt = (s: Str) => s.map((t) => symName(t, mode)).join(mode === 'letter' ? '' : ' ');
      distractors.push({
        s: out,
        why: why(`that rule turns ${fmt(failing.input)} into ${got ? fmt(got) : 'nothing valid'}, not ${fmt(failing.output)}`),
      });
    };
    for (let i = 0; i < rule.length; i++) tryRule(rule.filter((_, j) => j !== i), (f) => `It skips the step "${rule[i].desc}" — ${f}.`);
    if (rule.length >= 2) tryRule(rule.slice().reverse(), (f) => `It applies the steps in the wrong order — ${f}.`);
    for (const alt of rng.shuffle(lib).slice(0, 40)) {
      if (distractors.length >= cfg.choices + 2) break;
      const idx = rng.int(0, rule.length - 1);
      const ops = rule.map((r, j) => (j === idx ? alt : r));
      tryRule(ops, (f) => `It uses "${alt.desc}" instead of "${rule[idx].desc}" — ${f}.`);
    }
    if (distractors.length < cfg.choices - 1) reject('not enough distractors');
    const chosen = distractors.slice(0, cfg.choices - 1);
    const built = buildChoices(
      { key: key(answer), visual: tokens(answer, mode) },
      chosen.map((d) => ({ key: key(d.s), visual: tokens(d.s, mode), reason: d.why })),
      rng,
    );

    const trace: string[] = [];
    let cur: Str = query;
    const fmt = (s: Str) => s.map((t) => symName(t, mode)).join(mode === 'letter' ? '' : ', ');
    trace.push(`Start with the new input: ${fmt(cur)}.`);
    for (const op of rule) {
      cur = op.apply(cur)!;
      trace.push(`${capitalize(op.desc)} → ${fmt(cur)}.`);
    }
    const famWords = { order: 'rearranges the order', identity: 'changes which items appear', length: 'changes the length' };

    return {
      title: 'Crack the transformation',
      prompt: `Each input is turned into its output by the same hidden rule. Find the simplest rule that fits every example, then apply it to the last input.`,
      display: {
        blocks: [
          { type: 'pairs', pairs: [...examples.map((e) => ({ input: tokens(e.input, mode), output: tokens(e.output, mode) })), { input: tokens(query, mode), output: null }] },
        ],
      },
      interaction: { type: 'choice', choices: built.choices, columns: 2 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        rule.some((r) => r.family === 'length')
          ? 'Compare the lengths of the inputs and outputs first.'
          : rule.some((r) => r.family === 'identity')
            ? 'Check whether the outputs contain exactly the same items as the inputs.'
            : 'Every output contains exactly the same items as its input — only positions change.',
        rule.length === 1 ? `The rule is a single step that ${famWords[rule[0].family]}.` : `The rule has ${rule.length} steps: ${listJoin(rule.map((r) => `one ${famWords[r.family]}`))}.`,
        rule.length === 1 ? singleOpHint(rule[0]) : `The first step is: ${rule[0].desc}.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${fmt(answer)}.`,
        answerVisual: tokens(answer, mode),
        rule: `${capitalize(ruleOp.desc)}.`,
        steps: [
          `The rule: ${ruleOp.desc}. It reproduces every example.`,
          ...trace,
          consistent.length > 1
            ? `Other step-for-step equivalent descriptions of the rule exist, but every rule of this size that fits the examples gives the same answer.`
            : 'No other rule of this size fits all of the examples.',
        ],
        alternatives: built.alternatives,
        skills: ['fluid reasoning', 'rule induction', 'hypothesis testing'],
      },
      metrics: { rules: rule.length, steps: rule.length + examples.length - 2, choices: built.choices.length },
      fingerprint: {
        structure: `transform|${mode}|${rule.map((r) => r.family).join('>')}`,
        features: [`mode:${mode}`, ...rule.map((r) => `op:${r.id.split(':')[0]}`)],
        detail: `${rule.map((r) => r.id).join('|')}|${key(query)}`,
      },
      hidden: { mode, alphabet, rule: rule.map((r) => r.id), examples, query } satisfies TransformHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as TransformHidden;
    const lib = baseOps(h.mode, h.alphabet);
    const ops = h.rule.map((id) => lib.find((o) => o.id === id)!);
    if (ops.some((o) => !o)) return ['unknown op'];
    const comp = composeOps(ops);
    if (h.examples.some((e) => key(comp.apply(e.input)) !== key(e.output))) return ['examples do not follow the rule'];
    const ans = comp.apply(h.query);
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const matches = p.interaction.choices.filter((c) => c.visual?.kind === 'tokens' && key(c.visual.tokens) === key(ans));
    if (matches.length !== 1 || matches[0].id !== p.answer.correct) return ['answer mismatch'];
    return [];
  },
};
