import { describe, it } from 'vitest';
import { GENERATORS } from '../generators';
import { sweep } from './harness';
import type { Difficulty } from '../types';

const only = process.env.PROBE;
describe.skipIf(!only)('probe', () => {
  it('reports rejection rates', () => {
    for (const def of GENERATORS.filter((g) => !only || only === 'all' || g.id.startsWith(only))) {
      for (const d of [1, 2, 3, 4] as Difficulty[]) {
        const t = Date.now();
        const r = sweep(def, d, Number(process.env.PROBE_N ?? 200));
        process.stdout.write(`\n${def.id} d${d}: ok=${r.puzzles.length} rej=${r.rejected} ${Date.now() - t}ms`);
        const top = [...r.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
        for (const [k, v] of top) process.stdout.write(`\n   ${v}× ${k}`);
        if (r.unexpected.length) process.stdout.write('\nUNEXPECTED ' + r.unexpected[0]);
        if (process.env.PROBE_SHOW && r.puzzles[0]) process.stdout.write("\n" + JSON.stringify({ hints: r.puzzles[0].hints, ex: r.puzzles[0].explanation }, null, 1).slice(0, 3000));
      }
    }
  });
});
