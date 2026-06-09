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

const EMPTY_GAME_STATE: GameState = {
  rack: [],
  board: [],
};

type InitialRackRowItem = {
  tile?: Tile;
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
  const candidateDetections = boardDetections.filter((detection) => detection.source === 'board');
  const flattenedBoardTiles = board.flatMap((tileSet) => tileSet.tiles);
  const hasExactFlatOrderMatch = (
    flattenedBoardTiles.length === candidateDetections.length
    && flattenedBoardTiles.every((tile, index) => {
      const detection = candidateDetections[index];
      return !!detection && areTilesEqual(tile, detection.tile);
    })
  );
  const unmatchedDetectionIndexes = new Set(candidateDetections.map((_, index) => index));
  let flatTileIndex = 0;

  const takeDetectionForTile = (tile: Tile, currentFlatIndex: number) => {
    if (hasExactFlatOrderMatch) {
      unmatchedDetectionIndexes.delete(currentFlatIndex);
      return candidateDetections[currentFlatIndex];
    }

    const preferredDetection = candidateDetections[currentFlatIndex];

    if (
      preferredDetection
      && unmatchedDetectionIndexes.has(currentFlatIndex)
      && areTilesEqual(tile, preferredDetection.tile)
    ) {
      unmatchedDetectionIndexes.delete(currentFlatIndex);
      return preferredDetection;
    }

    const matchingIndexes = [...unmatchedDetectionIndexes].filter((index) => (
      areTilesEqual(tile, candidateDetections[index].tile)
    ));

    if (matchingIndexes.length === 1) {
      const matchingIndex = matchingIndexes[0];
      unmatchedDetectionIndexes.delete(matchingIndex);
      return candidateDetections[matchingIndex];
    }

    return undefined;
  };

  return board.map((tileSet, setIndex) => ({
    id: `board-set-${setIndex}`,
    tiles: tileSet.tiles.map((tile, tileIndex) => {
      const currentFlatIndex = flatTileIndex;
      const detection = takeDetectionForTile(tile, currentFlatIndex);
      const feedbackTileIndex = detection?.index ?? currentFlatIndex;

      flatTileIndex += 1;

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
  : EMPTY_GAME_STATE;

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
    setIsTileModalVisible(true);
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
    Alert.alert('Set Created', 'An empty set was added. Add tiles to it before solving.');
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

  const handleMergeSets = (fromSetId: string, toSetId: string) => {
    const sourceSet = reviewBoard.find((tileSet) => tileSet.id === fromSetId);
    if (!sourceSet || sourceSet.tiles.length === 0) return;

    captureUndoSnapshot();
    sourceSet.tiles.forEach((tile) => recordBoardStructureChange(tile, fromSetId, toSetId));

    setReviewBoard((prev) => {
      const currentSourceSet = prev.find((tileSet) => tileSet.id === fromSetId);
      if (!currentSourceSet) return prev;
      return prev
        .filter((tileSet) => tileSet.id !== fromSetId)
        .map((tileSet) => (
          tileSet.id === toSetId
            ? { ...tileSet, tiles: sortTilesInSet([...tileSet.tiles, ...currentSourceSet.tiles]) }
            : tileSet
        ));
    });
  };

  const handleMoveTile = (fromSetId: string, tileId: string, toSetId: string) => {
    const tile = reviewBoard.find((s) => s.id === fromSetId)?.tiles.find((t) => t.id === tileId);
    if (!tile) return;

    captureUndoSnapshot();

    setReviewBoard((prev) => prev.map((tileSet) => {
      if (tileSet.id === fromSetId) return { ...tileSet, tiles: tileSet.tiles.filter((t) => t.id !== tileId) };
      if (tileSet.id === toSetId) return { ...tileSet, tiles: sortTilesInSet([...tileSet.tiles, tile]) };
      return tileSet;
    }));

    recordBoardStructureChange(tile, fromSetId, toSetId);
  };

  const handleDeleteBoardSet = (setId: string) => {
    deleteBoardSet(setId);
    Alert.alert('Set Deleted', 'The set has been removed.');
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
    if (isTileModalVisible) return;

    const timeoutId = setTimeout(() => {
      validateCurrentGameState(gameState);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [gameState, validateCurrentGameState, isTileModalVisible]);

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
          <View style={styles.headerTitleContainer} pointerEvents="none">
            <Text style={styles.headerTitle}>Review Tiles</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Correct any misdetected tiles, then confirm to solve.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rack Review</Text>
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
            <BoardSetEditor
              board={reviewBoard}
              unassignedBoardTiles={unassignedBoardTiles}
              selectedTileId={selectedTileId}
              invalidSetIndexes={invalidSetIndexes}
              invalidTileKeys={invalidTileKeys}
              onTilePress={handleEditBoardTile}
              onUnassignedTilePress={handleUnassignedBoardTilePress}
              onAddTileToSet={handleAddTileToBoardSet}
              onCreateSet={handleCreateBoardSet}
              onDeleteSet={handleDeleteBoardSet}
              onMergeSets={handleMergeSets}
              onMoveTile={handleMoveTile}
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
    gap: 12,
    position: 'relative',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
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