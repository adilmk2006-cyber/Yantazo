/**
 * Odd one out: every panel but one shares a structural property (mirror
 * symmetry, being a rotation of one arrangement, dots matching sides …).
 * A property library is evaluated over all panels; the puzzle is rejected if
 * any other property — including superficial ones such as "the only panel with
 * a star" — singles out a panel.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Figure, Glyph, Puzzle, ShapeKind } from '../../types';
import type { Rng } from '../../rng';
import { figureKey, mirrorFigure, rotateFigure, shapeInfo, PLAIN_SHAPES, ORIENTABLE_SHAPES, CHIRAL_SHAPES, SIDE_SERIES, SHADE_NAMES, withArticle } from '../../visual/shapes';
import { slotXY } from '../../visual/attributes';
import { capitalize, mod, range, reject } from '../../util';

type Principle = 'mirror' | 'symmetry' | 'sides' | 'largest' | 'pair';

interface Built {
  panels: Figure[];
  odd: number;
  rule: string;
  oddReason: string;
  normalReason: (i: number) => string;
  hint2: string;
  hint3: string;
}

const isDot = (g: Glyph) => g.r <= 5;

function rotationClass(f: Figure): string {
  return range(8)
    .map((k) => figureKey(rotateFigure(f, k)))
    .sort()[0];
}

function isSymmetric(f: Figure): boolean {
  return figureKey(mirrorFigure(f)) === figureKey(f);
}

function bigPolygon(f: Figure): Glyph | undefined {
  return f.glyphs.find((g) => g.r >= 30);
}

function largestIsSolid(f: Figure): boolean {
  const main = f.glyphs.filter((g) => !isDot(g));
  const max = Math.max(...main.map((g) => g.r));
  const largest = main.filter((g) => g.r === max);
  return largest.length === 1 && largest[0].shade === 3 && main.filter((g) => g.shade === 3).length === 1;
}

function hasExactPair(f: Figure): boolean {
  const counts = new Map<string, number>();
  for (const g of f.glyphs) if (!isDot(g)) counts.set(g.shape, (counts.get(g.shape) ?? 0) + 1);
  return [...counts.values()].filter((c) => c === 2).length === 1 && f.glyphs.filter((g) => !isDot(g)).length === 3;
}

/** Structural and surface properties evaluated for ambiguity. */
function propertyTable(panels: Figure[]): { name: string; values: (boolean | string | number)[]; surface: boolean }[] {
  const props: { name: string; values: (boolean | string | number)[]; surface: boolean }[] = [];
  const shapes = new Set(panels.flatMap((p) => p.glyphs.filter((g) => !isDot(g)).map((g) => g.shape)));
  for (const s of shapes) props.push({ name: `has-${s}`, values: panels.map((p) => p.glyphs.some((g) => !isDot(g) && g.shape === s)), surface: true });
  for (let sh = 0; sh < 4; sh++) props.push({ name: `shade-${sh}`, values: panels.map((p) => p.glyphs.some((g) => !isDot(g) && g.shade === sh)), surface: true });
  props.push({ name: 'count', values: panels.map((p) => p.glyphs.filter((g) => !isDot(g)).length), surface: true });
  props.push({ name: 'dots', values: panels.map((p) => p.glyphs.filter(isDot).length), surface: true });
  props.push({ name: 'symmetric', values: panels.map(isSymmetric), surface: false });
  props.push({ name: 'rotation-class', values: panels.map(rotationClass), surface: false });
  props.push({ name: 'largest-solid', values: panels.map(largestIsSolid), surface: false });
  props.push({ name: 'exact-pair', values: panels.map(hasExactPair), surface: false });
  props.push({
    name: 'dots-match-sides',
    values: panels.map((p) => {
      const big = bigPolygon(p);
      return !!big && shapeInfo(big.shape).sides === p.glyphs.filter(isDot).length;
    }),
    surface: false,
  });
  return props;
}

/** Index singled out by a property (one panel differs from all the others), or -1. */
function singledOut(values: (boolean | string | number)[]): number {
  const counts = new Map<string, number[]>();
  values.forEach((v, i) => {
    const k = String(v);
    counts.set(k, [...(counts.get(k) ?? []), i]);
  });
  if (counts.size !== 2) return -1;
  const groups = [...counts.values()];
  const single = groups.find((g) => g.length === 1);
  const other = groups.find((g) => g.length > 1);
  return single && other ? single[0] : -1;
}

function mirroredGlyph(g: Glyph): Glyph {
  return { ...g, x: 100 - g.x, rot: mod(-g.rot, 8), mirror: !g.mirror };
}

function buildMirror(rng: Rng, n: number, hard: boolean): Built {
  const glyphs: Glyph[] = [];
  const slots = rng.sample([0, 1, 2, 3, 5, 6, 7, 8], hard ? 3 : 2);
  const chiral = rng.pick(CHIRAL_SHAPES);
  slots.forEach((slot, i) => {
    const [x, y] = slotXY(slot);
    const shape: ShapeKind = i === 0 && !hard ? chiral : rng.pick(i === 0 ? ORIENTABLE_SHAPES : [...PLAIN_SHAPES, ...ORIENTABLE_SHAPES]);
    glyphs.push({ shape, x, y, r: 11, rot: shapeInfo(shape).orientable ? rng.int(0, 7) : 0, shade: rng.int(0, 3) });
  });
  const base: Figure = { glyphs };
  const mirrored = mirrorFigure(base);
  const baseRots = new Set(range(8).map((k) => figureKey(rotateFigure(base, k))));
  if (range(8).some((k) => baseRots.has(figureKey(rotateFigure(mirrored, k))))) reject('arrangement is not chiral');
  const steps = rng.sample(hard ? range(8) : [0, 2, 4, 6], n - 1);
  if (steps.length < n - 1) reject('not enough rotations');
  const odd = rng.int(0, n - 1);
  const oddStep = rng.pick(hard ? range(8) : [0, 2, 4, 6]);
  const panels: Figure[] = [];
  let s = 0;
  const stepOf: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === odd) {
      panels.push(rotateFigure(mirrored, oddStep));
      stepOf.push(oddStep);
    } else {
      panels.push(rotateFigure(base, steps[s]));
      stepOf.push(steps[s++]);
    }
  }
  return {
    panels,
    odd,
    rule: 'Every other panel shows the same arrangement, only rotated. The odd panel is a mirror image of that arrangement — no rotation can turn it into the others.',
    oddReason: 'it is a reflection of the shared arrangement, so it cannot be rotated to match the others',
    normalReason: (i) => {
      const ref = odd === 0 ? 1 : 0;
      const turn = mod(stepOf[i] - stepOf[ref], 8) * 45;
      return i === ref ? 'it shows the shared arrangement' : `it is the same arrangement as panel ${ref + 1}, rotated ${turn}° clockwise`;
    },
    hint2: 'Try mentally rotating one panel to match another. Do all of them line up?',
    hint3: 'One panel can only be matched by flipping it over as well as turning it.',
  };
}

function symmetricPanel(rng: Rng, shapes: ShapeKind[]): Figure {
  const glyphs: Glyph[] = [];
  const pairs = rng.sample([[0, 2], [3, 5], [6, 8]], rng.int(1, 2));
  for (const [a] of pairs) {
    const shape = rng.pick(shapes);
    const [x, y] = slotXY(a);
    const g: Glyph = { shape, x, y, r: 11, rot: shapeInfo(shape).orientable ? rng.int(0, 7) : 0, shade: rng.int(0, 3) };
    glyphs.push(g, mirroredGlyph(g));
  }
  for (const c of rng.sample([1, 4, 7], rng.int(1, 2))) {
    const shape = rng.pick(shapes.filter((s) => shapeInfo(s).achiral));
    const [x, y] = slotXY(c);
    glyphs.push({ shape, x, y, r: 11, rot: shapeInfo(shape).orientable ? rng.pick([0, 4]) : 0, shade: rng.int(0, 3) });
  }
  return { glyphs };
}

function buildSymmetry(rng: Rng, n: number): Built {
  const shapes = [...rng.sample(PLAIN_SHAPES, 3), ...rng.sample(ORIENTABLE_SHAPES, 2)];
  const panels = range(n).map(() => symmetricPanel(rng, shapes));
  const odd = rng.int(0, n - 1);
  const p = panels[odd];
  // break the symmetry with a single small change
  const idx = rng.int(0, p.glyphs.length - 1);
  const g = p.glyphs[idx];
  let changed: Glyph;
  let change: string;
  if (shapeInfo(g.shape).orientable && rng.chance(0.6)) {
    const choices = range(8).filter((r) => r !== g.rot);
    changed = { ...g, rot: rng.pick(choices) };
    change = `the ${shapeInfo(g.shape).name} has been turned`;
  } else {
    const shade = rng.pick([0, 1, 2, 3].filter((s) => s !== g.shade));
    changed = { ...g, shade };
    change = `one ${shapeInfo(g.shape).name} is ${SHADE_NAMES[shade]} instead of ${SHADE_NAMES[g.shade]}`;
  }
  panels[odd] = { glyphs: p.glyphs.map((x, i) => (i === idx ? changed : x)) };
  if (isSymmetric(panels[odd])) reject('change kept symmetry');
  return {
    panels,
    odd,
    rule: 'Every other panel is mirror-symmetric about a vertical line through its centre.',
    oddReason: `it is not symmetric: ${change}`,
    normalReason: () => 'its left half is an exact mirror image of its right half',
    hint2: 'Imagine a vertical mirror line down the middle of each panel.',
    hint3: 'Compare each shape on the left with its partner on the right — shading and direction must mirror exactly.',
  };
}

function dotsRing(n: number, phase: number): Glyph[] {
  return range(n).map((i) => {
    const a = (2 * Math.PI * i) / n + phase;
    return { shape: 'circle', x: Math.round((50 + 13 * Math.sin(a)) * 10) / 10, y: Math.round((54 - 13 * Math.cos(a)) * 10) / 10, r: 3.5, rot: 0, shade: 3 } satisfies Glyph;
  });
}

function buildSides(rng: Rng, n: number): Built {
  const polys = range(n).map(() => rng.pick(SIDE_SERIES));
  const odd = rng.int(0, n - 1);
  const oddSides = shapeInfo(polys[odd]).sides;
  const oddDots = oddSides + rng.pick([-1, 1]);
  const panels = polys.map((poly, i): Figure => {
    const dots = i === odd ? oddDots : shapeInfo(poly).sides;
    return { glyphs: [{ shape: poly, x: 50, y: 52, r: 42, rot: 0, shade: 0 }, ...dotsRing(dots, (rng.int(0, 5) * Math.PI) / 9)] };
  });
  const describe = (i: number) => {
    const info = shapeInfo(polys[i]);
    return `${withArticle(info.name)} (${info.sides} sides) with ${panels[i].glyphs.length - 1} dots`;
  };
  return {
    panels,
    odd,
    rule: 'In every other panel, the number of dots equals the number of sides of the outer shape.',
    oddReason: `it shows ${describe(odd)}`,
    normalReason: (i) => `${describe(i)} — they match`,
    hint2: 'Count two different things in each panel and compare them.',
    hint3: 'Count the sides of each outer shape.',
  };
}

function buildLargest(rng: Rng, n: number): Built {
  const radii = [8, 12, 17];
  const shapes = rng.sample(PLAIN_SHAPES, 4);
  const odd = rng.int(0, n - 1);
  const panels = range(n).map((i): Figure => {
    const slots = rng.sample([0, 2, 4, 6, 8, 1, 7], 3);
    const solidAt = i === odd ? rng.int(0, 1) : 2;
    const glyphs = slots.map((slot, k): Glyph => {
      const [x, y] = slotXY(slot);
      return { shape: rng.pick(shapes), x, y, r: radii[k], rot: 0, shade: k === solidAt ? 3 : rng.int(0, 2) };
    });
    return { glyphs };
  });
  return {
    panels,
    odd,
    rule: 'In every other panel, the largest shape is the only solid one.',
    oddReason: 'its solid shape is not the largest one',
    normalReason: (i) => `its largest shape (${withArticle(shapeInfo(panels[i].glyphs.find((g) => g.r === 17)!.shape).name)}) is the solid one`,
    hint2: 'Compare sizes and shading together rather than shapes.',
    hint3: 'In each panel, find the biggest shape. What is special about it?',
  };
}

function buildPair(rng: Rng, n: number): Built {
  const shapes = rng.sample(PLAIN_SHAPES, 5);
  const odd = rng.int(0, n - 1);
  const panels = range(n).map((i): Figure => {
    const slots = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8], 3);
    let kinds: ShapeKind[];
    if (i === odd) kinds = rng.sample(shapes, 3);
    else {
      const [a, b] = rng.sample(shapes, 2);
      kinds = rng.shuffle([a, a, b]);
    }
    return { glyphs: slots.map((slot, k) => { const [x, y] = slotXY(slot); return { shape: kinds[k], x, y, r: 11, rot: 0, shade: rng.int(0, 3) }; }) };
  });
  return {
    panels,
    odd,
    rule: 'Every other panel contains exactly two shapes of the same kind plus one different shape.',
    oddReason: 'all three of its shapes are different',
    normalReason: (i) => {
      const counts = new Map<string, number>();
      for (const g of panels[i].glyphs) counts.set(g.shape, (counts.get(g.shape) ?? 0) + 1);
      const pair = [...counts.entries()].find(([, c]) => c === 2)![0] as ShapeKind;
      return `it has a pair of ${shapeInfo(pair).plural}`;
    },
    hint2: 'Ignore shading and position; look only at which kinds of shape appear.',
    hint3: 'Count how many times each kind of shape appears in a panel.',
  };
}

interface OddHidden {
  principle: Principle;
  odd: number;
  [k: string]: unknown;
}

export const visualOddOne: GeneratorDef = {
  id: 'visual.oddone',
  category: 'visual',
  version: 1,
  family: 'Odd one out',
  description: 'All panels but one share a structural property.',
  weight: 0.9,
  candidates: 6,
  generate({ rng, difficulty }) {
    const n = difficulty <= 2 ? 5 : 6;
    const principles: Principle[] = difficulty === 1 ? ['mirror', 'sides', 'pair'] : difficulty === 2 ? ['mirror', 'symmetry', 'sides', 'largest', 'pair'] : ['mirror', 'symmetry', 'largest', 'sides'];
    const principle = rng.pick(principles);
    const intended: Record<Principle, string> = {
      mirror: 'rotation-class',
      symmetry: 'symmetric',
      sides: 'dots-match-sides',
      largest: 'largest-solid',
      pair: 'exact-pair',
    };
    // Panels are random within the principle, so a bounded number of internal
    // re-draws is used to find a set where nothing else singles out a panel.
    let built: Built | null = null;
    let lastProblem = '';
    for (let attempt = 0; attempt < 30 && !built; attempt++) {
      let cand: Built;
      try {
        cand =
          principle === 'mirror'
            ? buildMirror(rng, n, difficulty >= 3)
            : principle === 'symmetry'
              ? buildSymmetry(rng, n)
              : principle === 'sides'
                ? buildSides(rng, n)
                : principle === 'largest'
                  ? buildLargest(rng, n)
                  : buildPair(rng, n);
      } catch (e) {
        lastProblem = (e as Error).message;
        continue;
      }
      const keys = cand.panels.map(figureKey);
      if (new Set(keys).size !== keys.length) {
        lastProblem = 'duplicate panels';
        continue;
      }
      const table = propertyTable(cand.panels);
      const main = table.find((t) => t.name === intended[principle])!;
      if (singledOut(main.values) !== cand.odd) {
        lastProblem = 'intended property does not single out the odd panel';
        continue;
      }
      const clash = table.find((t) => {
        if (t.name === main.name) return false;
        const s = singledOut(t.values);
        return s !== -1 && (t.surface || s !== cand.odd);
      });
      if (clash) {
        lastProblem = `property ${clash.name} also singles out a panel`;
        continue;
      }
      built = cand;
    }
    if (!built) reject(lastProblem || 'no balanced panel set');
    const { panels, odd } = built;
    const keys = panels.map(figureKey);

    const visuals = panels.map((f) => ({ kind: 'figure' as const, figure: f }));
    const choices = buildChoices(
      { key: keys[odd], visual: visuals[odd] },
      panels.map((_, i) => i).filter((i) => i !== odd).map((i) => ({ key: keys[i], visual: visuals[i], reason: capitalize(`${built.normalReason(i)}.`) })),
      rng,
    );

    return {
      title: 'Odd one out',
      prompt: `All but one of these ${n} panels follow the same hidden rule. Which panel is the odd one out?`,
      display: { blocks: [{ type: 'text', text: 'Shading, position and shape may vary freely unless they are part of the rule.', tone: 'note' }] },
      interaction: { type: 'choice', choices: choices.choices, columns: n === 6 ? 3 : 5 },
      answer: { type: 'choice', correct: choices.correctId },
      hints: ['Look for a structural property, not a single surface detail — every shape and shading appears in more than one panel.', built.hint2, built.hint3],
      explanation: {
        answer: `Option ${choices.correctLabel} — ${built.oddReason}.`,
        answerVisual: visuals[odd],
        rule: built.rule,
        steps: [
          built.rule,
          ...choices.choices.filter((c) => c.id !== choices.correctId).slice(0, 3).map((c) => `Option ${c.label}: ${choices.alternatives.find((a) => a.choiceId === c.id)!.reason}`),
          `Option ${choices.correctLabel} breaks the rule: ${built.oddReason}.`,
          'The generator also checked that no other property (for example being the only panel with a particular shape or shading) singles out a different panel.',
        ],
        alternatives: choices.alternatives,
        skills: principle === 'mirror' ? ['mental rotation', 'visual attention', 'abstract reasoning'] : ['abstract reasoning', 'visual attention', 'pattern recognition'],
      },
      metrics: { rules: 1, steps: principle === 'mirror' || principle === 'sides' ? 3 : 2, choices: n },
      fingerprint: {
        structure: `odd|${principle}|${n}`,
        features: [`principle:${principle}`, `panels:${n}`],
        detail: keys.join('|'),
      },
      hidden: { principle, odd } satisfies OddHidden,
    };
  },
  verify(p: Puzzle) {
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const panels = p.interaction.choices.map((c) => (c.visual?.kind === 'figure' ? c.visual.figure : { glyphs: [] }));
    const h = p.hidden as unknown as OddHidden;
    const name = { mirror: 'rotation-class', symmetry: 'symmetric', sides: 'dots-match-sides', largest: 'largest-solid', pair: 'exact-pair' }[h.principle];
    const prop = propertyTable(panels).find((t) => t.name === name)!;
    const s = singledOut(prop.values);
    if (s < 0 || p.interaction.choices[s].id !== p.answer.correct) return ['recomputed odd panel does not match the answer'];
    return [];
  },
};
