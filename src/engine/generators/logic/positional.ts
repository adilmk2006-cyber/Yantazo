import type { GeneratorDef } from '../../generator';
import type { Puzzle } from '../../types';
import type { Geometry, PositionalHidden } from '../../logic/positional';
import { buildPositional, verifyPositional } from '../../logic/positional';

function answerPositions(p: Puzzle): number[] | null {
  const h = p.hidden as unknown as PositionalHidden;
  if (p.answer.type === 'order') {
    const pos = new Array<number>(h.names.length).fill(-1);
    p.answer.solution.forEach((item, slot) => {
      if (item >= 0) pos[item] = slot;
    });
    return pos;
  }
  if (p.answer.type === 'assign') return p.answer.solution.map((row) => row[0]);
  return null;
}

function verify(p: Puzzle): string[] {
  const pos = answerPositions(p);
  if (!pos) return ['wrong answer type'];
  return verifyPositional(p.hidden as unknown as PositionalHidden, pos);
}

function def(id: string, geometry: Geometry, family: string, description: string, weight: number): GeneratorDef {
  return {
    id,
    category: 'logic',
    version: 1,
    family,
    description,
    weight,
    candidates: 4,
    generate: ({ rng, difficulty }) => buildPositional(rng, difficulty, geometry),
    verify,
  };
}

export const logicOrder = def('logic.order', 'line', 'Ordering & sequencing', 'Queues, towers, races and rows solved from relative clues.', 1.2);
export const logicSeating = def('logic.seating', 'circle', 'Seating arrangements', 'Round-table seating with clockwise, opposite and adjacency clues.', 0.9);
export const logicSchedule = def('logic.schedule', 'week', 'Scheduling', 'Weekly schedules with free days, gaps and before/after clues.', 0.9);
