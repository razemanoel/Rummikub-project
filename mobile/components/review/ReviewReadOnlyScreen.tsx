import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import BoardView from '@/components/rummikub/BoardView';
import TileView from '@/components/rummikub/TileView';
import { getTileLabel } from '@/components/review/reviewTypes';
import { apiService } from '@/services/api';
import { GameState, Tile, VisionDetection } from '@/types/rummikub';

const EMPTY_GAME_STATE: GameState = {
  rack: [],
  board: [],
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

export default function ReviewReadOnlyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const initialGameState = useMemo<GameState>(
    () => (params.gameState ? JSON.parse(params.gameState as string) : EMPTY_GAME_STATE),
    [params.gameState],
  );
  const initialRackRows = useMemo(
    () => (params.rackRows ? JSON.parse(params.rackRows as string) : [] as InitialRackRowItem[][]),
    [params.rackRows],
  );
  const initialRackDetections = useMemo<VisionDetection[]>(
    () => (params.rackDetections ? JSON.parse(params.rackDetections as string) : []),
    [params.rackDetections],
  );
  const initialBoardDetections = useMemo<VisionDetection[]>(
    () => (params.boardDetections ? JSON.parse(params.boardDetections as string) : []),
    [params.boardDetections],
  );

  const rackImageUri = (params.rackImageUri as string) || '';
  const boardImageUri = (params.boardImageUri as string) || '';
  const classifierModelVersion = (params.classifierModelVersion as string) || '';
  const detectorModelVersion = (params.detectorModelVersion as string) || '';

  const displayRackRows = useMemo(
    () => buildDisplayRackRows(initialGameState.rack, initialRackRows),
    [initialGameState.rack, initialRackRows],
  );

  const routeParams = useMemo(
    () => ({
      gameState: JSON.stringify(initialGameState),
      rackRows: JSON.stringify(initialRackRows ?? []),
      rackDetections: JSON.stringify(initialRackDetections ?? []),
      boardDetections: JSON.stringify(initialBoardDetections ?? []),
      rackImageUri,
      boardImageUri,
      classifierModelVersion,
      detectorModelVersion,
    }),
    [
      boardImageUri,
      classifierModelVersion,
      detectorModelVersion,
      initialBoardDetections,
      initialGameState,
      initialRackDetections,
      initialRackRows,
      rackImageUri,
    ],
  );

  useEffect(() => {
    let isActive = true;

    const validateGameState = async () => {
      try {
        setIsValidating(true);

        const response = await apiService.validateGameState(initialGameState);

        if (!isActive) {
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
          ? invalidSets.map((item: any) => (
              item.index >= 0
                ? `Invalid set: ${initialGameState.board[item.index]?.tiles.map(getTileLabel).join(', ')} - ${item.reason}`
                : item.reason
            ))
          : ['Invalid game state'];

        setValidationErrors(errors);
      } catch (error: any) {
        if (isActive) {
          setValidationErrors([error.message || 'Validation failed']);
        }
      } finally {
        if (isActive) {
          setIsValidating(false);
        }
      }
    };

    validateGameState();

    return () => {
      isActive = false;
    };
  }, [initialGameState]);

  const handleOpenEditor = () => {
    router.push({
      pathname: '/(main)/review-edit',
      params: routeParams,
    });
  };

  const handleSolve = async () => {
    try {
      setIsSubmitting(true);

      const response = await apiService.solveGameState(initialGameState);

      if (!response.success || !response.data) {
        Alert.alert('Solver Error', response.message || 'Failed to solve game state');
        return;
      }

      await apiService.saveSolution(initialGameState, response.data);

      router.push({
        pathname: '/(main)/solution',
        params: {
          originalGameState: JSON.stringify(initialGameState),
          solution: JSON.stringify(response.data),
        },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to calculate solution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDetectedTiles = initialRackDetections.length + initialBoardDetections.length;
  const canSolve = validationErrors.length === 0 && !isSubmitting && !isValidating;

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>
          <Text style={styles.headerTitle}>Detection Review</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Review the detected rack and board state before solving. Open the editor only if you need to correct detections.
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Rack tiles</Text>
              <Text style={styles.summaryValue}>{initialGameState.rack.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Board sets</Text>
              <Text style={styles.summaryValue}>{initialGameState.board.length}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Detected tiles</Text>
              <Text style={styles.summaryValue}>{totalDetectedTiles}</Text>
            </View>
          </View>

          {validationErrors.length > 0 ? (
            <View style={styles.validationBox}>
              <Text style={styles.validationTitle}>Validation errors</Text>
              {validationErrors.map((error, index) => (
                <Text key={index} style={styles.validationText}>
                  • {error}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rack</Text>

            <View style={styles.rackContainer}>
              {displayRackRows.length === 0 ? (
                <Text style={styles.emptyText}>No rack tiles returned.</Text>
              ) : (
                displayRackRows.map((row, rowIndex) => (
                  <View key={`rack-row-${rowIndex}`} style={styles.rackVisualRow}>
                    {row.map((tile, tileIndex) => (
                      <TileView key={`rack-tile-${rowIndex}-${tileIndex}`} tile={tile} />
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Board</Text>
            {initialGameState.board.length === 0 ? (
              <Text style={styles.emptyText}>No board sets returned.</Text>
            ) : (
              <BoardView board={initialGameState.board} />
            )}
          </View>

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={handleOpenEditor}>
              <Ionicons name="create-outline" size={18} color="#dbeafe" />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, !canSolve && styles.primaryButtonDisabled]}
              onPress={handleSolve}
              disabled={!canSolve}
            >
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Solving...' : isValidating ? 'Checking...' : 'Solve'}
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
    gap: 18,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.22)',
  },
  secondaryButtonText: {
    color: '#dbeafe',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: '#334155',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(8, 15, 33, 0.72)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.18)',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  validationBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.65)',
    borderColor: 'rgba(248, 113, 113, 0.45)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  validationTitle: {
    color: '#fee2e2',
    fontSize: 16,
    fontWeight: '800',
  },
  validationText: {
    color: '#fecaca',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '800',
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
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
