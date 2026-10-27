/**
 * Deterministic pseudo-random number generation.
 *
 * Every puzzle is built from a single string seed. The same seed, generator
 * id, generator version and difficulty always reproduce the same puzzle, so
 * saved puzzles only need to store those four values.
 */

/** cyrb53-style string hash folded to an unsigned 32-bit integer. */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Short base-36 hash, convenient for fingerprints and ids. */
export function shortHash(str: string): string {
  return hashString(str).toString(36).padStart(7, '0');
}

export interface Rng {
  readonly seed: string;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Returns a shuffled copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** k distinct items in random order. */
  sample<T>(items: readonly T[], k: number): T[];
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Independent deterministic sub-stream. */
  fork(label: string): Rng;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const gen = mulberry32(hashString(seed));
  const rng: Rng = {
    seed,
    next: gen,
    int(min, max) {
      return min + Math.floor(gen() * (max - min + 1));
    },
    chance(p) {
      return gen() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() from empty list');
      return items[Math.floor(gen() * items.length)];
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample(items, k) {
      return rng.shuffle(items).slice(0, Math.max(0, Math.min(k, items.length)));
    },
    weighted(items, weights) {
      let total = 0;
      for (const w of weights) total += Math.max(0, w);
      if (total <= 0) return rng.pick(items);
      let r = gen() * total;
      for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, weights[i]);
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
    fork(label) {
      return createRng(`${seed}/${label}`);
    },
  };
  return rng;
}

const SEED_ALPHABET = '0123456789abcdefghijkmnpqrstuvwxyz';

/** Non-deterministic seed for new puzzles (crypto when available). */
export function randomSeed(length = 10): string {
  const bytes = new Uint8Array(length);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (const b of bytes) s += SEED_ALPHABET[b % SEED_ALPHABET.length];
  return s;
}
