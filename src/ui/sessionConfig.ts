/** Endless-session configuration chosen on the setup screen (kept for the browser tab). */
import type { Category, Difficulty } from '../engine/types';
import { CATEGORIES } from '../engine/types';

export interface SessionConfig {
  categories: Category[];
  difficulty: Difficulty | 'adaptive';
  timed: boolean;
  timerSeconds: number;
  hints: boolean;
  /** null = unlimited */
  length: number | null;
}

const KEY = 'mindvault.session-config';

export const DEFAULT_CONFIG: SessionConfig = {
  categories: [...CATEGORIES],
  difficulty: 'adaptive',
  timed: false,
  timerSeconds: 120,
  hints: true,
  length: null,
};

export function loadConfig(): SessionConfig {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    const c = { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<SessionConfig>) };
    c.categories = c.categories.filter((x) => CATEGORIES.includes(x));
    if (!c.categories.length) c.categories = [...CATEGORIES];
    return c;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(c: SessionConfig) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* session storage unavailable: the config simply is not remembered */
  }
}
