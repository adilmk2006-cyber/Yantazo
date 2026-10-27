/**
 * Rule induction from labelled examples (Bongard-style).
 *
 * Cards vary in shape, shading, size and count. A hidden boolean rule decides
 * which cards are accepted. Examples are chosen greedily until every rule in
 * the hypothesis library that fits them classifies the answer options exactly
 * like the true rule, so exactly one option is defensible.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Figure, Glyph, Puzzle, ShapeKind, Visual } from '../../types';
import { capitalize, reject } from '../../util';

interface Card {
  shape: number;
  shade: number;
  count: number;
  size: number;
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'star'];
const SHAPE_PLURAL = ['circles', 'squares', 'triangles', 'stars'];
const SHADES = [0, 2, 3];
const SHADE_WORD = ['outlined', 'striped', 'solid'];
const SIZE_WORD = ['small', 'large'];
type Feature = 'shape' | 'shading' | 'size' | 'count';

const UNIVERSE: Card[] = [];
for (let shape = 0; shape < 4; shape++)
  for (let shade = 0; shade < 3; shade++)
    for (let count = 1; count <= 4; count++) for (let size = 0; size < 2; size++) UNIVERSE.push({ shape, shade, count, size });

interface Lit {
  id: string;
  feature: Feature;
  /** verb phrase: "contains circles" */
  vp: string;
  test(c: Card): boolean;
  simple: boolean;
}

function literals(): Lit[] {
  const out: Lit[] = [];
  SHAPES.forEach((_, i) => {
    out.push({ id: `shape=${i}`, feature: 'shape', vp: `shows ${SHAPE_PLURAL[i]}`, test: (c) => c.shape === i, simple: true });
    out.push({ id: `shape!=${i}`, feature: 'shape', vp: `does not show ${SHAPE_PLURAL[i]}`, test: (c) => c.shape !== i, simple: false });
  });
  SHADE_WORD.forEach((w, i) => {
    out.push({ id: `shade=${i}`, feature: 'shading', vp: `has ${w} shapes`, test: (c) => c.shade === i, simple: true });
    out.push({ id: `shade!=${i}`, feature: 'shading', vp: `has shapes that are not ${w}`, test: (c) => c.shade !== i, simple: false });
  });
  SIZE_WORD.forEach((w, i) => out.push({ id: `size=${i}`, feature: 'size', vp: `has ${w} shapes`, test: (c) => c.size === i, simple: true }));
  for (let n = 1; n <= 4; n++) out.push({ id: `count=${n}`, feature: 'count', vp: `has exactly ${n} shape${n > 1 ? 's' : ''}`, test: (c) => c.count === n, simple: true });
  out.push({ id: 'even', feature: 'count', vp: 'has an even number of shapes', test: (c) => c.count % 2 === 0, simple: true });
  out.push({ id: 'odd', feature: 'count', vp: 'has an odd number of shapes', test: (c) => c.count % 2 === 1, simple: true });
  for (const k of [2, 3]) {
    out.push({ id: `count>=${k}`, feature: 'count', vp: `has at least ${k} shapes`, test: (c) => c.count >= k, simple: true });
    out.push({ id: `count<=${k}`, feature: 'count', vp: `has at most ${k} shapes`, test: (c) => c.count <= k, simple: true });
  }
  return out;
}

const LITS = literals();
type Op = 'and' | 'or' | 'xor';

interface Rule {
  id: string;
  lits: Lit[];
  op?: Op;
  text: string;
  test(c: Card): boolean;
}

function single(l: Lit): Rule {
  return { id: l.id, lits: [l], text: `it ${l.vp}`, test: l.test };
}

function pair(a: Lit, b: Lit, op: Op): Rule {
  const text = op === 'and' ? `it ${a.vp} and ${b.vp}` : op === 'or' ? `it ${a.vp} or ${b.vp} (or both)` : `it ${a.vp} or ${b.vp}, but not both`;
  const test = op === 'and' ? (c: Card) => a.test(c) && b.test(c) : op === 'or' ? (c: Card) => a.test(c) || b.test(c) : (c: Card) => a.test(c) !== b.test(c);
  return { id: `${a.id} ${op} ${b.id}`, lits: [a, b], op, text, test };
}

let PAIR_CACHE: Rule[] | null = null;
function hypotheses(includePairs: boolean): Rule[] {
  const singles = LITS.map(single);
  if (!includePairs) return singles;
  if (!PAIR_CACHE) {
    PAIR_CACHE = [];
    for (let i = 0; i < LITS.length; i++)
      for (let j = i + 1; j < LITS.length; j++)
        for (const op of ['and', 'or', 'xor'] as Op[]) PAIR_CACHE.push(pair(LITS[i], LITS[j], op));
  }
  return [...singles, ...PAIR_CACHE];
}

const CARD_POS: [number, number][][] = [
  [],
  [[50, 50]],
  [[33, 50], [67, 50]],
  [[50, 31], [31, 67], [69, 67]],
  [[32, 32], [68, 32], [32, 68], [68, 68]],
];

export function cardFigure(c: Card): Figure {
  return {
    glyphs: CARD_POS[c.count].map(([x, y]): Glyph => ({ shape: SHAPES[c.shape], x, y, r: c.size ? 15 : 9, rot: 0, shade: SHADES[c.shade] })),
  };
}

export function describeCard(c: Card): string {
  return `${c.count} ${SIZE_WORD[c.size]} ${SHADE_WORD[c.shade]} ${c.count === 1 ? SHAPE_PLURAL[c.shape].slice(0, -1) : SHAPE_PLURAL[c.shape]}`;
}

const cardKey = (c: Card) => `${c.shape}${c.shade}${c.count}${c.size}`;
const vis = (c: Card): Visual => ({ kind: 'figure', figure: cardFigure(c) });

interface ClassifyHidden {
  rule: string;
  examples: { card: Card; accepted: boolean }[];
  question: 'accepted' | 'rejected';
  options: Card[];
  [k: string]: unknown;
}

function ruleById(id: string): Rule | undefined {
  return hypotheses(true).find((h) => h.id === id);
}

function verdictWords(r: Rule, c: Card): string {
  return r.lits.map((l) => `${l.test(c) ? 'it does' : 'it does not'} satisfy "${l.vp}"`).join(' and ');
}

export const fluidClassify: GeneratorDef = {
  id: 'fluid.classify',
  category: 'fluid',
  version: 1,
  family: 'Rule induction',
  description: 'Work out which hidden rule sorts cards into accepted and rejected, then apply it.',
  weight: 1.1,
  candidates: 5,
  generate({ rng, difficulty }) {
    let rule: Rule;
    if (difficulty === 1) rule = single(rng.pick(LITS.filter((l) => l.simple && !l.id.startsWith('count=') && l.id !== 'even' && l.id !== 'odd')));
    else {
      const op: Op = difficulty === 2 ? 'and' : difficulty === 3 ? rng.pick<Op>(['or', 'and']) : rng.pick<Op>(['xor', 'or']);
      const a = rng.pick(LITS.filter((l) => l.simple));
      const b = rng.pick(LITS.filter((l) => l.feature !== a.feature && (difficulty >= 3 || l.simple)));
      // canonical order so the id matches the hypothesis library
      rule = LITS.indexOf(a) < LITS.indexOf(b) ? pair(a, b, op) : pair(b, a, op);
    }
    const accepted = UNIVERSE.filter(rule.test);
    const ratio = accepted.length / UNIVERSE.length;
    if (ratio < 0.12 || ratio > 0.75) reject('rule too lopsided');

    const question: 'accepted' | 'rejected' = difficulty >= 2 && rng.chance(0.3) ? 'rejected' : 'accepted';
    const nOptions = difficulty <= 2 ? 4 : 5;
    const winners = UNIVERSE.filter((c) => rule.test(c) === (question === 'accepted'));
    const losers = UNIVERSE.filter((c) => rule.test(c) !== (question === 'accepted'));
    const options = [rng.pick(winners), ...rng.sample(losers, nOptions - 1)];
    const optionKeys = new Set(options.map(cardKey));

    const H = hypotheses(difficulty >= 2).filter((h) => h.id !== rule.id);
    const examples: { card: Card; accepted: boolean }[] = [];
    const usedKeys = new Set(optionKeys);
    const pool = UNIVERSE.filter((c) => !optionKeys.has(cardKey(c)));
    // seed with two accepted and two rejected examples
    for (const c of [...rng.sample(pool.filter(rule.test), 2), ...rng.sample(pool.filter((c) => !rule.test(c)), 2)]) {
      usedKeys.add(cardKey(c));
      examples.push({ card: c, accepted: rule.test(c) });
    }
    const disagrees = (h: Rule) => options.some((o) => h.test(o) !== rule.test(o));
    const consistent = (h: Rule) => examples.every((e) => h.test(e.card) === e.accepted);
    let bad = H.filter((h) => consistent(h) && disagrees(h));
    const maxExamples = difficulty === 1 ? 8 : difficulty === 2 ? 10 : 12;
    while (bad.length && examples.length < maxExamples) {
      let best: Card | null = null;
      let bestScore = -1;
      for (const c of rng.shuffle(pool)) {
        if (usedKeys.has(cardKey(c))) continue;
        const score = bad.filter((h) => h.test(c) !== rule.test(c)).length;
        if (score > bestScore) {
          best = c;
          bestScore = score;
        }
      }
      if (!best || bestScore <= 0) break;
      usedKeys.add(cardKey(best));
      examples.push({ card: best, accepted: rule.test(best) });
      bad = bad.filter((h) => h.test(best!) === rule.test(best!));
    }
    if (bad.length) reject('examples cannot pin down the rule');
    const nAcc = examples.filter((e) => e.accepted).length;
    if (nAcc < 2 || examples.length - nAcc < 2) reject('unbalanced examples');
    const shown = rng.shuffle(examples);

    // A tempting simpler rule that the examples refute (for the explanation).
    const tempting = LITS.map(single)
      .filter((h) => h.id !== rule.id)
      .map((h) => ({ h, wrong: shown.filter((e) => h.test(e.card) !== e.accepted) }))
      .filter((x) => x.wrong.length > 0)
      .sort((a, b) => a.wrong.length - b.wrong.length)[0];

    const answerCard = options[0];
    const built = buildChoices(
      { key: cardKey(answerCard), visual: vis(answerCard) },
      options.slice(1).map((c) => ({
        key: cardKey(c),
        visual: vis(c),
        reason: `${capitalize(describeCard(c))}: ${verdictWords(rule, c)}, so it is ${rule.test(c) ? 'accepted' : 'rejected'}.`,
      })),
      rng,
    );
    const features = [...new Set(rule.lits.map((l) => l.feature))];
    const featureWord: Record<Feature, string> = { shape: 'the kind of shape', shading: 'the shading', size: 'the size', count: 'how many shapes there are' };
    const exampleIndex = (e: { card: Card }) => shown.indexOf(e as (typeof shown)[number]) + 1;

    return {
      title: 'Find the sorting rule',
      prompt: `A hidden rule sorts cards into ACCEPTED and REJECTED. Study the examples, then decide which new card would be ${question.toUpperCase()}.`,
      display: {
        blocks: [
          {
            type: 'gallery',
            size: 'sm',
            items: shown.map((e, i) => ({ visual: vis(e.card), caption: `#${i + 1}`, tag: e.accepted ? ('accepted' as const) : ('rejected' as const) })),
          },
          { type: 'text', text: `Exactly one of the options below would be ${question}.`, tone: 'note' },
        ],
      },
      interaction: { type: 'choice', choices: built.choices, columns: nOptions === 5 ? 5 : 4 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        'List what every accepted card has in common, then check whether any rejected card also has it.',
        features.length === 1 ? `Only one property matters: ${featureWord[features[0]]}.` : `Two properties matter: ${featureWord[features[0]]} and ${featureWord[features[1]]}.`,
        rule.lits.length === 1 ? `Accepted cards are exactly those where something specific is true about ${featureWord[features[0]]}.` : `One part of the rule: a card ${rule.lits[0].vp}. Work out how the second part combines with it.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${describeCard(answerCard)}.`,
        answerVisual: vis(answerCard),
        rule: `A card is accepted when ${rule.text}.`,
        steps: [
          `Every accepted example satisfies "${rule.text}", and every rejected example does not.`,
          ...(tempting
            ? [`A tempting simpler rule — "${tempting.h.text}" — fails on example #${exampleIndex(tempting.wrong[0])} (${describeCard(tempting.wrong[0].card)}), which is ${tempting.wrong[0].accepted ? 'accepted' : 'rejected'}.`]
            : []),
          `Option ${built.correctLabel} (${describeCard(answerCard)}): ${verdictWords(rule, answerCard)}, so it is ${question}.`,
          `The examples were chosen so that every rule in the library that fits them sorts the options the same way.`,
        ],
        alternatives: built.alternatives,
        skills: ['rule induction', 'fluid reasoning', 'hypothesis testing'],
      },
      metrics: { rules: rule.lits.length, steps: rule.lits.length + (rule.op === 'xor' ? 2 : rule.op ? 1 : 0), choices: nOptions },
      fingerprint: {
        structure: `classify|${rule.op ?? 'single'}|${features.sort().join('+')}|${question}`,
        features: [`op:${rule.op ?? 'single'}`, ...features.map((f) => `feature:${f}`), `ask:${question}`],
        detail: `${rule.id}|${shown.map((e) => cardKey(e.card)).join(',')}`,
      },
      hidden: { rule: rule.id, examples: shown, question, options } satisfies ClassifyHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as ClassifyHidden;
    const rule = ruleById(h.rule);
    if (!rule) return ['unknown rule'];
    if (h.examples.some((e) => rule.test(e.card) !== e.accepted)) return ['example labels inconsistent'];
    const winners = h.options.filter((c) => rule.test(c) === (h.question === 'accepted'));
    if (winners.length !== 1) return [`expected one ${h.question} option, found ${winners.length}`];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const key = JSON.stringify(cardFigure(winners[0]));
    const match = p.interaction.choices.find((c) => c.visual?.kind === 'figure' && JSON.stringify(c.visual.figure) === key);
    if (!match || match.id !== p.answer.correct) return ['answer mismatch'];
    // every hypothesis consistent with the examples must agree on all options
    const H = hypotheses(true);
    for (const hyp of H) {
      if (h.examples.every((e) => hyp.test(e.card) === e.accepted) && h.options.some((o) => hyp.test(o) !== rule.test(o)) && (p.difficulty >= 2 || hyp.lits.length === 1))
        return [`rival rule "${hyp.text}" fits the examples but sorts the options differently`];
    }
    return [];
  },
};

