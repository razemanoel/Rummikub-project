// Raw detection returned by the backend vision service
export interface TileDetection {
  tile_number: number | null;
  tile_color: string | null;
  confidence: number;
}

// Tile colors recognised by the game
export type TileColor = 'red' | 'blue' | 'yellow' | 'black';

// Mutable tile used in the UI (can be corrected by the user)
export interface EditableTile {
  /** Stable key for React lists */
  id: string;
  /** 1-13, or null for joker */
  number: number | null;
  /** null for joker */
  color: TileColor | null;
  isJoker: boolean;
  /** Original confidence from vision service (0-1) */
  confidence: number;
}

// ── Game state types (sent to POST /api/solve) ────────────────────────────

/** A tile as the backend solver expects it. */
export interface GameTile {
  value: number | null;  // 1-13, null for joker
  color: TileColor | null; // null for joker
  isJoker: boolean;
}

/** A set of tiles already on the shared board. */
export interface GameTileSet {
  tiles: GameTile[];
}

/** Full game state sent to the solve endpoint. */
export interface GameState {
  rack: GameTile[];
  board: GameTileSet[];
}

/** Response shape from POST /api/solve */
export interface SolveApiResponse {
  success: boolean;
  message?: string;
  data: {
    solverResult: SolverResponse;
  };
}

// ── Solver types (mirror backend/api/src/types/rummikub.ts) ────────────────

export type MoveActionType = 'new_set' | 'extend_set';

export interface MoveAction {
  type: MoveActionType;
  tilesFromRack: Array<{ value: number | null; color: string | null; isJoker: boolean }>;
  boardSetIndex?: number;
  description: string;
}

export interface MoveSuggestion {
  actions: MoveAction[];
  tilesPlayed: number;
}

export interface SolverResponse {
  hasSuggestion: boolean;
  suggestion: MoveSuggestion | null;
  explanation: string;
}

// Full API response shape for /api/vision/analyze
export interface AnalysisResult {
  success: boolean;
  message: string;
  data: {
    myBoardDetections: TileDetection[] | null;
    sharedBoardDetections: TileDetection[] | null;
    suggestedMove?: SolverResponse;
  };
}
