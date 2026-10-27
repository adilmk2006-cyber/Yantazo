import type { GeneratorDef } from '../generator';
import { fluidClassify } from './fluid/classify';
import { fluidEquations } from './fluid/equations';
import { fluidFunction } from './fluid/functions';
import { fluidTransform } from './fluid/transform';
import { lateralThinking } from './lateral';
import { logicGrid } from './logic/grid';
import { logicImplication } from './logic/implication';
import { logicTruth } from './logic/truth';
import { logicOrder, logicSchedule, logicSeating } from './logic/positional';
import { obsChange, obsDifference, obsLocation, obsProperties, obsRecall, obsRecords } from './observation';
import { riddleClassic } from './riddle/classic';
import { riddleMatchsticks } from './riddle/matchsticks';
import { riddleNumeric } from './riddle/numeric';
import { riddleSequence } from './riddle/sequences';
import { riddleSquares } from './riddle/squares';
import { riddleAnagram, riddleLetters, riddleWhatAmI } from './riddle/words';
import { spatialAssembly } from './spatial/assembly';
import { spatialCube } from './spatial/cube';
import { spatialFolding } from './spatial/folding';
import { spatialPath } from './spatial/path';
import { spatialRotation } from './spatial/rotation';
import { visualAnalogy } from './visual/analogy';
import { visualMatrix } from './visual/matrix';
import { visualOddOne } from './visual/oddone';
import { visualSequence } from './visual/sequence';

export const GENERATORS: GeneratorDef[] = [
  visualMatrix,
  visualAnalogy,
  visualSequence,
  visualOddOne,
  fluidTransform,
  fluidFunction,
  fluidClassify,
  fluidEquations,
  logicOrder,
  logicSeating,
  logicSchedule,
  logicGrid,
  logicTruth,
  logicImplication,
  spatialRotation,
  spatialFolding,
  spatialCube,
  spatialPath,
  spatialAssembly,
  obsRecall,
  obsLocation,
  obsDifference,
  obsChange,
  obsProperties,
  obsRecords,
  riddleSequence,
  riddleNumeric,
  riddleMatchsticks,
  riddleSquares,
  riddleWhatAmI,
  riddleLetters,
  riddleAnagram,
  riddleClassic,
  lateralThinking,
];
