/**
 * Shape decomposition / assembly: a rectangle with a missing region; which
 * piece (turned but not flipped) fills it exactly? Fitting is checked by
 * trying every rotation and placement.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle, Visual } from '../../types';
import type { Cell } from '../../spatial/poly';
import { bounds, isChiral, mirrorH, nearMiss, normalize, polyKey, randomPolyomino, rotateTimes, rotationKeys } from '../../spatial/poly';
import { reject } from '../../util';

function fits(piece: Cell[], hole: Cell[]): boolean {
  const target = polyKey(hole);
  return rotationKeys(piece).has(target);
}

function vis(cells: Cell[]): Visual {
  const b = bounds(cells);
  return { kind: 'cells', w: b.w, h: b.h, frame: 4, gridLines: true, layers: [{ cells, style: 'accent' }] };
}

interface AsmHidden {
  hole: Cell[];
  [k: string]: unknown;
}

export const spatialAssembly: GeneratorDef = {
  id: 'spatial.assembly',
  category: 'spatial',
  version: 1,
  family: 'Shape assembly',
  description: 'Find the piece that completes a shape (rotation allowed, flipping not).',
  weight: 0.9,
  candidates: 5,
  generate({ rng, difficulty }) {
    const [W, H] = difficulty === 1 ? [3, 3] : difficulty === 2 ? [4, 3] : difficulty === 3 ? [4, 4] : [5, 4];
    const size = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5;
    // grow the missing region inside the rectangle (chiral pieces make mirror images a real trap)
    let piece = randomPolyomino(rng, size, Math.min(W, 4), Math.min(H, 4));
    for (let t = 0; t < 20 && difficulty >= 2 && !isChiral(piece); t++) piece = randomPolyomino(rng, size, Math.min(W, 4), Math.min(H, 4));
    const pb = bounds(piece);
    if (pb.w > W || pb.h > H) reject('piece too large');
    const ox = rng.int(0, W - pb.w);
    const oy = rng.int(0, H - pb.h);
    const hole: Cell[] = piece.map(([x, y]) => [x + ox, y + oy]);
    const holeSet = new Set(hole.map(([x, y]) => `${x},${y}`));
    const rest: Cell[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!holeSet.has(`${x},${y}`)) rest.push([x, y]);
    if (difficulty >= 2 && !isChiral(piece)) reject('want a chiral piece so mirror images are a real trap');
    const nOpts = difficulty === 1 ? 4 : 5;
    const holeNorm = normalize(hole);
    const distractors: { cells: Cell[]; why: string }[] = [];
    const seen = new Set<string>([...rotationKeys(holeNorm)]);
    const add = (c: Cell[] | null, why: string) => {
      if (!c || distractors.length >= nOpts - 1) return;
      const keys = rotationKeys(c);
      if ([...keys].some((k) => seen.has(k))) return;
      for (const k of keys) seen.add(k);
      distractors.push({ cells: rotateTimes(c, rng.int(0, 3)), why });
    };
    if (isChiral(piece)) add(mirrorH(piece), 'This is the mirror image of the gap. It would only fit if it were flipped over, which is not allowed.');
    for (let t = 0; t < 12; t++) add(nearMiss(rng, piece), 'It has the right number of squares, but one square sticks out in the wrong place.');
    for (let t = 0; t < 12; t++) add(randomPolyomino(rng, size + (rng.chance(0.5) ? 1 : -1), 4, 4), 'It has the wrong number of squares to fill the gap.');
    if (distractors.length < nOpts - 1) reject('not enough distractors');
    const shown = rotateTimes(piece, rng.int(1, 3));
    const built = buildChoices(
      { key: polyKey(shown), visual: vis(shown) },
      distractors.map((d) => ({ key: polyKey(d.cells), visual: vis(d.cells), reason: d.why })),
      rng,
    );
    const board: Visual = { kind: 'cells', w: W, h: H, gridLines: true, layers: [{ cells: rest, style: 'solid' }, { cells: hole, style: 'ghost' }] };
    return {
      title: 'Complete the shape',
      prompt: `Which piece fills the dashed gap to complete the ${W}×${H} rectangle? Pieces may be turned but not flipped over.`,
      display: { blocks: [{ type: 'visual', visual: board, size: 'md' }] },
      interaction: { type: 'choice', choices: built.choices, columns: nOpts },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        `Count the squares in the gap first: there are ${hole.length}.`,
        'Look at the outline of the gap: where does it have a notch or a corner step?',
        'Mirror-image pieces have the same squares but the wrong handedness — they cannot be turned into the gap’s shape.',
      ],
      explanation: {
        answer: `Option ${built.correctLabel}.`,
        answerVisual: vis(holeNorm),
        rule: 'The correct piece matches the gap exactly after turning it; every other option needs flipping, has a square out of place, or has the wrong size.',
        steps: [`The gap is made of ${hole.length} squares.`, `Option ${built.correctLabel}, turned into the right orientation, covers every square of the gap and nothing else.`],
        alternatives: built.alternatives,
        skills: ['spatial visualisation', 'mental rotation'],
      },
      metrics: { rules: 1, steps: 2 + (difficulty >= 3 ? 1 : 0), choices: nOpts },
      fingerprint: { structure: `asm|${W}x${H}|${size}`, features: [`board:${W}x${H}`, `piece:${size}`], detail: polyKey(hole) + `@${ox},${oy}` },
      hidden: { hole } satisfies AsmHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as AsmHidden;
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const ok = p.interaction.choices.filter((c) => c.visual?.kind === 'cells' && fits(c.visual.layers[0].cells, h.hole));
    if (ok.length !== 1 || ok[0].id !== p.answer.correct) return [`expected exactly one fitting piece, found ${ok.length}`];
    return [];
  },
};
