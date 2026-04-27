import { Tile, TileColor, TileSet, GameState } from '../types/rummikub';

const VALID_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black'];

function isValidTile(t: unknown): t is Tile {
  if (!t || typeof t !== 'object') return false;
  const tile = t as Record<string, unknown>;

  if (typeof tile.isJoker !== 'boolean') return false;

  if (tile.isJoker) {
    // Joker: value and color must be null or absent
    if (tile.value !== null && tile.value !== undefined) return false;
    if (tile.color !== null && tile.color !== undefined) return false;
    return true;
  }

  // Normal tile
  if (typeof tile.value !== 'number' || tile.value < 1 || tile.value > 13) return false;
  if (!VALID_COLORS.includes(tile.color as TileColor)) return false;
  return true;
}

function isValidTileSet(s: unknown): s is TileSet {
  if (!s || typeof s !== 'object') return false;
  const set = s as Record<string, unknown>;
  if (!Array.isArray(set.tiles)) return false;
  return set.tiles.every(isValidTile);
}

/**
 * Validates and coerces the request body into a GameState.
 * Returns an error message string on failure, or null on success.
 */
export function validateGameState(
  body: unknown
): { error: string } | { gameState: GameState } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object.' };
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.rack)) {
    return { error: '"rack" must be an array of tile objects.' };
  }

  if (!Array.isArray(b.board)) {
    return { error: '"board" must be an array of set objects.' };
  }

  for (let i = 0; i < (b.rack as unknown[]).length; i++) {
    if (!isValidTile((b.rack as unknown[])[i])) {
      return {
        error: `rack[${i}] is invalid. Each tile must have isJoker (boolean), value (1-13 or null for joker), and color ('red'|'blue'|'yellow'|'black' or null for joker).`,
      };
    }
  }

  for (let i = 0; i < (b.board as unknown[]).length; i++) {
    if (!isValidTileSet((b.board as unknown[])[i])) {
      return {
        error: `board[${i}] is invalid. Each set must have a "tiles" array of valid tile objects.`,
      };
    }
  }

  return {
    gameState: {
      rack: b.rack as Tile[],
      board: b.board as TileSet[],
    },
  };
}
