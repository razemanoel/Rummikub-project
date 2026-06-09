export type TileColor = 'red' | 'blue' | 'yellow' | 'black';

export interface Tile {
  value: number | null;
  color: TileColor | null;
  is_joker: boolean;
}

export interface VisionBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionPrediction {
  value: number | null;
  color: TileColor | null;
  is_joker: boolean;
}

export type VisionFeedbackCorrectionType =
  | 'wrong_class'
  | 'wrong_bbox'
  | 'missing_tile'
  | 'false_positive'
  | 'added_tile'
  | 'removed_tile'
  | 'both';

export interface VisionDetection {
  index: number;
  source: 'rack' | 'board';
  tile: Tile;
  originalPrediction: VisionPrediction;
  confidence: number;
  bbox: VisionBBox;
}

export interface VisionFeedbackCorrection {
  tileIndex: number;
  source: 'rack' | 'board';
  correctionType: VisionFeedbackCorrectionType;
  originalPrediction?: VisionPrediction;
  correctedTile: Tile;
  confidence?: number;
  bbox?: VisionBBox;
  finalImageDetections?: Array<{
    tileIndex: number;
    bbox: VisionBBox;
    correctedTile: Tile;
  }>;
}

export interface VisionFeedbackSourceDetections {
  rack?: Array<{
    tileIndex: number;
    bbox: VisionBBox;
    correctedTile: Tile;
  }>;
  board?: Array<{
    tileIndex: number;
    bbox: VisionBBox;
    correctedTile: Tile;
  }>;
}

export interface VisionAnalyzeResponse {
  status: string;
  message: string;
  rackDetections: VisionDetection[];
  rackRows: Array<
    Array<{
      tile: Tile;
      class_name: string;
      bbox: VisionBBox;
      confidence: number;
    }>
  >;
  boardDetections: VisionDetection[];
  gameState: GameState;
  validation: {
    status: string;
    invalid_sets: Array<{
      index: number;
      reason: string;
    }>;
  };
  classifierModelVersion?: string;
  detectorModelVersion?: string;
}

export interface VisionFeedbackPayload {
  corrections: VisionFeedbackCorrection[];
  classifierModelVersion?: string;
  detectorModelVersion?: string;
  finalImageDetections?: VisionFeedbackSourceDetections;
  sourceImages?: {
    rack?: string;
    board?: string;
  };
}

export interface PreparedUploadImage {
  uri: string;
  mimeType: 'image/jpeg';
  fileName: string;
  width: number;
  height: number;
  fileSize: number | null;
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