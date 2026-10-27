import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Difficulty, Figure, Puzzle, Visual } from '../../types';
import type { AttrName, LayoutId, PanelCtx, SeqRule, SeqRuleKind, Values } from '../../visual/attributes';
import {
  attrDef,
  balancedCombos,
  buildSeqRule,
  describeSeqRule,
  inferSequenceValue,
  relevantAttrs,
  renderPanel,
  ruleHintPhrase,
  seqAlternatives,
  seqRuleKinds,
} from '../../visual/attributes';
import { figureKey } from '../../visual/shapes';
import { capitalize, listJoin, ordinal, range, reject } from '../../util';
import { choiceCountFor, describeDeviation, describePanel, makePanelCtx } from './panel';

const CONFIG: Record<Difficulty, { layouts: LayoutId[]; length: number; vary: [number, number]; kinds: SeqRuleKind[]; middle: boolean }> = {
  1: { layouts: ['single', 'orbit', 'count'], length: 5, vary: [1, 1], kinds: ['progression', 'alternate', 'march'], middle: false },
  2: { layouts: ['single', 'orbit', 'count', 'grid'], length: 6, vary: [2, 2], kinds: ['progression', 'alternate', 'cycle3', 'march'], middle: false },
  3: { layouts: ['single', 'orbit', 'count', 'grid'], length: 6, vary: [2, 3], kinds: ['progression', 'alternate', 'cycle3', 'march'], middle: true },
  4: { layouts: ['single', 'orbit', 'grid', 'count'], length: 7, vary: [3, 3], kinds: ['progression', 'alternate', 'cycle3', 'march'], middle: true },
};

interface SeqHidden {
  ctx: PanelCtx;
  rules: SeqRule[];
  missing: number;
  [k: string]: unknown;
}

function valuesAt(rules: SeqRule[], i: number): Values {
  const v: Values = {};
  for (const r of rules) v[r.attr] = r.values[i];
  return v;
}

const fig = (f: Figure): Visual => ({ kind: 'figure', figure: f });

export const visualSequence: GeneratorDef = {
  id: 'visual.sequence',
  category: 'visual',
  version: 1,
  family: 'Visual sequences',
  description: 'Panel sequences where several properties evolve by their own rules.',
  weight: 1.2,
  candidates: 8,
  generate({ rng, difficulty }) {
    const cfg = CONFIG[difficulty];
    const layout = rng.pick(cfg.layouts);
    const ctx = makePanelCtx(layout, rng, { orientable: layout === 'single' ? rng.chance(0.6) : false, sides: layout === 'single' && rng.chance(0.2) });
    const attrs = relevantAttrs(ctx);
    const length = cfg.length;
    const missing = cfg.middle && rng.chance(0.5) ? rng.int(2, length - 2) : length - 1;
    const nVary = Math.min(attrs.length, rng.int(cfg.vary[0], cfg.vary[1]));
    const lead: AttrName | null = layout === 'count' ? 'count' : layout === 'grid' ? 'mask' : layout === 'orbit' ? 'orbit' : null;
    const varying: AttrName[] = lead ? [lead] : [];
    for (const a of rng.shuffle(attrs)) if (varying.length < nVary && !varying.includes(a)) varying.push(a);

    const rules: SeqRule[] = [];
    for (const attr of attrs) {
      const def = attrDef(attr, ctx);
      let rule: SeqRule | null = null;
      if (varying.includes(attr)) {
        const kinds = seqRuleKinds(def).filter((k) => cfg.kinds.includes(k));
        if (!kinds.length) reject(`no kinds for ${attr}`);
        for (let t = 0; t < 10 && !rule; t++) rule = buildSeqRule(rng.pick(kinds), def, rng, length);
      } else rule = buildSeqRule('constant', def, rng, length);
      if (!rule) reject(`cannot build ${attr}`);
      rules.push(rule);
    }
    const varyingRules = rules.filter((r) => varying.includes(r.attr));
    if (difficulty >= 2 && new Set(varyingRules.map((r) => r.kind)).size < 2 && varyingRules.length > 1 && rng.chance(0.5)) reject('prefer mixed rule kinds');

    for (const r of rules) {
      const shown = r.values.map((v, i) => (i === missing ? null : v));
      const preds = inferSequenceValue(shown, missing, attrDef(r.attr, ctx));
      if (preds.size !== 1 || !preds.has(r.values[missing])) reject(`ambiguous ${r.attr}`);
    }

    const panels = range(length).map((i) => renderPanel(valuesAt(rules, i), ctx));
    const keys = panels.map(figureKey);
    // consecutive panels must visibly differ so the sequence reads as motion
    for (let i = 1; i < length; i++) if (keys[i] === keys[i - 1]) reject('static step');

    const correct = valuesAt(rules, missing);
    const spec = choiceCountFor(difficulty);
    const order = [...rng.shuffle(varyingRules), ...rng.shuffle(rules.filter((r) => !varying.includes(r.attr)))];
    const perturb: { attr: AttrName; alts: number[] }[] = [];
    const used = new Set<AttrName>();
    for (const need of spec) {
      const r = order.find((x) => !used.has(x.attr) && seqAlternatives(x, missing, attrDef(x.attr, ctx), rng.fork(x.attr)).length >= need);
      if (!r) reject('not enough alternatives');
      used.add(r.attr);
      const alts = seqAlternatives(r, missing, attrDef(r.attr, ctx), rng.fork(r.attr));
      perturb.push({ attr: r.attr, alts: rng.sample(alts.slice(0, need + 1), need) });
    }
    const combos = balancedCombos(correct, perturb);
    const comboKeys = new Set(combos.map((c) => figureKey(renderPanel(c.values, ctx))));
    if (comboKeys.size !== combos.length) reject('indistinct options');

    const correctFig = renderPanel(correct, ctx);
    const ruleOf = (a: AttrName) => rules.find((r) => r.attr === a)!;
    const built = buildChoices(
      { key: figureKey(correctFig), visual: fig(correctFig) },
      combos
        .filter((c) => c.wrong.length)
        .map((c) => ({
          key: figureKey(renderPanel(c.values, ctx)),
          visual: fig(renderPanel(c.values, ctx)),
          reason:
            capitalize(
              c.wrong
                .map((a) => `${describeDeviation(a, c.values[a]!, correct[a]!, ctx)}${ruleOf(a).kind === 'constant' ? ' (it never changes)' : ''}`)
                .join('; also '),
            ) + '.',
        })),
      rng,
    );

    const labels = varyingRules.map((r) => attrDef(r.attr, ctx).label);
    const constants = rules.filter((r) => !varying.includes(r.attr));
    const where = missing === length - 1 ? 'next panel' : `missing ${ordinal(missing + 1)} panel`;
    const steps = varyingRules.map((r) => {
      const def = attrDef(r.attr, ctx);
      return `${capitalize(def.label)}: ${describeSeqRule(r, def)} So the ${where} has ${def.label} ${def.describe(r.values[missing])}.`;
    });
    if (constants.length)
      steps.push(`Unchanged throughout: ${listJoin(constants.map((r) => { const d = attrDef(r.attr, ctx); return `${d.label} (${d.describe(r.values[0])})`; }))}.`);
    const answerText = describePanel(correct, ctx);
    steps.push(`Together: ${answerText} — option ${built.correctLabel}.`);

    const neighbour = missing > 0 ? missing - 1 : missing + 1;
    const lastRule = varyingRules[0];
    const lastDef = attrDef(lastRule.attr, ctx);

    return {
      title: missing === length - 1 ? 'What comes next?' : 'Fill the gap',
      prompt: missing === length - 1 ? 'The panels change step by step. Which option comes next?' : 'The panels change step by step. Which option belongs in the gap?',
      display: { blocks: [{ type: 'sequence', items: panels.map((p, i) => (i === missing ? null : fig(p))) }] },
      interaction: { type: 'choice', choices: built.choices, columns: 4 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        `${labels.length === 1 ? `Only the ${labels[0]} changes.` : `Track ${listJoin(labels)} separately — each has its own rule.`}`,
        `${capitalize(varyingRules.map((r) => ruleHintPhrase(r.kind, attrDef(r.attr, ctx).label)).join('; '))}.`,
        `Next to the gap, panel ${neighbour + 1} has ${lastDef.label} ${lastDef.describe(lastRule.values[neighbour])}. Apply the ${lastDef.label} rule one step${missing > neighbour ? ' forward' : ' backward'} from there, then do the same for the other properties.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${answerText}.`,
        answerVisual: fig(correctFig),
        rule: varyingRules.map((r) => describeSeqRule(r, attrDef(r.attr, ctx))).join(' '),
        steps,
        alternatives: built.alternatives,
        skills: ['pattern recognition', 'rule induction', 'abstract reasoning'],
      },
      metrics: { rules: varyingRules.length, steps: varyingRules.length + (missing === length - 1 ? 0 : 1), choices: built.choices.length },
      fingerprint: {
        structure: `seq|${layout}|${varyingRules.map((r) => `${r.attr}:${r.kind}`).sort().join('+')}|${missing === length - 1 ? 'end' : 'mid'}`,
        features: [`layout:${layout}`, ...varyingRules.map((r) => `rule:${r.kind}`), ...varyingRules.map((r) => `attr:${r.attr}`)],
        detail: `${ctx.shapes.join(',')}|${rules.map((r) => r.values.join(',')).join('|')}|${missing}`,
      },
      hidden: { ctx, rules, missing } satisfies SeqHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as SeqHidden;
    const problems: string[] = [];
    for (const r of h.rules) {
      const shown = r.values.map((v, i) => (i === h.missing ? null : v));
      const preds = inferSequenceValue(shown, h.missing, attrDef(r.attr, h.ctx));
      if (preds.size !== 1 || !preds.has(r.values[h.missing])) problems.push(`${r.attr} ambiguous`);
    }
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return [...problems, 'wrong interaction'];
    const key = figureKey(renderPanel(valuesAt(h.rules, h.missing), h.ctx));
    const matches = p.interaction.choices.filter((c) => c.visual?.kind === 'figure' && figureKey(c.visual.figure) === key);
    if (matches.length !== 1 || matches[0].id !== p.answer.correct) problems.push('recomputed panel does not match exactly one option');
    return problems;
  },
};
