/** "How many squares / rectangles?" counting puzzles on generated grids. */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Cell } from '../../spatial/poly';
import { isConnected } from '../../spatial/poly';
import { range, reject } from '../../util';

export function countShapes(cells: Cell[], W: number, H: number, squaresOnly: boolean): Map<string, number> {
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  const out = new Map<string, number>();
  for (let h = 1; h <= H; h++)
    for (let w = 1; w <= W; w++) {
      if (squaresOnly && w !== h) continue;
      let c = 0;
      for (let y = 0; y + h <= H; y++)
        for (let x = 0; x + w <= W; x++) {
          let full = true;
          for (let dy = 0; dy < h && full; dy++) for (let dx = 0; dx < w && full; dx++) if (!has.has(`${x + dx},${y + dy}`)) full = false;
          if (full) c++;
        }
      if (c) out.set(`${w}×${h}`, c);
    }
  return out;
}

interface SqHidden {
  cells: Cell[];
  W: number;
  H: number;
  squaresOnly: boolean;
  [k: string]: unknown;
}

export const riddleSquares: GeneratorDef = {
  id: 'riddle.squares',
  category: 'riddle',
  version: 1,
  family: 'Counting figures',
  description: 'Count every square or rectangle hidden in a grid figure.',
  weight: 0.8,
  candidates: 5,
  generate({ rng, difficulty }) {
    const [W, H] = difficulty === 1 ? rng.pick([[2, 2], [3, 2], [2, 3], [3, 3]]) : difficulty === 2 ? rng.pick([[3, 3], [4, 2], [2, 4], [3, 2]]) : difficulty === 3 ? rng.pick([[4, 3], [3, 4], [3, 3]]) : rng.pick([[4, 4], [5, 3], [4, 3], [3, 5]]);
    const squaresOnly = difficulty === 1 ? W * H > 6 || rng.chance(0.6) : difficulty === 2 ? rng.chance(0.6) : difficulty === 3 ? rng.chance(0.5) : W * H > 12;
    const all: Cell[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) all.push([x, y]);
    const missingCount = difficulty === 1 ? 0 : difficulty === 2 ? rng.int(0, 1) : difficulty === 3 ? rng.int(0, 2) : rng.int(1, 2);
    const missing = rng.sample(all, missingCount);
    const cells = all.filter((c) => !missing.includes(c));
    if (!isConnected(cells)) reject('figure falls apart');
    const counts = countShapes(cells, W, H, squaresOnly);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const unit = counts.get('1×1') ?? 0;
    const what = squaresOnly ? 'squares' : 'rectangles (squares count as rectangles too)';
    const largestMissed = total - ([...counts.entries()].pop()?.[1] ?? 0);
    const traps = [
      { v: unit, why: `that counts only the small single squares` },
      { v: largestMissed, why: 'that forgets the largest shape(s)' },
      { v: total + 1, why: 'this counts one shape that is not complete' },
      { v: total - 1, why: 'one shape is missing from the count' },
      { v: total + 2, why: 'some shapes have been counted twice' },
      { v: unit * 2, why: 'doubling the small squares does not match how larger shapes are formed' },
    ];
    const seen = new Set([total]);
    const d = traps.filter((t) => t.v > 0 && !seen.has(t.v) && (seen.add(t.v), true)).slice(0, 3);
    if (d.length < 3) reject('not enough distractors');
    const built = buildChoices({ key: String(total), text: String(total) }, d.map((t) => ({ key: String(t.v), text: String(t.v), reason: `${t.v}: ${t.why}.` })), rng);
    const breakdown = [...counts.entries()].map(([k, v]) => `${k}: ${v}`);
    return {
      title: squaresOnly ? 'How many squares?' : 'How many rectangles?',
      prompt: `How many ${what} of any size can you find in this figure?`,
      display: { blocks: [{ type: 'visual', visual: { kind: 'cells', w: W, h: H, gridLines: true, layers: [{ cells, style: 'outline' }] }, size: 'md' }] },
      interaction: { type: 'number', placeholder: 'Count', fallback: built.choices },
      answer: { type: 'number', value: total, fallbackCorrect: built.correctId },
      hints: ['Count by size: first the smallest, then larger ones made of several small cells.', `There are ${unit} of the smallest size.`, `List every size from 1×1 up to ${squaresOnly ? `${Math.min(W, H)}×${Math.min(W, H)}` : `${W}×${H}`} and count each separately.`],
      explanation: {
        answer: `${total}`,
        rule: `Count each size separately and add: ${breakdown.join(', ')}.`,
        steps: [...breakdown.map((b) => `${b.replace(':', ' shapes:')}`), `Total: ${total}.`],
        alternatives: built.alternatives,
        skills: ['visual attention', 'numerical reasoning', 'spatial visualisation'],
      },
      metrics: { rules: 1, steps: counts.size, choices: 4 },
      fingerprint: { structure: `count|${squaresOnly ? 'sq' : 'rect'}|${W}x${H}|${missingCount}`, features: [squaresOnly ? 'count:squares' : 'count:rectangles', `missing:${missingCount}`], detail: JSON.stringify(missing) },
      hidden: { cells, W, H, squaresOnly } satisfies SqHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as SqHidden;
    const total = [...countShapes(h.cells, h.W, h.H, h.squaresOnly).values()].reduce((a, b) => a + b, 0);
    // independent brute force over all corner pairs
    const has = new Set(h.cells.map(([x, y]) => `${x},${y}`));
    let brute = 0;
    for (const x1 of range(h.W)) for (const y1 of range(h.H)) for (const x2 of range(h.W)) for (const y2 of range(h.H)) {
      if (x2 < x1 || y2 < y1) continue;
      if (h.squaresOnly && x2 - x1 !== y2 - y1) continue;
      let ok = true;
      for (let x = x1; x <= x2 && ok; x++) for (let y = y1; y <= y2 && ok; y++) if (!has.has(`${x},${y}`)) ok = false;
      if (ok) brute++;
    }
    if (brute !== total || p.answer.type !== 'number' || p.answer.value !== total) return ['count mismatch'];
    return [];
  },
};
