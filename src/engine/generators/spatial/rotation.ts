/**
 * Mental rotation, mirror images, composed 2D transformations and spatial
 * analogies on random chiral polyominoes. Option equivalence is decided with
 * canonical polyomino keys, so "same shape after rotation" is computed, not
 * eyeballed.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle, Visual } from '../../types';
import type { Cell } from '../../spatial/poly';
import { bounds, hasRotationalSymmetry, isChiral, mirrorH, nearMiss, normalize, polyKey, randomPolyomino, rotateTimes, rotationKeys } from '../../spatial/poly';
import { reject } from '../../util';

type Mode = 'rotate' | 'mirror' | 'compose' | 'analogy';

interface Transform {
  id: string;
  desc: string;
  apply(c: Cell[]): Cell[];
}

const T: Transform[] = [
  { id: 'r90', desc: 'rotate 90° clockwise', apply: (c) => rotateTimes(c, 1) },
  { id: 'r180', desc: 'rotate 180°', apply: (c) => rotateTimes(c, 2) },
  { id: 'r270', desc: 'rotate 90° anticlockwise', apply: (c) => rotateTimes(c, 3) },
  { id: 'mh', desc: 'flip left ↔ right', apply: (c) => mirrorH(c) },
  { id: 'mv', desc: 'flip top ↔ bottom', apply: (c) => rotateTimes(mirrorH(c), 2) },
];

const byId = (id: string) => T.find((t) => t.id === id)!;

function vis(cells: Cell[]): Visual {
  const b = bounds(cells);
  return { kind: 'cells', w: b.w, h: b.h, frame: 4, gridLines: true, layers: [{ cells, style: 'solid' }] };
}

interface RotHidden {
  mode: Mode;
  base: Cell[];
  ops: string[];
  [k: string]: unknown;
}

export const spatialRotation: GeneratorDef = {
  id: 'spatial.rotation',
  category: 'spatial',
  version: 1,
  family: 'Rotation & reflection',
  description: 'Mental rotation, mirror images, composed transformations and spatial analogies.',
  weight: 1.3,
  candidates: 5,
  generate({ rng, difficulty }) {
    const size = difficulty === 1 ? 5 : difficulty === 2 ? 6 : difficulty === 3 ? 7 : 8;
    const base = randomPolyomino(rng, size, 4, 4);
    if (!isChiral(base) || hasRotationalSymmetry(base)) reject('shape must be chiral and rotation-asymmetric');
    const modes: Mode[] = difficulty === 1 ? ['rotate', 'mirror'] : difficulty === 2 ? ['rotate', 'mirror', 'compose', 'analogy'] : ['rotate', 'compose', 'analogy'];
    const mode = rng.pick(modes);
    const nOpts = difficulty <= 2 ? 4 : 5;
    const used = new Set<string>();
    const distractors: { cells: Cell[]; reason: string }[] = [];
    const addD = (cells: Cell[] | null, reason: string, avoid: (c: Cell[]) => boolean) => {
      if (!cells || distractors.length >= nOpts - 1) return;
      const k = polyKey(cells);
      if (used.has(k) || avoid(cells)) return;
      used.add(k);
      distractors.push({ cells: normalize(cells), reason });
    };
    let correct: Cell[];
    let prompt: string;
    let rule: string;
    let steps: string[];
    let ops: string[] = [];
    let display: Visual[] = [vis(base)];
    let hints: [string, string, string];

    if (mode === 'rotate') {
      const k = rng.int(1, 3);
      correct = rotateTimes(base, k);
      used.add(polyKey(correct));
      const rots = rotationKeys(base);
      const mirrored = mirrorH(base);
      const mirrorWhy = 'This is a mirror image of the shape: no rotation can produce it — the shape would have to be flipped over.';
      if (difficulty >= 3) {
        const nm = nearMiss(rng, base);
        if (nm) addD(rotateTimes(nm, rng.int(0, 3)), 'One square is in a different place, so it is a different shape altogether.', (c) => rots.has(polyKey(c)));
      }
      for (const r of rng.shuffle([0, 1, 2, 3])) addD(rotateTimes(mirrored, r), mirrorWhy, (c) => rots.has(polyKey(c)));
      prompt = 'Which option is the same shape, only rotated? (Turning is allowed; flipping over is not.)';
      rule = `The correct option is the shape turned ${k === 1 ? '90° clockwise' : k === 2 ? '180°' : '90° anticlockwise'}.`;
      steps = [rule, 'The other options are reflections (or altered shapes). A reflection reverses the shape’s handedness, which rotation can never do.'];
      hints = ['Pick a distinctive feature — an end, a notch or a corner — and follow it as you turn the shape.', 'Rotation keeps the shape’s handedness. Mirror images are the trap.', `The correct option is turned ${k === 2 ? 'half a turn' : 'a quarter turn'}.`];
      ops = [`r${k}`];
    } else if (mode === 'mirror') {
      correct = mirrorH(base);
      used.add(polyKey(correct));
      for (const t of rng.shuffle(['r90', 'r180', 'r270'])) addD(byId(t).apply(base), `This is the original shape ${byId(t).desc.replace('rotate', 'rotated')}, not reflected.`, () => false);
      addD(byId('mv').apply(base), 'This is a top ↔ bottom flip; a vertical mirror swaps left and right only.', () => false);
      prompt = 'A mirror is placed along the right-hand side of the shape. Which option shows its reflection?';
      rule = 'A vertical mirror swaps left and right but keeps top and bottom where they are.';
      steps = [rule, 'Each square keeps its height and its distance from the mirror line, but on the opposite side.'];
      hints = ['In a vertical mirror, things on the left appear on the right.', 'Nothing moves up or down in the reflection.', 'Check the top row of the shape first: it stays on top but reverses left to right.'];
      ops = ['mh'];
    } else if (mode === 'compose') {
      const geo = rng.pick(['r90', 'r180', 'r270']);
      const flip = rng.pick(['mh', 'mv']);
      const seq = rng.chance(0.5) ? [geo, flip] : [flip, geo];
      ops = seq;
      correct = seq.reduce((c, id) => byId(id).apply(c), base);
      used.add(polyKey(correct));
      const alt = (ids: string[]) => ids.reduce((c, id) => byId(id).apply(c), base);
      addD(alt([...seq].reverse()), 'This performs the same two moves in the opposite order — rotation and reflection do not commute.', () => false);
      addD(alt([seq[0]]), 'This stops after the first move.', () => false);
      addD(alt([seq[1]]), 'This performs only the second move.', () => false);
      for (const t of T) addD(alt([t.id]), `This is a single move (${t.desc}) rather than the two-step combination.`, () => false);
      addD(alt(seq.map((id) => (id === 'r90' ? 'r270' : id === 'r270' ? 'r90' : id === 'mh' ? 'mv' : id === 'mv' ? 'mh' : id))), 'This turns or flips the wrong way.', () => false);
      prompt = `Apply these moves in order: first ${byId(seq[0]).desc}, then ${byId(seq[1]).desc}. Which option shows the result?`;
      rule = `First ${byId(seq[0]).desc}, then ${byId(seq[1]).desc}.`;
      const mid = byId(seq[0]).apply(base);
      display = [vis(base)];
      steps = [`After the first move (${byId(seq[0]).desc}) the shape looks like the intermediate picture.`, `Then ${byId(seq[1]).desc} to get the final answer.`];
      hints = ['Do the moves one at a time — sketch the intermediate shape if it helps.', 'Order matters: flipping then turning is not the same as turning then flipping.', `After the first move, the shape occupies a ${bounds(mid).w}×${bounds(mid).h} box.`];
    } else {
      // analogy: A → B, C → ?
      const t = rng.pick(T);
      let other = randomPolyomino(rng, size, 4, 4);
      for (let i = 0; i < 20 && (!isChiral(other) || hasRotationalSymmetry(other) || polyKey(other) === polyKey(base)); i++) other = randomPolyomino(rng, size, 4, 4);
      if (!isChiral(other) || hasRotationalSymmetry(other)) reject('no second shape');
      const B = t.apply(base);
      // ambiguity: any other transform giving the same B?
      const fits = T.filter((x) => polyKey(x.apply(base)) === polyKey(B));
      if (fits.length !== 1) reject('ambiguous analogy transform');
      correct = t.apply(other);
      used.add(polyKey(correct));
      ops = [t.id];
      for (const x of rng.shuffle(T)) if (x.id !== t.id) addD(x.apply(other), `This would be "${x.desc}", but the first pair shows "${t.desc}".`, () => false);
      addD(normalize(other), 'This is the third shape unchanged.', () => false);
      display = [vis(base), vis(B), vis(other)];
      prompt = 'The first shape is transformed into the second. Apply the same transformation to the third shape. Which option is the result?';
      rule = `The transformation is: ${t.desc}.`;
      steps = [`Shape 1 → shape 2: ${t.desc}. No other single rotation or flip produces shape 2.`, `Applying the same move to shape 3 gives the answer.`];
      hints = ['Work out exactly what happened between the first two shapes before looking at the options.', 'Is it a turn or a flip? Check whether the shape’s handedness changed.', `It ${t.id.startsWith('r') ? 'is a rotation' : 'is a reflection'}.`];
    }
    if (distractors.length < nOpts - 1) reject('not enough distinct distractors');
    // Exactly-one check
    const isCorrect = (c: Cell[]) => (mode === 'rotate' ? rotationKeys(base).has(polyKey(c)) : polyKey(c) === polyKey(correct));
    if (distractors.some((d) => isCorrect(d.cells))) reject('a distractor is also correct');
    const built = buildChoices(
      { key: polyKey(correct), visual: vis(correct) },
      distractors.map((d) => ({ key: polyKey(d.cells), visual: vis(d.cells), reason: d.reason })),
      rng,
    );
    return {
      title: mode === 'rotate' ? 'Mental rotation' : mode === 'mirror' ? 'Mirror image' : mode === 'compose' ? 'Combined moves' : 'Spatial analogy',
      prompt,
      display: { blocks: display.length === 1 ? [{ type: 'visual', visual: display[0], size: 'md', caption: 'Original shape' }] : [{ type: 'sequence', items: [...display, null] }] },
      interaction: { type: 'choice', choices: built.choices, columns: nOpts },
      answer: { type: 'choice', correct: built.correctId },
      hints,
      explanation: {
        answer: `Option ${built.correctLabel}.`,
        answerVisual: vis(correct),
        rule,
        steps,
        alternatives: built.alternatives,
        skills: mode === 'mirror' ? ['spatial visualisation', 'mental rotation'] : ['mental rotation', 'spatial visualisation'],
      },
      metrics: { rules: ops.length, steps: ops.length + (difficulty >= 3 ? 1 : 0), choices: nOpts },
      fingerprint: {
        structure: `rot|${mode}|${size}`,
        features: [`mode:${mode}`, ...ops.map((o) => `op:${o}`), `cells:${size}`],
        detail: `${polyKey(base)}|${ops.join(',')}`,
      },
      hidden: { mode, base, ops } satisfies RotHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as RotHidden;
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const cellsOf = (v?: Visual) => (v?.kind === 'cells' ? v.layers[0].cells : null);
    const ok = (c: Cell[]) => {
      if (h.mode === 'rotate') return rotationKeys(h.base).has(polyKey(c));
      if (h.mode === 'analogy') {
        const block = p.display.blocks[0];
        if (block.type !== 'sequence') return false;
        const third = cellsOf(block.items[2] ?? undefined);
        return !!third && polyKey(c) === polyKey(byId(h.ops[0]).apply(third));
      }
      return polyKey(c) === polyKey(h.ops.reduce((acc, id) => byId(id).apply(acc), h.base));
    };
    const good = p.interaction.choices.filter((c) => {
      const cells = cellsOf(c.visual);
      return cells && ok(cells);
    });
    if (good.length !== 1 || good[0].id !== p.answer.correct) return [`expected one valid option, found ${good.length}`];
    return [];
  },
};
