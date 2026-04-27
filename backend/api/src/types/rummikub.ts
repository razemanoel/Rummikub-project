// ─────────────────────────────────────────────
// Rummikub domain types
// ─────────────────────────────────────────────

export type TileColor = 'red' | 'blue' | 'yellow' | 'black';

export interface Tile {
  value: number | null; // 1-13, null for joker
  color: TileColor | null; // null for joker
  isJoker: boolean;
}

export interface TileSet {
  tiles: Tile[];
}

export interface GameState {
  rack: Tile[];  // tiles on the player's own board
  board: TileSet[]; // sets already on the shared board
}

// ─────────────────────────────────────────────
// Move solver response types
// ─────────────────────────────────────────────

/** A single action that forms part of a suggested move */
export type MoveActionType = 'new_set' | 'extend_set';

export interface MoveAction {
  type: MoveActionType;
  /** Tiles taken from the rack to play */
  tilesFromRack: Tile[];
  /**
   * Index of the board set being extended.
   * Only present when type === 'extend_set'.
   */
  boardSetIndex?: number;
  /** Human-readable description of this action */
  description: string;
}

/** A complete move suggestion returned by the solver */
export interface MoveSuggestion {
  actions: MoveAction[];
  /** Total number of rack tiles used across all actions */
  tilesPlayed: number;
}

/** Top-level response from the move solver */
export interface SolverResponse {
  hasSuggestion: boolean;
  suggestion: MoveSuggestion | null;
  /** Plain-language explanation shown to the user */
  explanation: string;
}
