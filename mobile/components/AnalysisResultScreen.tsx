import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  AnalysisResult,
  EditableTile,
  TileDetection,
  TileColor,
  SolverResponse,
  GameTile,
  GameState,
} from '@/types/rummikub';
import DetectionResultsList from '@/components/DetectionResultsList';
import EditTileModal from '@/components/EditTileModal';
import { solveBestMoveFromEditableRack } from '@/utils/localMoveSolver';
import { apiService } from '@/services/api';

interface Props {
  result: AnalysisResult;
  onBack: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `t_${++_idCounter}_${Date.now()}`;
}

const VALID_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black'];

function detectionToEditable(d: TileDetection): EditableTile {
  // Normalise to lowercase so 'Red', 'RED' etc. all work
  const rawColor = typeof d.tile_color === 'string' ? d.tile_color.toLowerCase().trim() : null;

  const isJoker =
    d.tile_number === null &&
    (rawColor === null || rawColor === '' || rawColor === 'joker');

  const color = VALID_COLORS.includes(rawColor as TileColor)
    ? (rawColor as TileColor)
    : null;

  return {
    id: nextId(),
    number: isJoker ? null : d.tile_number,
    color: isJoker ? null : color,
    isJoker,
    confidence: d.confidence,
  };
}

function toEditables(detections: TileDetection[] | null): EditableTile[] {
  if (!detections) return [];
  return detections.map(detectionToEditable);
}

// ── Blank tile template used when the user adds a new tile ────────────────
function blankTile(): EditableTile {
  return {
    id: nextId(),
    number: 1,
    color: 'red',
    isJoker: false,
    confidence: 1,
  };
}

/**
 * Convert an EditableTile (UI model) to a GameTile (API model).
 * Called when building the GameState for POST /api/solve.
 */
function editableTileToGameTile(t: EditableTile): GameTile {
  return {
    value: t.isJoker ? null : t.number,
    color: t.isJoker ? null : t.color,
    isJoker: t.isJoker,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

type EditTarget = {
  section: 'rack' | 'shared';
  index: number | null; // null = new tile
};

export default function AnalysisResultScreen({ result, onBack }: Props) {
  const [myRack, setMyRack] = useState<EditableTile[]>(() =>
    toEditables(result.data.myBoardDetections)
  );
  const [sharedBoard, setSharedBoard] = useState<EditableTile[]>(() =>
    toEditables(result.data.sharedBoardDetections)
  );

  const [editMode, setEditMode] = useState(false);
  const [solverResult, setSolverResult] = useState<SolverResponse | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // Which tile object should the modal receive?
  const modalTile: EditableTile | null =
    editTarget === null
      ? null
      : editTarget.index === null
      ? blankTile()
      : editTarget.section === 'rack'
      ? myRack[editTarget.index]
      : sharedBoard[editTarget.index];

  const openEdit = (section: 'rack' | 'shared', index: number) =>
    setEditTarget({ section, index });

  const openAddTile = (section: 'rack' | 'shared') =>
    setEditTarget({ section, index: null });

  const closeModal = () => setEditTarget(null);

  const handleSaveTile = useCallback(
    (updated: EditableTile) => {
      if (!editTarget) return;
      const isNew = editTarget.index === null;

      if (editTarget.section === 'rack') {
        setMyRack((prev) =>
          isNew
            ? [...prev, updated]
            : prev.map((t, i) => (i === editTarget.index ? updated : t))
        );
      } else {
        setSharedBoard((prev) =>
          isNew
            ? [...prev, updated]
            : prev.map((t, i) => (i === editTarget.index ? updated : t))
        );
      }
      closeModal();
    },
    [editTarget]
  );

  const handleRemoveTile = useCallback(() => {
    if (!editTarget || editTarget.index === null) {
      closeModal();
      return;
    }
    if (editTarget.section === 'rack') {
      setMyRack((prev) => prev.filter((_, i) => i !== editTarget.index));
    } else {
      setSharedBoard((prev) => prev.filter((_, i) => i !== editTarget.index));
    }
    // Editing the rack invalidates any existing solve result
    setSolverResult(null);
    closeModal();
  }, [editTarget]);

  // Clear solver result whenever the user saves a tile edit
  const handleSaveTileAndClearSolver = useCallback(
    (updated: EditableTile) => {
      setSolverResult(null);
      handleSaveTile(updated);
    },
    [handleSaveTile]
  );

  const handleSolve = async () => {
    setIsSolving(true);
    setSolverResult(null);

    // Build GameState from corrected UI state
    const gameState: GameState = {
      rack: myRack.map(editableTileToGameTile),
      // TODO: when board grouping UI exists, convert sharedBoard into
      // GameTileSet[] by grouping tiles into their respective sets.
      // For now the board is empty and the solver works from rack only.
      board: [],
    };

    try {
      const response = await apiService.solveGameState(gameState);

      if (response.success) {
        setSolverResult(response.data.solverResult);
      } else {
        // Backend returned an error — fall back to local solver
        console.warn('Backend solve failed, using local fallback:', response.message);
        Alert.alert(
          'Using local solver',
          'Could not reach the server. Showing local result instead.'
        );
        setSolverResult(solveBestMoveFromEditableRack(myRack));
      }
    } catch (err: any) {
      // Network / unexpected error — fall back to local solver
      console.error('Solve request error:', err);
      Alert.alert(
        'Using local solver',
        'Could not reach the server. Showing local result instead.'
      );
      setSolverResult(solveBestMoveFromEditableRack(myRack));
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0b1020', '#1b2250', '#0b1020']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.headerBtn,
                pressed && styles.headerBtnPressed,
              ]}
            >
              <Ionicons name="arrow-back" size={18} color="#9db4ff" />
              <Text style={styles.headerBtnText}>Back</Text>
            </Pressable>

            <Text style={styles.screenTitle}>Analysis Results</Text>

            <Pressable
              onPress={() => {
                // Exiting edit mode clears stale solver result
                if (editMode) setSolverResult(null);
                setEditMode((e) => !e);
              }}
              style={({ pressed }) => [
                styles.headerBtn,
                editMode && styles.headerBtnActive,
                pressed && styles.headerBtnPressed,
              ]}
            >
              <Ionicons
                name={editMode ? 'checkmark' : 'pencil'}
                size={16}
                color={editMode ? '#f59e0b' : '#9db4ff'}
              />
              <Text
                style={[
                  styles.headerBtnText,
                  editMode && styles.headerBtnTextActive,
                ]}
              >
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          {/* ── Edit mode banner ── */}
          {editMode && (
            <View style={styles.editBanner}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.editBannerText}>
                Tap any tile to correct it. Press Done when finished.
              </Text>
            </View>
          )}

          {/* ── My Rack ── */}
          <DetectionResultsList
            title="My Rack"
            tiles={myRack}
            editMode={editMode}
            onEditTile={(idx) => openEdit('rack', idx)}
            onAddTile={() => openAddTile('rack')}
          />

          {/* ── Shared Board ── */}
          <DetectionResultsList
            title="Shared Board"
            tiles={sharedBoard}
            editMode={editMode}
            onEditTile={(idx) => openEdit('shared', idx)}
            onAddTile={() => openAddTile('shared')}
          />

          {/* ── Solve button ── */}
          <Pressable
            onPress={handleSolve}
            disabled={isSolving}
            style={({ pressed }) => [
              styles.solveButton,
              pressed && !isSolving && styles.solveButtonPressed,
              isSolving && styles.solveButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={isSolving ? ['#374151', '#1f2937'] : ['#4f8dfd', '#73a9ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.solveGradient}
            >
              <Ionicons
                name="flash"
                size={18}
                color={isSolving ? '#9ca3af' : '#ffffff'}
                style={styles.solveIcon}
              />
              <Text style={[styles.solveText, isSolving && styles.solveTextDisabled]}>
                {isSolving ? 'Solving...' : 'Solve'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* ── Solution panel ── */}
          {solverResult && (
            <View style={styles.solutionPanel}>
              <View style={styles.solutionHeader}>
                <Ionicons
                  name={
                    solverResult.hasSuggestion
                      ? 'checkmark-circle'
                      : 'close-circle'
                  }
                  size={22}
                  color={solverResult.hasSuggestion ? '#10b981' : '#f59e0b'}
                />
                <Text
                  style={[
                    styles.solutionTitle,
                    {
                      color: solverResult.hasSuggestion ? '#10b981' : '#f59e0b',
                    },
                  ]}
                >
                  {solverResult.hasSuggestion ? 'Move Found!' : 'No Move Available'}
                </Text>
              </View>

              <Text style={styles.explanationText}>
                {solverResult.explanation}
              </Text>

              {solverResult.hasSuggestion && solverResult.suggestion && (
                <>
                  <Text style={styles.solutionSubheading}>
                    {solverResult.suggestion.tilesPlayed} tile
                    {solverResult.suggestion.tilesPlayed !== 1 ? 's' : ''} played
                  </Text>

                  {solverResult.suggestion.actions.map((action, i) => (
                    <View key={i} style={styles.actionRow}>
                      <View style={styles.actionBadge}>
                        <Text style={styles.actionBadgeText}>
                          {action.type === 'new_set' ? 'NEW' : 'EXT'}
                        </Text>
                      </View>
                      <Text style={styles.actionDesc}>{action.description}</Text>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.solutionNote}>
                Note: Board grouping is not yet available — solution uses rack
                tiles only.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Edit tile modal ── */}
        <EditTileModal
          visible={editTarget !== null}
          tile={modalTile}
          onSave={handleSaveTileAndClearSolver}
          onRemove={handleRemoveTile}
          onClose={closeModal}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 24,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 141, 253, 0.1)',
  },
  headerBtnPressed: { backgroundColor: 'rgba(79, 141, 253, 0.2)' },
  headerBtnActive: { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
  headerBtnText: {
    color: '#9db4ff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  headerBtnTextActive: { color: '#f59e0b' },
  screenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },

  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  editBannerText: {
    color: '#fcd34d',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },

  // Solve button
  solveButton: { marginBottom: 16 },
  solveButtonPressed: { opacity: 0.9 },
  solveButtonDisabled: { opacity: 0.6 },
  solveGradient: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  solveIcon: { marginRight: 8 },
  solveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  solveTextDisabled: {
    color: '#9ca3af',
  },

  // Solution panel
  solutionPanel: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  solutionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 12,
  },
  solutionSubheading: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  actionBadge: {
    backgroundColor: 'rgba(79, 141, 253, 0.2)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 1,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9db4ff',
    letterSpacing: 0.5,
  },
  actionDesc: {
    fontSize: 13,
    color: '#e2e8f0',
    flex: 1,
    lineHeight: 18,
  },
  solutionNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
