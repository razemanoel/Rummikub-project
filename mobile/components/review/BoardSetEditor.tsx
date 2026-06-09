import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TileView from '@/components/rummikub/TileView';
import {
  getReviewSetBadgeLabel,
  getTileKey,
  ReviewTileState,
  ReviewTileSetState,
} from './reviewTypes';

type Mode = null | 'merge' | 'move';

interface Props {
  board: ReviewTileSetState[];
  unassignedBoardTiles: ReviewTileState[];
  selectedTileId?: string;
  invalidSetIndexes?: number[];
  invalidTileKeys?: string[];
  onTilePress: (setId: string, tileId: string) => void;
  onUnassignedTilePress: (tileId: string) => void;
  onAddTileToSet: (setId: string) => void;
  onCreateSet: () => void;
  onDeleteSet: (setId: string) => void;
  onMergeSets: (fromSetId: string, toSetId: string) => void;
  onMoveTile: (fromSetId: string, tileId: string, toSetId: string) => void;
}

export default function BoardSetEditor({
  board,
  unassignedBoardTiles,
  selectedTileId,
  invalidSetIndexes = [],
  invalidTileKeys = [],
  onTilePress,
  onUnassignedTilePress,
  onAddTileToSet,
  onCreateSet,
  onDeleteSet,
  onMergeSets,
  onMoveTile,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [mergeSelectedSets, setMergeSelectedSets] = useState<string[]>([]);
  const [movingTile, setMovingTile] = useState<{ tileId: string; fromSetId: string } | null>(null);

  const handleToggleMergeMode = () => {
    if (mode === 'merge') {
      setMode(null);
      setMergeSelectedSets([]);
    } else {
      setMode('merge');
      setMergeSelectedSets([]);
      setMovingTile(null);
    }
  };

  const handleToggleMoveMode = () => {
    if (mode === 'move') {
      setMode(null);
      setMovingTile(null);
    } else {
      setMode('move');
      setMovingTile(null);
      setMergeSelectedSets([]);
    }
  };

  const handleSetCheckbox = (setId: string) => {
    if (mode === 'merge') {
      if (mergeSelectedSets.includes(setId)) {
        setMergeSelectedSets((prev) => prev.filter((id) => id !== setId));
        return;
      }
      const next = [...mergeSelectedSets, setId];
      if (next.length === 2) {
        onMergeSets(next[0], next[1]);
        setMode(null);
        setMergeSelectedSets([]);
      } else {
        setMergeSelectedSets(next);
      }
    } else if (mode === 'move' && movingTile) {
      if (setId === movingTile.fromSetId) return;
      onMoveTile(movingTile.fromSetId, movingTile.tileId, setId);
      setMode(null);
      setMovingTile(null);
    }
  };

  const handleTilePress = (setId: string, tileId: string) => {
    if (mode === 'move' && !movingTile) {
      setMovingTile({ tileId, fromSetId: setId });
      return;
    }
    onTilePress(setId, tileId);
  };

  const showSetCheckbox = mode === 'merge' || (mode === 'move' && movingTile !== null);

  const getModeHint = (): string | null => {
    if (mode === 'merge') return 'Select 2 sets to merge';
    if (mode === 'move' && !movingTile) return 'Select a tile to move';
    if (mode === 'move' && movingTile) return 'Select destination set';
    return null;
  };

  const modeHint = getModeHint();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Board Sets</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.primaryButton} onPress={onCreateSet}>
            <Text style={styles.primaryButtonText}>Create set</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, mode === 'merge' && styles.primaryButtonActive]}
            onPress={handleToggleMergeMode}
          >
            <Text style={styles.primaryButtonText}>
              {mode === 'merge' ? 'Cancel' : 'Merge sets'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, mode === 'move' && styles.primaryButtonActive]}
            onPress={handleToggleMoveMode}
          >
            <Text style={styles.primaryButtonText}>
              {mode === 'move' ? 'Cancel' : 'Move tile'}
            </Text>
          </Pressable>
        </View>
        {modeHint ? (
          <Text style={styles.modeHint}>{modeHint}</Text>
        ) : null}
      </View>

      <View style={styles.list}>
        {board.map((tileSet, index) => {
          const isInvalidSet = invalidSetIndexes.includes(index);
          const isChecked = mergeSelectedSets.includes(tileSet.id) || movingTile?.fromSetId === tileSet.id;
          const isSourceSet = mode === 'move' && movingTile?.fromSetId === tileSet.id;

          return (
            <View
              key={tileSet.id}
              style={[styles.setCard, isInvalidSet && styles.setCardInvalid]}
            >
              <View style={styles.setHeader}>
                <View style={styles.setHeaderCopy}>
                  <Text style={styles.setTitle}>Set {index + 1}</Text>
                  <Text style={styles.setMeta}>{getReviewSetBadgeLabel(tileSet)}</Text>
                </View>
                <View style={styles.actionRow}>
                  {showSetCheckbox ? (
                    <Pressable
                      style={[
                        styles.checkbox,
                        isChecked && styles.checkboxChecked,
                        isSourceSet && styles.checkboxSource,
                      ]}
                      onPress={() => handleSetCheckbox(tileSet.id)}
                      disabled={isSourceSet}
                    >
                      <Text style={styles.checkboxText}>
                        {isChecked ? '✓' : '○'}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        style={[styles.secondaryButton, styles.secondaryButtonSuccess]}
                        onPress={() => onAddTileToSet(tileSet.id)}
                      >
                        <Text style={styles.secondaryButtonText}>Add tile</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.secondaryButton, styles.secondaryButtonDanger]}
                        onPress={() => onDeleteSet(tileSet.id)}
                      >
                        <Text style={styles.secondaryButtonText}>Delete set</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              {tileSet.tiles.length === 0 ? (
                <View style={styles.emptySet}>
                  <Text style={styles.emptySetText}>Empty set. Add tiles here before solving.</Text>
                </View>
              ) : (
                <View style={styles.tileRow}>
                  {tileSet.tiles.map((tile) => (
                    <View
                      key={tile.id}
                      style={[
                        styles.tileWrapper,
                        selectedTileId === tile.id && styles.tileWrapperSelected,
                        movingTile?.tileId === tile.id && styles.tileWrapperMoving,
                      ]}
                    >
                      <TileView
                        tile={tile.tile}
                        isSelected={selectedTileId === tile.id || movingTile?.tileId === tile.id}
                        isInvalid={isInvalidSet || invalidTileKeys.includes(getTileKey(tile.tile))}
                        onPress={() => handleTilePress(tileSet.id, tile.id)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8, 15, 33, 0.72)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.18)',
  },
  header: {
    gap: 12,
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerCopy: {
    gap: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonActive: {
    backgroundColor: '#7c3aed',
  },
  primaryButtonText: {
    color: '#eff6ff',
    fontSize: 13,
    fontWeight: '800',
  },
  modeHint: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  list: {
    gap: 14,
  },
  setCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  setCardInvalid: {
    borderColor: '#f87171',
    borderWidth: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  setHeaderCopy: {
    gap: 4,
    flex: 1,
  },
  setTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  setMeta: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  checkbox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  checkboxChecked: {
    borderColor: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  checkboxSource: {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    opacity: 0.4,
  },
  checkboxText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryButtonSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.42)',
  },
  secondaryButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.42)',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
  },
  emptySet: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    padding: 14,
  },
  emptySetText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileWrapper: {
    borderRadius: 12,
  },
  tileWrapperSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  tileWrapperMoving: {
    backgroundColor: 'rgba(124, 58, 237, 0.22)',
    borderRadius: 12,
  },
});
