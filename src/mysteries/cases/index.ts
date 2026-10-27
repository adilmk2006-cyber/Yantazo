import type { MysteryCase } from '../types';
import { gallery } from './gallery';
import { glasshouse } from './glasshouse';
import { lighthouse } from './lighthouse';
import { nighttrain } from './nighttrain';
import { observatory } from './observatory';
import { theatre } from './theatre';

/** The finite, hand-authored campaign, in recommended order. */
export const CASES: MysteryCase[] = [lighthouse, gallery, theatre, observatory, nighttrain, glasshouse];

export function caseById(id: string): MysteryCase | undefined {
  return CASES.find((c) => c.id === id);
}
