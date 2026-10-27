/**
 * Response checking. Structured answers are compared exactly; free text is
 * normalised and compared against explicit accepted answers and alternatives
 * with a small typo tolerance. Anything the system cannot judge reliably is
 * handed back to the player for self-comparison instead of being guessed.
 */
import type { CheckResult, PlayerResponse, Puzzle } from './types';

const STOP_WORDS = new Set(['a', 'an', 'the', 'it', 'its', 'is', 'my', 'your', 'answer', 'i', 'am', 'was', 'of', 'some']);

export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map(stem)
    .join(' ')
    .trim();
}

/** Very small plural stemmer so "keys"/"key" and "boxes"/"box" compare equal. */
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('es') && /(s|x|z|ch|sh)$/.test(w.slice(0, -2))) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** True when `input` matches one of `accepted` after normalisation (tolerating one typo in longer words). */
export function textMatches(input: string, accepted: readonly string[]): boolean {
  const n = normaliseText(input);
  if (!n) return false;
  for (const a of accepted) {
    const m = normaliseText(a);
    if (!m) continue;
    if (n === m) return true;
    if (m.length >= 5 && levenshtein(n, m) <= 1) return true;
    if (m.length >= 9 && levenshtein(n, m) <= 2) return true;
    // Accept the answer embedded in a short phrase ("it's a clock!" → clock), but not a negated one.
    const words = n.split(' ');
    const negated = words.some((w) => ['not', 'no', 'never', 'isnt', 'aint', 'nor'].includes(w));
    if (!negated && words.length <= 4 && (` ${n} `).includes(` ${m} `)) return true;
  }
  return false;
}

export function checkResponse(p: Puzzle, r: PlayerResponse): CheckResult {
  const a = p.answer;
  switch (r.type) {
    case 'choice': {
      if (a.type === 'choice') return result(r.id === a.correct);
      if ((a.type === 'text' || a.type === 'number') && a.fallbackCorrect) return result(r.id === a.fallbackCorrect);
      return result(false);
    }
    case 'multi': {
      if (a.type !== 'multi') return result(false);
      const want = new Set(a.correct);
      const got = new Set(r.ids);
      const hits = [...got].filter((x) => want.has(x)).length;
      const exact = hits === want.size && got.size === want.size;
      return { correct: exact, score: exact ? 1 : Math.max(0, hits - (got.size - hits)) / Math.max(1, want.size) };
    }
    case 'text': {
      if (a.type !== 'text') return result(false);
      return result(textMatches(r.text, [a.canonical, ...a.accepted, ...(a.alternatives ?? [])]));
    }
    case 'number': {
      if (a.type !== 'number') return result(false);
      return result(Math.abs(r.value - a.value) < 1e-9);
    }
    case 'order': {
      if (a.type !== 'order') return result(false);
      const right = a.solution.filter((item, slot) => r.slots[slot] === item).length;
      return { correct: right === a.solution.length, score: right / a.solution.length, detail: `${right} of ${a.solution.length} positions correct` };
    }
    case 'assign': {
      if (a.type !== 'assign') return result(false);
      let right = 0;
      let total = 0;
      a.solution.forEach((row, i) =>
        row.forEach((v, j) => {
          total++;
          if (r.table[i]?.[j] === v) right++;
        }),
      );
      return { correct: right === total, score: right / total, detail: `${right} of ${total} entries correct` };
    }
    case 'cell':
      return result(a.type === 'cell' && a.index === r.index);
    case 'sequence': {
      if (a.type !== 'sequence') return result(false);
      const right = a.items.filter((x, i) => r.items[i] === x).length;
      const exact = right === a.items.length && r.items.length === a.items.length;
      return { correct: exact, score: right / a.items.length, detail: `${right} of ${a.items.length} symbols in the right place` };
    }
    case 'glyphs': {
      if (a.type !== 'glyphs') return result(false);
      const want = new Set(a.indices);
      const hits = r.indices.filter((i) => want.has(i)).length;
      const exact = hits === want.size && r.indices.length === want.size;
      return { correct: exact, score: hits / want.size, detail: `${hits} of ${want.size} found` };
    }
    case 'self': {
      const score = r.verdict === 'match' ? 1 : r.verdict === 'partial' ? 0.5 : 0;
      return { correct: r.verdict === 'match', score, selfAssessed: true };
    }
  }
}

function result(ok: boolean): CheckResult {
  return { correct: ok, score: ok ? 1 : 0 };
}

/** The response a perfect player would give (used by tests and the "reveal" view). */
export function correctResponse(p: Puzzle): PlayerResponse {
  const a = p.answer;
  switch (a.type) {
    case 'choice':
      return { type: 'choice', id: a.correct };
    case 'multi':
      return { type: 'multi', ids: a.correct };
    case 'text':
      return { type: 'text', text: a.canonical };
    case 'number':
      return { type: 'number', value: a.value };
    case 'order':
      return { type: 'order', slots: a.solution.slice() };
    case 'assign':
      return { type: 'assign', table: a.solution.map((r) => r.slice()) };
    case 'cell':
      return { type: 'cell', index: a.index };
    case 'sequence':
      return { type: 'sequence', items: a.items.slice() };
    case 'glyphs':
      return { type: 'glyphs', indices: a.indices.slice() };
    case 'self':
      return { type: 'self', text: a.model, verdict: 'match' };
  }
}

/** A definitely-wrong response, or null when every response is self-assessed. */
export function wrongResponse(p: Puzzle): PlayerResponse | null {
  const a = p.answer;
  const it = p.interaction;
  switch (a.type) {
    case 'choice': {
      const choices = it.type === 'choice' || it.type === 'investigation' ? it.choices : [];
      const w = choices.find((c) => c.id !== a.correct);
      return w ? { type: 'choice', id: w.id } : null;
    }
    case 'multi':
      return { type: 'multi', ids: a.correct.slice(1) };
    case 'text':
      return { type: 'text', text: 'zzqx qqvz' };
    case 'number':
      return { type: 'number', value: a.value + 1 };
    case 'order':
      return { type: 'order', slots: [...a.solution.slice(1), a.solution[0]] };
    case 'assign': {
      const opts = it.type === 'assign' ? it.columns[0].options.length : 2;
      const table = a.solution.map((r) => r.slice());
      table[0][0] = (table[0][0] + 1) % opts;
      return { type: 'assign', table };
    }
    case 'cell':
      return { type: 'cell', index: a.index === 0 ? 1 : 0 };
    case 'sequence': {
      const palette = it.type === 'sequence' ? it.palette.map((x) => x.id) : [];
      const other = palette.find((id) => id !== a.items[0]) ?? 'nope';
      return { type: 'sequence', items: [other, ...a.items.slice(1)] };
    }
    case 'glyphs':
      return { type: 'glyphs', indices: a.indices.map((i) => i + 1000) };
    case 'self':
      return null;
  }
}
