/**
 * Numerical brain teasers built from verified templates. Each template has
 * its own mechanism (simultaneous equations, intervals vs. points, doubling,
 * pigeonhole, relative motion …), a brute-force or closed-form solver used for
 * verification, and named traps as distractors.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import type { Rng } from '../../rng';
import { range, reject } from '../../util';
import { DAYS } from '../../logic/names';

interface Built {
  mechanism: string;
  level: number;
  text: string;
  answer: number | string;
  unit?: string;
  traps: { value: number | string; why: string }[];
  steps: string[];
  rule: string;
  hints: [string, string, string];
  /** independent recomputation (brute force where possible) */
  check: () => number | string | null;
  params: Record<string, number | string>;
}

type Template = (rng: Rng, d: number) => Built | null;

const ANIMAL_PAIRS: [string, number, string, number, string][] = [
  ['chickens', 2, 'goats', 4, 'legs'],
  ['ducks', 2, 'sheep', 4, 'legs'],
  ['beetles', 6, 'spiders', 8, 'legs'],
  ['bicycles', 2, 'tricycles', 3, 'wheels'],
  ['cars', 4, 'motorbikes', 2, 'wheels'],
];

const legs: Template = (rng, d) => {
  const [a, la, b, lb, part] = rng.pick(ANIMAL_PAIRS);
  const na = rng.int(2, d * 6 + 4);
  const nb = rng.int(2, d * 6 + 4);
  const heads = na + nb;
  const total = na * la + nb * lb;
  const headWord = part === 'wheels' ? 'vehicles' : 'animals';
  const ask = rng.chance(0.5) ? b : a;
  const answer = ask === b ? nb : na;
  return {
    mechanism: 'legs',
    level: 1,
    text: `In a yard there are only ${a} and ${b}: ${heads} ${headWord} and ${total} ${part} altogether. How many ${ask} are there?`,
    answer,
    traps: [
      { value: Math.round(total / (la + lb)), why: `dividing the ${part} evenly between the two kinds ignores that they have different numbers of ${part}` },
      { value: ask === b ? na : nb, why: `that is the number of ${ask === b ? a : b}` },
      { value: answer + 1, why: 'an arithmetic slip' },
    ],
    steps: [
      `If all ${heads} were ${a}, there would be ${heads * la} ${part}.`,
      `There are ${total - heads * la} extra ${part}, and each of the ${b} adds ${lb - la} more than one of the ${a}.`,
      `So there are ${(total - heads * la) / (lb - la)} ${b} and ${heads - (total - heads * la) / (lb - la)} ${a}.`,
    ],
    rule: `${a}: ${na} × ${la} = ${na * la}; ${b}: ${nb} × ${lb} = ${nb * lb}; total ${total}.`,
    hints: [`Imagine every one of them were ${a}. How many ${part} would that give?`, `Each of the ${b} has ${lb - la} more ${part} than one of the ${a}.`, `The shortfall is ${total - heads * la} ${part}.`],
    check: () => {
      const sols = range(heads + 1).filter((x) => x * la + (heads - x) * lb === total);
      if (sols.length !== 1) return null;
      return ask === a ? sols[0] : heads - sols[0];
    },
    params: { a, b, heads, total, ask },
  };
};

const sumDiff: Template = (rng) => {
  const items = rng.pick([['notebook', 'pen'], ['torch', 'battery'], ['map', 'compass'], ['lock', 'key']]);
  const small = rng.int(1, 20) * 5;
  const diff = rng.int(4, 30) * 10;
  const total = small * 2 + diff;
  return {
    mechanism: 'sumdiff',
    level: 2,
    text: `A ${items[0]} and a ${items[1]} cost ${total}p together. The ${items[0]} costs ${diff}p more than the ${items[1]}. How many pence does the ${items[1]} cost?`,
    answer: small,
    unit: 'p',
    traps: [
      { value: total - diff, why: `subtracting the difference from the total gives ${total - diff}p, but then the ${items[0]} would cost ${total - diff + diff}p and the pair ${total - diff + total}p` },
      { value: diff, why: 'that is the difference, not a price' },
      { value: small + 5, why: 'an arithmetic slip' },
    ],
    steps: [`Call the ${items[1]}'s price x. Then the ${items[0]} costs x + ${diff}.`, `x + (x + ${diff}) = ${total}, so 2x = ${total - diff} and x = ${small}.`, `Check: ${small} + ${small + diff} = ${total}, and the difference is ${diff}.`],
    rule: `${items[1]} = (${total} − ${diff}) ÷ 2 = ${small}p.`,
    hints: ['The quick answer is a trap — check it against both conditions.', `If the ${items[1]} costs x, the ${items[0]} costs x + ${diff}.`, `Two ${items[1]}s plus ${diff}p make ${total}p.`],
    check: () => {
      const s = range(total + 1).filter((x) => x + (x + diff) === total);
      return s.length === 1 ? s[0] : null;
    },
    params: { total, diff },
  };
};

const ages: Template = (rng, d) => {
  for (let t = 0; t < 60; t++) {
    const kid = rng.int(2, 15);
    const k = rng.int(2, 5);
    const n = rng.int(2, 20);
    const adult = kid * k;
    const m = (adult + n) / (kid + n);
    if (!Number.isInteger(m) || m < 2 || m === k) continue;
    const names = rng.pick([['Mira', 'Teo'], ['Hana', 'Ivo'], ['Omar', 'Pia'], ['Rosa', 'Finn']]);
    return {
      mechanism: 'ages',
      level: d >= 3 ? 3 : 2,
      text: `${names[0]} is ${k} times as old as ${names[1]}. In ${n} years, ${names[0]} will be ${m} times as old as ${names[1]}. How old is ${names[0]} now?`,
      answer: adult,
      traps: [
        { value: kid, why: `that is ${names[1]}'s age` },
        { value: adult + n, why: `that is ${names[0]}'s age in ${n} years` },
        { value: k * (kid + 1), why: `it would make ${names[1]} ${kid + 1}, which breaks the second condition` },
      ],
      steps: [`Let ${names[1]} be x. Then ${names[0]} is ${k}x.`, `In ${n} years: ${k}x + ${n} = ${m}(x + ${n}).`, `${k}x + ${n} = ${m}x + ${m * n}, so ${k - m}x = ${m * n - n} and x = ${kid}.`, `${names[0]} is ${k} × ${kid} = ${adult}.`],
      rule: `${names[1]} is ${kid}, so ${names[0]} is ${adult}.`,
      hints: [`Write ${names[1]}'s age as x.`, `In ${n} years both are ${n} years older: ${k}x + ${n} and x + ${n}.`, `Set ${k}x + ${n} equal to ${m} × (x + ${n}).`],
      check: () => {
        const s = range(120, 1).filter((x) => k * x + n === m * (x + n));
        return s.length === 1 ? k * s[0] : null;
      },
      params: { k, n, m },
    };
  }
  return null;
};

const handshakes: Template = (rng): Built | null => {
  const n = rng.int(5, 14);
  const h = (n * (n - 1)) / 2;
  const reverse = rng.chance(0.5);
  return reverse
    ? {
        mechanism: 'handshakes-reverse',
        level: 3,
        text: `At a meeting every guest shook hands with every other guest exactly once. There were ${h} handshakes. How many guests were there?`,
        answer: n,
        traps: [
          { value: Math.round(Math.sqrt(h)), why: 'taking a square root ignores that each handshake involves two people' },
          { value: n + 1, why: `${n + 1} guests would make ${((n + 1) * n) / 2} handshakes` },
          { value: n - 1, why: `${n - 1} guests would make ${((n - 1) * (n - 2)) / 2} handshakes` },
        ],
        steps: [`With g guests there are g × (g − 1) ÷ 2 handshakes.`, `${n} × ${n - 1} ÷ 2 = ${h}.`],
        rule: `g(g − 1)/2 = ${h} gives g = ${n}.`,
        hints: ['Each guest shakes hands with everyone except themselves.', 'Counting "everyone × (everyone − 1)" counts each handshake twice.', `Look for consecutive numbers whose product is ${h * 2}.`],
        check: () => {
          const s = range(60, 2).filter((g) => (g * (g - 1)) / 2 === h);
          return s.length === 1 ? s[0] : null;
        },
        params: { h },
      }
    : {
        mechanism: 'handshakes',
        level: 2,
        text: `${n} detectives meet, and each shakes hands with every other detective exactly once. How many handshakes take place?`,
        answer: h,
        traps: [
          { value: n * (n - 1), why: 'this counts every handshake twice (once for each person)' },
          { value: n * n, why: 'this includes people shaking their own hands and double counts' },
          { value: h + n, why: 'an arithmetic slip' },
        ],
        steps: [`Each of the ${n} detectives shakes ${n - 1} hands: ${n} × ${n - 1} = ${n * (n - 1)}.`, `Every handshake was counted twice, so halve it: ${h}.`],
        rule: `${n} × ${n - 1} ÷ 2 = ${h}.`,
        hints: ['Count how many hands each detective shakes.', 'A handshake involves two people.', `Each of the ${n} detectives shakes ${n - 1} hands — then fix the double counting.`],
        check: () => {
          let c = 0;
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c++;
          return c;
        },
        params: { n },
      };
};

const clockAngle: Template = (rng) => {
  const H = rng.int(1, 12);
  const M = rng.pick([0, 10, 20, 30, 40, 50, 12, 24, 36, 48, 6, 18]);
  const raw = Math.abs(30 * (H % 12) - 5.5 * M);
  const ang = Math.min(raw, 360 - raw);
  if (!Number.isInteger(ang)) return null;
  const naive = Math.min(Math.abs(30 * (H % 12) - 6 * M), 360 - Math.abs(30 * (H % 12) - 6 * M));
  return {
    mechanism: 'clock',
    level: 3,
    text: `What is the smaller angle, in degrees, between the hour and minute hands of a clock at ${H}:${String(M).padStart(2, '0')}?`,
    answer: ang,
    unit: '°',
    traps: [
      { value: naive, why: 'this forgets that the hour hand also moves as the minutes pass (half a degree per minute)' },
      { value: 360 - ang, why: 'this is the larger (reflex) angle' },
      { value: ang + 15, why: 'an arithmetic slip' },
    ],
    steps: [
      `The minute hand is at ${6 * M}° (6° per minute).`,
      `The hour hand is at ${30 * (H % 12)}° + ${M} × 0.5° = ${30 * (H % 12) + 0.5 * M}°.`,
      `The difference is ${raw}°; the smaller angle is ${ang}°.`,
    ],
    rule: `|30 × ${H % 12} − 5.5 × ${M}| = ${raw}°, smaller angle ${ang}°.`,
    hints: ['The minute hand moves 6° per minute.', 'The hour hand moves 30° per hour — and keeps creeping forward as the minutes pass.', 'The hour hand moves half a degree every minute.'],
    check: () => {
      const hour = (H % 12) * 30 + M * 0.5;
      const min = M * 6;
      const r = Math.abs(hour - min);
      return Math.min(r, 360 - r);
    },
    params: { H, M },
  };
};

const calendar: Template = (rng) => {
  const anchor = rng.pick([
    { phrase: 'the day after tomorrow', off: 2 },
    { phrase: 'the day before yesterday', off: -2 },
    { phrase: 'tomorrow', off: 1 },
    { phrase: 'yesterday', off: -1 },
  ]);
  const target = rng.pick([
    { phrase: 'three days after today', off: 3 },
    { phrase: 'the day after tomorrow', off: 2 },
    { phrase: 'four days before today', off: -4 },
    { phrase: 'the day before yesterday', off: -2 },
    { phrase: 'five days after yesterday', off: 4 },
  ]);
  if (anchor.phrase === target.phrase) return null;
  const known = rng.int(0, 6);
  const today = (((known - anchor.off) % 7) + 7) % 7;
  const ans = DAYS[(((today + target.off) % 7) + 7) % 7];
  const wrong = DAYS[(((known + target.off) % 7) + 7) % 7];
  return {
    mechanism: 'calendar',
    level: 2,
    text: `If ${anchor.phrase} is ${DAYS[known]}, what day is ${target.phrase}?`,
    answer: ans,
    traps: [
      { value: wrong, why: `this counts from ${DAYS[known]} instead of from today` },
      { value: DAYS[(((today - target.off) % 7) + 7) % 7], why: 'this counts in the wrong direction' },
      { value: DAYS[today], why: 'that is today' },
    ].filter((t) => t.value !== ans),
    steps: [`${anchor.phrase.charAt(0).toUpperCase() + anchor.phrase.slice(1)} is ${DAYS[known]}, so today is ${DAYS[today]}.`, `${target.phrase.charAt(0).toUpperCase() + target.phrase.slice(1)} is ${Math.abs(target.off)} day${Math.abs(target.off) > 1 ? 's' : ''} ${target.off > 0 ? 'after' : 'before'} today: ${ans}.`],
    rule: `Today is ${DAYS[today]}.`,
    hints: ['Work out what day it is today first.', `${anchor.phrase} is ${Math.abs(anchor.off)} day${Math.abs(anchor.off) > 1 ? 's' : ''} ${anchor.off > 0 ? 'after' : 'before'} today.`, `Count ${Math.abs(target.off)} days ${target.off > 0 ? 'forward' : 'back'} from today.`],
    check: () => {
      for (let t = 0; t < 7; t++) if ((((t + anchor.off) % 7) + 7) % 7 === known) return DAYS[(((t + target.off) % 7) + 7) % 7];
      return null;
    },
    params: { anchor: anchor.phrase, target: target.phrase, known },
  };
};

const digits: Template = (rng) => {
  const a = rng.int(2, 9);
  const b = rng.int(0, a - 1);
  const num = 10 * a + b;
  const S = a + b;
  const D = 9 * (a - b);
  return {
    mechanism: 'digits',
    level: 3,
    text: `I am a two-digit number. My digits add up to ${S}. If you reverse my digits, the new number is ${D} less than me. What number am I?`,
    answer: num,
    traps: [
      { value: 10 * b + a, why: 'that is the reversed number' },
      { value: num + 9, why: `its digits add up to ${Math.floor((num + 9) / 10) + ((num + 9) % 10)}, not ${S}` },
      { value: S * 10, why: 'a guess that only uses the digit sum' },
    ].filter((t) => t.value !== num && Number(t.value) >= 10 && Number(t.value) <= 99),
    steps: [`Write the number as 10a + b. Reversing gives 10b + a, which is 9(a − b) smaller.`, `9(a − b) = ${D}, so a − b = ${a - b}; and a + b = ${S}.`, `So a = ${a}, b = ${b}: the number is ${num}.`],
    rule: `a + b = ${S}, a − b = ${a - b}.`,
    hints: ['A two-digit number "ab" is worth 10a + b.', 'Reversing the digits always changes the number by a multiple of 9.', `The digits differ by ${D} ÷ 9.`],
    check: () => {
      const s = range(90, 10).filter((x) => Math.floor(x / 10) + (x % 10) === S && x - (10 * (x % 10) + Math.floor(x / 10)) === D);
      return s.length === 1 ? s[0] : null;
    },
    params: { S, D },
  };
};

const doubling: Template = (rng) => {
  const N = rng.int(12, 60);
  const thing = rng.pick(['patch of moss on a vault wall', 'colony of algae in a pond', 'spill of ink on a blotter']);
  const area = thing.includes('wall') ? 'the wall' : thing.includes('pond') ? 'the pond' : 'the blotter';
  return {
    mechanism: 'doubling',
    level: 2,
    text: `A ${thing} doubles in size every day. It covers all of ${area} on day ${N}. On which day did it cover exactly half of ${area}?`,
    answer: N - 1,
    traps: [
      { value: Math.round(N / 2), why: 'halving the number of days ignores the doubling — growth is not steady' },
      { value: N - 2, why: `on day ${N - 2} it covered a quarter` },
      { value: N, why: `on day ${N} it covers everything` },
    ],
    steps: [`It doubles every day, so the day before it covers everything it covers half.`, `That day is ${N - 1}.`],
    rule: 'Half the final size is reached one doubling earlier.',
    hints: ['Think backwards from the last day.', 'What was its size the day before it covered everything?', 'One doubling turns half into whole.'],
    check: () => {
      let size = 1;
      for (let day = N; day > 0; day--) {
        if (size === 0.5) return day;
        size /= 2;
      }
      return null;
    },
    params: { N },
  };
};

const snail: Template = (rng) => {
  const up = rng.int(3, 6);
  const down = rng.int(1, up - 1);
  const depth = rng.int(up + 3, 30);
  let h = 0;
  let day = 0;
  while (true) {
    day++;
    h += up;
    if (h >= depth) break;
    h -= down;
  }
  const naive = Math.ceil(depth / (up - down));
  if (naive === day) return null;
  return {
    mechanism: 'snail',
    level: 3,
    text: `A snail is at the bottom of a ${depth} m well. Each day it climbs ${up} m, and each night it slides back ${down} m. On which day does it reach the top?`,
    answer: day,
    traps: [
      { value: naive, why: `this assumes it gains ${up - down} m every single day, but on the final day it reaches the top before sliding back` },
      { value: day + 1, why: 'this waits for a night that never matters' },
      { value: day - 1, why: `at the end of day ${day - 1} it is still below the top` },
    ],
    steps: [`Each full day-and-night it gains ${up - down} m, except the last day, when it climbs out before slipping.`, `After ${day - 1} full days it is at ${(day - 1) * (up - down)} m.`, `On day ${day} it climbs ${up} m to ${(day - 1) * (up - down) + up} m ≥ ${depth} m and escapes.`],
    rule: `Escape on day ${day}.`,
    hints: ['Does the snail slide back after it has reached the top?', `It needs to start the final day within ${up} m of the top.`, `It must first get to ${depth - up} m or higher.`],
    check: () => {
      let hh = 0;
      for (let dd = 1; dd < 1000; dd++) {
        hh += up;
        if (hh >= depth) return dd;
        hh -= down;
      }
      return null;
    },
    params: { up, down, depth },
  };
};

const fence: Template = (rng) => {
  const s = rng.pick([2, 3, 4, 5]);
  const k = rng.int(4, 15);
  const L = s * k;
  const circular = rng.chance(0.35);
  return {
    mechanism: circular ? 'fence-loop' : 'fence',
    level: 2,
    text: circular
      ? `A circular fence around a garden is ${L} m long, with a post every ${s} m. How many posts are there?`
      : `A straight fence is ${L} m long, with a post every ${s} m including one at each end. How many posts are there?`,
    answer: circular ? k : k + 1,
    traps: circular
      ? [{ value: k + 1, why: 'on a loop the "extra" end post is the same as the first post' }, { value: k - 1, why: 'one gap too few' }, { value: L, why: 'that is the length, not the number of posts' }]
      : [{ value: k, why: 'this counts the gaps between posts, not the posts — there is one more post than gaps' }, { value: k + 2, why: 'one post too many' }, { value: L, why: 'that is the length' }],
    steps: [`There are ${L} ÷ ${s} = ${k} gaps between posts.`, circular ? 'On a closed loop, posts and gaps alternate all the way round, so there are as many posts as gaps.' : 'A straight fence has one more post than gaps.'],
    rule: circular ? `${k} gaps → ${k} posts.` : `${k} gaps → ${k + 1} posts.`,
    hints: ['Draw a short version first: a fence with 2 gaps.', 'Count posts and gaps separately.', circular ? 'On a loop, does the last gap end at a new post?' : 'Each end needs its own post.'],
    check: () => (circular ? L / s : L / s + 1),
    params: { L, s, circular: String(circular) },
  };
};

const cutting: Template = (rng) => {
  const m = rng.int(2, 9);
  const p = rng.int(4, 12);
  return {
    mechanism: 'cuts',
    level: 1,
    text: `It takes ${m} minutes to saw a log into 2 pieces. Sawing at the same rate, how many minutes does it take to saw a log into ${p} pieces?`,
    answer: m * (p - 1),
    unit: 'minutes',
    traps: [
      { value: m * p, why: `that counts ${p} cuts, but ${p} pieces need only ${p - 1} cuts` },
      { value: (m * p) / 2, why: 'halving assumes each cut makes two new pieces from scratch' },
      { value: m * (p - 2), why: 'one cut too few' },
    ].filter((t) => Number.isInteger(t.value)),
    steps: ['Two pieces need one cut, so one cut takes ' + m + ' minutes.', `${p} pieces need ${p - 1} cuts: ${p - 1} × ${m} = ${m * (p - 1)} minutes.`],
    rule: 'Pieces = cuts + 1.',
    hints: ['How many cuts make 2 pieces?', 'Each cut adds exactly one piece.', `Count the cuts needed for ${p} pieces.`],
    check: () => {
      let pieces = 1;
      let t = 0;
      while (pieces < p) {
        pieces++;
        t += m;
      }
      return t;
    },
    params: { m, p },
  };
};

const socks: Template = (rng, d): Built | null => {
  const colors = ['black', 'white', 'grey', 'blue', 'green', 'red'];
  if (d >= 3 && rng.chance(0.6)) {
    const [c1, c2] = rng.sample(colors, 2);
    const n1 = rng.int(4, 12);
    const n2 = rng.int(4, 12);
    return {
      mechanism: 'pigeonhole-specific',
      level: 3,
      text: `A drawer holds ${n1} ${c1} socks and ${n2} ${c2} socks. In the dark, what is the smallest number you must take to be certain of getting two ${c1} socks?`,
      answer: n2 + 2,
      traps: [
        { value: 3, why: `3 guarantees a matching pair of some colour, but not two ${c1} socks` },
        { value: 2, why: 'you could draw socks of both colours' },
        { value: n2 + 1, why: `in the worst case all ${n2} ${c2} socks come first, leaving you with only one ${c1}` },
      ],
      steps: [`Worst case: you draw all ${n2} ${c2} socks first.`, `Then two more socks must both be ${c1}: ${n2} + 2 = ${n2 + 2}.`],
      rule: 'Plan for the worst possible luck.',
      hints: ['Think about the unluckiest possible order of draws.', `What if you kept drawing ${c2} socks?`, `After every ${c2} sock is out, how many more do you need?`],
      check: () => n2 + 2,
      params: { n1, n2 },
    };
  }
  const k = rng.int(2, 6);
  return {
    mechanism: 'pigeonhole',
    level: 2,
    text: `A drawer is full of socks in ${k} different colours (plenty of each). In the dark, how many socks must you take to be certain of a matching pair?`,
    answer: k + 1,
    traps: [
      { value: 2, why: 'two socks could be different colours' },
      { value: 2 * k, why: 'more than necessary' },
      { value: k, why: `you could draw one sock of each of the ${k} colours` },
    ],
    steps: [`In the worst case the first ${k} socks are all different colours.`, `The next sock must match one of them: ${k + 1}.`],
    rule: 'Pigeonhole principle.',
    hints: ['Imagine being as unlucky as possible.', 'How many socks could you draw without any pair?', 'One more than that guarantees a pair.'],
    check: () => k + 1,
    params: { k },
  };
};

const trains: Template = (rng) => {
  const v1 = rng.pick([40, 50, 60, 70, 80, 90]);
  const v2 = rng.pick([30, 45, 60, 75, 100, 120]);
  const minutes = rng.pick([20, 30, 40, 45, 60, 90, 120]);
  const dist = ((v1 + v2) * minutes) / 60;
  if (!Number.isInteger(dist)) return null;
  return {
    mechanism: 'meeting',
    level: 3,
    text: `Two trains start ${dist} km apart on the same line and travel towards each other, one at ${v1} km/h and the other at ${v2} km/h. After how many minutes do they meet?`,
    answer: minutes,
    unit: 'minutes',
    traps: [
      { value: Math.round((dist / Math.abs(v1 - v2 || 1)) * 60), why: 'this uses the difference of the speeds, which is for trains travelling the same way' },
      { value: Math.round((dist / v1) * 60), why: 'this ignores the second train' },
      { value: minutes + 10, why: 'an arithmetic slip' },
    ].filter((t) => Number.isFinite(t.value as number)),
    steps: [`Approaching each other, they close the gap at ${v1} + ${v2} = ${v1 + v2} km/h.`, `${dist} km ÷ ${v1 + v2} km/h = ${minutes / 60} h = ${minutes} minutes.`],
    rule: 'Closing speed = sum of speeds.',
    hints: ['How fast is the gap between them shrinking?', 'Add the speeds when objects move towards each other.', `The gap shrinks by ${v1 + v2} km every hour.`],
    check: () => {
      for (let t = 1; t <= 600; t++) if (((v1 + v2) * t) / 60 >= dist) return t;
      return null;
    },
    params: { v1, v2, dist },
  };
};

const TEMPLATES: { t: Template; min: number }[] = [
  { t: legs, min: 1 },
  { t: cutting, min: 1 },
  { t: fence, min: 1 },
  { t: calendar, min: 1 },
  { t: doubling, min: 2 },
  { t: sumDiff, min: 2 },
  { t: handshakes, min: 2 },
  { t: socks, min: 2 },
  { t: ages, min: 3 },
  { t: digits, min: 3 },
  { t: snail, min: 3 },
  { t: clockAngle, min: 3 },
  { t: trains, min: 3 },
];

interface NumHidden {
  mechanism: string;
  answer: number | string;
  [k: string]: unknown;
}

export const riddleNumeric: GeneratorDef = {
  id: 'riddle.numeric',
  category: 'riddle',
  version: 1,
  family: 'Numerical teasers',
  description: 'Word problems with classic traps: intervals, doubling, pigeonholes, relative speed and more.',
  weight: 1.2,
  candidates: 6,
  generate({ rng, difficulty }) {
    const pool = TEMPLATES.filter((x) => x.min <= difficulty && (difficulty < 4 || x.min >= 2));
    const tpl = rng.pick(pool);
    const b = tpl.t(rng, difficulty);
    if (!b) reject('template parameters failed');
    const checked = b.check();
    if (checked === null || String(checked) !== String(b.answer)) reject(`solver disagrees for ${b.mechanism}`);
    const isNum = typeof b.answer === 'number';
    const ans = String(b.answer);
    const seen = new Set([ans]);
    const traps = b.traps.filter((t) => {
      const k = String(t.value);
      if (seen.has(k) || (isNum && (Number(t.value) < 0 || !Number.isFinite(Number(t.value))))) return false;
      seen.add(k);
      return true;
    });
    if (traps.length < 3) {
      for (const extra of isNum ? [Number(b.answer) + 3, Number(b.answer) * 2, Number(b.answer) + 7] : DAYS) {
        if (traps.length >= 3) break;
        if (!seen.has(String(extra))) {
          seen.add(String(extra));
          traps.push({ value: extra, why: 'it does not satisfy the conditions in the question' });
        }
      }
    }
    const built = buildChoices(
      { key: ans, text: ans },
      traps.slice(0, 3).map((t) => ({ key: String(t.value), text: String(t.value), reason: `${t.value}${b.unit && isNum ? ` ${b.unit}` : ''}: ${t.why}.` })),
      rng,
    );
    return {
      title: 'Brain teaser',
      prompt: b.text,
      display: { blocks: [{ type: 'text', text: b.text, tone: 'lead' }] },
      interaction: isNum ? { type: 'number', placeholder: b.unit ? `Answer (${b.unit})` : 'Answer', fallback: built.choices } : { type: 'text', placeholder: 'Day of the week', fallback: built.choices },
      answer: isNum ? { type: 'number', value: Number(b.answer), fallbackCorrect: built.correctId } : { type: 'text', canonical: ans, accepted: [ans, ans.slice(0, 3)], fallbackCorrect: built.correctId },
      hints: b.hints,
      explanation: {
        answer: `${ans}${b.unit && isNum ? ` ${b.unit}` : ''}`,
        rule: b.rule,
        steps: b.steps,
        alternatives: built.alternatives,
        skills: ['numerical reasoning', 'deduction'],
      },
      metrics: { rules: 1, steps: b.steps.length, choices: 4 },
      fingerprint: { structure: `num|${b.mechanism}`, features: [`mechanism:${b.mechanism}`], detail: JSON.stringify(b.params) },
      hidden: { mechanism: b.mechanism, answer: b.answer } satisfies NumHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as NumHidden;
    if (p.answer.type === 'number' && p.answer.value !== h.answer) return ['answer mismatch'];
    if (p.answer.type === 'text' && p.answer.canonical !== h.answer) return ['answer mismatch'];
    return [];
  },
};
