/**
 * Propositional deduction: a chain of modus ponens / modus tollens /
 * disjunctive-syllogism steps leads from a stated fact to the one conclusion
 * that must be true. A truth table over every variable confirms the correct
 * option is entailed and gives a concrete counter-example for each distractor
 * (affirming the consequent, denying the antecedent, …).
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import { capitalize, range, reject } from '../../util';

interface Prop {
  id: string;
  pos: string;
  neg: string;
}

const PROPS: Prop[] = [
  { id: 'alarm', pos: 'the alarm is ringing', neg: 'the alarm is silent' },
  { id: 'guard', pos: 'the guard is awake', neg: 'the guard is asleep' },
  { id: 'door', pos: 'the east door is open', neg: 'the east door is shut' },
  { id: 'lights', pos: 'the lights are on', neg: 'the lights are off' },
  { id: 'dog', pos: 'the dog is barking', neg: 'the dog is quiet' },
  { id: 'rain', pos: 'it is raining', neg: 'it is dry' },
  { id: 'safe', pos: 'the safe is locked', neg: 'the safe is unlocked' },
  { id: 'camera', pos: 'the camera is recording', neg: 'the camera is off' },
  { id: 'gate', pos: 'the gate is raised', neg: 'the gate is lowered' },
  { id: 'radio', pos: 'the radio is on', neg: 'the radio is off' },
];

/** literal = variable index + polarity */
interface Lit {
  v: number;
  pos: boolean;
}

type Premise = { kind: 'fact'; a: Lit } | { kind: 'if'; a: Lit; b: Lit; phrasing: 'if' | 'onlyif' | 'unless' } | { kind: 'or'; a: Lit; b: Lit };

const neg = (l: Lit): Lit => ({ v: l.v, pos: !l.pos });
const litTrue = (l: Lit, m: boolean[]) => m[l.v] === l.pos;

function premiseTrue(p: Premise, m: boolean[]): boolean {
  switch (p.kind) {
    case 'fact':
      return litTrue(p.a, m);
    case 'if':
      return !litTrue(p.a, m) || litTrue(p.b, m);
    case 'or':
      return litTrue(p.a, m) || litTrue(p.b, m);
  }
}

function models(premises: Premise[], nVars: number): boolean[][] {
  const out: boolean[][] = [];
  for (let mask = 0; mask < 1 << nVars; mask++) {
    const m = range(nVars).map((i) => !!((mask >> i) & 1));
    if (premises.every((p) => premiseTrue(p, m))) out.push(m);
  }
  return out;
}

interface ImplHidden {
  props: string[];
  premises: Premise[];
  options: Lit[];
  answerIndex: number;
  [k: string]: unknown;
}

export const logicImplication: GeneratorDef = {
  id: 'logic.implication',
  category: 'logic',
  version: 1,
  family: 'Logical implication',
  description: 'Chains of if/then, either/or and only-if statements — which conclusion must follow?',
  weight: 0.9,
  candidates: 5,
  generate({ rng, difficulty }) {
    const props = rng.sample(PROPS, difficulty === 4 ? 7 : 6);
    const words = (l: Lit) => (l.pos ? props[l.v].pos : props[l.v].neg);
    const steps = difficulty === 1 ? 1 : difficulty === 2 ? 2 : difficulty === 3 ? 3 : rng.int(3, 4);
    if (steps + 2 > props.length) reject('not enough variables');
    const premises: Premise[] = [];
    const derivation: string[] = [];
    const order = range(props.length);
    let cur: Lit = { v: order[0], pos: rng.chance(0.5) };
    premises.push({ kind: 'fact', a: cur });
    const derived: Lit[] = [cur];
    const ruleKinds: string[] = [];
    for (let i = 1; i <= steps; i++) {
      const next: Lit = { v: order[i], pos: rng.chance(0.5) };
      const kind = rng.pick(difficulty === 1 ? ['mp', 'mp', 'mt'] : ['mp', 'mt', 'ds']);
      ruleKinds.push(kind);
      if (kind === 'mp') {
        const phrasing = difficulty >= 3 && rng.chance(0.35) ? 'onlyif' : difficulty === 4 && rng.chance(0.3) ? 'unless' : 'if';
        premises.push({ kind: 'if', a: cur, b: next, phrasing });
        derivation.push(`${capitalize(words(cur))}, and if ${words(cur)} then ${words(next)} — so ${words(next)} (modus ponens).`);
        cur = next;
      } else if (kind === 'mt') {
        // if (not next) then (not cur); cur is true, so "not next" is false → next
        premises.push({ kind: 'if', a: neg(next), b: neg(cur), phrasing: 'if' });
        derivation.push(`If ${words(neg(next))}, then ${words(neg(cur))}. But ${words(cur)}, so it cannot be that ${words(neg(next))}: ${words(next)} (modus tollens).`);
        cur = next;
      } else {
        // either (not cur) or next → next
        premises.push({ kind: 'or', a: neg(cur), b: next });
        derivation.push(`Either ${words(neg(cur))} or ${words(next)}. Since ${words(cur)}, the first option is ruled out, so ${words(next)} (disjunctive syllogism).`);
        cur = next;
      }
      derived.push(cur);
    }
    const answer = cur;
    // Fallacy bait premises with unused variables.
    const spare = order.slice(steps + 1);
    if (spare.length < 2) reject('no spare variables');
    const z: Lit = { v: spare[0], pos: rng.chance(0.5) };
    const w: Lit = { v: spare[1], pos: rng.chance(0.5) };
    const someDerived = rng.pick(derived.slice(1));
    premises.push({ kind: 'if', a: z, b: someDerived, phrasing: 'if' }); // affirming the consequent bait: z
    const falseLit = neg(rng.pick(derived));
    premises.push({ kind: 'if', a: falseLit, b: w, phrasing: 'if' }); // denying the antecedent bait: not w
    const nVars = props.length;
    const ms = models(premises, nVars);
    if (ms.length === 0) reject('premises inconsistent');
    const entailed = (l: Lit) => ms.every((m) => litTrue(l, m));
    if (!entailed(answer)) reject('answer not entailed');

    const candidates: { lit: Lit; why: string }[] = [
      { lit: z, why: `affirming the consequent: knowing that ${words(someDerived)} does not tell us whether ${words(z)}` },
      { lit: neg(w), why: `denying the antecedent: "if ${words(falseLit)} then ${words(w)}" says nothing about what happens when ${words(neg(falseLit))}` },
      { lit: neg(answer), why: 'it contradicts what the premises force' },
      { lit: { v: spare[0], pos: !z.pos }, why: `nothing in the premises settles whether ${words({ v: spare[0], pos: !z.pos })}` },
      { lit: w, why: `nothing forces ${words(w)}; the only premise about it applies when ${words(falseLit)}, which is not the case` },
    ];
    const nOpts = difficulty <= 2 ? 4 : 5;
    const distractors: { lit: Lit; why: string }[] = [];
    const seen = new Set([`${answer.v}${answer.pos}`]);
    for (const c of candidates) {
      if (distractors.length >= nOpts - 1) break;
      const k = `${c.lit.v}${c.lit.pos}`;
      if (seen.has(k) || entailed(c.lit)) continue;
      seen.add(k);
      distractors.push(c);
    }
    if (distractors.length < nOpts - 1) reject('not enough distractors');

    const counter = (l: Lit) => {
      const m = ms.find((mm) => !litTrue(l, mm))!;
      const free = range(nVars).filter((v) => ms.some((mm) => mm[v] !== ms[0][v]));
      const shown = [...new Set([l.v, ...free])];
      return shown.map((v) => words({ v, pos: m[v] })).join(', ');
    };
    const built = buildChoices(
      { key: words(answer), text: capitalize(words(answer)) + '.' },
      distractors.map((d) => ({
        key: words(d.lit),
        text: capitalize(words(d.lit)) + '.',
        reason: entailed(neg(d.lit))
          ? 'Impossible — the chain of premises forces the opposite, so this statement must be false.'
          : `Not guaranteed — ${d.why}. Every premise still holds in a situation where ${counter(d.lit)}.`,
      })),
      rng,
    );
    const shuffled = rng.shuffle(premises);
    const premiseText = (p: Premise) => {
      if (p.kind === 'fact') return `${capitalize(words(p.a))}.`;
      if (p.kind === 'or') return `Either ${words(p.a)} or ${words(p.b)} (or both).`;
      if (p.phrasing === 'onlyif') return `${capitalize(words(p.a))} only if ${words(p.b)}.`;
      if (p.phrasing === 'unless') return `${capitalize(words(p.b))} unless ${words(neg(p.a))}.`;
      return `If ${words(p.a)}, then ${words(p.b)}.`;
    };
    const factIdx = shuffled.findIndex((p) => p.kind === 'fact') + 1;
    const usesOnlyIf = premises.some((p) => p.kind === 'if' && p.phrasing !== 'if');

    return {
      title: 'What must be true?',
      prompt: 'Assume every statement below is true. Which conclusion must also be true?',
      display: { blocks: [{ type: 'list', ordered: true, title: 'Premises', items: shuffled.map(premiseText) }] },
      interaction: { type: 'choice', choices: built.choices },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        `Start from the only plain fact (premise ${factIdx}) and look for a premise it triggers.`,
        `From "if A then B" and A you may conclude B; from "if A then B" and not-B you may conclude not-A. You may NOT conclude A from B.${usesOnlyIf ? ' "A only if B" means "if A then B"; "B unless A" means "if not A then B".' : ''}`,
        steps > 1
          ? `The chain takes ${steps} steps. The first step gives: ${words(derived[1])}.`
          : `Only one premise can be combined with the fact "${words(derived[0])}". Watch for the word "not" hidden in phrases like "${props[derived[0].v].neg}".`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${words(answer)}.`,
        rule: `Following the chain of premises from the stated fact leads to "${words(answer)}"; a full truth table confirms it holds in every situation consistent with the premises.`,
        steps: [`Fact: ${words(derived[0])}.`, ...derivation, `The two remaining premises are traps: they cannot be applied in the direction the tempting options assume.`],
        alternatives: built.alternatives,
        skills: ['deduction', 'verbal reasoning', 'hypothesis testing'],
      },
      metrics: { rules: premises.length, steps, choices: nOpts },
      fingerprint: {
        structure: `impl|${ruleKinds.join('>')}`,
        features: [...new Set(ruleKinds.map((k) => `step:${k}`)), usesOnlyIf ? 'phrasing:conditional-variants' : 'phrasing:plain'],
        detail: `${props.map((p) => p.id).join(',')}|${shuffled.map(premiseText).join('|')}`,
      },
      hidden: { props: props.map((p) => p.id), premises, options: [answer, ...distractors.map((d) => d.lit)], answerIndex: 0 } satisfies ImplHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as ImplHidden;
    const ms = models(h.premises, h.props.length);
    if (!ms.length) return ['inconsistent premises'];
    const entailed = h.options.map((l) => ms.every((m) => litTrue(l, m)));
    if (entailed.filter(Boolean).length !== 1 || !entailed[h.answerIndex]) return ['exactly one option must be entailed'];
    return [];
  },
};
