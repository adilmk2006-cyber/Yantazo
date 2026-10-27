import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { CubeSymbol, Puzzle, Visual } from '../../types';
import type { Cell } from '../../spatial/poly';
import { allNets, foldNet, isValidView, opposite, validViews } from '../../spatial/cube';
import { listJoin, reject } from '../../util';

const SYMBOLS: CubeSymbol[] = ['circle', 'ring', 'cross', 'xmark', 'square', 'diamond', 'dots4', 'star4'];
const SYMBOL_NAMES: Record<CubeSymbol, string> = {
  circle: 'disc',
  ring: 'ring',
  cross: 'plus',
  xmark: 'cross (×)',
  square: 'square',
  diamond: 'diamond',
  dots4: 'four dots',
  star4: 'star',
};

interface CubeHidden {
  net: Cell[];
  symbols: CubeSymbol[];
  mode: 'opposite' | 'view';
  [k: string]: unknown;
}

export const spatialCube: GeneratorDef = {
  id: 'spatial.cube',
  category: 'spatial',
  version: 1,
  family: 'Cube nets',
  description: 'Fold a net into a cube: opposite faces and which views are possible.',
  weight: 1,
  candidates: 5,
  generate({ rng, difficulty }) {
    const net = rng.pick(allNets());
    const faces = foldNet(net)!;
    const symbols = rng.sample(SYMBOLS, 6);
    // symbol on each body face
    const symOfFace: CubeSymbol[] = new Array(6);
    faces.forEach((f, i) => (symOfFace[f] = symbols[i]));
    const netVisual: Visual = { kind: 'net', cells: net.map(([x, y], i) => ({ x, y, symbol: symbols[i] })) };
    const nm = (f: number) => SYMBOL_NAMES[symOfFace[f]];
    const pairs = [0, 2, 4].map((f) => `${nm(f)} – ${nm(opposite(f))}`);
    const mode: 'opposite' | 'view' = difficulty === 1 ? 'opposite' : difficulty === 2 ? (rng.chance(0.5) ? 'opposite' : 'view') : 'view';

    if (mode === 'opposite') {
      const f = rng.int(0, 5);
      const opp = opposite(f);
      const adj = [0, 1, 2, 3, 4, 5].filter((x) => x !== f && x !== opp);
      const others = rng.sample(adj, 3);
      const built = buildChoices(
        { key: symOfFace[opp], text: nm(opp) },
        others.map((x) => ({ key: symOfFace[x], text: nm(x), reason: `The ${nm(x)} shares an edge with the ${nm(f)} on the folded cube, so it cannot be opposite.` })),
        rng,
      );
      const cellOf = (face: number) => net[faces.indexOf(face)];
      const [fx, fy] = cellOf(f);
      const [ox, oy] = cellOf(opp);
      const collinear = (fx === ox && Math.abs(fy - oy) === 2) || (fy === oy && Math.abs(fx - ox) === 2);
      return {
        title: 'Opposite faces',
        prompt: `This net is folded into a cube. Which symbol ends up opposite the ${nm(f)}?`,
        display: { blocks: [{ type: 'visual', visual: netVisual, size: 'lg' }] },
        interaction: { type: 'choice', choices: built.choices.map((c) => ({ ...c, visual: { kind: 'net', cells: [{ x: 0, y: 0, symbol: SYMBOLS.find((s) => SYMBOL_NAMES[s] === c.text)! }] } })) },
        answer: { type: 'choice', correct: built.correctId },
        hints: [
          'Faces that touch along an edge in the net can never be opposite each other.',
          `Cross out every symbol that touches the ${nm(f)} in the net, directly or after folding.`,
          collinear
            ? `Look along the straight row or column through the ${nm(f)}: two squares with exactly one square between them always end up opposite.`
            : `Imagine the ${nm(f)} as the base and fold its neighbours up around it; the square left over becomes the lid.`,
        ],
        explanation: {
          answer: `Option ${built.correctLabel}: the ${nm(opp)}.`,
          rule: `When folded, the opposite pairs are ${listJoin(pairs)}.`,
          steps: [
            `Every face touches four others and is opposite exactly one.`,
            `Folding this net pairs the faces as ${listJoin(pairs)} (computed by rolling a cube across the net).`,
            collinear ? `The ${nm(f)} and the ${nm(opp)} lie two squares apart in a straight line of the net, which always makes them opposite.` : `The ${nm(f)} and the ${nm(opp)} are separated by a bend in the net, but after folding they still face each other.`,
          ],
          alternatives: built.alternatives,
          skills: ['spatial visualisation', 'mental rotation'],
        },
        metrics: { rules: 1, steps: 2, choices: 4 },
        fingerprint: { structure: 'cube|opposite', features: ['cube:opposite', collinear ? 'layout:straight' : 'layout:bent'], detail: `${netVisual.cells.map((c) => `${c.x},${c.y},${c.symbol}`).join(';')}|${f}` },
        hidden: { net, symbols, mode } satisfies CubeHidden,
      };
    }

    const views = validViews();
    const correctView = rng.pick(views);
    const nOpts = difficulty <= 2 ? 4 : 5;
    const nMirror = difficulty === 2 ? 0 : difficulty === 3 ? 2 : 3;
    const distractors: { view: [number, number, number]; why: string }[] = [];
    const keyOf = (v: number[]) => v.map((f) => symOfFace[f]).join('|');
    const seen = new Set([keyOf(correctView)]);
    for (let t = 0; t < 200 && distractors.length < nMirror; t++) {
      const [l, r, tp] = rng.pick(views);
      const mirrored: [number, number, number] = [r, l, tp];
      if (seen.has(keyOf(mirrored))) continue;
      seen.add(keyOf(mirrored));
      distractors.push({ view: mirrored, why: `The ${nm(l)}, ${nm(r)} and ${nm(tp)} do meet at one corner, but in mirror-image order — the real cube has them the other way round.` });
    }
    for (let t = 0; t < 200 && distractors.length < nOpts - 1; t++) {
      const a = rng.int(0, 5);
      const others = [0, 1, 2, 3, 4, 5].filter((x) => x !== a && x !== opposite(a));
      const c = rng.pick(others);
      const arr = rng.shuffle([a, opposite(a), c]) as [number, number, number];
      if (seen.has(keyOf(arr))) continue;
      seen.add(keyOf(arr));
      distractors.push({ view: arr, why: `The ${nm(a)} and the ${nm(opposite(a))} are on opposite faces, so they can never be seen together.` });
    }
    if (distractors.length < nOpts - 1) reject('not enough cube distractors');
    const cubeVis = ([l, r, t]: number[]): Visual => ({ kind: 'cube', left: symOfFace[l], right: symOfFace[r], top: symOfFace[t] });
    const built = buildChoices(
      { key: keyOf(correctView), visual: cubeVis(correctView) },
      distractors.map((d) => ({ key: keyOf(d.view), visual: cubeVis(d.view), reason: d.why })),
      rng,
    );
    const [l, r, t] = correctView;
    return {
      title: 'Fold the cube',
      prompt: 'This net is folded into a cube (symbols may appear turned). Which option shows a view of that cube?',
      display: { blocks: [{ type: 'visual', visual: netVisual, size: 'lg' }] },
      interaction: { type: 'choice', choices: built.choices, columns: nOpts },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        'First find the three pairs of opposite faces: a correct view can never show both faces of a pair.',
        nMirror ? 'Then check the order of the three symbols around the visible corner — a mirror-image arrangement is impossible.' : 'Every option but one shows a pair of opposite faces together.',
        `Opposite pairs: ${listJoin(pairs)}.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${nm(t)} on top, ${nm(l)} on the left, ${nm(r)} on the right.`,
        answerVisual: cubeVis(correctView),
        rule: `Opposite faces: ${listJoin(pairs)}. A view shows three faces that meet at one corner, in the cube's actual handedness.`,
        steps: [
          `Folding the net (simulated by rolling a cube across it) gives the opposite pairs ${listJoin(pairs)}.`,
          `The ${nm(l)}, ${nm(r)} and ${nm(t)} meet at a corner; going clockwise around it from outside you meet ${nm(t)}, ${nm(r)}, ${nm(l)} — exactly as in option ${built.correctLabel}.`,
          'Every other option either pairs two opposite faces or shows a corner in mirror-image order.',
        ],
        alternatives: built.alternatives,
        skills: ['spatial visualisation', 'mental rotation'],
      },
      metrics: { rules: 2, steps: 2 + nMirror, choices: nOpts },
      fingerprint: { structure: `cube|view|${nMirror ? 'chiral' : 'pairs'}`, features: ['cube:view', nMirror ? 'trap:mirror' : 'trap:opposite'], detail: `${netVisual.cells.map((c) => `${c.x},${c.y},${c.symbol}`).join(';')}|${correctView.join(',')}` },
      hidden: { net, symbols, mode } satisfies CubeHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as CubeHidden;
    const faces = foldNet(h.net);
    if (!faces) return ['not a valid net'];
    const faceOf = (s: CubeSymbol) => faces[h.symbols.indexOf(s)];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    if (h.mode === 'view') {
      const valid = p.interaction.choices.filter((c) => c.visual?.kind === 'cube' && isValidView(faceOf(c.visual.left), faceOf(c.visual.right), faceOf(c.visual.top)));
      if (valid.length !== 1 || valid[0].id !== p.answer.correct) return [`expected exactly one valid cube, found ${valid.length}`];
    }
    return [];
  },
};
