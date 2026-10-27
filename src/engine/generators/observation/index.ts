/**
 * Observation, attention and memory puzzles. Scenes are generated locally;
 * the answer is always computed from the generated data (diffs are found by
 * comparing scenes, not by trusting the change that was applied).
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Figure, FigureLine, Glyph, Puzzle, ShapeKind, Visual } from '../../types';
import { describeGlyph, glyphKey, shapeInfo, PLAIN_SHAPES, SHADE_NAMES } from '../../visual/shapes';
import { capitalize, listJoin, range, reject } from '../../util';
import type { Change } from './scenes';
import { applyChange, describeChange, randomChange, randomScene, scatter, whereIs } from './scenes';

const fig = (f: Figure): Visual => ({ kind: 'figure', figure: f });

/* ---------------- sequence recall ---------------- */

const RECALL_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'cross', 'hexagon', 'pentagon'];

interface RecallHidden {
  sequence: string[];
  reverse: boolean;
  [k: string]: unknown;
}

export const obsRecall: GeneratorDef = {
  id: 'observation.recall',
  category: 'observation',
  version: 1,
  family: 'Sequence recall',
  description: 'Memorise a sequence of symbols and reproduce it.',
  weight: 1,
  candidates: 4,
  generate({ rng, difficulty }) {
    const L = difficulty === 1 ? 4 : difficulty === 2 ? 6 : difficulty === 3 ? 7 : 9;
    const k = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6;
    const palette = rng.sample(RECALL_SHAPES, k);
    const seq: string[] = [];
    while (seq.length < L) {
      const s = rng.pick(palette);
      if (s !== seq[seq.length - 1]) seq.push(s);
    }
    const reverse = difficulty >= 3 && rng.chance(0.4);
    const answer = reverse ? seq.slice().reverse() : seq;
    const name = (s: string) => shapeInfo(s as ShapeKind).name;
    const chunks: string[] = [];
    for (let i = 0; i < seq.length; i += 3) chunks.push(seq.slice(i, i + 3).map(name).join('–'));
    return {
      title: reverse ? 'Backwards recall' : 'Sequence recall',
      prompt: reverse ? 'Memorise the sequence, then enter it in REVERSE order (last symbol first).' : 'Memorise the sequence, then enter it in the same order.',
      display: {
        memorize: { blocks: [{ type: 'visual', visual: { kind: 'tokens', tokens: seq, style: 'symbol' }, size: 'lg' }], exposureMs: 1500 + 750 * L, instruction: `Memorise these ${L} symbols in order.` },
        blocks: [{ type: 'text', text: reverse ? 'Enter the symbols from last to first.' : 'Enter the symbols from first to last.', tone: 'note' }],
      },
      interaction: { type: 'sequence', palette: palette.map((s) => ({ id: s, name: name(s), visual: { kind: 'tokens', tokens: [s], style: 'symbol' } })), length: L },
      answer: { type: 'sequence', items: answer },
      hints: [`There were ${L} symbols, and no symbol appeared twice in a row.`, `The sequence started with the ${name(seq[0])}.`, `The sequence ended with the ${name(seq[L - 1])}.`],
      explanation: {
        answer: answer.map(name).join(', '),
        answerVisual: { kind: 'tokens', tokens: answer, style: 'symbol' },
        rule: reverse ? 'The sequence entered last-to-first.' : 'The sequence entered in its original order.',
        steps: [`The sequence was: ${seq.map(name).join(', ')}.`, `Grouping it into chunks of three makes it easier to hold: ${chunks.join(' | ')}.`],
        alternatives: [],
        skills: ['working memory', 'visual attention'],
      },
      metrics: { rules: 1, steps: L },
      fingerprint: { structure: `recall|${L}|${reverse ? 'rev' : 'fwd'}`, features: ['memory:sequence', reverse ? 'order:reverse' : 'order:forward'], detail: seq.join(',') },
      hidden: { sequence: seq, reverse } satisfies RecallHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as RecallHidden;
    const want = h.reverse ? h.sequence.slice().reverse() : h.sequence;
    if (p.answer.type !== 'sequence' || p.answer.items.join(',') !== want.join(',')) return ['answer mismatch'];
    return [];
  },
};

/* ---------------- object locations ---------------- */

function gridLines(n: number): FigureLine[] {
  const lines: FigureLine[] = [];
  for (let i = 0; i <= n; i++) {
    const p = (i * 100) / n;
    lines.push({ x1: p, y1: 0, x2: p, y2: 100 }, { x1: 0, y1: p, x2: 100, y2: p });
  }
  return lines;
}

interface LocHidden {
  n: number;
  items: { shape: ShapeKind; shade: number; cell: number }[];
  ask: 'where' | 'which';
  target: number;
  [k: string]: unknown;
}

export const obsLocation: GeneratorDef = {
  id: 'observation.location',
  category: 'observation',
  version: 1,
  family: 'Location memory',
  description: 'Remember where objects were placed on a grid.',
  weight: 1,
  candidates: 4,
  generate({ rng, difficulty }) {
    const n = difficulty === 1 ? 3 : difficulty === 2 ? 4 : difficulty === 3 ? 4 : 5;
    const count = difficulty === 1 ? 3 : difficulty === 2 ? 5 : difficulty === 3 ? 6 : 8;
    const cells = rng.sample(range(n * n), count);
    const shapes = rng.sample(PLAIN_SHAPES, count);
    const items = cells.map((cell, i) => ({ shape: shapes[i], shade: rng.int(0, 3), cell }));
    const center = (cell: number): [number, number] => [((cell % n) + 0.5) * (100 / n), (Math.floor(cell / n) + 0.5) * (100 / n)];
    const glyphFor = (it: (typeof items)[number]): Glyph => {
      const [x, y] = center(it.cell);
      return { shape: it.shape, x, y, r: 30 / n + 2, rot: 0, shade: it.shade };
    };
    const scene: Figure = { glyphs: items.map(glyphFor), lines: gridLines(n) };
    const ask: 'where' | 'which' = rng.chance(0.55) ? 'where' : 'which';
    const target = rng.int(0, count - 1);
    const t = items[target];
    const tName = describeGlyph(glyphFor(t), { orientation: false });
    const col = (c: number) => String.fromCharCode(65 + (c % n));
    const row = (c: number) => Math.floor(c / n) + 1;
    const memorize = { blocks: [{ type: 'visual' as const, visual: fig(scene), size: 'lg' as const }], exposureMs: 2000 + 900 * count, instruction: 'Memorise where each object is.' };
    if (ask === 'where') {
      const base: Visual = fig({ glyphs: [], lines: gridLines(n) });
      return {
        title: 'Where was it?',
        prompt: `Where was the ${tName}? Click its square.`,
        display: { memorize, blocks: [{ type: 'visual', visual: fig(glyphFor(t) ? { glyphs: [{ ...glyphFor(t), x: 50, y: 50, r: 20 }] } : { glyphs: [] }), size: 'sm', caption: 'Find this object' }] },
        interaction: { type: 'cell', base, rows: n, cols: n },
        answer: { type: 'cell', index: t.cell },
        hints: [`It was ${row(t.cell) <= n / 2 ? 'in the top half' : 'in the bottom half'} of the grid.`, `It was in column ${col(t.cell)}.`, `It was in row ${row(t.cell)}.`],
        explanation: {
          answer: `Column ${col(t.cell)}, row ${row(t.cell)}.`,
          answerVisual: fig({ ...scene, glyphs: scene.glyphs.map((g, i) => (i === target ? { ...g, highlight: true } : g)) }),
          rule: 'The highlighted square in the original layout.',
          steps: [`The ${tName} was in column ${col(t.cell)}, row ${row(t.cell)}.`, 'Linking each object to a neighbour (for example "the star is right of the heart") makes layouts easier to remember.'],
          alternatives: [],
          skills: ['working memory', 'observation'],
        },
        metrics: { rules: 1, steps: count },
        fingerprint: { structure: `loc|${n}|where`, features: ['memory:location', 'ask:where', `objects:${count}`], detail: JSON.stringify(items) },
        hidden: { n, items, ask, target } satisfies LocHidden,
      };
    }
    const highlightLines: FigureLine[] = (() => {
      const s = 100 / n;
      const x = (t.cell % n) * s;
      const y = Math.floor(t.cell / n) * s;
      return [
        { x1: x + 2, y1: y + 2, x2: x + s - 2, y2: y + 2, dashed: true },
        { x1: x + s - 2, y1: y + 2, x2: x + s - 2, y2: y + s - 2, dashed: true },
        { x1: x + s - 2, y1: y + s - 2, x2: x + 2, y2: y + s - 2, dashed: true },
        { x1: x + 2, y1: y + s - 2, x2: x + 2, y2: y + 2, dashed: true },
      ];
    })();
    const others = rng.sample(range(count).filter((i) => i !== target), 3);
    const built = buildChoices(
      { key: t.shape, visual: fig({ glyphs: [{ ...glyphFor(t), x: 50, y: 50, r: 22 }] }) },
      others.map((i) => ({
        key: items[i].shape,
        visual: fig({ glyphs: [{ ...glyphFor(items[i]), x: 50, y: 50, r: 22 }] }),
        reason: `The ${describeGlyph(glyphFor(items[i]), { orientation: false })} was in column ${col(items[i].cell)}, row ${row(items[i].cell)}.`,
      })),
      rng,
    );
    return {
      title: 'What was here?',
      prompt: 'Which object was in the outlined square?',
      display: { memorize, blocks: [{ type: 'visual', visual: fig({ glyphs: [], lines: [...gridLines(n), ...highlightLines] }), size: 'lg' }] },
      interaction: { type: 'choice', choices: built.choices, columns: 4 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [`There were ${count} objects on a ${n}×${n} grid.`, `The outlined square is column ${col(t.cell)}, row ${row(t.cell)}.`, `The object there was ${SHADE_NAMES[t.shade]}.`],
      explanation: {
        answer: `Option ${built.correctLabel}: the ${tName}.`,
        answerVisual: fig({ ...scene, glyphs: scene.glyphs.map((g, i) => (i === target ? { ...g, highlight: true } : g)) }),
        rule: 'Recall the object in the outlined square.',
        steps: [`The outlined square (column ${col(t.cell)}, row ${row(t.cell)}) held the ${tName}.`],
        alternatives: built.alternatives,
        skills: ['working memory', 'observation'],
      },
      metrics: { rules: 1, steps: count, choices: 4 },
      fingerprint: { structure: `loc|${n}|which`, features: ['memory:location', 'ask:which', `objects:${count}`], detail: JSON.stringify(items) },
      hidden: { n, items, ask, target } satisfies LocHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as LocHidden;
    if (h.ask === 'where') return p.answer.type === 'cell' && p.answer.index === h.items[h.target].cell ? [] : ['cell mismatch'];
    return [];
  },
};

/* ---------------- spot the difference ---------------- */

/** Differences between two scenes, matched by position. Returns indices into `b`. */
export function sceneDiff(a: Figure, b: Figure): number[] {
  const at = new Map(a.glyphs.map((g) => [`${g.x},${g.y}`, g]));
  const out: number[] = [];
  b.glyphs.forEach((g, i) => {
    const o = at.get(`${g.x},${g.y}`);
    if (!o || glyphKey(o) !== glyphKey(g)) out.push(i);
  });
  return out;
}

interface DiffHidden {
  left: Figure;
  right: Figure;
  [k: string]: unknown;
}

export const obsDifference: GeneratorDef = {
  id: 'observation.difference',
  category: 'observation',
  version: 1,
  family: 'Spot the difference',
  description: 'Compare two scenes and click every difference.',
  weight: 1,
  candidates: 4,
  generate({ rng, difficulty }) {
    const n = difficulty === 1 ? 8 : difficulty === 2 ? 10 : difficulty === 3 ? 12 : 14;
    const k = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3;
    const cols = 5;
    const rows = 4;
    const all = scatter(rng, n + k, cols, rows);
    const base = randomScene(rng, n, cols, rows, 7);
    base.glyphs = base.glyphs.map((g, i) => ({ ...g, x: all[i][0], y: all[i][1] }));
    const free = all.slice(n);
    const kinds: Change['kind'][] = difficulty <= 2 ? ['shape', 'shade', 'add'] : difficulty === 3 ? ['shape', 'shade', 'rotate', 'add'] : ['shade', 'rotate', 'size', 'shade'];
    let right = base;
    const touched = new Set<number>();
    const changes: Change[] = [];
    for (let t = 0; t < 60 && changes.length < k; t++) {
      const c = randomChange(rng, right, kinds, free[changes.length]);
      if (!c) continue;
      if (c.kind !== 'add' && touched.has(c.index)) continue;
      if (c.kind !== 'add') touched.add(c.index);
      changes.push(c);
      right = applyChange(right, c);
    }
    if (changes.length < k) reject('could not place changes');
    // shuffle the right scene so glyph order reveals nothing
    const order = rng.shuffle(range(right.glyphs.length));
    const shuffled: Figure = { glyphs: order.map((i) => right.glyphs[i]) };
    const diff = sceneDiff(base, shuffled);
    if (diff.length !== k) reject('diff count mismatch');
    const descriptions = changes.map((c) => describeChange(base, c));
    return {
      title: 'Spot the difference',
      prompt: `The right-hand scene differs from the left in ${k === 1 ? 'one place' : `${k} places`}. Click ${k === 1 ? 'the difference' : `all ${k} differences`} in the right-hand scene.`,
      display: { blocks: [{ type: 'visual', visual: fig(base), size: 'lg', caption: 'Original' }] },
      interaction: { type: 'glyphs', figure: shuffled, count: k },
      answer: { type: 'glyphs', indices: diff },
      hints: [
        'Scan systematically: row by row, comparing each shape with its partner in the same position.',
        `Look at ${listJoin([...new Set(changes.map((c) => (c.kind === 'add' ? 'extra objects' : c.kind === 'shade' ? 'shading' : c.kind === 'shape' ? 'shapes' : c.kind === 'rotate' ? 'directions' : 'sizes')))])}.`,
        `One difference is ${whereIs(changes[0].kind === 'add' ? changes[0].glyph : base.glyphs[changes[0].index])}.`,
      ],
      explanation: {
        answer: descriptions.join(' '),
        answerVisual: fig({ glyphs: shuffled.glyphs.map((g, i) => (diff.includes(i) ? { ...g, highlight: true } : g)) }),
        rule: `${k === 1 ? 'One object differs' : `${k} objects differ`} between the scenes.`,
        steps: descriptions,
        alternatives: [],
        skills: ['visual attention', 'observation'],
      },
      metrics: { rules: k, steps: n },
      fingerprint: { structure: `diff|${n}|${k}`, features: ['attention:difference', ...new Set(changes.map((c) => `change:${c.kind}`))], detail: JSON.stringify(base.glyphs.map((g) => glyphKey(g))) },
      hidden: { left: base, right: shuffled } satisfies DiffHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as DiffHidden;
    const diff = sceneDiff(h.left, h.right);
    if (p.answer.type !== 'glyphs' || diff.join(',') !== [...p.answer.indices].sort((a, b) => a - b).join(',')) return ['diff mismatch'];
    return [];
  },
};

/* ---------------- change detection ---------------- */

interface ChangeHidden {
  before: Figure;
  after: Figure;
  [k: string]: unknown;
}

export const obsChange: GeneratorDef = {
  id: 'observation.change',
  category: 'observation',
  version: 1,
  family: 'Change detection',
  description: 'Study a scene, then spot what changed from memory.',
  weight: 1,
  candidates: 4,
  generate({ rng, difficulty }) {
    const n = difficulty === 1 ? 5 : difficulty === 2 ? 6 : difficulty === 3 ? 8 : 10;
    const pos = scatter(rng, n + 1, 4, 3);
    const before = randomScene(rng, n, 4, 3, 9);
    before.glyphs = before.glyphs.map((g, i) => ({ ...g, x: pos[i][0], y: pos[i][1] }));
    const kinds: Change['kind'][] = difficulty <= 2 ? ['shape', 'shade', 'add'] : ['shape', 'shade', 'rotate', 'add', 'size'];
    let change: Change | null = null;
    for (let t = 0; t < 20 && !change; t++) change = randomChange(rng, before, kinds, pos[n]);
    if (!change) reject('no change');
    const after = applyChange(before, change);
    if (sceneDiff(before, after).length !== 1) reject('change not unique');
    const correctText = describeChange(before, change);
    const distractors: { text: string; reason: string }[] = [];
    const seen = new Set([correctText]);
    for (let t = 0; t < 60 && distractors.length < 3; t++) {
      const fake = randomChange(rng, before, kinds.filter((x) => x !== 'add'), undefined);
      if (!fake || fake.kind === 'add' || (change.kind !== 'add' && fake.index === change.index)) continue;
      const text = describeChange(before, fake);
      if (seen.has(text)) continue;
      seen.add(text);
      const g = before.glyphs[fake.index];
      distractors.push({ text, reason: `The ${describeGlyph(g, { orientation: false })} ${whereIs(g)} is exactly the same in both scenes.` });
    }
    if (distractors.length < 3) reject('not enough distractors');
    const built = buildChoices({ key: correctText, text: correctText }, distractors.map((d) => ({ key: d.text, text: d.text, reason: d.reason })), rng);
    const changedIndex = sceneDiff(before, after)[0];
    return {
      title: 'What changed?',
      prompt: 'Study the first scene. After it disappears, one thing will have changed. What was it?',
      display: {
        memorize: { blocks: [{ type: 'visual', visual: fig(before), size: 'lg' }], exposureMs: 2500 + 500 * n, instruction: 'Memorise this scene.' },
        blocks: [{ type: 'visual', visual: fig(after), size: 'lg', caption: 'The scene now' }],
      },
      interaction: { type: 'choice', choices: built.choices },
      answer: { type: 'choice', correct: built.correctId },
      hints: [`Exactly one object is different; the other ${n - 1} are untouched.`, `The change is to ${change.kind === 'add' ? 'the number of objects' : change.kind === 'shade' ? 'a shading' : change.kind === 'shape' ? 'a shape' : change.kind === 'rotate' ? 'a direction' : 'a size'}.`, `Look ${whereIs(after.glyphs[changedIndex])}.`],
      explanation: {
        answer: `Option ${built.correctLabel}: ${correctText}`,
        answerVisual: fig({ glyphs: after.glyphs.map((g, i) => (i === changedIndex ? { ...g, highlight: true } : g)) }),
        rule: correctText,
        steps: [correctText, 'Every other object kept its shape, shading, size, direction and position.'],
        alternatives: built.alternatives,
        skills: ['working memory', 'visual attention', 'observation'],
      },
      metrics: { rules: 1, steps: n, choices: 4 },
      fingerprint: { structure: `change|${n}|${change.kind}`, features: ['memory:change', `change:${change.kind}`], detail: JSON.stringify(before.glyphs.map(glyphKey)) },
      hidden: { before, after } satisfies ChangeHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as ChangeHidden;
    return sceneDiff(h.before, h.after).length === 1 ? [] : ['scene does not differ in exactly one place'];
  },
};

/* ---------------- property recall ---------------- */

const CODE_WORDS = ['ORBIT', 'LANTERN', 'CIPHER', 'MAPLE', 'VELVET', 'QUARTZ', 'HARBOR', 'TIMBER', 'COMET', 'RIDDLE', 'SPARROW', 'BEACON'];

interface PropHidden {
  cards: { shape: ShapeKind; shade: number; number: number; word: string }[];
  ask: string;
  target: number;
  [k: string]: unknown;
}

export const obsProperties: GeneratorDef = {
  id: 'observation.properties',
  category: 'observation',
  version: 1,
  family: 'Detail recall',
  description: 'Remember the details printed on a set of cards.',
  weight: 0.9,
  candidates: 4,
  generate({ rng, difficulty }) {
    const n = difficulty === 1 ? 3 : difficulty === 2 ? 4 : difficulty === 3 ? 5 : 6;
    const shapes = rng.sample(PLAIN_SHAPES, n);
    const numbers = rng.sample(range(9, 1), n);
    const words = rng.sample(CODE_WORDS, n);
    const cards = shapes.map((shape, i) => ({ shape, shade: rng.int(0, 3), number: numbers[i], word: words[i] }));
    const cardFig = (c: (typeof cards)[number]): Visual => fig({ glyphs: [{ shape: c.shape, x: 50, y: 50, r: 26, rot: 0, shade: c.shade }] });
    const target = rng.int(0, n - 1);
    const t = cards[target];
    const tName = `${SHADE_NAMES[t.shade]} ${shapeInfo(t.shape).name}`;
    type Ask = 'number' | 'word' | 'neighbour';
    const ask: Ask = difficulty <= 2 ? rng.pick<Ask>(['number', 'word']) : difficulty === 3 ? rng.pick<Ask>(['number', 'word', 'neighbour']) : 'neighbour';
    let question: string;
    let correct: string;
    let others: string[];
    let explanation: string;
    if (ask === 'number') {
      question = `What number was on the card with the ${tName}?`;
      correct = String(t.number);
      others = rng.sample(cards.filter((_, i) => i !== target).map((c) => String(c.number)), 3);
      explanation = `The ${tName} card showed ${t.number}.`;
    } else if (ask === 'word') {
      question = `Which code word was on the card numbered ${t.number}?`;
      correct = t.word;
      others = rng.sample(cards.filter((_, i) => i !== target).map((c) => c.word), 3);
      explanation = `Card ${t.number} carried the word ${t.word}.`;
    } else {
      if (target === n - 1) reject('no right neighbour');
      const nb = cards[target + 1];
      question = `What number was on the card immediately to the right of the ${tName}?`;
      correct = String(nb.number);
      others = rng.sample(cards.filter((_, i) => i !== target + 1).map((c) => String(c.number)), 3);
      explanation = `The ${tName} was card ${target + 1} of ${n}; the next card (the ${SHADE_NAMES[nb.shade]} ${shapeInfo(nb.shape).name}) showed ${nb.number}.`;
    }
    while (others.length < 3) {
      const extra = ask === 'word' ? rng.pick(CODE_WORDS) : String(rng.int(1, 9));
      if (extra !== correct && !others.includes(extra)) others.push(extra);
    }
    const built = buildChoices(
      { key: correct, text: correct },
      others.map((o) => {
        const owner = cards.find((c) => String(c.number) === o || c.word === o);
        return { key: o, text: o, reason: owner ? `${o} belonged to the ${SHADE_NAMES[owner.shade]} ${shapeInfo(owner.shape).name} card.` : `${o} did not appear on any card.` };
      }),
      rng,
    );
    return {
      title: 'Detail recall',
      prompt: question,
      display: {
        memorize: {
          blocks: [{ type: 'gallery', size: 'sm', items: cards.map((c) => ({ visual: cardFig(c), caption: `${c.number} · ${c.word}` })) }],
          exposureMs: 2500 + 1800 * n,
          instruction: 'Memorise every card: its symbol, number and code word.',
        },
        blocks: [{ type: 'text', text: question, tone: 'lead' }],
      },
      interaction: { type: 'choice', choices: built.choices, columns: 4 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [`There were ${n} cards in a row.`, `The ${tName} was card ${target + 1} from the left.`, ask === 'word' ? `The word starts with ${correct[0]}.` : `The number is ${Number(correct) % 2 === 0 ? 'even' : 'odd'}.`],
      explanation: {
        answer: `Option ${built.correctLabel}: ${correct}.`,
        rule: explanation,
        steps: [explanation, `All cards: ${cards.map((c) => `${SHADE_NAMES[c.shade]} ${shapeInfo(c.shape).name} = ${c.number} ${c.word}`).join('; ')}.`],
        alternatives: built.alternatives,
        skills: ['working memory', 'observation'],
      },
      metrics: { rules: ask === 'neighbour' ? 2 : 1, steps: n, choices: 4 },
      fingerprint: { structure: `props|${n}|${ask}`, features: ['memory:properties', `ask:${ask}`], detail: JSON.stringify(cards) },
      hidden: { cards, ask, target } satisfies PropHidden,
    };
  },
};

/* ---------------- record comparison ---------------- */

const ITEMS = ['brass key', 'ledger', 'pocket watch', 'silver locket', 'map case', 'cipher wheel', 'lantern', 'seal stamp', 'compass', 'quill set', 'telescope', 'music box'];

interface RecHidden {
  a: string[][];
  b: string[][];
  [k: string]: unknown;
}

function mismatched(a: string[][], b: string[][]): string[] {
  const byItem = new Map(b.map((r) => [r[0], r]));
  return a.filter((r) => {
    const o = byItem.get(r[0]);
    return !o || o.join('|') !== r.join('|');
  }).map((r) => r[0]);
}

export const obsRecords: GeneratorDef = {
  id: 'observation.records',
  category: 'observation',
  version: 1,
  family: 'Comparing evidence',
  description: 'Compare two records and find the entry that does not match.',
  weight: 0.9,
  candidates: 4,
  generate({ rng, difficulty }) {
    const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : difficulty === 3 ? 6 : 8;
    const items = rng.sample(ITEMS, n);
    const code = () => `${rng.pick(['A', 'B', 'C', 'D', 'K', 'M'])}-${rng.int(100, 999)}`;
    const a = items.map((it) => [it, String(rng.int(1, 12)), code()]);
    const b = a.map((r) => r.slice());
    const bad = rng.int(0, n - 1);
    const field = rng.pick(difficulty >= 3 ? [1, 2, 2] : [1, 2]);
    if (field === 1) {
      const q = Number(a[bad][1]);
      b[bad][1] = String(difficulty >= 3 && q >= 10 ? Number(String(q).split('').reverse().join('')) || q + 1 : q + rng.pick([-1, 1, 2]) || q + 1);
    } else {
      const [p, num] = a[bad][2].split('-');
      const digits = num.split('');
      if (difficulty >= 3 && digits[1] !== digits[2]) [digits[1], digits[2]] = [digits[2], digits[1]];
      else digits[2] = String((Number(digits[2]) + rng.int(1, 8)) % 10);
      b[bad][2] = `${p}-${digits.join('')}`;
    }
    if (b[bad].join('|') === a[bad].join('|')) reject('no discrepancy created');
    const bShown = difficulty >= 3 ? rng.shuffle(b) : b;
    const mm = mismatched(a, bShown);
    if (mm.length !== 1 || mm[0] !== items[bad]) reject('discrepancy not unique');
    const others = rng.sample(items.filter((_, i) => i !== bad), 3);
    const built = buildChoices(
      { key: items[bad], text: capitalize(items[bad]) },
      others.map((o) => ({ key: o, text: capitalize(o), reason: `Both records agree on the ${o}.` })),
      rng,
    );
    const what = field === 1 ? `quantity (${a[bad][1]} vs ${b[bad][1]})` : `crate code (${a[bad][2]} vs ${b[bad][2]})`;
    return {
      title: 'Find the discrepancy',
      prompt: 'The shipping manifest and the vault log should agree. Exactly one item’s entries do not match. Which one?',
      display: {
        blocks: [
          { type: 'table', caption: 'Shipping manifest', headers: ['Item', 'Qty', 'Crate'], rows: a },
          { type: 'table', caption: 'Vault log', headers: ['Item', 'Qty', 'Crate'], rows: bShown },
        ],
      },
      interaction: { type: 'choice', choices: built.choices, columns: 2 },
      answer: { type: 'choice', correct: built.correctId },
      hints: [
        difficulty >= 3 ? 'The log is in a different order — match rows by item name, not by position.' : 'Compare the two tables row by row.',
        `The mismatch is in the ${field === 1 ? 'quantity' : 'crate code'} column.`,
        field === 2 && difficulty >= 3 ? 'Watch for two digits swapped round.' : 'Check every character, not just the first one.',
      ],
      explanation: {
        answer: `Option ${built.correctLabel}: the ${items[bad]} — its ${what} differs.`,
        rule: `The ${items[bad]} has a different ${what} in the two records.`,
        steps: [`Every other item has identical quantity and crate code in both records.`, `The ${items[bad]}: ${what}.`],
        alternatives: built.alternatives,
        skills: ['visual attention', 'observation'],
      },
      metrics: { rules: 1, steps: n, choices: 4 },
      fingerprint: { structure: `records|${n}|${field === 1 ? 'qty' : 'code'}|${difficulty >= 3 ? 'shuffled' : 'aligned'}`, features: ['attention:records', `field:${field === 1 ? 'qty' : 'code'}`], detail: JSON.stringify(a) },
      hidden: { a, b: bShown } satisfies RecHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as RecHidden;
    const mm = mismatched(h.a, h.b);
    if (mm.length !== 1) return [`${mm.length} mismatching items`];
    if (p.interaction.type !== 'choice' || p.answer.type !== 'choice') return ['wrong interaction'];
    const ans = p.interaction.choices.find((c) => c.id === (p.answer as { correct: string }).correct);
    if (ans?.text?.toLowerCase() !== mm[0]) return ['answer mismatch'];
    return [];
  },
};
