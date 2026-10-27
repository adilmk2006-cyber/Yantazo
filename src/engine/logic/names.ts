/** Name pools for generated logic puzzles. Names never affect a puzzle's structural fingerprint. */
export const PEOPLE = [
  'Ava', 'Ben', 'Cara', 'Dev', 'Elif', 'Finn', 'Gita', 'Hugo', 'Ines', 'Jun', 'Kofi', 'Lena', 'Milo', 'Nia', 'Omar', 'Pia',
  'Quinn', 'Rosa', 'Sami', 'Tara', 'Umar', 'Vera', 'Wes', 'Xena', 'Yuki', 'Zane', 'Amara', 'Bruno', 'Chen', 'Dalia', 'Emil',
  'Farah', 'Goran', 'Hana', 'Ivo', 'Jalen', 'Kiri', 'Luca', 'Maya', 'Nadia', 'Otto', 'Priya', 'Rafa', 'Sana', 'Theo', 'Uma',
];

/** Pick names with distinct first letters so clues stay easy to scan. */
export function pickNames(rng: { shuffle<T>(xs: readonly T[]): T[] }, n: number): string[] {
  const out: string[] = [];
  const initials = new Set<string>();
  for (const name of rng.shuffle(PEOPLE)) {
    if (initials.has(name[0])) continue;
    initials.add(name[0]);
    out.push(name);
    if (out.length === n) break;
  }
  return out;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
