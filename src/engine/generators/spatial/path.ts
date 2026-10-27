/**
 * Grid navigation and relative orientation: follow movement instructions and
 * click the final square. The trace is simulated exactly; common slips
 * (mixing up left and right, ignoring "turn around") are reported.
 */
import type { GeneratorDef } from '../../generator';
import type { Puzzle, Visual } from '../../types';
import type { Rng } from '../../rng';
import { LETTERS, reject } from '../../util';

type Dir = 0 | 1 | 2 | 3; // N E S W
const DIR_NAMES = ['north', 'east', 'south', 'west'];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

type Step = { kind: 'F'; n: number } | { kind: 'B'; n: number } | { kind: 'L' } | { kind: 'R' } | { kind: 'U' };

function stepText(s: Step): string {
  switch (s.kind) {
    case 'F':
      return `Move forward ${s.n} square${s.n > 1 ? 's' : ''}`;
    case 'B':
      return `Step backward ${s.n} square${s.n > 1 ? 's' : ''} (without turning)`;
    case 'L':
      return 'Turn left';
    case 'R':
      return 'Turn right';
    case 'U':
      return 'Turn around';
  }
}

interface SimResult {
  path: [number, number][];
  facing: Dir;
  ok: boolean;
  trace: string[];
}

function cellName(x: number, y: number): string {
  return `${LETTERS[x]}${y + 1}`;
}

function simulate(steps: Step[], start: [number, number], facing: Dir, cols: number, rows: number, blocked: Set<string>, swapLR = false, ignoreU = false): SimResult {
  let [x, y] = start;
  let f = facing;
  const path: [number, number][] = [[x, y]];
  const trace: string[] = [];
  let ok = true;
  for (const s of steps) {
    if (s.kind === 'L' || s.kind === 'R') {
      const right = (s.kind === 'R') !== swapLR;
      f = ((f + (right ? 1 : 3)) % 4) as Dir;
      trace.push(`${stepText(s)} → now facing ${DIR_NAMES[f]}.`);
    } else if (s.kind === 'U') {
      if (!ignoreU) f = ((f + 2) % 4) as Dir;
      trace.push(`Turn around → now facing ${DIR_NAMES[f]}.`);
    } else {
      const sign = s.kind === 'F' ? 1 : -1;
      for (let i = 0; i < s.n; i++) {
        x += sign * DX[f];
        y += sign * DY[f];
        if (x < 0 || y < 0 || x >= cols || y >= rows || blocked.has(`${x},${y}`)) ok = false;
        path.push([x, y]);
      }
      trace.push(`${stepText(s)} → at ${ok ? cellName(x, y) : 'an invalid square'}.`);
    }
  }
  return { path, facing: f, ok, trace };
}

/** Random but always-valid route: moves are capped by the distance to the edge. */
function randomSteps(rng: Rng, n: number, difficulty: number, start: [number, number], facing: Dir, cols: number, rows: number): Step[] {
  const steps: Step[] = [];
  let [x, y] = start;
  let f = facing;
  const room = (dir: Dir) => {
    let k = 0;
    while (true) {
      const nx = x + DX[dir] * (k + 1);
      const ny = y + DY[dir] * (k + 1);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return k;
      k++;
    }
  };
  for (let i = 0; i < n; i++) {
    const last = steps[steps.length - 1];
    const lastWasTurn = !!last && last.kind !== 'F' && last.kind !== 'B';
    const forward = room(f);
    const backward = room(((f + 2) % 4) as Dir);
    const wantMove = lastWasTurn || rng.chance(0.5);
    if (wantMove && (forward > 0 || (difficulty >= 4 && backward > 0))) {
      if (difficulty >= 4 && backward > 0 && (forward === 0 || rng.chance(0.2))) {
        const k = rng.int(1, Math.min(2, backward));
        steps.push({ kind: 'B', n: k });
        x -= DX[f] * k;
        y -= DY[f] * k;
      } else {
        const k = rng.int(1, Math.min(3, forward));
        steps.push({ kind: 'F', n: k });
        x += DX[f] * k;
        y += DY[f] * k;
      }
    } else {
      const opts: Step[] = [{ kind: 'L' }, { kind: 'R' }];
      if (difficulty >= 3) opts.push({ kind: 'U' });
      const t = rng.pick(opts);
      steps.push(t);
      f = ((f + (t.kind === 'R' ? 1 : t.kind === 'L' ? 3 : 2)) % 4) as Dir;
    }
  }
  const last = steps[steps.length - 1];
  if (last.kind !== 'F' && last.kind !== 'B') {
    const forward = room(f);
    if (forward > 0) steps.push({ kind: 'F', n: rng.int(1, Math.min(2, forward)) });
  }
  return steps;
}

interface PathHidden {
  steps: Step[];
  start: [number, number];
  facing: Dir;
  cols: number;
  rows: number;
  blocked: [number, number][];
  [k: string]: unknown;
}

export const spatialPath: GeneratorDef = {
  id: 'spatial.path',
  category: 'spatial',
  version: 1,
  family: 'Grid navigation',
  description: 'Follow turning and movement instructions on a grid and find the end point.',
  weight: 0.9,
  candidates: 5,
  generate({ rng, difficulty }) {
    const size = difficulty === 1 ? 4 : difficulty === 2 ? 5 : difficulty === 3 ? 5 : 6;
    const cols = size;
    const rows = size;
    const nSteps = difficulty === 1 ? 4 : difficulty === 2 ? 6 : difficulty === 3 ? 8 : 10;
    const start: [number, number] = [rng.int(0, cols - 1), rng.int(0, rows - 1)];
    const facing = rng.int(0, 3) as Dir;
    const blocked = new Set<string>();
    const blockedList: [number, number][] = [];
    const steps = randomSteps(rng, nSteps, difficulty, start, facing, cols, rows);
    const truth = simulate(steps, start, facing, cols, rows, blocked);
    if (!truth.ok) reject('walks off the grid');
    const end = truth.path[truth.path.length - 1];
    if (end[0] === start[0] && end[1] === start[1]) reject('ends where it started');
    if (difficulty >= 3) {
      // obstacles off the path make the grid feel like a real floor plan
      const onPath = new Set(truth.path.map(([x, y]) => `${x},${y}`));
      for (let t = 0; t < 30 && blockedList.length < difficulty; t++) {
        const c: [number, number] = [rng.int(0, cols - 1), rng.int(0, rows - 1)];
        const k = `${c[0]},${c[1]}`;
        if (onPath.has(k) || blocked.has(k)) continue;
        blocked.add(k);
        blockedList.push(c);
      }
    }
    const turns = steps.filter((s) => s.kind === 'L' || s.kind === 'R').length;
    const mistakes: { label: string; reason: string }[] = [];
    if (turns) {
      const swapped = simulate(steps, start, facing, cols, rows, new Set(), true);
      const e = swapped.path[swapped.path.length - 1];
      if (swapped.ok && (e[0] !== end[0] || e[1] !== end[1])) mistakes.push({ label: `Ending at ${cellName(e[0], e[1])}`, reason: 'comes from mixing up left and right. Turns are relative to the direction the walker is currently facing, not to the page.' });
    }
    if (steps.some((s) => s.kind === 'U')) {
      const ign = simulate(steps, start, facing, cols, rows, new Set(), false, true);
      const e = ign.path[ign.path.length - 1];
      if (ign.ok && (e[0] !== end[0] || e[1] !== end[1])) mistakes.push({ label: `Ending at ${cellName(e[0], e[1])}`, reason: 'comes from ignoring a "turn around" instruction.' });
    }
    const withoutLast = simulate(steps.slice(0, -1), start, facing, cols, rows, new Set());
    const wl = withoutLast.path[withoutLast.path.length - 1];
    if (wl[0] !== end[0] || wl[1] !== end[1]) mistakes.push({ label: `Ending at ${cellName(wl[0], wl[1])}`, reason: 'means the final move was skipped.' });

    const base: Visual = { kind: 'path-grid', rows, cols, start, facing, blocked: blockedList, labels: true };
    const solved: Visual = { ...base, path: truth.path, end };
    const compass = difficulty >= 2 ? `Start facing ${DIR_NAMES[facing]}.` : '';
    return {
      title: 'Follow the route',
      prompt: `A walker starts on the marked square, facing the direction of the arrow (north is up). ${compass} Follow the instructions in order, then click the square where the walker ends.`,
      display: {
        blocks: [{ type: 'list', ordered: true, title: 'Instructions', items: steps.map((s) => stepText(s) + '.') }, ...(blockedList.length ? [{ type: 'text' as const, tone: 'note' as const, text: 'Dark squares are pillars; the route never passes through them.' }] : [])],
      },
      interaction: { type: 'cell', base, rows, cols },
      answer: { type: 'cell', index: end[1] * cols + end[0] },
      hints: [
        'Keep track of the direction the walker faces after every turn — left and right are relative to that direction.',
        `After the first ${Math.min(3, steps.length)} instructions the walker is facing ${DIR_NAMES[simulate(steps.slice(0, Math.min(3, steps.length)), start, facing, cols, rows, new Set()).facing]}.`,
        (() => {
          for (const frac of [0.5, 0.34, 0.67]) {
            const k = Math.max(1, Math.round(steps.length * frac));
            const h = simulate(steps.slice(0, k), start, facing, cols, rows, new Set());
            const at = h.path[h.path.length - 1];
            if (at[0] !== end[0] || at[1] !== end[1]) return `After instruction ${k}, the walker is at ${cellName(at[0], at[1])}, facing ${DIR_NAMES[h.facing]}.`;
          }
          return 'Trace the route with your finger, one instruction at a time.';
        })(),
      ],
      explanation: {
        answer: `Square ${cellName(end[0], end[1])}, facing ${DIR_NAMES[truth.facing]}.`,
        answerVisual: solved,
        rule: 'Turns change the facing direction relative to the walker; moves follow the current facing.',
        steps: [`Start at ${cellName(start[0], start[1])} facing ${DIR_NAMES[facing]}.`, ...truth.trace],
        alternatives: mistakes,
        skills: ['spatial visualisation', 'working memory'],
      },
      metrics: { rules: turns + 1, steps: steps.length },
      fingerprint: {
        structure: `path|${size}|${steps.length}|${steps.some((s) => s.kind === 'U') ? 'u' : ''}${steps.some((s) => s.kind === 'B') ? 'b' : ''}`,
        features: [`steps:${steps.length}`, ...new Set(steps.map((s) => `move:${s.kind}`))],
        detail: `${start.join(',')}|${facing}|${steps.map((s) => s.kind + ('n' in s ? s.n : '')).join('')}`,
      },
      hidden: { steps, start, facing, cols, rows, blocked: blockedList } satisfies PathHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as PathHidden;
    const sim = simulate(h.steps, h.start, h.facing, h.cols, h.rows, new Set(h.blocked.map((c) => `${c[0]},${c[1]}`)));
    if (!sim.ok) return ['route invalid'];
    const end = sim.path[sim.path.length - 1];
    if (p.answer.type !== 'cell' || p.answer.index !== end[1] * h.cols + end[0]) return ['end cell mismatch'];
    return [];
  },
};
