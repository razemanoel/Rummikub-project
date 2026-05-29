import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import {
  GameState,
  Tile,
  TileSet,
  VisionBBox,
  VisionDetection,
  VisionFeedbackCorrection,
  VisionFeedbackPayload,
  VisionPrediction,
} from '@/types/rummikub';
import TileView from '@/components/rummikub/TileView';
import BoardView from '@/components/rummikub/BoardView';
import EditTileModal from '@/components/rummikub/EditTileModal';
import { apiService } from '@/services/api';

const mockGameState: GameState = {
  rack: [
    { value: null, color: null, is_joker: true },

    { value: 8, color: 'red', is_joker: false },
    { value: 8, color: 'blue', is_joker: false },

    { value: 6, color: 'red', is_joker: false },
    { value: 7, color: 'red', is_joker: false },
    { value: 8, color: 'red', is_joker: false },

    { value: 12, color: 'blue', is_joker: false },
    { value: 13, color: 'blue', is_joker: false },

    { value: 4, color: 'yellow', is_joker: false },
    { value: 5, color: 'yellow', is_joker: false },

    { value: 12, color: 'black', is_joker: false },
  ],

  board: [
    {
      tiles: [
        { value: 8, color: 'black', is_joker: false },
        { value: 9, color: 'black', is_joker: false },
        { value: 10, color: 'black', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 11, color: 'black', is_joker: false },
        { value: 12, color: 'black', is_joker: false },
        { value: 13, color: 'black', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 3, color: 'blue', is_joker: false },
        { value: 4, color: 'blue', is_joker: false },
        { value: 5, color: 'blue', is_joker: false },
        { value: 6, color: 'blue', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 9, color: 'red', is_joker: false },
        { value: 10, color: 'red', is_joker: false },
        { value: 11, color: 'red', is_joker: false },
        { value: 12, color: 'red', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 4, color: 'black', is_joker: false },
        { value: 4, color: 'blue', is_joker: false },
        { value: 4, color: 'red', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 7, color: 'yellow', is_joker: false },
        { value: 8, color: 'yellow', is_joker: false },
        { value: 9, color: 'yellow', is_joker: false },
      ],
    },
  ],
};

type ReviewTileSource = 'rack' | 'board';
type ReviewTileOrigin = 'detected' | 'manual';

interface ReviewTileState {
  id: string;
  feedbackTileIndex: number;
  tile: Tile;
  source: ReviewTileSource;
  origin: ReviewTileOrigin;
  isNew: boolean;
  detectionIndex?: number;
  originalPrediction?: VisionPrediction;
  bbox?: VisionBBox;
  confidence?: number;
}

interface ReviewTileSetState {
  id: string;
  tiles: ReviewTileState[];
}

type InitialRackRowItem = {
  tile?: Tile;
};

type EditingLocation =
  | { source: 'rack'; tileId: string }
  | { source: 'board'; setId: string; tileId: string }
  | null;

const areTilesEqual = (left: Tile, right: Tile) => (
  left.value === right.value
  && left.color === right.color
  && left.is_joker === right.is_joker
);

const isTile = (value: unknown): value is Tile => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as Tile).is_joker === 'boolean';
};

const isReviewTileState = (value: unknown): value is ReviewTileState => {
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

const sortTilesInSet = (tiles: ReviewTileState[]) => {
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

const buildReviewTileState = (
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
  confidence: detection?.confidence,
});

const buildInitialRackReviewTiles = (
  rack: Tile[],
  rackRows: InitialRackRowItem[][],
  rackDetections: VisionDetection[],
): ReviewTileState[] => {
  const rowTiles = rackRows.flatMap((row) => row.map((item) => item?.tile));
  const sourceTiles = rowTiles.some((tile) => isTile(tile))
    ? rowTiles.filter(isTile)
    : rack.filter(isTile);

  return sourceTiles.map((tile, index) => {
  const detection = rackDetections[index];
  const feedbackTileIndex = detection?.index ?? index;

  return buildReviewTileState(
    tile,
    'rack',
    feedbackTileIndex,
    detection ? `rack-detected-${detection.index}` : `rack-initial-${index}`,
    detection,
  );
  });
};

const buildInitialBoardReviewState = (
  board: TileSet[],
  boardDetections: VisionDetection[],
): ReviewTileSetState[] => {
  let detectionCursor = 0;

  return board.map((tileSet, setIndex) => ({
    id: `board-set-${setIndex}`,
    tiles: tileSet.tiles.map((tile, tileIndex) => {
      const detection = boardDetections[detectionCursor++];
      const feedbackTileIndex = detection?.index ?? detectionCursor + tileIndex;

      return buildReviewTileState(
        tile,
        'board',
        feedbackTileIndex,
        detection ? `board-detected-${detection.index}` : `board-initial-${setIndex}-${tileIndex}`,
        detection,
      );
    }),
  }));
};

const buildPlainGameState = (
  rack: ReviewTileState[],
  board: ReviewTileSetState[],
): GameState => ({
  rack: rack.map((item) => item.tile),
  board: board.map((tileSet) => ({
    tiles: tileSet.tiles.map((item) => item.tile),
  })),
});

const buildRackDisplayRows = (
  rack: ReviewTileState[],
  initialRowLengths: number[],
): ReviewTileState[][] => {
  const normalizedRack = rack.filter(isReviewTileState);

  if (normalizedRack.length === 0) {
    return [[]];
  }

  if (initialRowLengths.length === 0) {
    return [normalizedRack];
  }

  const rows: ReviewTileState[][] = [];
  let cursor = 0;

  initialRowLengths.forEach((rowLength, index) => {
    const isLastConfiguredRow = index === initialRowLengths.length - 1;
    const nextCursor = isLastConfiguredRow
      ? normalizedRack.length
      : Math.min(normalizedRack.length, cursor + rowLength);

    const row = normalizedRack.slice(cursor, nextCursor);

    if (row.length > 0 || isLastConfiguredRow) {
      rows.push(row);
    }

    cursor = nextCursor;
  });

  if (cursor < normalizedRack.length) {
    rows.push(normalizedRack.slice(cursor));
  }

  return rows.length > 0 ? rows : [[]];
};

const getTileKey = (tile: Tile) => {
  if (tile.is_joker) {
    return 'joker';
  }

  return `${tile.value}-${tile.color}`;
};

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

const initialGameState: GameState = params.gameState
  ? JSON.parse(params.gameState as string)
  : mockGameState;

const initialRackRows = params.rackRows
  ? JSON.parse(params.rackRows as string)
  : [];

const initialRackDetections: VisionDetection[] = params.rackDetections
  ? JSON.parse(params.rackDetections as string)
  : [];

const initialBoardDetections: VisionDetection[] = params.boardDetections
  ? JSON.parse(params.boardDetections as string)
  : [];

const rackImageUri = (params.rackImageUri as string) || '';
const boardImageUri = (params.boardImageUri as string) || '';
const classifierModelVersion = (params.classifierModelVersion as string) || undefined;
const detectorModelVersion = (params.detectorModelVersion as string) || undefined;

const initialRackRowLengths = initialRackRows.map((row: unknown[]) => row.length);
const [reviewRack, setReviewRack] = useState<ReviewTileState[]>(() =>
  buildInitialRackReviewTiles(initialGameState.rack, initialRackRows, initialRackDetections)
);
const [reviewBoard, setReviewBoard] = useState<ReviewTileSetState[]>(() =>
  buildInitialBoardReviewState(initialGameState.board, initialBoardDetections)
);
const [removedTiles, setRemovedTiles] = useState<ReviewTileState[]>([]);
const [editingLocation, setEditingLocation] = useState<EditingLocation>(null);

const [validationErrors, setValidationErrors] = useState<string[]>([]);
const [isValidating, setIsValidating] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [invalidSetIndexes, setInvalidSetIndexes] = useState<number[]>([]);
const [invalidTileKeys, setInvalidTileKeys] = useState<string[]>([]);

const nextManualFeedbackTileIndexRef = useRef({
  rack: initialRackDetections.reduce((max, detection) => Math.max(max, detection.index), -1) + 1,
  board: initialBoardDetections.reduce((max, detection) => Math.max(max, detection.index), -1) + 1,
});
const manualTileSerialRef = useRef(0);

const gameState = useMemo(
  () => buildPlainGameState(reviewRack, reviewBoard),
  [reviewRack, reviewBoard],
);
const reviewRackRows = useMemo(
  () => buildRackDisplayRows(reviewRack, initialRackRowLengths),
  [initialRackRowLengths, reviewRack],
);

useEffect(() => {
  const firstRowItem = reviewRackRows[0]?.[0];

  if (firstRowItem) {
    console.log('Review rack first row item shape:', {
      id: firstRowItem.id,
      source: firstRowItem.source,
      origin: firstRowItem.origin,
      hasTile: isTile(firstRowItem.tile),
      tile: firstRowItem.tile,
    });
  }
}, [reviewRackRows]);

const editingReviewTile = useMemo(() => {
  if (!editingLocation) {
    return null;
  }

  if (editingLocation.source === 'rack') {
    return reviewRack.find((tile) => tile.id === editingLocation.tileId) || null;
  }

  const boardSet = reviewBoard.find((tileSet) => tileSet.id === editingLocation.setId);
  return boardSet?.tiles.find((tile) => tile.id === editingLocation.tileId) || null;
}, [editingLocation, reviewBoard, reviewRack]);

const isGameStateValid = validationErrors.length === 0;

  const createManualReviewTile = (tile: Tile, source: ReviewTileSource): ReviewTileState => {
    const feedbackTileIndex = nextManualFeedbackTileIndexRef.current[source];
    nextManualFeedbackTileIndexRef.current[source] += 1;
    manualTileSerialRef.current += 1;

    return buildReviewTileState(
      tile,
      source,
      feedbackTileIndex,
      `${source}-manual-${manualTileSerialRef.current}`,
      undefined,
      true,
    );
  };

  const getCurrentDetectionsForSource = (source: ReviewTileSource) => {
    const activeTiles = [
      ...reviewRack,
      ...reviewBoard.flatMap((tileSet) => tileSet.tiles),
    ];

    return activeTiles
      .filter((tile) => tile.source === source && tile.origin === 'detected' && tile.detectionIndex !== undefined && tile.bbox)
      .map((tile) => ({
        tileIndex: tile.detectionIndex as number,
        bbox: tile.bbox as VisionBBox,
        correctedTile: tile.tile,
      }))
      .sort((left, right) => left.tileIndex - right.tileIndex);
  };

  const buildSubmissionCorrections = (): VisionFeedbackCorrection[] => {
    const activeTiles = [
      ...reviewRack,
      ...reviewBoard.flatMap((tileSet) => tileSet.tiles),
    ];

    const activeCorrections: VisionFeedbackCorrection[] = activeTiles.flatMap<VisionFeedbackCorrection>((tile) => {
      if (tile.origin === 'manual') {
        if (!tile.isNew) {
          return [];
        }

        return [{
            tileIndex: tile.feedbackTileIndex,
          source: tile.source,
          correctionType: 'added_tile' as const,
          correctedTile: tile.tile,
        }];
      }

      if (!tile.originalPrediction || tile.detectionIndex === undefined || tile.confidence === undefined || !tile.bbox) {
        return [];
      }

      if (areTilesEqual(tile.originalPrediction, tile.tile)) {
        return [];
      }

      return [{
        tileIndex: tile.detectionIndex,
        source: tile.source,
        correctionType: 'wrong_class' as const,
        originalPrediction: tile.originalPrediction,
        correctedTile: tile.tile,
        confidence: tile.confidence,
        bbox: tile.bbox,
      }];
    });

    const removedCorrections: VisionFeedbackCorrection[] = removedTiles.flatMap<VisionFeedbackCorrection>((tile) => {
      if (!tile.originalPrediction || tile.detectionIndex === undefined || tile.confidence === undefined || !tile.bbox) {
        return [];
      }

      return [{
        tileIndex: tile.detectionIndex,
        source: tile.source,
        correctionType: 'false_positive' as const,
        originalPrediction: tile.originalPrediction,
        correctedTile: tile.originalPrediction,
        confidence: tile.confidence,
        bbox: tile.bbox,
      }];
    });

    return [...activeCorrections, ...removedCorrections];
  };

  const buildFinalImageDetections = () => ({
    rack: getCurrentDetectionsForSource('rack'),
    board: getCurrentDetectionsForSource('board'),
  });

  const handleEditRackTile = (tileId: string) => {
    setEditingLocation({ source: 'rack', tileId });
  };

  const handleEditBoardTile = (setIndex: number, tileIndex: number) => {
    const tileSet = reviewBoard[setIndex];
    const tile = tileSet?.tiles[tileIndex];

    if (!tile || !tileSet) {
      return;
    }

    setEditingLocation({ source: 'board', setId: tileSet.id, tileId: tile.id });
  };

  const defaultNewTile: Tile = {
    value: 1,
    color: 'blue',
    is_joker: false,
  };

  const handleAddTileToBoardSet = (setIndex: number) => {
    const tileSet = reviewBoard[setIndex];

    if (!tileSet) {
      return;
    }

    const newTile = createManualReviewTile({ ...defaultNewTile }, 'board');

    setReviewBoard((prev) => prev.map((item) => (
      item.id === tileSet.id
        ? { ...item, tiles: sortTilesInSet([...item.tiles, newTile]) }
        : item
    )));

    setEditingLocation({
      source: 'board',
      setId: tileSet.id,
      tileId: newTile.id,
    });
  };

  const handleSaveTile = (updatedTile: Tile) => {
    if (!editingLocation) return;

    if (editingLocation.source === 'rack') {
      setReviewRack((prev) => prev.map((tile) => (
        tile.id === editingLocation.tileId
          ? { ...tile, tile: updatedTile }
          : tile
      )));
    } else {
      setReviewBoard((prev) => prev.map((tileSet) => {
        if (tileSet.id !== editingLocation.setId) {
          return tileSet;
        }

        return {
          ...tileSet,
          tiles: sortTilesInSet(tileSet.tiles.map((tile) => (
            tile.id === editingLocation.tileId
              ? { ...tile, tile: updatedTile }
              : tile
          ))),
        };
      }));
    }

    setEditingLocation(null);
  };

  const handleDeleteTile = () => {
    if (!editingLocation) return;

    const tileToRemove = editingReviewTile;

    if (!tileToRemove) {
      setEditingLocation(null);
      return;
    }

    if (tileToRemove.origin === 'detected') {
      setRemovedTiles((prev) => [...prev.filter((item) => item.id !== tileToRemove.id), tileToRemove]);
    }

    if (editingLocation.source === 'rack') {
      setReviewRack((prev) => prev.filter((tile) => tile.id !== editingLocation.tileId));
    } else {
      setReviewBoard((prev) => prev.map((tileSet) => (
        tileSet.id === editingLocation.setId
          ? { ...tileSet, tiles: tileSet.tiles.filter((tile) => tile.id !== editingLocation.tileId) }
          : tileSet
      )));
    }

    setEditingLocation(null);
  };

  const handleAddRackTile = () => {
    const newTile = createManualReviewTile({ ...defaultNewTile }, 'rack');

    setReviewRack((prev) => [...prev, newTile]);
    setEditingLocation({
      source: 'rack',
      tileId: newTile.id,
    });
  };

  const validateCurrentGameState = async (stateToValidate: GameState) => {
    try {
      setIsValidating(true);

      const response = await apiService.validateGameState(stateToValidate);

      if (!response.success || !response.data) {
        setValidationErrors([response.message || 'Validation failed']);
        return;
      }

      if (response.data.status === 'success') {
        setValidationErrors([]);
        setInvalidSetIndexes([]);
        setInvalidTileKeys([]);
        return;
      }

      const invalidSets = response.data.invalid_sets || [];

      const errors =
        invalidSets.map((item: any) =>
          item.index >= 0
            ? `Invalid set: ${stateToValidate.board[item.index]?.tiles
                .map((tile) =>
                  tile.is_joker ? 'joker' : `${tile.value} ${tile.color}`
                )
                .join(', ')} - ${item.reason}`
            : item.reason
        ) || ['Invalid game state'];

      const invalidIndexes = invalidSets
        .filter((item: any) => item.index >= 0)
        .map((item: any) => item.index);

      const duplicateKeys = invalidSets
      .map((item: any) => item.reason)
      .flatMap((reason: string) => {
        if (reason.includes('Too many jokers')) {
          return ['joker'];
        }

        if (reason.startsWith('Too many copies of tile')) {
          const match = reason.match(/tile (\d+) (\w+)/);
          return match ? [`${match[1]}-${match[2]}`] : [];
        }

        return [];
      });

      setValidationErrors(errors);
      setInvalidSetIndexes(invalidIndexes);
      setInvalidTileKeys(duplicateKeys);
    } catch (error: any) {
      setValidationErrors([error.message || 'Validation failed']);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateCurrentGameState(gameState);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  const handleConfirm = async () => {
  try {
    setIsSubmitting(true);

    const correctionList = buildSubmissionCorrections();

    if (correctionList.length > 0) {
      const feedbackPayload: VisionFeedbackPayload = {
        corrections: correctionList,
        classifierModelVersion,
        detectorModelVersion,
        finalImageDetections: buildFinalImageDetections(),
        sourceImages: {
          rack: correctionList.some((item) => item.source === 'rack') ? rackImageUri : undefined,
          board: correctionList.some((item) => item.source === 'board') ? boardImageUri : undefined,
        },
      };

      const feedbackResponse = await apiService.submitVisionFeedback(feedbackPayload);

      if (!feedbackResponse.success) {
        console.warn('Vision feedback submission failed:', feedbackResponse.message);
      } else if (feedbackResponse.data?.skippedDuplicateCount) {
        console.log(
          `Skipped ${feedbackResponse.data.skippedDuplicateCount} duplicate feedback sample(s)`
        );
      }
    }

    const response = await apiService.solveGameState(gameState);

    if (!response.success || !response.data) {
      Alert.alert('Solver Error', response.message || 'Failed to solve game state');
      return;
    }

    await apiService.saveSolution(gameState, response.data);
    
    router.push({
      pathname: '/(main)/solution',
      params: {
        originalGameState: JSON.stringify(gameState),
        solution: JSON.stringify(response.data),
      },
    });
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to calculate solution');
  } finally {
    setIsSubmitting(false);
  }
};
  

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>
          <Text style={styles.headerTitle}>Review Tiles</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Review the detected tiles. Tap a tile to edit it before solving.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rack</Text>

            <View style={styles.rackContainer}>
              {reviewRackRows.length > 0 ? (
                reviewRackRows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.rackVisualRow}>
                    {row.map((tile) => {

                      return (
                        <TileView
                          key={tile.id}
                          tile={tile.tile}
                          isInvalid={
                            tile.tile.is_joker
                              ? invalidTileKeys.includes('joker')
                              : invalidTileKeys.includes(
                                  `${tile.tile.value}-${tile.tile.color}`
                                )
                          }
                          onPress={() => handleEditRackTile(tile.id)}
                        />
                      );
                    })}
                    {rowIndex === reviewRackRows.length - 1 && (
                      <Pressable style={styles.addTileButton} onPress={handleAddRackTile}>
                        <Ionicons name="add" size={18} color="#ffffff" />
                      </Pressable>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.rackVisualRow}>
                  {reviewRack.map((tile) => (
                    <TileView
                      key={tile.id}
                      tile={tile.tile}
                      isInvalid={
                        tile.tile.is_joker
                          ? invalidTileKeys.includes('joker')
                          : invalidTileKeys.includes(getTileKey(tile.tile))
                      }
                      onPress={() => handleEditRackTile(tile.id)}
                    />
                  ))}
                  <Pressable style={styles.addTileButton} onPress={handleAddRackTile}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Board</Text>
            <BoardView
              board={gameState.board}
              onTilePress={handleEditBoardTile}
              onAddTileToSet={handleAddTileToBoardSet}
              invalidSetIndexes={invalidSetIndexes}
              invalidTileKeys={invalidTileKeys}
            />
          </View>
          {validationErrors.length > 0 && (
            <View style={styles.validationBox}>
              <Text style={styles.validationTitle}>Invalid board state</Text>

              {validationErrors.map((error, index) => (
                <Text key={index} style={styles.validationText}>
                  • {error}
                </Text>
              ))}
            </View>
          )}
          <Pressable
          style={[
            styles.confirmButton,
            (!isGameStateValid || isValidating || isSubmitting) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!isGameStateValid || isValidating || isSubmitting}
        >
          <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
          <Text style={styles.confirmText}>
            {isSubmitting ? 'Submitting...' : isValidating ? 'Checking...' : 'Confirm and Solve'}
          </Text>
        </Pressable>
        </ScrollView>
      </SafeAreaView>
      <EditTileModal
      visible={!!editingReviewTile}
      tile={editingReviewTile?.tile || null}
      onClose={() => {
        setEditingLocation(null);
      }}
      onSave={handleSaveTile}
      onDelete={handleDeleteTile}
    />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  rackContainer: {
  backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  rackVisualRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: '#4f8dfd',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
  validationBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },

  validationTitle: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },

  validationText: {
    color: '#fecaca',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  confirmButtonDisabled: {
    opacity: 0.45,
  },
  addTileButton: {
    width: 34,
    height: 64,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
});