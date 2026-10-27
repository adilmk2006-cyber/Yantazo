/**
 * Case verifier. A case is accepted only if:
 *  - every reference (statements, evidence, timeline sources, solution) exists;
 *  - every listed contradiction is a genuine conflict between the statement's
 *    structured claim and the evidence's structured facts;
 *  - combining all evidence leaves exactly one suspect with means, access and
 *    an unaccounted-for slot inside the murder window — the stated culprit;
 *  - every other suspect is excluded by evidence the solution cites;
 *  - the culprit is exposed by at least one non-red-herring contradiction.
 */
import type { Clock, Contradiction, Evidence, Fact, MysteryCase } from './types';

export function toMinutes(t: Clock, crossesMidnight: boolean): number {
  const [h, m] = t.split(':').map(Number);
  const base = h * 60 + m;
  return crossesMidnight && h < 12 ? base + 24 * 60 : base;
}

type Interval = [number, number];

/** Parts of `win` not covered by any interval. */
export function uncovered(win: Interval, covers: Interval[]): Interval[] {
  let gaps: Interval[] = [win];
  for (const [a, b] of covers) {
    const next: Interval[] = [];
    for (const [x, y] of gaps) {
      if (b < x || a > y) {
        next.push([x, y]);
        continue;
      }
      if (a > x) next.push([x, a - 1]);
      if (b < y) next.push([b + 1, y]);
    }
    gaps = next;
  }
  return gaps.filter(([x, y]) => y >= x);
}

export interface SuspectAnalysis {
  id: string;
  means: boolean | null;
  access: boolean;
  opportunity: boolean;
  possible: boolean;
  excludedBy: string[];
}

export interface CaseAnalysis {
  window: Interval | null;
  suspects: SuspectAnalysis[];
  candidates: string[];
}

function factsOf(c: MysteryCase): { ev: Evidence; f: Fact }[] {
  return c.evidence.flatMap((ev) => ev.facts.map((f) => ({ ev, f })));
}

export function analyseCase(c: MysteryCase): CaseAnalysis {
  const m = (t: Clock) => toMinutes(t, c.crossesMidnight);
  const all = factsOf(c);
  let window: Interval | null = null;
  for (const { f } of all) {
    if (f.t !== 'window') continue;
    const w: Interval = [m(f.from), m(f.to)];
    window = window ? [Math.max(window[0], w[0]), Math.min(window[1], w[1])] : w;
  }
  const suspects: SuspectAnalysis[] = c.suspects.map((s) => {
    const mine = all.filter(({ f }) => 'who' in f && f.who === s.id);
    const meansFacts = mine.filter(({ f }) => f.t === 'means');
    const means = meansFacts.length ? meansFacts.every(({ f }) => f.t === 'means' && f.value) : null;
    const accessFacts = mine.filter(({ f }) => f.t === 'access');
    const access = accessFacts.every(({ f }) => f.t === 'access' && f.value);
    const away = mine.filter(({ f }) => f.t === 'elsewhere').map(({ f }) => f as Extract<Fact, { t: 'elsewhere' }>);
    const gaps = window ? uncovered(window, away.map((a) => [m(a.from), m(a.to)] as Interval)) : [];
    const opportunity = !!window && gaps.length > 0;
    const excludedBy = new Set<string>();
    if (means === false) meansFacts.forEach(({ ev, f }) => f.t === 'means' && !f.value && excludedBy.add(ev.id));
    if (!access) accessFacts.forEach(({ ev, f }) => f.t === 'access' && !f.value && excludedBy.add(ev.id));
    if (!opportunity) mine.filter(({ f }) => f.t === 'elsewhere').forEach(({ ev }) => excludedBy.add(ev.id));
    return { id: s.id, means, access, opportunity, possible: means === true && access && opportunity, excludedBy: [...excludedBy] };
  });
  return { window, suspects, candidates: suspects.filter((s) => s.possible).map((s) => s.id) };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

export function contradictionHolds(c: MysteryCase, k: Contradiction): boolean {
  const m = (t: Clock) => toMinutes(t, c.crossesMidnight);
  const st = c.suspects.flatMap((s) => s.statements).find((x) => x.id === k.statementId);
  const ev = c.evidence.find((e) => e.id === k.evidenceId);
  if (!st?.claim || !ev) return false;
  const claim = st.claim;
  if (claim.t === 'topic') return ev.facts.some((f) => f.t === 'record' && f.topic === claim.topic);
  const ci: Interval = [m(claim.from), m(claim.to)];
  return ev.facts.some(
    (f) => (f.t === 'seen' || f.t === 'elsewhere') && f.who === claim.who && f.where !== claim.where && overlaps(ci, [m(f.from), m(f.to)]),
  );
}

export function verifyCase(c: MysteryCase): string[] {
  const problems: string[] = [];
  const fail = (s: string) => problems.push(`${c.id}: ${s}`);
  const suspectIds = new Set(c.suspects.map((s) => s.id));
  const evidenceIds = new Set(c.evidence.map((e) => e.id));
  const statementIds = new Set(c.suspects.flatMap((s) => s.statements.map((x) => x.id)));
  const sourceIds = new Set([...evidenceIds, ...statementIds]);

  if (c.suspects.length < 4) fail('needs at least four suspects');
  if (c.evidence.length < 8) fail('needs at least eight pieces of evidence');
  if (suspectIds.size !== c.suspects.length) fail('duplicate suspect ids');
  if (evidenceIds.size !== c.evidence.length) fail('duplicate evidence ids');
  if (statementIds.size !== c.suspects.reduce((n, s) => n + s.statements.length, 0)) fail('duplicate statement ids');
  for (const s of c.suspects) {
    if (s.statements.length < 2) fail(`${s.id} needs at least two statements`);
    if (!s.motive || !s.alibi || !s.relationship) fail(`${s.id} needs a motive, alibi and relationship`);
  }
  for (const ev of c.evidence) {
    for (const f of ev.facts) if ('who' in f && !suspectIds.has(f.who)) fail(`${ev.id} refers to unknown suspect ${f.who}`);
  }
  for (const t of c.timeline) for (const src of t.sources) if (!sourceIds.has(src)) fail(`timeline ${t.id} cites unknown source ${src}`);
  if (c.contradictions.length < 2) fail('needs at least two contradictions');
  for (const k of c.contradictions) {
    if (!statementIds.has(k.statementId) || !evidenceIds.has(k.evidenceId)) fail(`contradiction ${k.id} has a broken reference`);
    else if (!contradictionHolds(c, k)) fail(`contradiction ${k.id} is not a real conflict between claim and evidence`);
    if (!suspectIds.has(k.exposes)) fail(`contradiction ${k.id} exposes unknown suspect`);
  }
  if (!suspectIds.has(c.truth.culprit)) fail('culprit is not a suspect');
  if (!c.methods.some((x) => x.id === c.truth.method)) fail('true method is not among the method options');
  if (c.methods.length < 3) fail('needs at least three method options');
  for (const k of c.truth.keyEvidence) if (!evidenceIds.has(k)) fail(`key evidence ${k} missing`);
  for (const d of c.solution.decisive) if (!evidenceIds.has(d.evidenceId)) fail(`decisive evidence ${d.evidenceId} missing`);
  for (const r of c.solution.redHerrings) if (!r.explanation.trim() || !sourceIds.has(r.ref)) fail(`red herring ${r.ref} needs a valid reference and explanation`);
  if (c.solution.redHerrings.length < 2) fail('needs at least two explained red herrings');

  const analysis = analyseCase(c);
  if (!analysis.window) fail('no murder window established by the evidence');
  if (analysis.candidates.length !== 1 || analysis.candidates[0] !== c.truth.culprit)
    fail(`evidence leaves ${analysis.candidates.length ? analysis.candidates.join(', ') : 'nobody'} as possible culprit(s), expected only ${c.truth.culprit}`);
  for (const s of analysis.suspects) {
    if (s.means === null) fail(`means not established for ${s.id}`);
    if (s.id === c.truth.culprit) continue;
    const elim = c.solution.eliminations.find((e) => e.suspectId === s.id);
    if (!elim) fail(`no elimination given for ${s.id}`);
    else if (!elim.evidence.some((e) => s.excludedBy.includes(e))) fail(`elimination of ${s.id} does not cite the evidence that excludes them (${s.excludedBy.join(', ')})`);
  }
  const culpritExposed = c.contradictions.some((k) => k.exposes === c.truth.culprit && !k.redHerring && contradictionHolds(c, k));
  if (!culpritExposed) fail('the culprit is never caught in a lie by the evidence');
  // the key evidence must actually place the culprit at the scene or establish the method
  const keyFacts = c.evidence.filter((e) => c.truth.keyEvidence.includes(e.id)).flatMap((e) => e.facts);
  if (!keyFacts.some((f) => (f.t === 'seen' || f.t === 'means') && 'who' in f && f.who === c.truth.culprit)) fail('key evidence does not tie the culprit to the scene or method');
  return problems;
}
