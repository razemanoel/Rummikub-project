import {
  Tile,
  TileColor,
  VisionBBox,
  VisionDetection,
  VisionPrediction,
} from '@/types/rummikub';

export type ReviewTileSource = 'rack' | 'board';
export type ReviewTileOrigin = 'detected' | 'manual';

export interface ReviewTileState {
  id: string;
  feedbackTileIndex: number;
  tile: Tile;
  source: ReviewTileSource;
  origin: ReviewTileOrigin;
  isNew: boolean;
  detectionIndex?: number;
  originalPrediction?: VisionPrediction;
  bbox?: VisionBBox;
  originalBBox?: VisionBBox;
  confidence?: number;
}

export interface ReviewTileSetState {
  id: string;
  tiles: ReviewTileState[];
}

export interface BoardStructureChange {
  tileId: string;
  detectionIndex?: number;
  fromSetId: string;
  toSetId: string;
}

export interface ReviewSnapshot {
  rack: ReviewTileState[];
  board: ReviewTileSetState[];
  unassignedBoardTiles: ReviewTileState[];
  removedTiles: ReviewTileState[];
  boardStructureChanges: BoardStructureChange[];
}

export type EditingLocation =
  | { source: 'rack'; tileId: string }
  | { source: 'board'; setId: string; tileId: string }
  | null;

export const areTilesEqual = (left: Tile, right: Tile) => (
  left.value === right.value
  && left.color === right.color
  && left.is_joker === right.is_joker
);

export const isTile = (value: unknown): value is Tile => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as Tile).is_joker === 'boolean';
};

export const isReviewTileState = (value: unknown): value is ReviewTileState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as ReviewTileState;

  return (
    typeof candidate.id === 'string'
    && typeof candidate.feedbackTileIndex === 'number'
    && isTile(candidate.tile)
    && (candidate.source === 'rack' || candidate.source === 'board')
    && (candidate.origin === 'detected' || candidate.origin === 'manual')
    && typeof candidate.isNew === 'boolean'
  );
};

export const sortTilesInSet = (tiles: ReviewTileState[]) => {
  const jokers = tiles.filter((tile) => tile.tile.is_joker);
  const normalTiles = tiles.filter((tile) => !tile.tile.is_joker);

  const sameColor =
    normalTiles.length > 0
    && normalTiles.every((tile) => tile.tile.color === normalTiles[0].tile.color);

  if (sameColor) {
    return [
      ...normalTiles.sort((left, right) => (left.tile.value || 0) - (right.tile.value || 0)),
      ...jokers,
    ];
  }

  return [
    ...normalTiles.sort((left, right) => {
      if ((left.tile.value || 0) !== (right.tile.value || 0)) {
        return (left.tile.value || 0) - (right.tile.value || 0);
      }

      return String(left.tile.color).localeCompare(String(right.tile.color));
    }),
    ...jokers,
  ];
};

export const buildReviewTileState = (
  tile: Tile,
  source: ReviewTileSource,
  feedbackTileIndex: number,
  id: string,
  detection?: VisionDetection,
  isNew = false,
): ReviewTileState => ({
  id,
  feedbackTileIndex,
  tile,
  source,
  origin: detection ? 'detected' : 'manual',
  isNew,
  detectionIndex: detection?.index,
  originalPrediction: detection?.originalPrediction,
  bbox: detection?.bbox,
  originalBBox: detection?.bbox,
  confidence: detection?.confidence,
});

export const getTileKey = (tile: Tile) => {
  if (tile.is_joker) {
    return 'joker';
  }

  return `${tile.value}-${tile.color}`;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getTileColorHex = (color: TileColor | null) => {
  switch (color) {
    case 'red':
      return '#ef4444';
    case 'blue':
      return '#3b82f6';
    case 'yellow':
      return '#facc15';
    case 'black':
      return '#111827';
    default:
      return '#e2e8f0';
  }
};

export const getTileLabel = (tile: Tile) => {
  if (tile.is_joker) {
    return 'Joker';
  }

  const colorLabel = tile.color ? capitalize(tile.color) : 'Unknown';
  return `${tile.value ?? '?'} ${colorLabel}`;
};

export const getShortTileLabel = (tile: Tile) => {
  if (tile.is_joker) {
    return 'J';
  }

  return String(tile.value ?? '?');
};

export const getReviewTileBadgeLabel = (tile: ReviewTileState) => {
  if (tile.origin === 'manual') {
    return tile.source === 'board' ? 'Manual board tile' : 'Manual rack tile';
  }

  if (tile.originalPrediction && !areTilesEqual(tile.originalPrediction, tile.tile)) {
    return 'Corrected detection';
  }

  return 'Detected tile';
};

export const getReviewSetBadgeLabel = (tileSet: ReviewTileSetState) => {
  const hasDetectedTiles = tileSet.tiles.some((tile) => tile.origin === 'detected');
  const hasManualTiles = tileSet.tiles.some((tile) => tile.origin === 'manual');

  if (hasDetectedTiles && hasManualTiles) {
    return 'Mixed set';
  }

  if (hasDetectedTiles) {
    return 'Detected set';
  }

  if (hasManualTiles) {
    return 'Manual set';
  }

  return 'Empty set';
};