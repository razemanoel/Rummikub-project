export type TileColor = 'red' | 'blue' | 'yellow' | 'black';

export interface Tile {
  value: number | null;
  color: TileColor | null;
  is_joker: boolean;
}

export interface TileSet {
  tiles: Tile[];
}

export interface GameState {
  rack: Tile[];
  board: TileSet[];
}

export interface JokerAssignment {
  value: number;
  color: TileColor;
  type: 'run' | 'group';
}

export interface StructuredBoardSource {
  set_index: number;
  tiles: Tile[];
}

export interface StructuredStep {
  type: string;
  description: string;
  take_from_rack: Tile[];
  take_from_board: StructuredBoardSource[];
  result_set: TileSet;
}

export interface SolveILPResponse {
  status: string;
  message: string;
  solver_status: string;
  candidate_count: number;
  solve_time_seconds: number;
  tiles_used_count: number;
  remaining_rack: Tile[];
  new_board: TileSet[];
  joker_assignments: JokerAssignment[];
  steps: string[];
  structured_steps: StructuredStep[];
}
