/**
 * Lateral-thinking puzzles in three framings:
 *  - choose: pick the explanation that fits every stated fact;
 *  - investigate: ask yes/no questions (answered from the case's fact table), then choose;
 *  - open: write an explanation, then compare it with the model answer (self-assessed).
 * Cases come from an authored library plus parametric generators.
 */
import type { GeneratorDef } from '../../generator';
import { buildChoices } from '../../generator';
import type { InvestigationQuestion, Puzzle } from '../../types';
import type { LateralCase } from '../../content/lateral';
import { GENERIC_QUESTIONS, LATERAL_CASES, MECHANISM_NAMES, generationsCase, genericAnswer, leapDayCase } from '../../content/lateral';
import { reject } from '../../util';

type Framing = 'choose' | 'investigate' | 'open';

interface LateralHidden {
  caseId: string;
  framing: Framing;
  [k: string]: unknown;
}

function questionsFor(c: LateralCase, rng: { shuffle<T>(x: readonly T[]): T[]; sample<T>(x: readonly T[], k: number): T[] }): InvestigationQuestion[] {
  const specific = c.facts.map(([text, answer, note], i) => ({ id: `f${i}`, text, answer, note }));
  const generic = rng.sample(Object.keys(GENERIC_QUESTIONS), 5).map((k) => ({ id: `g-${k}`, text: GENERIC_QUESTIONS[k], answer: genericAnswer(c, k) }));
  return rng.shuffle([...specific, ...generic]);
}

export const lateralThinking: GeneratorDef = {
  id: 'lateral.scenario',
  category: 'lateral',
  version: 1,
  family: 'Lateral thinking',
  description: 'Strange situations with a hidden but fully consistent explanation.',
  weight: 1,
  candidates: 6,
  generate({ rng, difficulty }) {
    const roll = rng.next();
    let c: LateralCase;
    if (roll < 0.12 && difficulty >= 2) c = leapDayCase(rng);
    else if (roll < 0.24) c = generationsCase(rng);
    else {
      const pool = LATERAL_CASES.filter((x) => x.level <= difficulty + 1 && x.level >= difficulty - 1);
      if (!pool.length) reject('no case for this tier');
      c = rng.pick(pool);
    }
    const framings: Framing[] = difficulty === 1 ? ['choose', 'choose', 'investigate'] : difficulty === 2 ? ['choose', 'investigate', 'investigate'] : difficulty === 3 ? ['investigate', 'investigate', 'open'] : ['investigate', 'open'];
    const framing = rng.pick(framings);
    const keyFacts = c.facts.filter(([, a]) => a !== 'irrelevant').slice(0, 3).map(([q, a, note]) => `${q} — ${a.toUpperCase()}${note ? ` (${note})` : ''}`);
    const common = {
      title: framing === 'investigate' ? 'Investigate the mystery' : framing === 'open' ? 'Explain the situation' : 'Lateral thinking',
      hints: c.hints,
      metrics: { rules: c.keyPoints.length, steps: c.level + (framing === 'open' ? 1 : 0), choices: framing === 'open' ? undefined : 4 },
      fingerprint: { structure: `lateral|${c.mechanism}|${framing}`, features: [`mechanism:${c.mechanism}`, `framing:${framing}`, `case:${c.id.replace(/-\d+.*$/, '')}`], detail: `${c.id}|${framing}` },
      hidden: { caseId: c.id, framing } satisfies LateralHidden,
    };
    const steps = [`The trick: ${MECHANISM_NAMES[c.mechanism]}.`, ...c.keyPoints.map((k) => `Key point: ${k}.`), ...keyFacts.map((f) => `Consistent fact: ${f}`)];
    if (framing === 'open') {
      return {
        ...common,
        prompt: `${c.setup} ${c.question} Write the explanation you think fits every fact, then compare it with the solution.`,
        display: {
          blocks: [
            { type: 'text', text: c.setup, tone: 'quote' },
            { type: 'text', text: 'Free-text explanations cannot be marked reliably by a computer, so after revealing the solution you will compare your answer with its key points yourself.', tone: 'note' },
          ],
        },
        interaction: { type: 'open', placeholder: 'Your explanation…' },
        answer: { type: 'self', model: c.solution, keyPoints: c.keyPoints },
        explanation: {
          answer: c.solution,
          rule: `This puzzle hinges on ${MECHANISM_NAMES[c.mechanism]}.`,
          steps,
          alternatives: c.wrong.map(([text, why]) => ({ label: text, reason: why })),
          skills: ['lateral thinking', 'hypothesis testing'],
        },
      };
    }
    const built = buildChoices(
      { key: c.short, text: c.short },
      c.wrong.map(([text, why]) => ({ key: text, text, reason: why })),
      rng,
    );
    const explanation = {
      answer: `Option ${built.correctLabel}: ${c.short}`,
      rule: c.solution,
      steps,
      alternatives: built.alternatives,
      skills: ['lateral thinking', 'hypothesis testing'] as Puzzle['explanation']['skills'],
    };
    if (framing === 'investigate') {
      return {
        ...common,
        prompt: `${c.question} Ask as many yes/no questions as you like, then choose the explanation that fits every answer.`,
        display: { blocks: [{ type: 'text', text: c.setup, tone: 'quote' }] },
        interaction: { type: 'investigation', questions: questionsFor(c, rng), choices: built.choices },
        answer: { type: 'choice', correct: built.correctId },
        explanation,
      };
    }
    return {
      ...common,
      prompt: `${c.question} Choose the explanation that fits every detail.`,
      display: { blocks: [{ type: 'text', text: c.setup, tone: 'quote' }] },
      interaction: { type: 'choice', choices: built.choices },
      answer: { type: 'choice', correct: built.correctId },
      explanation,
    };
  },
  verify(p: Puzzle) {
    const h = p.hidden as unknown as LateralHidden;
    if (p.interaction.type === 'investigation') {
      for (const q of p.interaction.questions) if (!['yes', 'no', 'irrelevant'].includes(q.answer)) return ['bad investigation answer'];
    }
    if (h.framing === 'open') return p.interaction.type === 'open' && p.answer.type === 'self' ? [] : ['framing mismatch'];
    if ((p.interaction.type !== 'choice' && p.interaction.type !== 'investigation') || p.answer.type !== 'choice') return ['framing mismatch'];
    const authored = LATERAL_CASES.find((c) => c.id === h.caseId);
    if (authored) {
      const correct = p.interaction.choices.find((c) => c.id === (p.answer as { correct: string }).correct);
      if (correct?.text !== authored.short) return ['correct option is not the case solution'];
    }
    return [];
  },
};
