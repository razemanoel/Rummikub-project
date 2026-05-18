import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GameState, SolveILPResponse, TileSet } from '@/types/rummikub';
import TileView from '@/components/rummikub/TileView';
import BoardView from '@/components/rummikub/BoardView';

function tileMatches(a: any, b: any) {
  if (a.is_joker || b.is_joker) {
    return a.is_joker === b.is_joker;
  }

  return (
    a.value === b.value &&
    a.color === b.color &&
    a.is_joker === b.is_joker
  );
}

function removeTilesFromList(sourceTiles: any[], tilesToRemove: any[]) {
  const result = [...sourceTiles];

  for (const tileToRemove of tilesToRemove) {
    const index = result.findIndex((tile) => tileMatches(tile, tileToRemove));

    if (index !== -1) {
      result.splice(index, 1);
    }
  }

  return result;
}

function removeTilesFromBoard(board: any[], takeFromBoard: any[]) {
  return board.map((set) => ({
    tiles: [...set.tiles],
  })).map((set, setIndex) => {
    const source = takeFromBoard.find(
      (item) => item.set_index === setIndex
    );

    if (!source) {
      return set;
    }

    return {
      tiles: removeTilesFromList(set.tiles, source.tiles),
    };
  });
}

export default function SimulationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const originalGameState: GameState = JSON.parse(
    params.originalGameState as string
  );

  const solution: SolveILPResponse = JSON.parse(
    params.solution as string
  );

  const structuredSteps = solution.structured_steps || [];

  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = structuredSteps[stepIndex];

  const appliedSteps = useMemo(() => {
  return structuredSteps.slice(0, stepIndex);
}, [structuredSteps, stepIndex]);

const currentRack = useMemo(() => {
  let rack = [...originalGameState.rack];

  for (const step of appliedSteps) {
    rack = removeTilesFromList(rack, step.take_from_rack || []);
  }

  return rack;
}, [originalGameState.rack, appliedSteps]);

const currentBoard = useMemo(() => {
  let board = originalGameState.board.map((set) => ({
    tiles: [...set.tiles],
  }));

  for (const step of appliedSteps) {
    board = removeTilesFromBoard(board, step.take_from_board || []);
  }

  return board;
}, [originalGameState.board, appliedSteps]);

const builtBoard: TileSet[] = useMemo(() => {
  return appliedSteps.map((step) => step.result_set);
}, [appliedSteps]);

  const handleNext = () => {
    if (stepIndex < structuredSteps.length) {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const isFinished = stepIndex >= structuredSteps.length;

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>

          <Text style={styles.headerTitle}>Step Simulation</Text>

          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.progressCard}>
            <Text style={styles.progressText}>
              Step {Math.min(stepIndex + 1, structuredSteps.length)} of {structuredSteps.length}
            </Text>

            <Text style={styles.description}>
              {isFinished
                ? 'Simulation complete. This is the final board.'
                : currentStep?.description}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Original Rack</Text>
            <View style={styles.rackBox}>
              {currentRack.map((tile, index) => (
                <TileView key={index} tile={tile} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Original Shared Board</Text>
            <BoardView board={currentBoard} />
          </View>

          {!isFinished && currentStep && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Step Sources</Text>

                <View style={styles.sourceBox}>
                    {currentStep.type === 'keep_set' ? (
                        <>
                        <Text style={styles.sourceTitle}>
                            Keep this board set unchanged:
                        </Text>

                        <View style={styles.resultSetBox}>
                            {currentStep.result_set.tiles.map((tile, index) => (
                            <TileView key={index} tile={tile} />
                            ))}
                        </View>
                        </>
                    ) : (
                        <>
                        {currentStep.take_from_rack.length > 0 && (
                            <>
                            <Text style={styles.sourceTitle}>Take from rack:</Text>
                            <View style={styles.tileRow}>
                                {currentStep.take_from_rack.map((tile, index) => (
                                <TileView key={`rack-${index}`} tile={tile} />
                                ))}
                            </View>
                            </>
                        )}

                        {currentStep.take_from_board.map((source, sourceIndex) => (
                            <View key={sourceIndex} style={styles.boardSource}>
                            <Text style={styles.sourceTitle}>
                                Take from board set #{source.set_index}:
                            </Text>

                            <View style={styles.tileRow}>
                                {source.tiles.map((tile, tileIndex) => (
                                <TileView key={tileIndex} tile={tile} />
                                ))}
                            </View>
                            </View>
                        ))}

                        <Text style={styles.sourceTitle}>Build this set:</Text>

                        <View style={styles.resultSetBox}>
                            {currentStep.result_set.tiles.map((tile, index) => (
                            <TileView key={index} tile={tile} />
                            ))}
                        </View>
                        </>
                    )}
                    </View>
                </View>
                )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Board</Text>

            {builtBoard.length > 0 ? (
              <BoardView board={builtBoard} />
            ) : (
              <View style={styles.emptyBoard}>
                <Text style={styles.emptyText}>
                  The new board is empty. Press Next to start building it.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.navigationRow}>
            <Pressable
              onPress={handleBack}
              disabled={stepIndex === 0}
              style={[
                styles.navButton,
                stepIndex === 0 && styles.navButtonDisabled,
              ]}
            >
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
              <Text style={styles.navButtonText}>Back</Text>
            </Pressable>

            <Pressable
              onPress={handleNext}
              disabled={isFinished}
              style={[
                styles.navButton,
                isFinished && styles.navButtonDisabled,
              ]}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </Pressable>
          </View>
          {isFinished && (
            <Pressable
              style={styles.finishButton}
              onPress={() => router.replace('/(main)/(tabs)')}
            >
              <Ionicons name="checkmark-circle" size={22} color="#ffffff" />

              <Text style={styles.finishButtonText}>
                Finish Turn
              </Text>
            </Pressable>
          )}
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  progressText: {
    color: '#86efac',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  description: {
    color: '#d1fae5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
  rackBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  sourceBox: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  sourceTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 8,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  boardSource: {
    marginTop: 8,
  },
  resultSetBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  emptyBoard: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#4f8dfd',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  finishButton: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 18,
    gap: 8,
  },

  finishButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
});