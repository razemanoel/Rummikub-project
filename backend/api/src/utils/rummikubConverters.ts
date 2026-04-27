import { Tile, TileColor } from '../types/rummikub';
import { TileDetection } from '../services/visionService';

/** Minimum confidence score to accept a detection */
const CONFIDENCE_THRESHOLD = 0.5;

/** Valid color strings returned by the vision service */
const VALID_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black'];

/**
 * Normalize a raw color string from the vision service to a TileColor.
 * Returns null if the color is unrecognized.
 */
function normalizeColor(raw: string): TileColor | null {
  const lower = raw.toLowerCase().trim();
  if (VALID_COLORS.includes(lower as TileColor)) {
    return lower as TileColor;
  }
  return null;
}

/**
 * Convert a single TileDetection from the vision service into a Tile.
 *
 * Rules:
 * - A tile is a joker when tile_number is null AND tile_color is null/"joker".
 * - Tiles below the confidence threshold are rejected (returns null).
 * - Tiles with an unrecognized color are rejected (returns null).
 */
export function detectionToTile(detection: TileDetection): Tile | null {
  // Reject low-confidence detections
  if (detection.confidence < CONFIDENCE_THRESHOLD) {
    return null;
  }

  const rawColor = detection.tile_color?.toLowerCase().trim() ?? '';

  // Joker: no number and no recognizable color (or explicitly "joker")
  const isJoker =
    detection.tile_number === null &&
    (rawColor === '' || rawColor === 'joker' || rawColor === 'null');

  if (isJoker) {
    return { value: null, color: null, isJoker: true };
  }

  // Regular tile: must have a valid color and a number in range 1-13
  const color = normalizeColor(detection.tile_color);
  if (color === null) {
    return null; // unrecognized color — skip
  }

  const value = detection.tile_number;
  if (value === null || value < 1 || value > 13) {
    return null; // out-of-range number — skip
  }

  return { value, color, isJoker: false };
}

/**
 * Convert an array of TileDetections into a rack (Tile[]).
 * Invalid or low-confidence detections are silently skipped.
 */
export function detectionsToRack(detections: TileDetection[] | null): Tile[] {
  if (!detections) return [];

  const tiles: Tile[] = [];
  for (const detection of detections) {
    const tile = detectionToTile(detection);
    if (tile !== null) {
      tiles.push(tile);
    }
  }
  return tiles;
}
