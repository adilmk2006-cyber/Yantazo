import { useMemo, useState } from 'react';
import { regeneratePuzzle } from '../../engine/registry';
import type { Difficulty } from '../../engine/types';
import { useGame } from '../GameContext';
import { PuzzlePlayer } from '../play/PuzzlePlayer';
import { href, navigate } from '../router';

export function ReplayScreen({ refKey }: { refKey: string }) {
  const game = useGame();
  const [round, setRound] = useState(0);
  const puzzle = useMemo(() => {
    const [generator, version, difficulty, seed] = decodeURIComponent(refKey).split('~');
    if (!generator || !seed) return null;
    return regeneratePuzzle({ generator, version: Number(version), difficulty: Number(difficulty) as Difficulty, seed });
  }, [refKey]);
  if (!puzzle)
    return (
      <div className="screen narrow">
        <h1>Puzzle unavailable</h1>
        <p>This puzzle was created by an older version of its generator and can no longer be rebuilt exactly. It has not been altered silently — older seeds are reported instead.</p>
        <a className="btn btn-secondary" href={href('/history')}>
          Back to history
        </a>
      </div>
    );
  return (
    <div className="screen play">
      <PuzzlePlayer
        key={`${puzzle.id}-${round}`}
        puzzle={puzzle}
        hintsEnabled={game.settings.defaultHints}
        timeLimitSec={null}
        replay
        mode="history"
        nextLabel="Back to history"
        onNext={() => navigate('/history')}
        headerExtra={
          <button type="button" className="link-btn" onClick={() => setRound((r) => r + 1)}>
            Restart this puzzle
          </button>
        }
      />
    </div>
  );
}
