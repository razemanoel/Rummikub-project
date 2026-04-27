/**
 * localMoveSolver.ts
 *
 * Client-side Rummikub move solver.
 * Mirrors the logic in backend/api/src/services/moveSolverService.ts so that
 * the app can solve from the *corrected* rack state without a network round-trip.
 *
 * Scope: My Rack only (board grouping not yet supported on mobile).
 */

import { EditableTile, SolverResponse, MoveSuggestion, MoveAction } from '@/types/rummikub';

// ── Internal helpers ─────────────────────────────────────────────────────────

/** All combinations of `size` elements from `arr`. */
function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

/**
 * Check if a set of tiles forms a valid GROUP.
 * Rules: 3-4 tiles, all same value, all different colors (jokers fill any color).
 */
function isGroup(tiles: EditableTile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;

  const jokers = tiles.filter((t) => t.isJoker);
  const normal = tiles.filter((t) => !t.isJoker);

  if (normal.length === 0) return false;

  const values = normal.map((t) => t.number);
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== 1) return false; // all same value

  const colors = normal.map((t) => t.color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== normal.length) return false; // all different colors

  // jokers fill remaining slots — always valid at this point
  return true;
}

/**
 * Check if a set of tiles forms a valid RUN.
 * Rules: 3+ tiles, all same color, consecutive values (jokers fill gaps).
 */
function isRun(tiles: EditableTile[]): boolean {
  if (tiles.length < 3) return false;

  const jokers = tiles.filter((t) => t.isJoker);
  const normal = tiles.filter((t) => !t.isJoker);

  if (normal.length === 0) return false;

  const colors = normal.map((t) => t.color);
  const uniqueColors = new Set(colors);
  if (uniqueColors.size !== 1) return false; // all same color

  const values = normal
    .map((t) => t.number as number)
    .sort((a, b) => a - b);

  // Count gaps between consecutive normal tiles
  let gaps = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff === 0) return false; // duplicate value
    gaps += diff - 1;
  }

  return gaps <= jokers.length;
}

/** True if the tile set is a valid group or run. */
function validateSet(tiles: EditableTile[]): boolean {
  return isGroup(tiles) || isRun(tiles);
}

/** Build a human-readable description of a set. */
function describeSet(tiles: EditableTile[]): string {
  const parts = tiles.map((t) => {
    if (t.isJoker) return 'Joker';
    return `${t.number ?? '?'} ${t.color ?? '?'}`;
  });
  return parts.join(', ');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Find the best new set (group or run) that can be formed entirely from rack tiles.
 * Prefers sets that play the most tiles.
 */
function findBestNewSet(rack: EditableTile[]): MoveSuggestion | null {
  let best: MoveSuggestion | null = null;

  // Try all subset sizes from largest to smallest (max 4 for groups, no limit for runs)
  for (let size = rack.length; size >= 3; size--) {
    const combos = combinations(rack, size);
    for (const combo of combos) {
      if (validateSet(combo)) {
        const action: MoveAction = {
          type: 'new_set',
          tilesFromRack: combo.map((t) => ({
            value: t.number,
            color: t.color,
            isJoker: t.isJoker,
          })),
          description: `Play new set: ${describeSet(combo)}`,
        };
        const candidate: MoveSuggestion = {
          actions: [action],
          tilesPlayed: combo.length,
        };
        if (!best || candidate.tilesPlayed > best.tilesPlayed) {
          best = candidate;
        }
      }
    }
    // Found at least one valid set at this size — don't look at smaller sizes
    if (best && best.tilesPlayed === size) break;
  }

  return best;
}

/**
 * Solve the best possible move using only the player's rack.
 * Board extension moves are not yet supported on mobile.
 *
 * @param rack  The corrected list of editable tiles from My Rack.
 * @returns     A `SolverResponse` ready to display in the UI.
 */
export function solveBestMoveFromEditableRack(rack: EditableTile[]): SolverResponse {
  if (rack.length === 0) {
    return {
      hasSuggestion: false,
      suggestion: null,
      explanation: 'No tiles in rack to solve from.',
    };
  }

  const suggestion = findBestNewSet(rack);

  if (!suggestion) {
    return {
      hasSuggestion: false,
      suggestion: null,
      explanation: `No valid set found among ${rack.length} rack tile${rack.length !== 1 ? 's' : ''}. Try adding more tiles or check your tile corrections.`,
    };
  }

  return {
    hasSuggestion: true,
    suggestion,
    explanation: `Found a move playing ${suggestion.tilesPlayed} tile${suggestion.tilesPlayed !== 1 ? 's' : ''} from your rack.`,
  };
}
