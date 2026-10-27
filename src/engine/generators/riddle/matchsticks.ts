/**
 * Matchstick equations. Digits are seven-segment figures; "+" is two sticks
 * and "−" one. Starting from a true equation, one stick is moved to make a
 * false one; every possible single move from the shown equation is then
 * enumerated, and the puzzle is kept only if exactly one move makes it true.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { reject } from '../../util';

/** Segment bit order: a b c d e f g (top, top-right, bottom-right, bottom, bottom-left, top-left, middle). */
export const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '+': 'hv',
  '-': 'h',
};

const SEG_NAMES: Record<string, string> = {
  a: 'top',
  b: 'upper-right',
  c: 'lower-right',
  d: 'bottom',
  e: 'lower-left',
  f: 'upper-left',
  g: 'middle',
  h: 'horizontal',
  v: 'vertical',
};

const BY_SEGS = new Map(Object.entries(DIGIT_SEGMENTS).map(([ch, segs]) => [segs.split('').sort().join(''), ch]));

function charFor(segs: Set<string>, isOp: boolean): string | null {
  const key = [...segs].sort().join('');
  const ch = BY_SEGS.get(key);
  if (!ch) return null;
  if (isOp !== (ch === '+' || ch === '-')) return null;
  return ch;
}

export function evaluate(eq: string): boolean {
  const m = eq.match(/^(\d+)([+-])(\d+)=(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const c = Number(m[4]);
  if (/^0\d/.test(m[1]) || /^0\d/.test(m[3]) || /^0\d/.test(m[4])) return false;
  return (m[2] === '+' ? a + b : a - b) === c;
}

export interface Move {
  from: number;
  seg: string;
  to: number;
  seg2: string;
  result: string;
}

/** Every equation reachable by moving exactly one stick (the "=" stays put). */
export function singleMoves(eq: string): Move[] {
  const chars = eq.split('');
  const out: Move[] = [];
  chars.forEach((ch, i) => {
    if (ch === '=') return;
    const segs = new Set(DIGIT_SEGMENTS[ch]);
    for (const s of segs) {
      const rem = new Set(segs);
      rem.delete(s);
      const isOpI = ch === '+' || ch === '-';
      // removing the only stick of "-" would leave nothing — not allowed
      const afterRemove = rem.size ? charFor(rem, isOpI) : null;
      if (!afterRemove) continue;
      chars.forEach((ch2, j) => {
        if (ch2 === '=') return;
        const base = j === i ? rem : new Set(DIGIT_SEGMENTS[ch2]);
        const isOpJ = ch2 === '+' || ch2 === '-';
        const pool = isOpJ ? ['h', 'v'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        for (const t of pool) {
          if (base.has(t)) continue;
          if (j === i && t === s) continue;
          const added = new Set(base);
          added.add(t);
          const newJ = charFor(added, isOpJ);
          if (!newJ) continue;
          const res = chars.slice();
          res[i] = afterRemove;
          res[j] = newJ; // when j === i this overwrites the removal with the re-placed stick
          out.push({ from: i, seg: s, to: j, seg2: t, result: res.join('') });
        }
      });
    }
  });
  return out;
}

function pretty(eq: string): string {
  return eq.replace('-', ' − ').replace('+', ' + ').replace('=', ' = ');
}

function randomTrue(rng: Rng, difficulty: number): string {
  for (let t = 0; t < 100; t++) {
    const plus = rng.chance(0.55);
    const maxA = difficulty >= 4 ? 30 : 9;
    const a = rng.int(0, maxA);
    const b = rng.int(0, 9);
    const c = plus ? a + b : a - b;
    if (c < 0) continue;
    if (difficulty <= 2 && c > 9) continue;
    if (difficulty === 3 && (c < 10 || c > 19) && rng.chance(0.7)) continue;
    return `${a}${plus ? '+' : '-'}${b}=${c}`;
  }
  return '3+5=8';
}

function describeMove(eq: string, m: Move): string {
  const posName = (i: number) => {
    const ch = eq[i];
    if (ch === '+' || ch === '-') return `the ${ch === '+' ? 'plus' : 'minus'} sign`;
    const eqIdx = eq.indexOf('=');
    const opIdx = eq.search(/[+-]/);
    const which = i < opIdx ? 'first number' : i < eqIdx ? 'second number' : 'answer';
    return `the ${ch} in the ${which}`;
  };
  if (m.from === m.to) return `Move the ${SEG_NAMES[m.seg]} stick of ${posName(m.from)} to its ${SEG_NAMES[m.seg2]} position`;
  return `Take the ${SEG_NAMES[m.seg]} stick from ${posName(m.from)} and add it as the ${SEG_NAMES[m.seg2]} stick of ${posName(m.to)}`;
}

interface MatchHidden {
  shown: string;
  solution: string;
  [k: string]: unknown;
}

export const riddleMatchsticks: GeneratorDef = {
  id: 'riddle.matchsticks',
  category: 'riddle',
  version: 1,
  family: 'Matchstick equations',
  description: 'Move exactly one matchstick to make a false equation true.',
  weight: 1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const truth = randomTrue(rng, difficulty);
    const breaking = singleMoves(truth).filter((m) => !evaluate(m.result) && /^\d+[+-]\d+=\d+$/.test(m.result));
    if (!breaking.length) reject('no breaking move');
    const opMove = breaking.filter((m) => truth[m.from] === '+' || truth[m.from] === '-' || truth[m.to] === '+' || truth[m.to] === '-');
    const shownMove = difficulty >= 2 && opMove.length && rng.chance(0.4) ? rng.pick(opMove) : rng.pick(breaking);
    const shown = shownMove.result;
    const fixes = singleMoves(shown).filter((m) => evaluate(m.result));
    const solutions = new Set(fixes.map((m) => m.result));
    if (solutions.size !== 1 || !solutions.has(truth)) reject('not exactly one fixing move');
    const fix = fixes[0];
    // Distractors: one-move results that are false, and true equations needing more moves.
    const falseOnes = [...new Set(singleMoves(shown).map((m) => m.result))].filter((r) => !evaluate(r) && /^\d+[+-]\d+=\d+$/.test(r) && r !== truth);
    const distractors: { eq: string; why: string }[] = [];
    for (const r of rng.shuffle(falseOnes)) {
      if (distractors.length >= 3) break;
      const [l, rr] = r.split('=');
      const val = l.includes('+') ? Number(l.split('+')[0]) + Number(l.split('+')[1]) : Number(l.split('-')[0]) - Number(l.split('-')[1]);
      distractors.push({ eq: r, why: `It can be made with one move, but it is false: ${pretty(l)} = ${val}, not ${rr}.` });
    }
    if (distractors.length < 3) reject('not enough distractors');
    const built = buildChoices(
      { key: truth, text: pretty(truth), visual: { kind: 'matchsticks', text: truth } },
      distractors.map((d) => ({ key: d.eq, text: pretty(d.eq), visual: { kind: 'matchsticks', text: d.eq }, reason: d.why })),
      rng,
    );
    const moveText = describeMove(shown, fix);
    return {
      title: 'Matchstick equation',
      prompt: 'This equation made of matchsticks is wrong. Move exactly ONE matchstick to make it true. (The “=” sign cannot be changed.) Which equation do you get?',
      display: { blocks: [{ type: 'visual', visual: { kind: 'matchsticks', text: shown }, size: 'lg' }] },
      interaction: { type: 'choice', choices: built.choices, columns: 2 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        'A stick can move within the same digit or to a different digit — or turn + into − and back.',
        fix.from === fix.to ? 'The stick stays inside one character; only its position changes.' : truth[fix.to] === '+' || shown[fix.from] === '+' || truth[fix.from] === '-' ? 'Consider changing the operator.' : 'Take a stick from one character and give it to another.',
        `The stick to move comes from ${describeMove(shown, fix).match(/(?:of|from) (the [^ ]+ in the [a-z ]+|the (?:plus|minus) sign)/)?.[1] ?? 'one of the digits'}.`,
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: ${pretty(truth)}.`,
        answerVisual: { kind: 'matchsticks', text: truth },
        rule: `${moveText}: ${pretty(shown)} becomes ${pretty(truth)}.`,
        steps: [`${moveText}.`, `${pretty(shown)} turns into ${pretty(truth)}, which is true.`, `Every other single-stick move was checked by the generator; none of them produces a true equation.`],
        alternatives: built.alternatives,
        skills: ['lateral thinking', 'numerical reasoning', 'visual attention'],
      },
      metrics: { rules: 1, steps: difficulty + 1, choices: 4 },
      fingerprint: {
        structure: `match|${fix.from === fix.to ? 'within' : 'between'}|${/[+-]/.test(shown[fix.from]) || /[+-]/.test(shown[fix.to]) ? 'op' : 'digits'}`,
        features: [fix.from === fix.to ? 'move:within' : 'move:between', /[+-]/.test(shown[fix.from]) || /[+-]/.test(shown[fix.to]) ? 'move:operator' : 'move:digit'],
        detail: `${shown}>${truth}`,
      },
      hidden: { shown, solution: truth } satisfies MatchHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as MatchHidden;
    const sols = new Set(singleMoves(h.shown).filter((m) => evaluate(m.result)).map((m) => m.result));
    if (sols.size !== 1 || !sols.has(h.solution)) return ['not exactly one fix'];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const ok = p.interaction.choices.filter((c) => c.visual?.kind === 'matchsticks' && evaluate(c.visual.text) && sols.has(c.visual.text));
    if (ok.length !== 1 || ok[0].id !== p.answer.correct) return ['answer mismatch'];
    return [];
  },
};
