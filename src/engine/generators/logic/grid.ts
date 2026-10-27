import type { GeneratorDef } from '../../generator';
import type { GridHidden } from '../../logic/grid';
import { buildGrid, verifyGrid } from '../../logic/grid';

export const logicGrid: GeneratorDef = {
  id: 'logic.grid',
  category: 'logic',
  version: 1,
  family: 'Logic grids',
  description: 'Match people to attributes (optionally along a corridor) using a solver-verified clue set.',
  weight: 1.2,
  candidates: 3,
  generate: ({ rng, difficulty }) => buildGrid(rng, difficulty),
  verify: (p) => (p.answer.type === 'assign' ? verifyGrid(p.hidden as unknown as GridHidden, p.answer.solution) : ['wrong answer type']),
};
