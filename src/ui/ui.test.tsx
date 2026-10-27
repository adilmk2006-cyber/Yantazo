// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GameProvider } from './GameContext';
import { PuzzlePlayer } from './play/PuzzlePlayer';
import App from '../App';
import { GENERATORS } from '../engine/generators';
import { buildPuzzle } from '../engine/registry';
import type { Puzzle } from '../engine/types';
import { RejectCandidate } from '../engine/util';
import { load, setStorageBackend } from '../state/storage';
import type { KeyValueStore } from '../state/storage';
import type { Profile } from '../state/progress';

class MapStore implements KeyValueStore {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

function firstPuzzle(generator: string, difficulty: 1 | 2 | 3 | 4 = 1, interaction?: Puzzle['interaction']['type']): Puzzle {
  const def = GENERATORS.find((g) => g.id === generator)!;
  for (let i = 0; i < 200; i++) {
    try {
      const p = buildPuzzle(def, `ui-${i}`, difficulty);
      if (!interaction || p.interaction.type === interaction) return p;
    } catch (e) {
      if (!(e instanceof RejectCandidate)) throw e;
    }
  }
  throw new Error(`no puzzle for ${generator}`);
}

function renderPlayer(puzzle: Puzzle, onNext = vi.fn()) {
  render(
    <GameProvider>
      <PuzzlePlayer puzzle={puzzle} hintsEnabled timeLimitSec={null} replay={false} mode="endless" onNext={onNext} />
    </GameProvider>,
  );
  return onNext;
}

function radioFor(id: string): HTMLInputElement {
  return screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).value === id) as HTMLInputElement;
}

beforeEach(() => {
  setStorageBackend(new MapStore());
  window.scrollTo = () => {};
});
afterEach(() => cleanup());

describe('puzzle player', () => {
  it('accepts the correct choice, shows the full explanation and records progress', () => {
    const puzzle = firstPuzzle('logic.truth', 2, 'choice');
    const onNext = renderPlayer(puzzle);
    const correct = puzzle.answer.type === 'choice' ? puzzle.answer.correct : '';
    const submit = screen.getByRole('button', { name: /Submit answer/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(radioFor(correct));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(screen.getByText('Correct!')).toBeTruthy();
    for (const heading of ['Why', 'Step by step', 'Why the alternatives fail', 'Skills practised']) expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByText(puzzle.explanation.answer)).toBeTruthy();

    const profile = load<Profile | null>('profile', null);
    expect(profile?.categories.logic.correct).toBe(1);
    expect(profile?.totalSolved).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /Next puzzle/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('marks a wrong choice and still explains the answer', () => {
    const puzzle = firstPuzzle('logic.implication', 2, 'choice');
    renderPlayer(puzzle);
    const correct = puzzle.answer.type === 'choice' ? puzzle.answer.correct : '';
    const wrong = screen.getAllByRole('radio').find((r) => (r as HTMLInputElement).value !== correct) as HTMLInputElement;
    fireEvent.click(wrong);
    fireEvent.click(screen.getByRole('button', { name: /Submit answer/ }));
    expect(screen.getByText('Not this time')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Step by step' })).toBeTruthy();
    expect(load<Profile | null>('profile', null)?.categories.logic.attempts).toBe(1);
  });

  it('gives progressive hints, one at a time, up to three', () => {
    const puzzle = firstPuzzle('visual.matrix', 2);
    renderPlayer(puzzle);
    fireEvent.click(screen.getByRole('button', { name: /Show a hint/ }));
    expect(screen.getByText(puzzle.hints[0])).toBeTruthy();
    expect(screen.queryByText(puzzle.hints[1])).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Stronger hint/ }));
    fireEvent.click(screen.getByRole('button', { name: /Stronger hint/ }));
    expect(screen.getByText(puzzle.hints[2])).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
  });

  it('asks before revealing, then ends the attempt as not solved', () => {
    const puzzle = firstPuzzle('spatial.rotation', 2, 'choice');
    renderPlayer(puzzle);
    fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Confirm reveal' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep trying' }));
    expect(screen.queryByText('Answer revealed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('Answer revealed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Submit answer/ })).toBeNull();
    const stats = load<Profile | null>('profile', null)!.categories.spatial;
    expect(stats.reveals).toBe(1);
    expect(stats.correct).toBe(0);
  });

  it('accepts a typed answer that matches an accepted wording', () => {
    const puzzle = firstPuzzle('riddle.letters', 2, 'text');
    renderPlayer(puzzle);
    const answer = puzzle.answer.type === 'text' ? puzzle.answer.canonical : '';
    fireEvent.change(screen.getByRole('textbox'), { target: { value: `  ${answer.toLowerCase()} ` } });
    fireEvent.click(screen.getByRole('button', { name: /Submit answer/ }));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('offers self-comparison for unrecognised free text instead of silently failing it', () => {
    const puzzle = firstPuzzle('riddle.whatami', 2, 'text');
    renderPlayer(puzzle);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'qqzz nothing like it' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit answer/ }));
    expect(screen.getByText('Not recognised as an accepted answer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /It was different/ }));
    expect(screen.getByText('Not this time')).toBeTruthy();
  });

  it('can switch a free-text puzzle to multiple choice', () => {
    const puzzle = firstPuzzle('fluid.equations', 2, 'number');
    renderPlayer(puzzle);
    fireEvent.click(screen.getByRole('button', { name: /multiple choice instead/ }));
    const correct = puzzle.answer.type === 'number' ? puzzle.answer.fallbackCorrect! : '';
    fireEvent.click(radioFor(correct));
    fireEvent.click(screen.getByRole('button', { name: /Submit answer/ }));
    expect(screen.getByText('Correct!')).toBeTruthy();
  });

  it('hides an observation scene after the memorise phase', () => {
    vi.useFakeTimers();
    try {
      const puzzle = firstPuzzle('observation.recall', 1);
      renderPlayer(puzzle);
      expect(screen.getByText(puzzle.display.memorize!.instruction)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(puzzle.display.memorize!.exposureMs + 1500);
      });
      expect(screen.queryByText(puzzle.display.memorize!.instruction)).toBeNull();
      expect(screen.getByRole('button', { name: /Submit answer/ })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('app shell', () => {
  it('renders the home screen with both parts of the game', () => {
    window.location.hash = '#/';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /MINDVAULT/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Endless Reasoning/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Murder Mysteries/ })).toBeTruthy();
    expect(screen.getByText(/not an IQ score/)).toBeTruthy();
  });

  it('navigates to the mystery campaign and opens a case', async () => {
    window.location.hash = '#/mysteries';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Murder mysteries/ })).toBeTruthy();
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('/mysteries/')).length).toBeGreaterThanOrEqual(6);
    act(() => {
      window.location.hash = '#/mysteries/lighthouse';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { level: 1, name: /Keeper of Gull Rock/ })).toBeTruthy();
  });

  it('records a wrong first accusation separately, then solves the case', async () => {
    window.location.hash = '#/mysteries/lighthouse';
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /Keeper of Gull Rock/ });
    fireEvent.click(screen.getByRole('tab', { name: /Accuse/ }));
    const culprits = screen.getByRole('radiogroup', { name: 'Culprit' });
    const pick = (value: string) => fireEvent.click(within(culprits).getAllByRole('radio').find((r) => (r as HTMLInputElement).value === value)!);
    const accuse = () => fireEvent.click(screen.getByRole('button', { name: 'Make the accusation' }));

    pick(within(culprits).getAllByRole('radio').map((r) => (r as HTMLInputElement).value).find((v) => v !== 'silas')!);
    fireEvent.click(screen.getByRole('radio', { name: /brass telescope/ }));
    accuse();
    // Accusing before investigating triggers a warning first.
    expect(screen.getByRole('alert').textContent).toMatch(/interviewed 0 of/);
    accuse();
    expect(screen.getByRole('heading', { name: /The case collapses/ })).toBeTruthy();

    pick('silas');
    accuse();
    accuse();
    expect(screen.getByRole('heading', { name: /Case solved/ })).toBeTruthy();
    const cases = load<Record<string, { solved: boolean; firstResult: string }>>('cases', {});
    expect(cases.lighthouse.solved).toBe(true);
    expect(cases.lighthouse.firstResult).toBe('incorrect');
    expect(load<Profile | null>('profile', null)?.mysteriesSolved).toBe(1);
  });

  it('starts an endless session from the setup screen', async () => {
    window.location.hash = '#/endless';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((screen.getByRole('button', { name: /Start session/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Logic & Deduction'));
    fireEvent.click(screen.getByRole('button', { name: /Start session/ }));
    expect(await screen.findByRole('button', { name: /Submit answer|Compare with the solution/ }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Skip/ })).toBeTruthy();
  });
});
