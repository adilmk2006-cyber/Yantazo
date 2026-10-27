/**
 * Wordplay generators.
 *
 *  - "What am I?" riddles composed from a feature knowledge base. A clue set
 *    is accepted only if exactly one object in the knowledge base has every
 *    clued feature.
 *  - Letter riddles ("my first is in CAT but not in CAR"). Each position is
 *    pinned to exactly one letter by set difference, so the answer is fully
 *    determined regardless of dictionary coverage.
 *  - Category anagrams, rejected if another word in the category uses the
 *    same letters.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import { capitalize, ORDINAL_WORDS, reject } from '../../util';
import { ANAGRAM_CATEGORIES, CLUE_WORDS, LETTER_ANSWERS } from '../../content/wordlists';

/* ------------------------------------------------------------------ */
/* What am I?                                                           */
/* ------------------------------------------------------------------ */

const FEATURES: Record<string, { clues: string[]; hint: string }> = {
  hands: { clues: ['I have hands but cannot clap', 'I have two hands but not a single finger'], hint: 'hands' },
  face: { clues: ['I have a face but no nose', 'I show you my face but never smile'], hint: 'a face' },
  teeth: { clues: ['I have teeth but never bite', 'I have rows of teeth yet never eat'], hint: 'teeth' },
  eye: { clues: ['I have an eye but cannot see', 'I have an eye that never blinks'], hint: 'an eye' },
  neck: { clues: ['I have a neck but no head'], hint: 'a neck' },
  spine: { clues: ['I have a spine but no bones'], hint: 'a spine' },
  legs: { clues: ['I have legs but cannot walk', 'I stand on legs but never take a step'], hint: 'legs' },
  keys: { clues: ['I have keys but open no locks'], hint: 'keys' },
  tongue: { clues: ['I have a tongue but cannot taste'], hint: 'a tongue' },
  mouth: { clues: ['I have a mouth but never eat', 'I have a mouth but never speak'], hint: 'a mouth' },
  bed: { clues: ['I have a bed but never sleep'], hint: 'a bed' },
  runs: { clues: ['I run but have no legs', 'I keep running without ever getting tired'], hint: 'running' },
  headtail: { clues: ['I have a head and a tail but no body'], hint: 'a head and a tail' },
  ears: { clues: ['I have ears but cannot hear'], hint: 'ears' },
  bark: { clues: ['I have bark but never bite'], hint: 'bark' },
  rings: { clues: ['I have rings but wear no jewellery'], hint: 'rings' },
  trunk: { clues: ['I have a trunk but never pack it for a journey'], hint: 'a trunk' },
  heart: { clues: ['I have a heart that never beats'], hint: 'a heart' },
  cities: { clues: ['I have cities but no houses', 'I hold whole countries yet weigh almost nothing'], hint: 'cities' },
  thumb: { clues: ['I have a thumb and four fingers but no bones'], hint: 'a thumb' },
  crown: { clues: ['I wear a crown but rule no kingdom'], hint: 'a crown' },
  roots: { clues: ['I have roots but never grow leaves'], hint: 'roots' },
  strings: { clues: ['I have strings but I am no puppet'], hint: 'strings' },
  bow: { clues: ['I have a bow but carry no arrows'], hint: 'a bow' },
  banks: { clues: ['I have banks but keep no money'], hint: 'banks' },
  sole: { clues: ['I have a sole but no soul'], hint: 'a sole' },
  headfoot: { clues: ['I have a head and a foot but no body'], hint: 'a head and a foot' },
  spout: { clues: ['I have a spout but I am no whale'], hint: 'a spout' },
  whistle: { clues: ['I whistle when I get hot'], hint: 'a whistle' },
  steps: { clues: ['I have steps but never walk anywhere'], hint: 'steps' },
  fork: { clues: ['I have forks but never eat'], hint: 'forks' },
  shoulders: { clues: ['I have shoulders but no arms'], hint: 'shoulders' },
  panes: { clues: ['I am full of panes but feel no pain'], hint: 'panes' },
  seal: { clues: ['I carry a seal but have no flippers'], hint: 'a seal' },
  cap: { clues: ['I wear a cap but have no head'], hint: 'a cap' },
  shrinks: { clues: ['The more I work, the shorter I become'], hint: 'getting shorter' },
  wetter: { clues: ['The more I dry, the wetter I get'], hint: 'drying' },
  holes: { clues: ['I am full of holes yet I still hold water'], hint: 'holes' },
  uprain: { clues: ['I go up when the rain comes down'], hint: 'rain' },
  words: { clues: ['I am full of words but never speak'], hint: 'words' },
  leaves: { clues: ['I have leaves but I am not a plant'], hint: 'leaves' },
  scale: { clues: ['I have a scale but I am not a fish'], hint: 'a scale' },
  lead: { clues: ['I have lead inside me but I am not a bullet'], hint: 'lead' },
  point: { clues: ['I have a point but never argue'], hint: 'a point' },
  burns: { clues: ['I give light but burn myself away'], hint: 'light' },
  foot: { clues: ['I have a foot but no toes'], hint: 'a foot' },
  peak: { clues: ['I have a peak but I am not a hat'], hint: 'a peak' },
};

interface KObject {
  id: string;
  name: string;
  accepted: string[];
  features: string[];
}

export const KB: KObject[] = [
  { id: 'clock', name: 'a clock', accepted: ['clock', 'watch', 'wristwatch', 'alarm clock', 'wall clock'], features: ['hands', 'face', 'runs'] },
  { id: 'comb', name: 'a comb', accepted: ['comb', 'hair comb'], features: ['teeth'] },
  { id: 'zipper', name: 'a zip', accepted: ['zip', 'zipper', 'zip fastener'], features: ['teeth'] },
  { id: 'saw', name: 'a saw', accepted: ['saw', 'handsaw'], features: ['teeth'] },
  { id: 'needle', name: 'a needle', accepted: ['needle', 'sewing needle'], features: ['eye', 'point'] },
  { id: 'potato', name: 'a potato', accepted: ['potato'], features: ['eye'] },
  { id: 'hurricane', name: 'a hurricane', accepted: ['hurricane', 'storm', 'cyclone', 'typhoon'], features: ['eye'] },
  { id: 'bottle', name: 'a bottle', accepted: ['bottle'], features: ['neck', 'mouth', 'cap'] },
  { id: 'shirt', name: 'a shirt', accepted: ['shirt', 'blouse', 't-shirt'], features: ['neck'] },
  { id: 'book', name: 'a book', accepted: ['book', 'novel'], features: ['spine', 'words', 'leaves'] },
  { id: 'table', name: 'a table', accepted: ['table'], features: ['legs'] },
  { id: 'bed', name: 'a bed', accepted: ['bed'], features: ['legs', 'headfoot', 'foot'] },
  { id: 'piano', name: 'a piano', accepted: ['piano', 'grand piano'], features: ['keys', 'legs', 'strings'] },
  { id: 'keyboard', name: 'a computer keyboard', accepted: ['keyboard', 'computer keyboard'], features: ['keys'] },
  { id: 'map', name: 'a map', accepted: ['map', 'atlas', 'globe'], features: ['cities', 'scale'] },
  { id: 'shoe', name: 'a shoe', accepted: ['shoe', 'boot', 'trainer', 'sneaker'], features: ['tongue', 'sole'] },
  { id: 'bell', name: 'a bell', accepted: ['bell'], features: ['tongue'] },
  { id: 'river', name: 'a river', accepted: ['river', 'stream'], features: ['mouth', 'bed', 'runs', 'banks'] },
  { id: 'coin', name: 'a coin', accepted: ['coin'], features: ['headtail'] },
  { id: 'corn', name: 'an ear of corn', accepted: ['corn', 'maize', 'corn cob', 'sweetcorn'], features: ['ears'] },
  { id: 'tree', name: 'a tree', accepted: ['tree'], features: ['bark', 'rings', 'trunk', 'crown'] },
  { id: 'cards', name: 'a deck of cards', accepted: ['deck of cards', 'pack of cards', 'playing cards', 'cards', 'deck'], features: ['heart'] },
  { id: 'artichoke', name: 'an artichoke', accepted: ['artichoke'], features: ['heart'] },
  { id: 'glove', name: 'a glove', accepted: ['glove', 'mitten'], features: ['thumb'] },
  { id: 'tooth', name: 'a tooth', accepted: ['tooth', 'molar'], features: ['crown', 'roots'] },
  { id: 'guitar', name: 'a guitar', accepted: ['guitar'], features: ['strings'] },
  { id: 'violin', name: 'a violin', accepted: ['violin', 'fiddle'], features: ['strings', 'bow'] },
  { id: 'ship', name: 'a ship', accepted: ['ship', 'boat'], features: ['bow'] },
  { id: 'gift', name: 'a wrapped present', accepted: ['present', 'gift', 'parcel'], features: ['bow'] },
  { id: 'road', name: 'a road', accepted: ['road', 'highway', 'motorway'], features: ['fork', 'shoulders'] },
  { id: 'window', name: 'a window', accepted: ['window'], features: ['panes'] },
  { id: 'envelope', name: 'an envelope', accepted: ['envelope', 'letter'], features: ['seal'] },
  { id: 'pencil', name: 'a pencil', accepted: ['pencil'], features: ['shrinks', 'lead', 'point'] },
  { id: 'candle', name: 'a candle', accepted: ['candle'], features: ['shrinks', 'burns'] },
  { id: 'towel', name: 'a towel', accepted: ['towel', 'tea towel', 'cloth'], features: ['wetter'] },
  { id: 'sponge', name: 'a sponge', accepted: ['sponge'], features: ['holes'] },
  { id: 'umbrella', name: 'an umbrella', accepted: ['umbrella', 'brolly'], features: ['uprain'] },
  { id: 'kettle', name: 'a kettle', accepted: ['kettle'], features: ['spout', 'whistle'] },
  { id: 'stairs', name: 'a staircase', accepted: ['stairs', 'staircase', 'stairway'], features: ['steps'] },
  { id: 'mountain', name: 'a mountain', accepted: ['mountain', 'hill'], features: ['foot', 'peak'] },
];

function uniqueObjects(features: string[]): KObject[] {
  return KB.filter((o) => features.every((f) => o.features.includes(f)));
}

interface KbHidden {
  object: string;
  features: string[];
  [k: string]: unknown;
}

export const riddleWhatAmI: GeneratorDef = {
  id: 'riddle.whatami',
  category: 'riddle',
  version: 1,
  family: '“What am I?” riddles',
  description: 'Riddles assembled from a feature knowledge base and checked for a unique answer.',
  weight: 1.1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const want = difficulty <= 2 ? 2 : 3;
    const candidates = KB.filter((o) => o.features.length >= Math.min(want, 2));
    const obj = rng.pick(candidates);
    const nClues = Math.min(want, obj.features.length);
    const feats = rng.sample(obj.features, nClues);
    let matches = uniqueObjects(feats);
    // single-feature objects can still be unique if no other object shares the feature
    if (matches.length !== 1) {
      const all = obj.features;
      matches = uniqueObjects(all);
      if (matches.length !== 1) reject('no unique clue set');
      feats.splice(0, feats.length, ...all);
    }
    if (feats.length === 1 && difficulty >= 2) reject('too easy for this tier');
    const lines = feats.map((f) => rng.pick(FEATURES[f].clues));
    const framing = rng.pick(['What am I?', 'What could I be?', 'Name me.']);
    const text = `${lines.join('. ')}. ${framing}`;
    // distractors: objects sharing at least one clue but failing another
    const near = rng.shuffle(KB.filter((o) => o.id !== obj.id && feats.some((f) => o.features.includes(f))));
    const far = rng.shuffle(KB.filter((o) => o.id !== obj.id && !near.includes(o)));
    const picks = [...near, ...far].slice(0, 3);
    const built = buildChoices(
      { key: obj.id, text: capitalize(obj.name) },
      picks.map((o) => {
        const fails = feats.filter((f) => !o.features.includes(f));
        const has = feats.filter((f) => o.features.includes(f));
        return {
          key: o.id,
          text: capitalize(o.name),
          reason: has.length
            ? `${capitalize(o.name)} has ${has.map((f) => FEATURES[f].hint).join(' and ')}, but not ${fails.map((f) => FEATURES[f].hint).join(' or ')}.`
            : `${capitalize(o.name)} fits none of the clues.`,
        };
      }),
      rng,
    );
    return {
      title: 'What am I?',
      prompt: 'Read the riddle and name the object.',
      display: { blocks: [{ type: 'text', text, tone: 'quote' }] },
      interaction: { type: 'text', placeholder: 'One or two words', fallback: built.choices },
      answer: { type: 'text', canonical: obj.accepted[0], accepted: obj.accepted, fallbackCorrect: built.correctId },
      hints: [
        'Every clue uses a body-part or human word in an unexpected, literal sense.',
        `Think of everyday objects that have ${FEATURES[feats[0]].hint} in a non-human sense.`,
        `It must also have ${feats.slice(1).map((f) => FEATURES[f].hint).join(' and ') || 'nothing else unusual'}; only one common object has all of these.`,
      ],
      explanation: {
        answer: `${capitalize(obj.name)} (${obj.accepted[0]}).`,
        rule: `Each clue is a pun on a part that ${obj.name} really has: ${feats.map((f) => FEATURES[f].hint).join(', ')}.`,
        steps: [...lines.map((l, i) => `“${l}” — ${obj.name} has ${FEATURES[feats[i]].hint}.`), `Among the objects in the riddle library, only ${obj.name} has every one of these features.`],
        alternatives: built.alternatives,
        skills: ['verbal reasoning', 'lateral thinking'],
      },
      metrics: { rules: feats.length, steps: feats.length, choices: 4 },
      fingerprint: { structure: `kb|${feats.length}`, features: [`kb:${obj.id}`, ...feats.map((f) => `feat:${f}`)], detail: `${obj.id}|${feats.sort().join(',')}` },
      hidden: { object: obj.id, features: feats } satisfies KbHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as KbHidden;
    const m = uniqueObjects(h.features);
    if (m.length !== 1 || m[0].id !== h.object) return ['knowledge base does not give a unique object'];
    return [];
  },
};

/* ------------------------------------------------------------------ */
/* Letter riddles                                                       */
/* ------------------------------------------------------------------ */

const letterSet = (w: string) => new Set(w.split(''));

const maskOf = (w: string) => w.split('').reduce((m, c) => m | (1 << (c.charCodeAt(0) - 97)), 0);
const CLUE_MASKS = CLUE_WORDS.map(maskOf);
const PAIR_CACHE = new Map<string, [string, string][]>();

/** Pairs (in, out) where letters(in) − letters(out) = {x}; computed with bit masks and cached per letter. */
function pairsFor(x: string, exclude: string): [string, string][] {
  let all = PAIR_CACHE.get(x);
  if (!all) {
    all = [];
    const bit = 1 << (x.charCodeAt(0) - 97);
    for (let i = 0; i < CLUE_WORDS.length; i++) {
      if (!(CLUE_MASKS[i] & bit) || CLUE_WORDS[i].length > 5) continue;
      const rest = CLUE_MASKS[i] & ~bit;
      for (let j = 0; j < CLUE_WORDS.length; j++) {
        if (i === j || CLUE_MASKS[j] & bit) continue;
        if ((CLUE_MASKS[j] & rest) === rest) all.push([CLUE_WORDS[i], CLUE_WORDS[j]]);
      }
    }
    PAIR_CACHE.set(x, all);
  }
  return all.filter(([a, b]) => a !== exclude && b !== exclude);
}

export function solveLetterClues(pairs: [string, string][]): string[] {
  // each position: letters in A but not B
  return pairs.map(([a, b]) => [...letterSet(a)].filter((c) => !letterSet(b).has(c)).join(''));
}

interface LetterHidden {
  word: string;
  pairs: [string, string][];
  [k: string]: unknown;
}

export const riddleLetters: GeneratorDef = {
  id: 'riddle.letters',
  category: 'riddle',
  version: 1,
  family: 'Letter riddles',
  description: '“My first is in … but not in …” riddles with a provably unique answer.',
  weight: 0.9,
  candidates: 4,
  generate({ rng, difficulty }) {
    const pool = LETTER_ANSWERS.filter(([w]) => (difficulty <= 2 ? w.length <= 5 : w.length >= 5));
    const [word, def] = rng.pick(pool);
    const pairs: [string, string][] = [];
    for (const ch of word) {
      const options = pairsFor(ch, word);
      if (!options.length) reject(`no clue pair for ${ch}`);
      // harder tiers prefer longer, less obvious clue words
      const sorted = options.filter(([a]) => (difficulty >= 3 ? a.length >= 4 : true));
      pairs.push(rng.pick(sorted.length ? sorted : options));
    }
    const solved = solveLetterClues(pairs);
    if (solved.some((s) => s.length !== 1) || solved.join('') !== word) reject('clue letters not unique');
    const lines = pairs.map(([a, b], i) => `My ${ORDINAL_WORDS[i]} is in ${a.toUpperCase()} but not in ${b.toUpperCase()}.`);
    const others = rng.shuffle(LETTER_ANSWERS.filter(([w]) => w !== word && w.length === word.length)).slice(0, 3);
    while (others.length < 3) {
      const extra = rng.pick(LETTER_ANSWERS);
      if (extra[0] !== word && !others.includes(extra)) others.push(extra);
    }
    const built = buildChoices(
      { key: word, text: word.toUpperCase() },
      others.map(([w]) => {
        const i = w.split('').findIndex((c, k) => c !== word[k]);
        const reason = i < 0 || i >= pairs.length ? `${w.toUpperCase()} has a different number of letters.` : `Its ${ORDINAL_WORDS[i]} letter, ${w[i].toUpperCase()}, ${pairs[i][0].includes(w[i]) ? `also appears in ${pairs[i][1].toUpperCase()}` : `is not in ${pairs[i][0].toUpperCase()}`}.`;
        return { key: w, text: w.toUpperCase(), reason };
      }),
      rng,
    );
    return {
      title: 'Letter riddle',
      prompt: 'Each line gives one letter of a hidden word, in order. Find the word.',
      display: { blocks: [{ type: 'list', items: [...lines, `My whole is ${def}.`] }] },
      interaction: { type: 'text', placeholder: 'The word', fallback: built.choices },
      answer: { type: 'text', canonical: word, accepted: [word], fallbackCorrect: built.correctId },
      hints: [
        'For each line, cross out everything the two clue words share — exactly one character survives.',
        `The word has ${word.length} letters; work through the lines one at a time.`,
        `It ends with ${word[word.length - 1].toUpperCase()}.`,
      ],
      explanation: {
        answer: `${word.toUpperCase()} — ${def}.`,
        rule: 'Each line leaves exactly one letter after removing the letters shared by both words.',
        steps: pairs.map(([a, b], i) => `${capitalize(ORDINAL_WORDS[i])}: ${a.toUpperCase()} minus the letters of ${b.toUpperCase()} leaves ${word[i].toUpperCase()}.`),
        alternatives: built.alternatives,
        skills: ['verbal reasoning', 'deduction'],
      },
      metrics: { rules: word.length, steps: word.length, choices: 4 },
      fingerprint: { structure: `letters|${word.length}`, features: [`len:${word.length}`, 'word:letters'], detail: `${word}|${pairs.map((p) => p.join('/')).join(',')}` },
      hidden: { word, pairs } satisfies LetterHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as LetterHidden;
    const s = solveLetterClues(h.pairs);
    if (s.some((x) => x.length !== 1) || s.join('') !== h.word) return ['letters not uniquely determined'];
    return [];
  },
};

/* ------------------------------------------------------------------ */
/* Category anagrams                                                    */
/* ------------------------------------------------------------------ */

const sortLetters = (w: string) => w.split('').sort().join('');

interface AnaHidden {
  word: string;
  category: string;
  scramble: string;
  [k: string]: unknown;
}

export const riddleAnagram: GeneratorDef = {
  id: 'riddle.anagram',
  category: 'riddle',
  version: 1,
  family: 'Anagrams',
  description: 'Unscramble a word from a named category (checked against the whole category).',
  weight: 0.8,
  candidates: 5,
  generate({ rng, difficulty }) {
    const catKey = rng.pick(Object.keys(ANAGRAM_CATEGORIES));
    const cat = ANAGRAM_CATEGORIES[catKey];
    const [lo, hi] = difficulty === 1 ? [4, 5] : difficulty === 2 ? [5, 6] : difficulty === 3 ? [6, 7] : [8, 11];
    const pool = cat.words.filter((w) => w.length >= lo && w.length <= hi);
    if (!pool.length) reject('no words of that length');
    const word = rng.pick(pool);
    const clash = cat.words.filter((w) => w !== word && sortLetters(w) === sortLetters(word));
    if (clash.length) reject('another category word uses the same letters');
    let scramble = word;
    for (let t = 0; t < 20 && (scramble === word || scramble.slice(0, 2) === word.slice(0, 2)); t++) scramble = rng.shuffle(word.split('')).join('');
    if (scramble === word) reject('could not scramble');
    const others = rng.shuffle(cat.words.filter((w) => w !== word && Math.abs(w.length - word.length) <= 1)).slice(0, 3);
    if (others.length < 3) reject('not enough options');
    const built = buildChoices(
      { key: word, text: capitalize(word) },
      others.map((w) => {
        const need = w.split('').find((c) => w.split('').filter((x) => x === c).length > scramble.split('').filter((x) => x === c).length);
        return { key: w, text: capitalize(w), reason: need ? `${capitalize(w)} needs ${need.toUpperCase()}${scramble.includes(need) ? ' more times than' : ', which is not in'} the jumble.` : `${capitalize(w)} uses a different number of letters.` };
      }),
      rng,
    );
    const mid = Math.floor(word.length / 2);
    return {
      title: 'Anagram',
      prompt: `Rearrange the letters to spell ${cat.label}.`,
      display: { blocks: [{ type: 'visual', visual: { kind: 'tokens', tokens: scramble.toUpperCase().split(''), style: 'letter' }, size: 'md' }] },
      interaction: { type: 'text', placeholder: 'Unscrambled word', fallback: built.choices },
      answer: { type: 'text', canonical: word, accepted: [word], fallbackCorrect: built.correctId },
      hints: [`It has ${word.length} letters and starts with ${word[0].toUpperCase()}.`, `It ends with ${word[word.length - 1].toUpperCase()}.`, `Letter ${mid + 1} is ${word[mid].toUpperCase()}.`],
      explanation: {
        answer: `${word.toUpperCase()}`,
        rule: `${scramble.toUpperCase()} rearranges to ${word.toUpperCase()}.`,
        steps: [`${scramble.toUpperCase()} → ${word.toUpperCase()}.`, `No other ${cat.label.replace(/^an? /, '')} in the game's word list uses exactly these letters.`],
        alternatives: built.alternatives,
        skills: ['verbal reasoning', 'pattern recognition'],
      },
      metrics: { rules: 1, steps: Math.ceil(word.length / 3), choices: 4 },
      fingerprint: { structure: `anagram|${catKey}|${word.length > 7 ? 'long' : word.length > 5 ? 'mid' : 'short'}`, features: [`cat:${catKey}`, `len:${word.length}`], detail: `${word}|${scramble}` },
      hidden: { word, category: catKey, scramble } satisfies AnaHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as AnaHidden;
    const cat = ANAGRAM_CATEGORIES[h.category];
    const fits = cat.words.filter((w) => sortLetters(w) === sortLetters(h.scramble));
    if (fits.length !== 1 || fits[0] !== h.word) return ['anagram not unique in its category'];
    return [];
  },
};
