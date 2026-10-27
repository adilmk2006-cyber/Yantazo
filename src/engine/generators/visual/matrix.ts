import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Difficulty, Figure, Puzzle, Visual } from '../../types';
import type { AttrName, LayoutId, MatrixRule, MatrixRuleKind, PanelCtx, Values } from '../../visual/attributes';
import {
  attrDef,
  balancedCombos,
  buildMatrixRule,
  describeMatrixRule,
  inferMatrixCell,
  matrixAlternatives,
  matrixRuleKinds,
  relevantAttrs,
  renderPanel,
  ruleHintPhrase,
} from '../../visual/attributes';
import { figureKey } from '../../visual/shapes';
import { capitalize, listJoin, range, reject } from '../../util';
import { choiceCountFor, describeDeviation, describePanel, makePanelCtx } from './panel';

const ALL_KINDS: MatrixRuleKind[] = ['row-constant', 'progression', 'col-progression', 'distribute', 'arith-add', 'arith-sub', 'xor', 'or', 'and'];

const CONFIG: Record<Difficulty, { layouts: LayoutId[]; vary: [number, number]; kinds: MatrixRuleKind[] }> = {
  1: { layouts: ['single', 'count', 'nested'], vary: [1, 1], kinds: ['progression', 'row-constant', 'distribute'] },
  2: {
    layouts: ['single', 'count', 'grid', 'nested'],
    vary: [2, 2],
    kinds: ['progression', 'col-progression', 'row-constant', 'distribute', 'arith-add', 'xor', 'or'],
  },
  3: { layouts: ['single', 'count', 'grid', 'nested'], vary: [2, 3], kinds: ALL_KINDS },
  4: { layouts: ['single', 'count', 'grid', 'nested'], vary: [3, 4], kinds: ALL_KINDS },
};

const COMPLEX: MatrixRuleKind[] = ['distribute', 'arith-add', 'arith-sub', 'xor', 'or', 'and', 'col-progression'];

interface MatrixHidden {
  ctx: PanelCtx;
  rules: MatrixRule[];
  [key: string]: unknown;
}

function cellValues(rules: MatrixRule[], i: number): Values {
  const v: Values = {};
  for (const r of rules) v[r.attr] = r.values[i];
  return v;
}

function fig(f: Figure): Visual {
  return { kind: 'figure', figure: f };
}

function bottomRowHint(rule: MatrixRule, ctx: PanelCtx): string {
  const def = attrDef(rule.attr, ctx);
  const a = def.describe(rule.values[6]);
  const b = def.describe(rule.values[7]);
  switch (rule.kind) {
    case 'progression':
      return `In the bottom row the ${def.label} goes ${a}, then ${b} — take one more step of the same size.`;
    case 'col-progression':
      return `In the right-hand column the ${def.label} goes ${def.describe(rule.values[2])}, then ${def.describe(rule.values[5])} — take one more step down.`;
    case 'distribute':
      return `The bottom row already uses ${a} and ${b} for the ${def.label}; the rows above show which value is still missing.`;
    case 'row-constant':
      return `The bottom row starts with ${a} for the ${def.label}; check whether the ${def.label} ever changes within a row.`;
    case 'arith-add':
    case 'arith-sub':
      return `Bottom row: the first two panels have ${a} and ${b}. Combine them exactly as the upper rows do.`;
    case 'xor':
    case 'or':
    case 'and':
      return 'Overlay the first two panels of the bottom row and keep positions using the same rule that works for the top two rows.';
    case 'constant':
      return `The ${def.label} is ${a} everywhere.`;
  }
}

export const visualMatrix: GeneratorDef = {
  id: 'visual.matrix',
  category: 'visual',
  version: 1,
  family: 'Matrix reasoning',
  description: '3×3 matrices whose rows and columns follow interacting attribute rules.',
  weight: 1.4,
  candidates: 8,
  generate({ rng, difficulty }) {
    const cfg = CONFIG[difficulty];
    const layout = rng.pick(cfg.layouts);
    const roll = rng.next();
    const ctx = makePanelCtx(layout, rng, { orientable: roll < 0.45, sides: roll >= 0.45 && roll < 0.65 });
    const attrs = relevantAttrs(ctx);
    const nVary = Math.min(attrs.length, rng.int(cfg.vary[0], cfg.vary[1]));

    const lead: AttrName | null = layout === 'count' ? 'count' : layout === 'grid' ? 'mask' : null;
    const varying: AttrName[] = [];
    if (lead) varying.push(lead);
    for (const a of rng.shuffle(attrs)) if (varying.length < nVary && !varying.includes(a)) varying.push(a);

    const rules: MatrixRule[] = [];
    for (const attr of attrs) {
      const def = attrDef(attr, ctx);
      let rule: MatrixRule | null = null;
      if (varying.includes(attr)) {
        const kinds = matrixRuleKinds(def).filter((k) => cfg.kinds.includes(k));
        if (kinds.length === 0) reject(`no rule kinds for ${attr}`);
        for (let t = 0; t < 10 && !rule; t++) rule = buildMatrixRule(rng.pick(kinds), def, rng);
      } else {
        rule = buildMatrixRule('constant', def, rng);
      }
      if (!rule) reject(`could not build rule for ${attr}`);
      rules.push(rule);
    }

    const varyingRules = rules.filter((r) => varying.includes(r.attr));
    if (difficulty >= 3 && !varyingRules.some((r) => COMPLEX.includes(r.kind))) reject('not complex enough');
    // A puzzle where every varying rule is "row-constant" is too shallow beyond the first tier.
    if (difficulty >= 2 && varyingRules.every((r) => r.kind === 'row-constant')) reject('too shallow');

    // Rival-hypothesis check: every rule in the library that fits the eight
    // visible cells must predict the same missing value.
    for (const r of rules) {
      const preds = inferMatrixCell(r.values, attrDef(r.attr, ctx));
      if (preds.size !== 1 || !preds.has(r.values[8])) reject(`ambiguous ${r.attr}`);
    }

    const cells = range(9).map((i) => renderPanel(cellValues(rules, i), ctx));
    // No two visible cells may collapse into identical pictures by accident when they should differ.
    const correct = cellValues(rules, 8);

    // Balanced answer options.
    const spec = choiceCountFor(difficulty);
    const order = [...rng.shuffle(varyingRules), ...rng.shuffle(rules.filter((r) => !varying.includes(r.attr)))];
    const perturb: { attr: AttrName; alts: number[] }[] = [];
    const used = new Set<AttrName>();
    for (const need of spec) {
      const r = order.find((x) => !used.has(x.attr) && matrixAlternatives(x, attrDef(x.attr, ctx), rng.fork(x.attr)).length >= need);
      if (!r) reject('not enough plausible alternatives');
      used.add(r.attr);
      const alts = matrixAlternatives(r, attrDef(r.attr, ctx), rng.fork(r.attr));
      const pickFrom = alts.slice(0, Math.max(need, Math.min(alts.length, need + 1)));
      perturb.push({ attr: r.attr, alts: rng.sample(pickFrom, need) });
    }
    const combos = balancedCombos(correct, perturb);
    const correctFigure = renderPanel(correct, ctx);
    const correctKey = figureKey(correctFigure);
    const keys = new Set<string>();
    for (const c of combos) keys.add(figureKey(renderPanel(c.values, ctx)));
    if (keys.size !== combos.length) reject('indistinct options');

    const ruleOf = (a: AttrName) => rules.find((r) => r.attr === a)!;
    const built = buildChoices(
      { key: correctKey, visual: fig(correctFigure) },
      combos
        .filter((c) => c.wrong.length > 0)
        .map((c) => ({
          key: figureKey(renderPanel(c.values, ctx)),
          visual: fig(renderPanel(c.values, ctx)),
          reason:
            capitalize(
              c.wrong
                .map((a) => `${describeDeviation(a, c.values[a]!, correct[a]!, ctx)}${ruleOf(a).kind === 'constant' ? ' (it is the same in every panel)' : ''}`)
                .join('; also '),
            ) + '.',
        })),
      rng,
    );

    const labels = varyingRules.map((r) => attrDef(r.attr, ctx).label);
    const constants = rules.filter((r) => !varying.includes(r.attr));
    const steps: string[] = varyingRules.map((r) => {
      const def = attrDef(r.attr, ctx);
      return `${capitalize(def.label)}: ${describeMatrixRule(r, def)} So the missing panel's ${def.label} is ${def.describe(r.values[8])}.`;
    });
    if (constants.length) {
      steps.push(
        `Unchanged throughout: ${listJoin(constants.map((r) => { const d = attrDef(r.attr, ctx); return `${d.label} (${d.describe(r.values[0])})`; }))}.`,
      );
    }
    const answerText = describePanel(correct, ctx);
    steps.push(`Combining every rule gives ${answerText} — option ${built.correctLabel}.`);

    const hint3 = varyingRules
      .slice(0, 2)
      .map((r) => bottomRowHint(r, ctx))
      .join(' ');

    return {
      title: 'Complete the matrix',
      prompt: 'Each row and column of the 3×3 grid follows the same hidden rules. Which option belongs in the empty bottom-right cell?',
      display: { blocks: [{ type: 'matrix', cols: 3, cells: [...cells.slice(0, 8).map(fig), null] }] },
      interaction: { type: 'choice', choices: built.choices, columns: built.choices.length > 4 ? 4 : 2 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        `Work across the rows. ${labels.length === 1 ? `Only the ${labels[0]} changes from panel to panel.` : `${capitalize(listJoin(labels))} change from panel to panel, each following its own rule.`}`,
        `${capitalize(varyingRules.map((r) => ruleHintPhrase(r.kind, attrDef(r.attr, ctx).label)).join('; '))}.`,
        hint3,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${answerText}.`,
        answerVisual: fig(correctFigure),
        rule: varyingRules.map((r) => describeMatrixRule(r, attrDef(r.attr, ctx))).join(' '),
        steps,
        alternatives: built.alternatives,
        skills: ['pattern recognition', 'abstract reasoning', 'rule induction'],
      },
      metrics: {
        rules: varyingRules.length,
        steps: varyingRules.length + varyingRules.filter((r) => COMPLEX.includes(r.kind)).length,
        choices: built.choices.length,
      },
      fingerprint: {
        structure: `m3|${layout}|${varyingRules.map((r) => `${r.attr}:${r.kind}`).sort().join('+')}`,
        features: [`layout:${layout}`, ...varyingRules.map((r) => `rule:${r.kind}`), ...varyingRules.map((r) => `attr:${r.attr}`)],
        detail: `${ctx.shapes.join(',')}|${rules.map((r) => r.values.join(',')).join('|')}`,
      },
      hidden: { ctx, rules } satisfies MatrixHidden,
    };
  },
  verify(p: Puzzle) {
    const problems: string[] = [];
    const h = p.hidden as unknown as MatrixHidden;
    const block = p.display.blocks[0];
    if (block.type !== 'matrix') return ['display is not a matrix'];
    for (const r of h.rules) {
      const preds = inferMatrixCell(r.values, attrDef(r.attr, h.ctx));
      if (preds.size !== 1 || !preds.has(r.values[8])) problems.push(`attribute ${r.attr} is ambiguous`);
    }
    for (let i = 0; i < 8; i++) {
      const cell = block.cells[i];
      if (!cell || cell.kind !== 'figure' || figureKey(cell.figure) !== figureKey(renderPanel(cellValues(h.rules, i), h.ctx)))
        problems.push(`cell ${i} does not match its rule values`);
    }
    const expected = figureKey(renderPanel(cellValues(h.rules, 8), h.ctx));
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return [...problems, 'wrong interaction'];
    const matching = p.interaction.choices.filter((c) => c.visual?.kind === 'figure' && figureKey(c.visual.figure) === expected);
    if (matching.length !== 1) problems.push(`expected exactly one matching option, found ${matching.length}`);
    else if (matching[0].id !== p.answer.correct) problems.push('answer id does not match the computed panel');
    return problems;
  },
};
