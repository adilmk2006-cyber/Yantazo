/**
 * Murder-mystery case model. Text is for the player; the structured `facts`
 * and `claim` fields encode what each piece of evidence establishes so the
 * case can be verified mechanically (see verify.ts).
 */

export type Clock = string; // "HH:MM"

export type Fact =
  /** The killing (or, for poisonings, the poisoning) happened inside this window. */
  | { t: 'window'; from: Clock; to: Clock }
  /** Independently verified: the person was somewhere else (or incapable of acting) for this interval. */
  | { t: 'elsewhere'; who: string; from: Clock; to: Clock; where: string }
  /** Independently verified: the person was at (or entering) the scene during this interval. */
  | { t: 'seen'; who: string; from: Clock; to: Clock; where: string }
  /** Whether the person could have used the murder method. */
  | { t: 'means'; who: string; value: boolean; note: string }
  /** Whether the person could physically reach the scene. */
  | { t: 'access'; who: string; value: boolean; note: string }
  /** A documented fact on a topic, used to expose lies that are not about the murder itself. */
  | { t: 'record'; topic: string };

export type Claim =
  | { t: 'whereabouts'; who: string; from: Clock; to: Clock; where: string }
  | { t: 'topic'; topic: string };

export interface Statement {
  id: string;
  question: string;
  answer: string;
  claim?: Claim;
}

export interface Portrait {
  hue: number;
  skin: number;
  hair: 'short' | 'long' | 'bun' | 'bald' | 'curly' | 'swept';
  hairColor: number;
  accessory: 'none' | 'glasses' | 'hat' | 'beard' | 'scarf' | 'earrings';
}

export interface Suspect {
  id: string;
  name: string;
  role: string;
  portrait: Portrait;
  bio: string;
  relationship: string;
  motive: string;
  alibi: string;
  statements: Statement[];
}

export interface Evidence {
  id: string;
  title: string;
  kind: 'physical' | 'document' | 'forensic' | 'testimony' | 'record' | 'photo';
  location: string;
  summary: string;
  details: string;
  facts: Fact[];
}

export interface TimelineEvent {
  id: string;
  time: Clock;
  text: string;
  /** Evidence or statement ids that reveal this event to the player. */
  sources: string[];
  kind: 'established' | 'claimed';
}

export interface Contradiction {
  id: string;
  statementId: string;
  evidenceId: string;
  explanation: string;
  /** Suspect whose lie this exposes. */
  exposes: string;
  /** True when the lie hides something other than the murder. */
  redHerring: boolean;
}

export interface MysteryCase {
  id: string;
  title: string;
  subtitle: string;
  setting: string;
  difficulty: 1 | 2 | 3 | 4;
  /** One-line description of the investigative structure, shown on the case card. */
  structure: string;
  crossesMidnight: boolean;
  synopsis: string;
  victim: { name: string; description: string; found: string };
  scene: string;
  suspects: Suspect[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  contradictions: Contradiction[];
  methods: { id: string; text: string }[];
  truth: {
    culprit: string;
    method: string;
    motive: string;
    /** Evidence that, on its own, points decisively at the culprit (any one is accepted as the key evidence). */
    keyEvidence: string[];
    narrative: { time: Clock; text: string }[];
  };
  solution: {
    summary: string;
    decisive: { evidenceId: string; why: string }[];
    eliminations: { suspectId: string; reason: string; evidence: string[] }[];
    redHerrings: { ref: string; explanation: string }[];
  };
}
