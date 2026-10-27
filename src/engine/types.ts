/**
 * Core data model shared by every generator, the validation layer and the UI.
 * Everything in a Puzzle is plain JSON so it can be snapshotted if needed,
 * but normally only (generator, version, difficulty, seed) is persisted.
 */

export type Category = 'visual' | 'fluid' | 'logic' | 'lateral' | 'riddle' | 'spatial' | 'observation';

export const CATEGORIES: readonly Category[] = ['visual', 'fluid', 'logic', 'lateral', 'riddle', 'spatial', 'observation'];

export type Difficulty = 1 | 2 | 3 | 4;

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4];

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  1: 'Initiate',
  2: 'Analyst',
  3: 'Investigator',
  4: 'Mastermind',
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  1: 'Simple patterns, clear rules and short deductions.',
  2: 'More conditions, plausible distractors and moderate reasoning chains.',
  3: 'Multiple interacting rules and multi-step deductions.',
  4: 'Complex but fair puzzles that combine several observations.',
};

export type Skill =
  | 'pattern recognition'
  | 'abstract reasoning'
  | 'fluid reasoning'
  | 'rule induction'
  | 'deduction'
  | 'constraint satisfaction'
  | 'spatial visualisation'
  | 'mental rotation'
  | 'lateral thinking'
  | 'verbal reasoning'
  | 'numerical reasoning'
  | 'working memory'
  | 'visual attention'
  | 'observation'
  | 'hypothesis testing';

/* ------------------------------------------------------------------ */
/* Visual primitives                                                   */
/* ------------------------------------------------------------------ */

export type ShapeKind =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cross'
  | 'heart'
  | 'arrow'
  | 'semicircle'
  | 'drop'
  | 'lshape'
  | 'flag'
  | 'ring'
  | 'xmark'
  | 'star4'
  | 'dots4';

/** 0 outline, 1 dotted, 2 striped, 3 solid. Each level also has its own colour. */
export type Shade = 0 | 1 | 2 | 3;

export interface Glyph {
  shape: ShapeKind;
  /** Centre in a 0..100 view box. */
  x: number;
  y: number;
  /** Radius in view-box units. */
  r: number;
  /** Clockwise rotation in 45° steps (0..7). */
  rot: number;
  /** Reflected about its own vertical axis before rotating. */
  mirror?: boolean;
  shade: number;
  /** Optional emphasis ring used in explanations (never before answering). */
  highlight?: boolean;
}

export interface FigureLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

export interface Figure {
  glyphs: Glyph[];
  frame?: 'none' | 'grid3' | 'grid4' | 'ring8';
  lines?: FigureLine[];
}

export type CubeSymbol = 'circle' | 'ring' | 'cross' | 'xmark' | 'square' | 'diamond' | 'dots4' | 'star4';

export interface CellLayer {
  cells: [number, number][];
  style: 'solid' | 'ghost' | 'striped' | 'accent' | 'outline';
}

export interface PaperHole {
  x: number;
  y: number;
}

export type Visual =
  | { kind: 'figure'; figure: Figure }
  | {
      kind: 'cells';
      w: number;
      h: number;
      layers: CellLayer[];
      marks?: { x: number; y: number; text: string }[];
      gridLines?: boolean;
    }
  | {
      kind: 'paper';
      /** Paper is n×n units. */
      n: number;
      /** Outline of the visible (folded) paper, in paper units. */
      region: [number, number][];
      /** Dashed outline of the original square. */
      ghost?: boolean;
      foldLine?: [number, number, number, number];
      /** Arrow showing the fold motion: from → to (paper units). */
      arrow?: [number, number, number, number];
      holes: PaperHole[];
    }
  | { kind: 'cube'; top: CubeSymbol; left: CubeSymbol; right: CubeSymbol }
  | { kind: 'net'; cells: { x: number; y: number; symbol: CubeSymbol }[] }
  | { kind: 'tokens'; tokens: string[]; style: 'letter' | 'symbol' }
  | { kind: 'matchsticks'; text: string; highlight?: { from?: [number, number]; to?: [number, number] } }
  | { kind: 'num-triangle'; corners: [string, string, string]; center: string }
  | {
      kind: 'path-grid';
      rows: number;
      cols: number;
      start: [number, number];
      facing: 0 | 1 | 2 | 3;
      blocked?: [number, number][];
      landmarks?: { x: number; y: number; label: string }[];
      path?: [number, number][];
      end?: [number, number];
      labels?: boolean;
    }
  | { kind: 'text'; text: string; big?: boolean };

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

export type Block =
  | { type: 'text'; text: string; tone?: 'lead' | 'note' | 'quote' | 'warning' }
  | { type: 'list'; items: string[]; ordered?: boolean; title?: string }
  | { type: 'matrix'; cols: number; cells: (Visual | null)[] }
  | { type: 'sequence'; items: (Visual | null)[] }
  | {
      type: 'gallery';
      items: { visual: Visual; caption?: string; tag?: 'accepted' | 'rejected' }[];
      size?: 'sm' | 'md' | 'lg';
    }
  | { type: 'pairs'; pairs: { input: Visual; output: Visual | null }[]; caption?: string }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'visual'; visual: Visual; caption?: string; size?: 'sm' | 'md' | 'lg' }
  | { type: 'equations'; lines: string[][] }
  | { type: 'statements'; items: { speaker: string; text: string }[] };

export interface Display {
  blocks: Block[];
  /** Observation puzzles: shown first for `exposureMs`, then hidden before the question. */
  memorize?: { blocks: Block[]; exposureMs: number; instruction: string };
}

export interface Choice {
  id: string;
  label: string;
  text?: string;
  visual?: Visual;
}

export interface InvestigationQuestion {
  id: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant';
  note?: string;
}

export type Interaction =
  | { type: 'choice'; choices: Choice[]; columns?: number }
  | { type: 'multi'; choices: Choice[]; instruction: string }
  | { type: 'text'; placeholder?: string; fallback?: Choice[] }
  | { type: 'number'; placeholder?: string; fallback?: Choice[] }
  | { type: 'order'; items: string[]; slots: string[]; circular?: boolean }
  | { type: 'assign'; rows: string[]; rowHeader: string; columns: { name: string; options: string[] }[] }
  | { type: 'cell'; base: Visual; rows: number; cols: number }
  | { type: 'sequence'; palette: { id: string; visual: Visual; name: string }[]; length: number }
  | { type: 'glyphs'; figure: Figure; count: number }
  | { type: 'investigation'; questions: InvestigationQuestion[]; choices: Choice[] }
  | { type: 'open'; placeholder?: string };

export type Answer =
  | { type: 'choice'; correct: string }
  | { type: 'multi'; correct: string[] }
  | { type: 'text'; accepted: string[]; canonical: string; alternatives?: string[]; fallbackCorrect?: string }
  | { type: 'number'; value: number; fallbackCorrect?: string }
  | { type: 'order'; solution: number[] }
  | { type: 'assign'; solution: number[][] }
  | { type: 'cell'; index: number }
  | { type: 'sequence'; items: string[] }
  | { type: 'glyphs'; indices: number[] }
  | { type: 'self'; model: string; keyPoints: string[] };

export type PlayerResponse =
  | { type: 'choice'; id: string; viaFallback?: boolean }
  | { type: 'multi'; ids: string[] }
  | { type: 'text'; text: string }
  | { type: 'number'; value: number }
  | { type: 'order'; slots: (number | null)[] }
  | { type: 'assign'; table: (number | null)[][] }
  | { type: 'cell'; index: number }
  | { type: 'sequence'; items: string[] }
  | { type: 'glyphs'; indices: number[] }
  | { type: 'self'; text: string; verdict: 'match' | 'partial' | 'miss' };

export interface Explanation {
  /** Human readable statement of the correct answer. */
  answer: string;
  answerVisual?: Visual;
  /** The governing rule, relationship or decisive clue. */
  rule: string;
  /** Step-by-step demonstration. */
  steps: string[];
  /** Why plausible alternatives fail. */
  alternatives: { label: string; reason: string; choiceId?: string }[];
  skills: Skill[];
}

export interface Fingerprint {
  /** Coarse structural class, e.g. "matrix3|single|progression+distribute". */
  structure: string;
  /** Feature tokens used for over-use detection (rule families, mechanisms…). */
  features: string[];
  /** Hash of generator + structure + sorted features + answer structure. */
  key: string;
}

export interface PuzzleMetrics {
  /** Number of governing rules / constraints the player must combine. */
  rules: number;
  /** Rough length of the reasoning chain. */
  steps: number;
  choices?: number;
}

export interface Puzzle {
  id: string;
  seed: string;
  generator: string;
  version: number;
  category: Category;
  difficulty: Difficulty;
  /** Human readable family name ("Matrix reasoning"). */
  family: string;
  title: string;
  prompt: string;
  display: Display;
  interaction: Interaction;
  answer: Answer;
  hints: [string, string, string];
  explanation: Explanation;
  fingerprint: Fingerprint;
  metrics: PuzzleMetrics;
  /** Generator specific solution data used by its verifier. Never shown before answering. */
  hidden: Record<string, unknown>;
}

export type PuzzleDraft = Omit<
  Puzzle,
  'id' | 'seed' | 'generator' | 'version' | 'category' | 'difficulty' | 'fingerprint' | 'family'
> & {
  /** `detail` distinguishes exact duplicates; it never contains names or colours alone. */
  fingerprint: { structure: string; features: string[]; detail?: string };
};

/** Minimal data needed to rebuild a puzzle exactly. */
export interface PuzzleRef {
  generator: string;
  version: number;
  difficulty: Difficulty;
  seed: string;
}

export interface CheckResult {
  correct: boolean;
  /** 0..1 partial credit (e.g. ordering with some slots right). */
  score: number;
  /** Optional detail for the result panel. */
  detail?: string;
  /** True when correctness came from the player's own self-assessment. */
  selfAssessed?: boolean;
}

export const CATEGORY_INFO: Record<Category, { name: string; short: string; blurb: string; icon: string }> = {
  visual: {
    name: 'Visual Patterns',
    short: 'Visual',
    blurb: 'Matrices, sequences, analogies and odd-one-out panels built from composable transformations.',
    icon: 'matrix',
  },
  fluid: {
    name: 'Fluid Reasoning',
    short: 'Fluid',
    blurb: 'Infer unfamiliar rules from examples, then apply them to something new.',
    icon: 'fluid',
  },
  logic: {
    name: 'Logic & Deduction',
    short: 'Logic',
    blurb: 'Solver-verified ordering, seating, scheduling, matching, truth-teller and implication puzzles.',
    icon: 'logic',
  },
  lateral: {
    name: 'Lateral Thinking',
    short: 'Lateral',
    blurb: 'Question your assumptions. Investigate with yes/no questions and find the hidden explanation.',
    icon: 'lateral',
  },
  riddle: {
    name: 'Riddles & Teasers',
    short: 'Riddles',
    blurb: 'Wordplay, number sequences, matchsticks and numerical brain teasers.',
    icon: 'riddle',
  },
  spatial: {
    name: 'Spatial Reasoning',
    short: 'Spatial',
    blurb: 'Rotations, mirrors, paper folding, cube nets, assembly and grid navigation.',
    icon: 'spatial',
  },
  observation: {
    name: 'Observation & Memory',
    short: 'Observation',
    blurb: 'Recall sequences and locations, spot differences and catch inconsistencies.',
    icon: 'observation',
  },
};
