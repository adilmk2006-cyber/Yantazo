/** Polyomino helpers shared by the spatial generators. */
import type { Rng } from '../rng';

export type Cell = [number, number];

export function normalize(cells: readonly Cell[]): Cell[] {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function polyKey(cells: readonly Cell[]): string {
  return normalize(cells)
    .map(([x, y]) => `${x},${y}`)
    .join(';');
}

/** 90° clockwise on screen (y grows downward). */
export function rotateCW(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map(([x, y]) => [-y, x] as Cell));
}

export function rotateTimes(cells: readonly Cell[], k: number): Cell[] {
  let c = normalize(cells);
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) c = rotateCW(c);
  return c;
}

/** Mirror left ↔ right. */
export function mirrorH(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map(([x, y]) => [-x, y] as Cell));
}

export function rotationKeys(cells: readonly Cell[]): Set<string> {
  return new Set([0, 1, 2, 3].map((k) => polyKey(rotateTimes(cells, k))));
}

export function isChiral(cells: readonly Cell[]): boolean {
  return !rotationKeys(cells).has(polyKey(mirrorH(cells)));
}

export function hasRotationalSymmetry(cells: readonly Cell[]): boolean {
  return rotationKeys(cells).size < 4;
}

export function bounds(cells: readonly Cell[]): { w: number; h: number } {
  return { w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1 };
}

/** Random connected polyomino grown cell by cell. */
export function randomPolyomino(rng: Rng, size: number, maxW = 4, maxH = 4): Cell[] {
  const cells: Cell[] = [[0, 0]];
  const has = (x: number, y: number) => cells.some((c) => c[0] === x && c[1] === y);
  let guard = 0;
  while (cells.length < size && guard++ < 500) {
    const [x, y] = rng.pick(cells);
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]);
    const nx = x + dx;
    const ny = y + dy;
    if (has(nx, ny)) continue;
    const trial = normalize([...cells, [nx, ny]]);
    const b = bounds(trial);
    if (b.w > maxW || b.h > maxH) continue;
    cells.push([nx, ny]);
  }
  return normalize(cells);
}

export function isConnected(cells: readonly Cell[]): boolean {
  if (cells.length === 0) return false;
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set<string>([`${cells[0][0]},${cells[0][1]}`]);
  const stack: Cell[] = [cells[0]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === set.size;
}

/** Moves one cell to another free spot while keeping the shape connected and the same size. */
export function nearMiss(rng: Rng, cells: readonly Cell[]): Cell[] | null {
  for (let t = 0; t < 40; t++) {
    const idx = rng.int(0, cells.length - 1);
    const rest = cells.filter((_, i) => i !== idx);
    const [x, y] = rng.pick(rest);
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]);
    const cand: Cell = [x + dx, y + dy];
    if (cells.some((c) => c[0] === cand[0] && c[1] === cand[1])) continue;
    const shape = [...rest, cand];
    if (!isConnected(shape)) continue;
    const norm = normalize(shape);
    if (rotationKeys(cells).has(polyKey(norm)) || rotationKeys(mirrorH(cells)).has(polyKey(norm))) continue;
    return norm;
  }
  return null;
}
