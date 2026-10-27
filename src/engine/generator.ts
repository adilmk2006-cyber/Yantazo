import type { Category, Choice, Difficulty, Puzzle, PuzzleDraft, Visual } from './types';
import type { Rng } from './rng';
import { choiceLabel } from './util';

export interface GenContext {
  rng: Rng;
  difficulty: Difficulty;
}

export interface GeneratorDef {
  /** Stable id, e.g. "visual.matrix". */
  id: string;
  category: Category;
  /**
   * Bump whenever the output for an existing seed changes. Saved references
   * with an older version are reported as not reproducible instead of silently
   * producing a different puzzle.
   */
  version: number;
  /** Human readable family name. */
  family: string;
  description: string;
  minDifficulty?: Difficulty;
  /** Relative selection weight inside its category. */
  weight?: number;
  /** How many valid candidates the selector may compare for diversity. */
  candidates?: number;
  /** Must be deterministic for a given rng seed + difficulty. Throws RejectCandidate when invalid. */
  generate(ctx: GenContext): PuzzleDraft;
  /** Independent re-derivation of the answer from hidden rule data. Returns problems found. */
  verify?(p: Puzzle): string[];
}

export interface ChoiceSpec {
  key: string;
  text?: string;
  visual?: Visual;
  /** Why this option is wrong (omitted for the correct option). */
  reason?: string;
  /** Short name of the wrong option for the explanation list. */
  name?: string;
}

export interface BuiltChoices {
  choices: Choice[];
  correctId: string;
  alternatives: { label: string; reason: string; choiceId: string }[];
  correctLabel: string;
}

/**
 * Shuffles option specs, assigns stable ids and A/B/C labels, and returns the
 * explanation entries for every distractor. Throws if two options share a key.
 */
export function buildChoices(correct: ChoiceSpec, distractors: ChoiceSpec[], rng: Rng): BuiltChoices {
  const all = [{ ...correct, isCorrect: true }, ...distractors.map((d) => ({ ...d, isCorrect: false }))];
  const keys = new Set(all.map((a) => a.key));
  if (keys.size !== all.length) throw new Error('Duplicate option keys');
  const shuffled = rng.shuffle(all);
  let correctId = '';
  let correctLabel = '';
  const alternatives: BuiltChoices['alternatives'] = [];
  const choices = shuffled.map((spec, i) => {
    const id = `c${i}`;
    const label = choiceLabel(i);
    if (spec.isCorrect) {
      correctId = id;
      correctLabel = label;
    } else {
      alternatives.push({
        label: spec.name ? `${label} — ${spec.name}` : `Option ${label}`,
        reason: spec.reason ?? 'It breaks at least one of the governing rules.',
        choiceId: id,
      });
    }
    const choice: Choice = { id, label };
    if (spec.text !== undefined) choice.text = spec.text;
    if (spec.visual !== undefined) choice.visual = spec.visual;
    return choice;
  });
  alternatives.sort((a, b) => a.label.localeCompare(b.label));
  return { choices, correctId, alternatives, correctLabel };
}
