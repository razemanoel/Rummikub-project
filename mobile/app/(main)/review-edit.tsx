import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Platform,
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
} from '@/types/rummikub';
import EditTileModal from '@/components/rummikub/EditTileModal';
import BoardSetEditor from '@/components/review/BoardSetEditor';
import ReviewTileList from '@/components/review/ReviewTileList';
import VisionOverlayEditor from '@/components/review/VisionOverlayEditor';
import {
  areTilesEqual,
  BoardStructureChange,
  buildReviewTileState,
  EditingLocation,
  getTileLabel,
  isTile,
  ReviewSnapshot,
  ReviewTileSetState,
  ReviewTileSource,
  ReviewTileState,
  sortTilesInSet,
} from '@/components/review/reviewTypes';
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

type InitialRackRowItem = {
  tile?: Tile;
};

const detectionCenterY = (detection: VisionDetection) => (
  detection.bbox.y + (detection.bbox.height / 2)
);

const detectionCenterX = (detection: VisionDetection) => (
  detection.bbox.x + (detection.bbox.width / 2)
);

const groupBoardDetectionsIntoRows = (
  detections: VisionDetection[],
  rowToleranceRatio = 0.6,
) => {
  if (detections.length === 0) {
    return [] as VisionDetection[][];
  }

  const sortedDetections = [...detections].sort(
    (left, right) => detectionCenterY(left) - detectionCenterY(right)
  );
  const averageHeight = sortedDetections.reduce(
    (sum, detection) => sum + detection.bbox.height,
    0,
  ) / sortedDetections.length;
  const rowTolerance = averageHeight * rowToleranceRatio;
  const rows: VisionDetection[][] = [];

  sortedDetections.forEach((detection) => {
    const detectionY = detectionCenterY(detection);
    const matchingRow = rows.find((row) => {
      const rowCenter = row.reduce((sum, item) => sum + detectionCenterY(item), 0) / row.length;
      return Math.abs(detectionY - rowCenter) <= rowTolerance;
    });

    if (matchingRow) {
      matchingRow.push(detection);
      matchingRow.sort((left, right) => detectionCenterX(left) - detectionCenterX(right));
      return;
    }

    rows.push([detection]);
  });

  return rows.sort((left, right) => {
    const leftCenter = left.reduce((sum, item) => sum + detectionCenterY(item), 0) / left.length;
    const rightCenter = right.reduce((sum, item) => sum + detectionCenterY(item), 0) / right.length;
    return leftCenter - rightCenter;
  });
};

const splitBoardDetectionRowIntoSets = (
  row: VisionDetection[],
  gapRatio = 1.3,
) => {
  if (row.length <= 1) {
    return row.length === 0 ? [] as VisionDetection[][] : [row];
  }

  const averageWidth = row.reduce((sum, detection) => sum + detection.bbox.width, 0) / row.length;
  const maxSameSetGap = averageWidth * gapRatio;
  const sets: VisionDetection[][] = [];
  let currentSet: VisionDetection[] = [row[0]];

  row.slice(1).forEach((currentDetection, index) => {
    const previousDetection = row[index];
    const previousRight = previousDetection.bbox.x + previousDetection.bbox.width;
    const currentLeft = currentDetection.bbox.x;
    const gap = currentLeft - previousRight;

    if (gap > maxSameSetGap) {
      sets.push(currentSet);
      currentSet = [currentDetection];
      return;
    }

    currentSet.push(currentDetection);
  });

  sets.push(currentSet);
  return sets;
};

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
  if (boardDetections.length > 0) {
    const rows = groupBoardDetectionsIntoRows(boardDetections);

    return rows.flatMap((row, rowIndex) => (
      splitBoardDetectionRowIntoSets(row).map((tileSet, setIndex) => ({
        id: `board-set-${rowIndex}-${setIndex}`,
        tiles: tileSet.map((detection) => buildReviewTileState(
          detection.tile,
          'board',
          detection.index,
          `board-detected-${detection.index}`,
          detection,
        )),
      }))
    ));
  }

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
  board: board.filter((tileSet) => tileSet.tiles.length > 0).map((tileSet) => ({
    tiles: tileSet.tiles.map((item) => item.tile),
  })),
});

const buildBoardValidationIndexMap = (board: ReviewTileSetState[]) => {
  const indexMap: number[] = [];

  board.forEach((tileSet, index) => {
    if (tileSet.tiles.length > 0) {
      indexMap.push(index);
    }
  });

  return indexMap;
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

const [reviewRack, setReviewRack] = useState<ReviewTileState[]>(() =>
  buildInitialRackReviewTiles(initialGameState.rack, initialRackRows, initialRackDetections)
);
const [reviewBoard, setReviewBoard] = useState<ReviewTileSetState[]>(() =>
  buildInitialBoardReviewState(initialGameState.board, initialBoardDetections)
);
const [unassignedBoardTiles, setUnassignedBoardTiles] = useState<ReviewTileState[]>([]);
const [removedTiles, setRemovedTiles] = useState<ReviewTileState[]>([]);
const [boardStructureChanges, setBoardStructureChanges] = useState<BoardStructureChange[]>([]);
const [undoSnapshot, setUndoSnapshot] = useState<ReviewSnapshot | null>(null);
const [editingLocation, setEditingLocation] = useState<EditingLocation>(null);
const [isTileModalVisible, setIsTileModalVisible] = useState(false);

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
const boardSetSerialRef = useRef(initialGameState.board.length);
const pendingNewTileIdRef = useRef<string | null>(null);

const gameState = useMemo(
  () => buildPlainGameState(reviewRack, reviewBoard),
  [reviewRack, reviewBoard],
);
const boardValidationIndexMap = useMemo(
  () => buildBoardValidationIndexMap(reviewBoard),
  [reviewBoard],
);

const editingReviewTile = useMemo(() => {
  if (!editingLocation) {
    return null;
  }

  if (editingLocation.source === 'rack') {
    return reviewRack.find((tile) => tile.id === editingLocation.tileId) || null;
  }

  const boardSet = reviewBoard.find((tileSet) => tileSet.id === editingLocation.setId);
  return boardSet?.tiles.find((tile) => tile.id === editingLocation.tileId)
    || unassignedBoardTiles.find((tile) => tile.id === editingLocation.tileId)
    || null;
}, [editingLocation, reviewBoard, reviewRack, unassignedBoardTiles]);

const isGameStateValid = validationErrors.length === 0;

  const selectedTileId = editingLocation?.tileId;
  const selectedBoardSetId = editingLocation?.source === 'board' ? editingLocation.setId : undefined;

  const captureUndoSnapshot = () => {
    setUndoSnapshot({
      rack: reviewRack,
      board: reviewBoard,
      unassignedBoardTiles,
      removedTiles,
      boardStructureChanges,
    });
  };

  const handleUndo = () => {
    if (!undoSnapshot) {
      return;
    }

    setReviewRack(undoSnapshot.rack);
    setReviewBoard(undoSnapshot.board);
    setUnassignedBoardTiles(undoSnapshot.unassignedBoardTiles);
    setRemovedTiles(undoSnapshot.removedTiles);
    setBoardStructureChanges(undoSnapshot.boardStructureChanges);
    setEditingLocation(null);
    pendingNewTileIdRef.current = null;
    setUndoSnapshot(null);
  };

  const recordBoardStructureChange = (
    tile: ReviewTileState,
    fromSetId: string,
    toSetId: string,
  ) => {
    if (tile.origin !== 'detected') {
      return;
    }

    setBoardStructureChanges((prev) => {
      const existing = prev.find((change) => change.tileId === tile.id);
      const originalFromSetId = existing?.fromSetId ?? fromSetId;

      if (originalFromSetId === toSetId) {
        return prev.filter((change) => change.tileId !== tile.id);
      }

      const nextChange: BoardStructureChange = {
        tileId: tile.id,
        detectionIndex: tile.detectionIndex,
        fromSetId: originalFromSetId,
        toSetId,
      };

      if (!existing) {
        return [...prev, nextChange];
      }

      return prev.map((change) => (
        change.tileId === tile.id ? nextChange : change
      ));
    });
  };

  const discardPendingNewTile = (location: Exclude<EditingLocation, null>) => {
    if (location.source === 'rack') {
      setReviewRack((prev) => prev.filter((tile) => tile.id !== location.tileId));
    } else {
      if (location.setId === 'board-unassigned') {
        setUnassignedBoardTiles((prev) => prev.filter((tile) => tile.id !== location.tileId));
      } else {
        setReviewBoard((prev) => prev.map((tileSet) => (
          tileSet.id === location.setId
            ? { ...tileSet, tiles: tileSet.tiles.filter((tile) => tile.id !== location.tileId) }
            : tileSet
        )));
      }
    }

    pendingNewTileIdRef.current = null;
    setEditingLocation(null);
  };

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
      ...unassignedBoardTiles,
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
      ...unassignedBoardTiles,
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
    setIsTileModalVisible(true);
  };

  const handleSelectRackOverlayTile = (tileId: string) => {
    setEditingLocation({ source: 'rack', tileId });
    setIsTileModalVisible(false);
  };

  const handleEditBoardTile = (setId: string, tileId: string) => {
    const tileSet = setId === 'board-unassigned'
      ? { id: 'board-unassigned', tiles: unassignedBoardTiles }
      : reviewBoard.find((item) => item.id === setId);
    const tile = tileSet?.tiles.find((item) => item.id === tileId);

    if (!tile || !tileSet) {
      return;
    }

    setEditingLocation({ source: 'board', setId, tileId });
    setIsTileModalVisible(false);
  };

  const handleSelectBoardOverlayTile = (tileId: string) => {
    const parentSet = reviewBoard.find((tileSet) =>
      tileSet.tiles.some((tile) => tile.id === tileId)
    );

    if (!parentSet) {
      return;
    }

    handleEditBoardTile(parentSet.id, tileId);
  };

  const handleUnassignedBoardTilePress = (tileId: string) => {
    setEditingLocation({ source: 'board', setId: 'board-unassigned', tileId });
    setIsTileModalVisible(false);
  };

  const handleOpenSelectedTileEditor = () => {
    if (!editingReviewTile) {
      return;
    }

    setIsTileModalVisible(true);
  };

  const handleClearSelection = () => {
    setEditingLocation(null);
    setIsTileModalVisible(false);
  };

  const defaultNewTile: Tile = {
    value: 1,
    color: 'blue',
    is_joker: false,
  };

  const handleAddTileToBoardSet = (setId: string) => {
    const tileSet = reviewBoard.find((item) => item.id === setId);

    if (!tileSet) {
      return;
    }

    const newTile = createManualReviewTile({ ...defaultNewTile }, 'board');
    captureUndoSnapshot();

    setReviewBoard((prev) => prev.map((item) => (
      item.id === setId
        ? { ...item, tiles: sortTilesInSet([...item.tiles, newTile]) }
        : item
    )));

    setEditingLocation({
      source: 'board',
      setId,
      tileId: newTile.id,
    });
    setIsTileModalVisible(true);
    pendingNewTileIdRef.current = newTile.id;
  };

  const handleCreateBoardSet = () => {
    boardSetSerialRef.current += 1;
    captureUndoSnapshot();
    setReviewBoard((prev) => [
      ...prev,
      {
        id: `board-set-manual-${boardSetSerialRef.current}`,
        tiles: [],
      },
    ]);
  };

  const deleteBoardSet = (setId: string) => {
    const tileSet = reviewBoard.find((item) => item.id === setId);

    if (!tileSet) {
      return;
    }

    captureUndoSnapshot();

    const detectedTiles = tileSet.tiles.filter((tile) => tile.origin === 'detected');

    setRemovedTiles((prev) => {
      const filtered = prev.filter((item) => !detectedTiles.some((tile) => tile.id === item.id));
      return [...filtered, ...detectedTiles];
    });
    setBoardStructureChanges((prev) => prev.filter(
      (change) => !tileSet.tiles.some((tile) => tile.id === change.tileId)
    ));
    setReviewBoard((prev) => prev.filter((item) => item.id !== setId));

    if (editingLocation?.source === 'board' && editingLocation.setId === setId) {
      setEditingLocation(null);
    }
  };

  const removeBoardTileFromSet = (tileId: string) => {
    const boardSet = reviewBoard.find((tileSet) => tileSet.tiles.some((tile) => tile.id === tileId));
    const tile = boardSet?.tiles.find((item) => item.id === tileId);

    if (!boardSet || !tile) {
      return;
    }

    captureUndoSnapshot();
    setReviewBoard((prev) => prev.map((tileSet) => (
      tileSet.id === boardSet.id
        ? { ...tileSet, tiles: tileSet.tiles.filter((item) => item.id !== tileId) }
        : tileSet
    )));
    setUnassignedBoardTiles((prev) => [...prev, tile]);
    recordBoardStructureChange(tile, boardSet.id, 'board-unassigned');
    setEditingLocation({ source: 'board', setId: 'board-unassigned', tileId: tile.id });
    setIsTileModalVisible(false);
  };

  const moveSelectedBoardTileToSet = (targetSetId: string) => {
    if (!editingLocation || editingLocation.source !== 'board') {
      return;
    }

    const selectedTile = editingReviewTile;

    if (!selectedTile) {
      return;
    }

    const sourceSetId = editingLocation.setId;

    if (sourceSetId === targetSetId) {
      return;
    }

    captureUndoSnapshot();

    if (sourceSetId === 'board-unassigned') {
      setUnassignedBoardTiles((prev) => prev.filter((tile) => tile.id !== selectedTile.id));
    } else {
      setReviewBoard((prev) => prev.map((tileSet) => (
        tileSet.id === sourceSetId
          ? { ...tileSet, tiles: tileSet.tiles.filter((tile) => tile.id !== selectedTile.id) }
          : tileSet
      )));
    }

    setReviewBoard((prev) => prev.map((tileSet) => (
      tileSet.id === targetSetId
        ? { ...tileSet, tiles: sortTilesInSet([...tileSet.tiles, selectedTile]) }
        : tileSet
    )));
    recordBoardStructureChange(selectedTile, sourceSetId, targetSetId);
    setEditingLocation({ source: 'board', setId: targetSetId, tileId: selectedTile.id });
    setIsTileModalVisible(false);
  };

  const mergeSelectedBoardSetIntoSet = (targetSetId: string) => {
    if (!editingLocation || editingLocation.source !== 'board' || editingLocation.setId === 'board-unassigned') {
      return;
    }

    const sourceSetId = editingLocation.setId;

    if (sourceSetId === targetSetId) {
      return;
    }

    const sourceSet = reviewBoard.find((tileSet) => tileSet.id === sourceSetId);

    if (!sourceSet || sourceSet.tiles.length === 0) {
      return;
    }

    captureUndoSnapshot();

    sourceSet.tiles.forEach((tile) => recordBoardStructureChange(tile, sourceSetId, targetSetId));

    setReviewBoard((prev) => {
      const currentSourceSet = prev.find((tileSet) => tileSet.id === sourceSetId);

      if (!currentSourceSet) {
        return prev;
      }

      return prev
        .filter((tileSet) => tileSet.id !== sourceSetId)
        .map((tileSet) => (
          tileSet.id === targetSetId
            ? { ...tileSet, tiles: sortTilesInSet([...tileSet.tiles, ...currentSourceSet.tiles]) }
            : tileSet
        ));
    });

    setEditingLocation({ source: 'board', setId: targetSetId, tileId: sourceSet.tiles[0].id });
    setIsTileModalVisible(false);
  };

  const handleDeleteBoardSet = (setId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(
            'Detected tiles in this set will be submitted as removed detections. Manual tiles in this set will be discarded.'
          )
        : false;

      if (confirmed) {
        deleteBoardSet(setId);
      }

      return;
    }

    Alert.alert(
      'Delete this set?',
      'Detected tiles in this set will be submitted as removed detections. Manual tiles in this set will be discarded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete set',
          style: 'destructive',
          onPress: () => deleteBoardSet(setId),
        },
      ],
    );
  };

  const handleSaveTile = (updatedTile: Tile) => {
    if (!editingLocation) return;

    const isPendingNewTile = pendingNewTileIdRef.current === editingLocation.tileId;

    if (!isPendingNewTile) {
      captureUndoSnapshot();
    }

    if (editingLocation.source === 'rack') {
      setReviewRack((prev) => prev.map((tile) => (
        tile.id === editingLocation.tileId
          ? { ...tile, tile: updatedTile }
          : tile
      )));
    } else {
      if (editingLocation.setId === 'board-unassigned') {
        setUnassignedBoardTiles((prev) => prev.map((tile) => (
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
    }

    if (isPendingNewTile) {
      pendingNewTileIdRef.current = null;
    }

    setEditingLocation(null);
    setIsTileModalVisible(false);
  };

  const handleDeleteTile = () => {
    if (!editingLocation) return;

    const tileToRemove = editingReviewTile;

    if (!tileToRemove) {
      setEditingLocation(null);
      return;
    }

    const isPendingNewTile = pendingNewTileIdRef.current === tileToRemove.id;

    if (!isPendingNewTile) {
      captureUndoSnapshot();
    }

    if (tileToRemove.origin === 'detected') {
      setRemovedTiles((prev) => [...prev.filter((item) => item.id !== tileToRemove.id), tileToRemove]);
    }

    setBoardStructureChanges((prev) => prev.filter((change) => change.tileId !== tileToRemove.id));

    if (editingLocation.source === 'rack') {
      setReviewRack((prev) => prev.filter((tile) => tile.id !== editingLocation.tileId));
    } else {
      if (editingLocation.setId === 'board-unassigned') {
        setUnassignedBoardTiles((prev) => prev.filter((tile) => tile.id !== editingLocation.tileId));
      } else {
        setReviewBoard((prev) => prev.map((tileSet) => (
          tileSet.id === editingLocation.setId
            ? { ...tileSet, tiles: tileSet.tiles.filter((tile) => tile.id !== editingLocation.tileId) }
            : tileSet
        )));
      }
    }

    if (isPendingNewTile) {
      pendingNewTileIdRef.current = null;
    }

    setEditingLocation(null);
    setIsTileModalVisible(false);
  };

  const handleAddRackTile = () => {
    const newTile = createManualReviewTile({ ...defaultNewTile }, 'rack');

    captureUndoSnapshot();
    setReviewRack((prev) => [...prev, newTile]);
    setEditingLocation({
      source: 'rack',
      tileId: newTile.id,
    });
    setIsTileModalVisible(true);
    pendingNewTileIdRef.current = newTile.id;
  };

  const validateCurrentGameState = useCallback(async (stateToValidate: GameState) => {
    try {
      setIsValidating(true);

      const response = await apiService.validateGameState(stateToValidate);

      if (!response.success || !response.data) {
        setValidationErrors([response.message || 'Validation failed']);
        return;
      }

      if (response.data.status === 'success') {
        if (unassignedBoardTiles.length > 0) {
          setValidationErrors(['Unassigned board tiles must be placed into a set or deleted from the image before solving.']);
          setInvalidSetIndexes([]);
          setInvalidTileKeys([]);
          return;
        }

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
        .map((item: any) => boardValidationIndexMap[item.index])
        .filter((index: number | undefined): index is number => index !== undefined);

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
  }, [boardValidationIndexMap, unassignedBoardTiles.length]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateCurrentGameState(gameState);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [gameState, validateCurrentGameState]);

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
          <Pressable
            style={[styles.undoButton, !undoSnapshot && styles.undoButtonDisabled]}
            onPress={handleUndo}
            disabled={!undoSnapshot}
          >
            <Ionicons name="arrow-undo" size={18} color="#e2e8f0" />
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Review the detected tiles directly on the uploaded images, manage board sets explicitly,
            and keep the current review state as the single source of truth before solving.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rack Review</Text>
            <VisionOverlayEditor
              title="Rack image"
              subtitle="Tap a detected rack box to edit it. Manual rack tiles stay in the synced list below."
              imageUri={rackImageUri}
              tiles={reviewRack}
              selectedTileId={selectedTileId}
              selectedTile={editingLocation?.source === 'rack' ? editingReviewTile : null}
              onTilePress={handleSelectRackOverlayTile}
              onSelectedTileEdit={editingLocation?.source === 'rack' ? handleOpenSelectedTileEditor : undefined}
              onSelectedTileDelete={editingLocation?.source === 'rack' ? handleDeleteTile : undefined}
            />
            <View style={styles.sectionSpacer} />
            <ReviewTileList
              title="Rack tiles"
              subtitle="Add rack tiles manually or tap any tile to correct it."
              tiles={reviewRack}
              selectedTileId={selectedTileId}
              invalidTileKeys={invalidTileKeys}
              addLabel="Add rack tile"
              onTilePress={handleEditRackTile}
              onAddTile={handleAddRackTile}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Board Review</Text>
            <VisionOverlayEditor
              title="Board image"
              subtitle="Each box stays linked to the same detected board tile even if you edit or sort sets below."
              imageUri={boardImageUri}
              tiles={reviewBoard.flatMap((tileSet) => tileSet.tiles)}
              selectedTileId={selectedTileId}
              selectedTile={editingLocation?.source === 'board' ? editingReviewTile : null}
              onTilePress={handleSelectBoardOverlayTile}
              onSelectedTileEdit={editingLocation?.source === 'board' ? handleOpenSelectedTileEditor : undefined}
              onSelectedTileDelete={editingLocation?.source === 'board' ? handleDeleteTile : undefined}
            />
            <View style={styles.sectionSpacer} />
            <BoardSetEditor
              board={reviewBoard}
              unassignedBoardTiles={unassignedBoardTiles}
              selectedTileId={selectedTileId}
              selectedSetId={selectedBoardSetId}
              selectedTileLabel={editingLocation?.source === 'board' && editingReviewTile ? getTileLabel(editingReviewTile.tile) : undefined}
              invalidSetIndexes={invalidSetIndexes}
              invalidTileKeys={invalidTileKeys}
              onTilePress={handleEditBoardTile}
              onUnassignedTilePress={handleUnassignedBoardTilePress}
              onAddTileToSet={handleAddTileToBoardSet}
              onCreateSet={handleCreateBoardSet}
              onDeleteSet={handleDeleteBoardSet}
              onEditSelectedTile={editingLocation?.source === 'board' ? handleOpenSelectedTileEditor : undefined}
              onClearSelection={editingLocation?.source === 'board' ? handleClearSelection : undefined}
              onMoveTileToSet={
                editingLocation?.source === 'board' ? moveSelectedBoardTileToSet : undefined
              }
              onMoveTileToUnassigned={
                editingLocation?.source === 'board' && editingLocation.setId !== 'board-unassigned'
                  ? () => removeBoardTileFromSet(editingLocation.tileId)
                  : undefined
              }
              onMergeSelectedSetIntoSet={
                editingLocation?.source === 'board' && editingLocation.setId !== 'board-unassigned'
                  ? mergeSelectedBoardSetIntoSet
                  : undefined
              }
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
      visible={isTileModalVisible && !!editingReviewTile}
      tile={editingReviewTile?.tile || null}
      onClose={() => {
        if (editingLocation && pendingNewTileIdRef.current === editingLocation.tileId) {
          discardPendingNewTile(editingLocation);
          return;
        }

        setIsTileModalVisible(false);
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
    gap: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.22)',
  },
  undoButtonDisabled: {
    opacity: 0.45,
  },
  undoButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
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
  sectionSpacer: {
    height: 14,
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