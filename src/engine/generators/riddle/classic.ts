import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { Puzzle } from '../../types';
import { AUTHORED_RIDDLES } from '../../content/riddles';
import { capitalize, listJoin, reject } from '../../util';

interface ClassicHidden {
  id: string;
  [k: string]: unknown;
}

export const riddleClassic: GeneratorDef = {
  id: 'riddle.classic',
  category: 'riddle',
  version: 1,
  family: 'Classic riddles',
  description: 'A curated seed set of riddles with every legitimate answer accepted.',
  weight: 1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const pool = AUTHORED_RIDDLES.filter((r) => r.level <= difficulty && r.level >= difficulty - 2);
    if (!pool.length) reject('no riddle for this tier');
    const r = rng.pick(pool);
    const built = buildChoices(
      { key: r.answer.toLowerCase(), text: capitalize(r.answer) },
      r.wrong.map(([text, why]) => ({ key: text.toLowerCase(), text, reason: why })),
      rng,
    );
    const alt = r.alternatives?.length ? ` Also accepted: ${listJoin(r.alternatives)}.` : '';
    return {
      title: r.kind === 'numerical' || r.kind === 'deductive' ? 'Brain teaser' : 'Riddle',
      prompt: r.kind === 'what-am-i' ? 'Solve the riddle.' : 'Think it through, then answer.',
      display: { blocks: [{ type: 'text', text: r.text, tone: 'quote' }] },
      interaction: { type: 'text', placeholder: 'Your answer', fallback: built.choices },
      answer: { type: 'text', canonical: r.answer, accepted: r.accepted, alternatives: r.alternatives, fallbackCorrect: built.correctId },
      hints: r.hints,
      explanation: {
        answer: `${capitalize(r.answer)}.${alt}`,
        rule: r.explanation,
        steps: r.steps ?? [r.explanation],
        alternatives: built.alternatives,
        skills: r.kind === 'numerical' ? ['numerical reasoning', 'deduction'] : r.kind === 'deductive' ? ['deduction', 'verbal reasoning'] : ['lateral thinking', 'verbal reasoning'],
      },
      metrics: { rules: 1, steps: r.level, choices: 4 },
      fingerprint: { structure: `classic|${r.kind}`, features: [`kind:${r.kind}`, `riddle:${r.id}`], detail: r.id },
      hidden: { id: r.id } satisfies ClassicHidden,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as ClassicHidden;
    const r = AUTHORED_RIDDLES.find((x) => x.id === h.id);
    if (!r) return ['unknown riddle'];
    if (r.hints.length !== 3 || r.wrong.length !== 3) return ['riddle data incomplete'];
    return [];
  },
};
