import React from 'react';
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

import { GameState, SolveILPResponse } from '@/types/rummikub';
import BoardView from '@/components/rummikub/BoardView';
import TileView from '@/components/rummikub/TileView';

export default function SolutionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const originalGameState: GameState = JSON.parse(
    params.originalGameState as string
  );

  const solution: SolveILPResponse = JSON.parse(
    params.solution as string
  );
  const filteredSteps = (solution.steps || []).filter(
    (step) =>
      !step.startsWith('Joker usage') &&
      !step.startsWith('- Use a joker') &&
      !step.startsWith('Tiles left in your rack') &&
      !step.startsWith('No tiles remain')
  );

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>

          <Text style={styles.headerTitle}>Optimal Solution</Text>

          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Best Move Found</Text>

            <Text style={styles.summaryText}>
              Tiles removed from rack: {solution.tiles_used_count}
            </Text>

            <Text style={styles.summaryText}>
              Solver status: {solution.solver_status}
            </Text>

            <Text style={styles.summaryText}>
              Solve time: {solution.solve_time_seconds}s
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.phaseTitle}>BEFORE</Text>

            <Text style={styles.sectionTitle}>Your Rack</Text>
            <View style={styles.rackRow}>
                {originalGameState.rack.map((tile, index) => (
                <TileView key={index} tile={tile} />
                ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                Shared Board
            </Text>

            <BoardView board={originalGameState.board} />
            </View>

            <View style={styles.section}>
            <Text style={styles.phaseTitle}>AFTER</Text>

            <Text style={styles.sectionTitle}>Remaining Rack</Text>

            <View style={styles.rackRow}>
                {(solution.remaining_rack?.length ?? 0) > 0 ? (
                (solution.remaining_rack ?? []).map((tile, index) => (
                    <TileView key={index} tile={tile} />
                ))
                ) : (
                <Text style={styles.emptyText}>
                    No tiles remain in your rack.
                </Text>
                )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                Final Board
            </Text>

            <BoardView board={solution.new_board} />
            </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps</Text>

            <View style={styles.stepsCard}>
              {filteredSteps.map((step, index) => {
                const isSubStep = step.trim().startsWith('-');

                if (isSubStep) {
                  return (
                    <View key={index} style={styles.subStepRow}>
                      <Text style={styles.subStepText}>{step}</Text>
                    </View>
                  );
                }

                const stepNumber =
                  filteredSteps
                    .slice(0, index)
                    .filter((s) => !s.trim().startsWith('-')).length + 1;

                return (
                  <View key={index} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{stepNumber}</Text>
                    </View>

                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {(solution.joker_assignments?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Joker Usage</Text>

              <View style={styles.stepsCard}>
                {(solution.joker_assignments ?? []).map((joker, index) => (
                  <Text key={index} style={styles.stepText}>
                    Joker as {joker.value} {joker.color} in a {joker.type}
                  </Text>
                ))}
              </View>
            </View>
          )}
          <Pressable
            style={styles.simulationButton}
            onPress={() =>
              router.push({
                pathname: '/(main)/simulation',
                params: {
                  originalGameState: JSON.stringify(originalGameState),
                  solution: JSON.stringify(solution),
                },
              })
            }
          >
            <Ionicons name="play-circle" size={22} color="#ffffff" />
            <Text style={styles.simulationButtonText}>Show Step-by-Step Simulation</Text>
          </Pressable>
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
  summaryCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    color: '#86efac',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  summaryText: {
    color: '#d1fae5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
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
  rackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  stepsCard: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4f8dfd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  phaseTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 1,
    },
    subStepRow: {
      marginLeft: 42,
      marginBottom: 8,
    },
    subStepText: {
      color: '#cbd5e1',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    simulationButton: {
      backgroundColor: '#10b981',
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginBottom: 24,
    },

    simulationButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
      marginLeft: 8,
    },
});