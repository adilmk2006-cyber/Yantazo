/**
 * Small finite-domain constraint solver used by the logic generators.
 *
 *  - countSolutions: bounded backtracking search (stops at `limit` solutions
 *    or when the node budget is spent) — used to prove uniqueness.
 *  - deduce: human-style propagation (clue eliminations, naked/hidden
 *    singles, one-level "suppose … contradiction" probing) that records a
 *    readable trace. Puzzles are only accepted if this trace reaches the
 *    unique solution, so the explanation always matches the verified answer.
 */

export interface Constraint {
  vars: number[];
  test: (vals: number[]) => boolean;
  /** Clue number shown to the player (1-based); 0 for structural rules. */
  clue: number;
  text: string;
  /** Apply `test` to each listed variable on its own (a unary rule on many variables). */
  forEach?: boolean;
}

export interface CspPhrasing {
  /** "Ava cannot be in position 4 or 5" */
  elim(v: number, values: number[]): string;
  /** "Ava must be in position 2" */
  assign(v: number, value: number): string;
  /** "Ava is in position 2" */
  fact(v: number, value: number): string;
  /** "Ava" — used when a variable runs out of options */
  name(v: number): string;
}

export interface Csp {
  vars: { name: string; domain: number[] }[];
  constraints: Constraint[];
  groups: { vars: number[]; bijective: boolean }[];
  phrasing: CspPhrasing;
}

export interface SolveCount {
  count: number;
  exhausted: boolean;
  solutions: number[][];
  nodes: number;
}

export function countSolutions(csp: Csp, limit = 2, budget = 400000): SolveCount {
  const n = csp.vars.length;
  const order = csp.vars.map((_, i) => i).sort((a, b) => csp.vars[a].domain.length - csp.vars[b].domain.length);
  const depthOf = new Array<number>(n);
  order.forEach((v, d) => (depthOf[v] = d));
  // constraints checked when their last variable (in search order) is assigned
  const checksAt: Constraint[][] = order.map(() => []);
  const unaryAt: { c: Constraint; v: number }[][] = order.map(() => []);
  for (const c of csp.constraints) {
    if (c.forEach) {
      for (const v of c.vars) unaryAt[depthOf[v]].push({ c, v });
    } else {
      const d = Math.max(...c.vars.map((v) => depthOf[v]));
      checksAt[d].push(c);
    }
  }
  const groupsOf: number[][][] = csp.vars.map(() => []);
  for (const g of csp.groups) for (const v of g.vars) groupsOf[v].push(g.vars);
  const vals = new Array<number>(n).fill(-1);
  const solutions: number[][] = [];
  let nodes = 0;
  let exhausted = false;
  const rec = (d: number) => {
    if (solutions.length >= limit || exhausted) return;
    if (d === n) {
      solutions.push(vals.slice());
      return;
    }
    const v = order[d];
    outer: for (const x of csp.vars[v].domain) {
      if (++nodes > budget) {
        exhausted = true;
        return;
      }
      for (const g of groupsOf[v]) for (const u of g) if (u !== v && vals[u] === x) continue outer;
      vals[v] = x;
      for (const { c } of unaryAt[d]) if (!c.test([x])) { vals[v] = -1; continue outer; }
      for (const c of checksAt[d]) if (!c.test(c.vars.map((u) => vals[u]))) { vals[v] = -1; continue outer; }
      rec(d + 1);
      vals[v] = -1;
      if (solutions.length >= limit || exhausted) return;
    }
  };
  rec(0);
  return { count: solutions.length, exhausted, solutions, nodes };
}

export interface DeductionResult {
  solved: boolean;
  steps: string[];
  contradictions: number;
  domains: number[][];
}

type Recorder = ((line: string) => void) | null;

/** Returns true when consistent. On contradiction returns the variable left without options (or -1). Mutates `dom`. */
function propagate(csp: Csp, dom: number[][], record: Recorder): true | number {
  const { phrasing } = csp;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    // clue eliminations
    for (const c of csp.constraints) {
      const removed = new Map<number, number[]>();
      if (c.forEach) {
        for (const v of c.vars) {
          const keep = dom[v].filter((x) => c.test([x]));
          if (keep.length !== dom[v].length) {
            removed.set(v, dom[v].filter((x) => !keep.includes(x)));
            dom[v] = keep;
          }
        }
      } else {
        for (let i = 0; i < c.vars.length; i++) {
          const v = c.vars[i];
          const others = c.vars.filter((_, j) => j !== i);
          const keep = dom[v].filter((x) => hasSupport(c, i, x, others, dom));
          if (keep.length !== dom[v].length) {
            removed.set(v, [...(removed.get(v) ?? []), ...dom[v].filter((x) => !keep.includes(x))]);
            dom[v] = keep;
          }
        }
      }
      if (removed.size) {
        changed = true;
        for (const v of removed.keys()) if (dom[v].length === 0) return v;
        if (record) {
          const label = c.clue > 0 ? `Clue ${c.clue}` : 'Rule';
          const fixed = [...removed.keys()].filter((v) => dom[v].length === 1);
          if (c.vars.length === 1 && !c.forEach) {
            // a unary clue simply restates itself; only narrate what it settles
            record(`${label}: ${c.text}${fixed.length ? ` — so ${phrasing.assign(fixed[0], dom[fixed[0]][0])}` : ''}.`);
          } else {
            const parts = [...removed.entries()].map(([v, xs]) => `${phrasing.elim(v, xs)}${dom[v].length === 1 ? ` — so ${phrasing.assign(v, dom[v][0])}` : ''}`);
            record(`${label} (${c.text}): ${parts.join('; ')}.`);
          }
        }
      }
    }
    // all-different reasoning
    for (const g of csp.groups) {
      for (const v of g.vars) {
        if (dom[v].length !== 1) continue;
        const x = dom[v][0];
        const touched: number[] = [];
        for (const u of g.vars) {
          if (u === v || !dom[u].includes(x)) continue;
          dom[u] = dom[u].filter((y) => y !== x);
          touched.push(u);
          if (dom[u].length === 0) return u;
        }
        if (touched.length) {
          changed = true;
          const settled = touched.filter((u) => dom[u].length === 1);
          if (settled.length && record)
            record(`Since ${phrasing.fact(v, x)}, ${settled.map((u) => phrasing.assign(u, dom[u][0])).join(' and ')}.`);
        }
      }
      if (g.bijective) {
        const values = new Set(g.vars.flatMap((v) => dom[v]));
        for (const x of values) {
          const holders = g.vars.filter((v) => dom[v].includes(x));
          if (holders.length === 1 && dom[holders[0]].length > 1) {
            dom[holders[0]] = [x];
            changed = true;
            record?.(`By elimination, ${phrasing.assign(holders[0], x)} — nothing else can take that place.`);
          }
        }
        // every value must still be placeable
        const all = new Set(g.vars.flatMap((v) => dom[v]));
        if (all.size < g.vars.length) return -1;
      }
    }
  }
  return true;
}

function hasSupport(c: Constraint, idx: number, x: number, others: number[], dom: number[][]): boolean {
  const vals = new Array<number>(c.vars.length);
  vals[idx] = x;
  const slots = c.vars.map((_, j) => j).filter((j) => j !== idx);
  const rec = (k: number): boolean => {
    if (k === slots.length) return c.test(vals);
    const j = slots[k];
    for (const y of dom[others[k]]) {
      // variables in the same constraint that are the same variable must agree
      vals[j] = y;
      if (rec(k + 1)) return true;
    }
    return false;
  };
  return rec(0);
}

function snapshot(dom: number[][]): number[][] {
  return dom.map((d) => d.slice());
}

/**
 * Human-style deduction with a readable trace. `allowContradiction` enables
 * one-level hypothetical reasoning ("suppose X were 3 … impossible").
 */
export function deduce(csp: Csp, allowContradiction: boolean, maxSteps = 60): DeductionResult {
  let dom = csp.vars.map((v) => v.domain.slice());
  const steps: string[] = [];
  const fixedAnnounced = new Set<number>();
  let contradictions = 0;
  const announceFixed = () => {
    for (let v = 0; v < dom.length; v++)
      if (dom[v].length === 1 && !fixedAnnounced.has(v)) {
        fixedAnnounced.add(v);
      }
  };
  for (let round = 0; round < maxSteps; round++) {
    const ok = propagate(csp, dom, (l) => steps.push(l));
    if (ok !== true) return { solved: false, steps, contradictions, domains: dom };
    announceFixed();
    if (dom.every((d) => d.length === 1)) return { solved: true, steps, contradictions, domains: dom };
    if (!allowContradiction) break;
    let progressed = false;
    const candidates = dom.map((d, v) => ({ v, n: d.length })).filter((x) => x.n > 1).sort((a, b) => a.n - b.n);
    outer: for (const { v } of candidates) {
      for (const x of dom[v]) {
        const trial = snapshot(dom);
        trial[v] = [x];
        const trialSteps: string[] = [];
        const res = propagate(csp, trial, (l) => trialSteps.push(l));
        if (res !== true) {
          dom[v] = dom[v].filter((y) => y !== x);
          contradictions++;
          const culprit = res >= 0 ? `${csp.phrasing.name(res)} would have no possible option left` : 'some option could not be placed at all';
          const first = trialSteps.find((t) => t.includes(' so ')) ?? trialSteps[0];
          const via = first ? ` Following on (${first.replace(/\.$/, '').replace(/^Clue (\d+) \([^)]*\)/, 'clue $1')}),` : '';
          steps.push(`Suppose ${csp.phrasing.fact(v, x)}.${via} eventually ${culprit}. So that is impossible: ${csp.phrasing.elim(v, [x])}.`);
          progressed = true;
          break outer;
        }
      }
    }
    if (!progressed) break;
    dom = dom.map((d) => d.slice());
  }
  return { solved: dom.every((d) => d.length === 1), steps, contradictions, domains: dom };
}

/** Removes redundant clues while keeping exactly one solution. */
export function pruneClues<T extends { constraint: Constraint }>(
  clues: T[],
  build: (subset: T[]) => Csp,
  shuffled: T[],
  budget = 200000,
): T[] {
  let current = clues.slice();
  for (const c of shuffled) {
    if (!current.includes(c)) continue;
    const trial = current.filter((x) => x !== c);
    const res = countSolutions(build(trial), 2, budget);
    if (!res.exhausted && res.count === 1) current = trial;
  }
  return current;
}
