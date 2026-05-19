import {
  Tile,
  TileColor,
  TileSet,
  GameState,
  MoveAction,
  MoveSuggestion,
  SolverResponse,
} from '../types/rummikub';

// ─────────────────────────────────────────────────────────────────────────────
// Set validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Separate tiles into normal tiles and jokers.
 */
function splitJokers(tiles: Tile[]): { normals: Tile[]; jokerCount: number } {
  const normals = tiles.filter((t) => !t.isJoker);
  const jokerCount = tiles.filter((t) => t.isJoker).length;
  return { normals, jokerCount };
}

/**
 * A valid GROUP is 3 or 4 tiles that:
 * - All share the same value
 * - All have different colors
 * - Jokers can substitute for missing tiles (max 1 color per group)
 */
function isGroup(tiles: Tile[]): boolean {
  const { normals, jokerCount } = splitJokers(tiles);

  if (tiles.length < 3 || tiles.length > 4) return false;

  // All normal tiles must share the same value
  const values = normals.map((t) => t.value);
  if (new Set(values).size > 1) return false;

  // All normal tiles must have distinct colors
  const colors = normals.map((t) => t.color);
  if (new Set(colors).size !== colors.length) return false;

  // Jokers fill the remaining slots — no extra validation needed
  // since group size is already checked above
  return true;
}

/**
 * A valid RUN is 3+ tiles that:
 * - All share the same color
 * - Have consecutive values (1-13)
 * - Jokers can fill gaps
 */
function isRun(tiles: Tile[]): boolean {
  const { normals, jokerCount } = splitJokers(tiles);

  if (tiles.length < 3) return false;

  // All normal tiles must share the same color
  const colors = normals.map((t) => t.color);
  if (new Set(colors).size > 1) return false;

  // Sort normal tiles by value
  const values = normals
    .map((t) => t.value as number)
    .sort((a, b) => a - b);

  // Count gaps between consecutive values — each gap costs one joker
  let jokersNeeded = 0;
  for (let i = 1; i < values.length; i++) {
    const gap = values[i] - values[i - 1] - 1;
    if (gap < 0) return false; // duplicate values in a run are invalid
    jokersNeeded += gap;
  }

  return jokersNeeded <= jokerCount;
}

/**
 * A set is valid if it is either a valid group or a valid run.
 */
export function validateSet(tiles: Tile[]): boolean {
  return isGroup(tiles) || isRun(tiles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Combination helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate all combinations of `size` elements from `arr`.
 * Does not mutate the input array.
 */
function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];

  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((combo) => [
    first,
    ...combo,
  ]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// ─────────────────────────────────────────────────────────────────────────────
// Move finding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try to form a brand-new valid set purely from the rack tiles.
 * Returns the suggestion that uses the most rack tiles, or null.
 */
export function findBestNewSetFromRack(rack: Tile[]): MoveSuggestion | null {
  let best: MoveSuggestion | null = null;

  // Try sets of size 3 then 4 (groups cap at 4; runs can be longer but
  // for simplicity we check up to min(rack.length, 13))
  const maxSize = Math.min(rack.length, 13);

  for (let size = 3; size <= maxSize; size++) {
    const combos = combinations(rack, size);

    for (const combo of combos) {
      if (validateSet(combo)) {
        const suggestion: MoveSuggestion = {
          actions: [
            {
              type: 'new_set',
              tilesFromRack: combo,
              description: describeNewSet(combo),
            },
          ],
          tilesPlayed: combo.length,
        };

        // Keep the suggestion that plays the most tiles
        if (best === null || suggestion.tilesPlayed > best.tilesPlayed) {
          best = suggestion;
        }
      }
    }

    // Stop early if we already found the maximum possible for this size
    // (no point searching larger combos that use the same tiles)
    if (best && best.tilesPlayed >= size) break;
  }

  return best;
}

/**
 * Try to extend an existing board set by adding one or more rack tiles.
 * Returns the suggestion that uses the most rack tiles, or null.
 *
 * TODO: This requires the board sets to already be correctly grouped.
 * Until the vision service can group shared-board tiles into sets,
 * board should be passed as [] and only findBestNewSetFromRack is reliable.
 */
export function findBestExtensionMove(
  rack: Tile[],
  board: TileSet[]
): MoveSuggestion | null {
  let best: MoveSuggestion | null = null;

  for (let setIndex = 0; setIndex < board.length; setIndex++) {
    const existingSet = board[setIndex];

    // Try adding 1 or 2 rack tiles to this board set
    for (let addCount = 1; addCount <= Math.min(2, rack.length); addCount++) {
      const rackCombos = combinations(rack, addCount);

      for (const rackTiles of rackCombos) {
        const extended = [...existingSet.tiles, ...rackTiles];

        if (validateSet(extended)) {
          const suggestion: MoveSuggestion = {
            actions: [
              {
                type: 'extend_set',
                tilesFromRack: rackTiles,
                boardSetIndex: setIndex,
                description: describeExtension(rackTiles, setIndex),
              },
            ],
            tilesPlayed: rackTiles.length,
          };

          if (best === null || suggestion.tilesPlayed > best.tilesPlayed) {
            best = suggestion;
          }
        }
      }
    }
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main solver entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the current game state, find the best move for the player.
 *
 * Strategy (v1 — simple & deterministic):
 * 1. Try to create a new valid set from the rack.
 * 2. Try to extend an existing board set with rack tiles.
 * 3. Choose whichever plays more tiles.
 * 4. Return a structured explanation.
 *
 * Does NOT mutate the input gameState.
 */
export function solveBestMove(gameState: GameState): SolverResponse {
  const { rack, board } = gameState;

  if (rack.length === 0) {
    return {
      hasSuggestion: false,
      suggestion: null,
      explanation: 'No tiles on your rack to play.',
    };
  }

  const newSetMove = findBestNewSetFromRack(rack);

  // TODO: Extension moves require board sets to be correctly grouped by the
  // vision service. Until detect-and-group is implemented, board is passed as
  // [] and extension moves are skipped.
  const extensionMove =
    board.length > 0 ? findBestExtensionMove(rack, board) : null;

  // Pick the move that plays the most tiles
  let best: MoveSuggestion | null = null;
  if (newSetMove && extensionMove) {
    best =
      newSetMove.tilesPlayed >= extensionMove.tilesPlayed
        ? newSetMove
        : extensionMove;
  } else {
    best = newSetMove ?? extensionMove;
  }

  if (!best) {
    return {
      hasSuggestion: false,
      suggestion: null,
      explanation:
        'No valid move found with your current rack. Draw a tile.',
    };
  }

  return {
    hasSuggestion: true,
    suggestion: best,
    explanation: buildExplanation(best),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable description helpers
// ─────────────────────────────────────────────────────────────────────────────

function tileLabel(tile: Tile): string {
  if (tile.isJoker) return 'Joker';
  return `${tile.value} ${tile.color}`;
}

function describeNewSet(tiles: Tile[]): string {
  const labels = tiles.map(tileLabel).join(', ');
  const setType = isGroup(tiles) ? 'group' : 'run';
  return `Create a new ${setType}: [${labels}]`;
}

function describeExtension(tiles: Tile[], boardSetIndex: number): string {
  const labels = tiles.map(tileLabel).join(', ');
  return `Add [${labels}] to board set #${boardSetIndex + 1}`;
}

function buildExplanation(suggestion: MoveSuggestion): string {
  const lines = suggestion.actions.map((a) => a.description);
  return `Play ${suggestion.tilesPlayed} tile(s): ${lines.join(' | ')}`;
}
