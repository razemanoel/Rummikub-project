import React, { useEffect, useMemo, useState } from 'react';
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
} from '@/types/rummikub';
import TileView from '@/components/rummikub/TileView';
import BoardView from '@/components/rummikub/BoardView';
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

const buildDisplayRackRows = (
  rack: Tile[],
  rackRows: InitialRackRowItem[][],
) => {
  const parsedRows = rackRows
    .map((row) => row.map((item) => item?.tile).filter((tile): tile is Tile => Boolean(tile)))
    .filter((row) => row.length > 0);

  if (parsedRows.length > 0) {
    return parsedRows;
  }

  return rack.length > 0 ? [rack] : [];
};

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const gameStateParam = typeof params.gameState === 'string' ? params.gameState : undefined;
  const rackRowsParam = typeof params.rackRows === 'string' ? params.rackRows : undefined;
  const rackDetectionsParam = typeof params.rackDetections === 'string' ? params.rackDetections : '[]';
  const boardDetectionsParam = typeof params.boardDetections === 'string' ? params.boardDetections : '[]';
  const rackImageUri = typeof params.rackImageUri === 'string' ? params.rackImageUri : '';
  const boardImageUri = typeof params.boardImageUri === 'string' ? params.boardImageUri : '';
  const classifierModelVersion = typeof params.classifierModelVersion === 'string'
    ? params.classifierModelVersion
    : '';
  const detectorModelVersion = typeof params.detectorModelVersion === 'string'
    ? params.detectorModelVersion
    : '';

  const detectedGameState = useMemo<GameState>(
    () => (gameStateParam ? JSON.parse(gameStateParam) : mockGameState),
    [gameStateParam],
  );

  const parsedRackRows = useMemo<InitialRackRowItem[][]>(
    () => (rackRowsParam ? JSON.parse(rackRowsParam) : []),
    [rackRowsParam],
  );

  const displayRackRows = useMemo(
    () => buildDisplayRackRows(detectedGameState.rack, parsedRackRows),
    [detectedGameState.rack, parsedRackRows],
  );
  const totalDetectedTiles = useMemo(
    () => detectedGameState.rack.length + detectedGameState.board.reduce((sum, tileSet) => sum + tileSet.tiles.length, 0),
    [detectedGameState],
  );
  const [isSolving, setIsSolving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isGameStateValid = validationErrors.length === 0;

  useEffect(() => {
    let isCancelled = false;

    const runValidation = async () => {
      try {
        setIsValidating(true);

        const response = await apiService.validateGameState(detectedGameState);

        if (isCancelled) {
          return;
        }

        if (!response.success || !response.data) {
          setValidationErrors([response.message || 'Validation failed']);
          return;
        }

        if (response.data.status === 'success') {
          setValidationErrors([]);
          return;
        }

        const invalidSets = response.data.invalid_sets || [];
        const errors = invalidSets.length > 0
          ? invalidSets.map((item: any) =>
              item.index >= 0
                ? `Invalid set ${item.index + 1}: ${item.reason}`
                : item.reason
            )
          : ['Invalid game state'];

        setValidationErrors(errors);
      } catch (error: any) {
        if (!isCancelled) {
          setValidationErrors([error.message || 'Validation failed']);
        }
      } finally {
        if (!isCancelled) {
          setIsValidating(false);
        }
      }
    };

    runValidation();

    return () => {
      isCancelled = true;
    };
  }, [detectedGameState]);

  const handleSolve = async () => {
    try {
      setIsSolving(true);

      const solverPayload: GameState = {
        rack: detectedGameState.rack,
        board: detectedGameState.board,
      };

      const response = await apiService.solveGameState(solverPayload);

      if (!response.success || !response.data) {
        Alert.alert('Solver Error', response.message || 'Failed to solve detected game state');
        return;
      }

      await apiService.saveSolution(solverPayload, response.data);

      router.push({
        pathname: '/(main)/solution',
        params: {
          originalGameState: JSON.stringify(solverPayload),
          solution: JSON.stringify(response.data),
        },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to calculate solution');
    } finally {
      setIsSolving(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/(main)/review-edit' as never,
      params: {
        gameState: gameStateParam ?? JSON.stringify(detectedGameState),
        rackRows: rackRowsParam ?? JSON.stringify(parsedRackRows),
        rackDetections: rackDetectionsParam,
        boardDetections: boardDetectionsParam,
        rackImageUri,
        boardImageUri,
        classifierModelVersion,
        detectorModelVersion,
      },
    } as never);
  };

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>
          <Text style={styles.headerTitle}>Review Tiles</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Review the detected tiles in a clean summary first. Solve the detected state as-is,
            or open the detailed editor if anything needs correction.
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{detectedGameState.rack.length}</Text>
              <Text style={styles.summaryLabel}>Rack tiles</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{detectedGameState.board.length}</Text>
              <Text style={styles.summaryLabel}>Board sets</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalDetectedTiles}</Text>
              <Text style={styles.summaryLabel}>Detected tiles</Text>
            </View>
          </View>

          <View style={styles.imageRow}>
            <View style={styles.imageBadge}>
              <Ionicons name="image-outline" size={16} color="#9db4ff" />
              <Text style={styles.imageBadgeText}>
                {rackImageUri ? 'Rack image attached' : 'No rack image attached'}
              </Text>
            </View>
            <View style={styles.imageBadge}>
              <Ionicons name="image-outline" size={16} color="#9db4ff" />
              <Text style={styles.imageBadgeText}>
                {boardImageUri ? 'Board image attached' : 'No board image attached'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rack</Text>

            <View style={styles.rackContainer}>
              {displayRackRows.map((row, rowIndex) => (
                <View key={`rack-row-${rowIndex}`} style={styles.rackVisualRow}>
                  {row.map((tile, tileIndex) => (
                    <TileView key={`rack-tile-${rowIndex}-${tileIndex}`} tile={tile} />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Board</Text>
            <BoardView board={detectedGameState.board} />
          </View>

          {validationErrors.length > 0 ? (
            <View style={styles.validationBox}>
              <Text style={styles.validationTitle}>Invalid board state</Text>
              {validationErrors.map((error, index) => (
                <Text key={`review-validation-${index}`} style={styles.validationText}>
                  • {error}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable style={styles.editButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={20} color="#dbeafe" />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              style={[
                styles.solveButton,
                (!isGameStateValid || isSolving || isValidating) && styles.solveButtonDisabled,
              ]}
              onPress={handleSolve}
              disabled={!isGameStateValid || isSolving || isValidating}
            >
              <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
              <Text style={styles.solveButtonText}>
                {isSolving ? 'Solving...' : isValidating ? 'Checking...' : 'Solve'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  headerSpacer: {
    width: 28,
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  imageRow: {
    gap: 10,
    marginBottom: 24,
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.18)',
  },
  imageBadgeText: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700',
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.22)',
  },
  editButtonText: {
    color: '#dbeafe',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
  solveButton: {
    flex: 1,
    backgroundColor: '#4f8dfd',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  solveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
  solveButtonDisabled: {
    opacity: 0.45,
  },
});
