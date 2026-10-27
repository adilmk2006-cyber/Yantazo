/**
 * Cube-net geometry. All 11 nets are found by enumerating hexominoes and
 * "rolling" a cube across each one: a hexomino is a net exactly when the
 * rolling stamps six different faces (and it has no 2×2 block).
 */
import type { Cell } from './poly';
import { normalize, polyKey, rotateTimes, mirrorH } from './poly';

interface Orientation {
  top: number;
  bottom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Body-frame outward normals of the six faces. 0 bottom,1 top,2 north,3 south,4 east,5 west. */
export const NORMALS: [number, number, number][] = [
  [0, 0, -1],
  [0, 0, 1],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
];

export const opposite = (f: number) => (f % 2 === 0 ? f + 1 : f - 1);

function roll(o: Orientation, dx: number, dy: number): Orientation {
  if (dx === 1) return { ...o, bottom: o.east, east: o.top, top: o.west, west: o.bottom };
  if (dx === -1) return { ...o, bottom: o.west, west: o.top, top: o.east, east: o.bottom };
  if (dy === 1) return { ...o, bottom: o.south, south: o.top, top: o.north, north: o.bottom };
  return { ...o, bottom: o.north, north: o.top, top: o.south, south: o.bottom };
}

/** Face id stamped on each cell (same order as `cells`), or null if not a net. */
export function foldNet(cells: readonly Cell[]): number[] | null {
  const idx = new Map(cells.map((c, i) => [`${c[0]},${c[1]}`, i]));
  const faces = new Array<number>(cells.length).fill(-1);
  const start: Orientation = { bottom: 0, top: 1, north: 2, south: 3, east: 4, west: 5 };
  const queue: [number, Orientation][] = [[0, start]];
  faces[0] = start.bottom;
  while (queue.length) {
    const [i, o] = queue.shift()!;
    const [x, y] = cells[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = idx.get(`${x + dx},${y + dy}`);
      if (j === undefined || faces[j] !== -1) continue;
      const next = roll(o, dx, dy);
      faces[j] = next.bottom;
      queue.push([j, next]);
    }
  }
  if (faces.some((f) => f < 0) || new Set(faces).size !== 6) return null;
  return faces;
}

function has2x2(cells: readonly Cell[]): boolean {
  const s = new Set(cells.map((c) => `${c[0]},${c[1]}`));
  return cells.some(([x, y]) => s.has(`${x + 1},${y}`) && s.has(`${x},${y + 1}`) && s.has(`${x + 1},${y + 1}`));
}

let NETS: Cell[][] | null = null;

/** Every fixed orientation of the 11 cube nets. */
export function allNets(): Cell[][] {
  if (NETS) return NETS;
  let level = new Map<string, Cell[]>([['0,0', [[0, 0]]]]);
  for (let size = 1; size < 6; size++) {
    const next = new Map<string, Cell[]>();
    for (const poly of level.values())
      for (const [x, y] of poly)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (poly.some((c) => c[0] === x + dx && c[1] === y + dy)) continue;
          const grown = normalize([...poly, [x + dx, y + dy]]);
          next.set(polyKey(grown), grown);
        }
    level = next;
  }
  NETS = [...level.values()].filter((p) => !has2x2(p) && foldNet(p) !== null);
  return NETS;
}

/** Number of distinct nets up to rotation and reflection (should be 11). */
export function freeNetCount(): number {
  const seen = new Set<string>();
  for (const net of allNets()) {
    const forms = [0, 1, 2, 3].flatMap((k) => [polyKey(rotateTimes(net, k)), polyKey(rotateTimes(mirrorH(net), k))]);
    seen.add(forms.sort()[0]);
  }
  return seen.size;
}

function det(a: number[], b: number[], c: number[]): number {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

/**
 * Can faces (left, right, top) be seen together around one corner of the
 * folded cube in that arrangement? They must be mutually adjacent and run
 * anticlockwise left → right → top when viewed from outside.
 */
export function isValidView(left: number, right: number, top: number): boolean {
  const fs = [left, right, top];
  if (new Set(fs).size !== 3) return false;
  for (const a of fs) for (const b of fs) if (a !== b && opposite(a) === b) return false;
  return det(NORMALS[left], NORMALS[right], NORMALS[top]) > 0;
}

/** All valid (left, right, top) views. */
export function validViews(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) if (isValidView(a, b, c)) out.push([a, b, c]);
  return out;
}
