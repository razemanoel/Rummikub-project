import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TileView from '@/components/rummikub/TileView';
import {
  getReviewSetBadgeLabel,
  getTileKey,
  getReviewTileBadgeLabel,
  getTileLabel,
  ReviewTileState,
  ReviewTileSetState,
} from './reviewTypes';

interface Props {
  board: ReviewTileSetState[];
  unassignedBoardTiles: ReviewTileState[];
  selectedTileId?: string;
  selectedSetId?: string;
  selectedTileLabel?: string;
  invalidSetIndexes?: number[];
  invalidTileKeys?: string[];
  onTilePress: (setId: string, tileId: string) => void;
  onUnassignedTilePress: (tileId: string) => void;
  onAddTileToSet: (setId: string) => void;
  onCreateSet: () => void;
  onDeleteSet: (setId: string) => void;
  onEditSelectedTile?: () => void;
  onClearSelection?: () => void;
  onMoveTileToSet?: (setId: string) => void;
  onMoveTileToUnassigned?: () => void;
  onMergeSelectedSetIntoSet?: (setId: string) => void;
}

export default function BoardSetEditor({
  board,
  unassignedBoardTiles,
  selectedTileId,
  selectedSetId,
  selectedTileLabel,
  invalidSetIndexes = [],
  invalidTileKeys = [],
  onTilePress,
  onUnassignedTilePress,
  onAddTileToSet,
  onCreateSet,
  onDeleteSet,
  onEditSelectedTile,
  onClearSelection,
  onMoveTileToSet,
  onMoveTileToUnassigned,
  onMergeSelectedSetIntoSet,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Board Sets</Text>
          <Text style={styles.subtitle}>
            Select a board tile first, then move it, merge its set into another set, or edit it without breaking the original detection identity.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.primaryButton} onPress={onCreateSet}>
            <Text style={styles.primaryButtonText}>Create empty set</Text>
          </Pressable>
        </View>
      </View>

      {selectedTileLabel ? (
        <View style={styles.selectionPanel}>
          <View style={styles.selectionPanelCopy}>
            <Text style={styles.selectionPanelTitle}>Selected board tile</Text>
            <Text style={styles.selectionPanelValue}>{selectedTileLabel}</Text>
            <Text style={styles.selectionPanelMeta}>
              Pick a destination set below, unassign this tile, or open the tile editor.
            </Text>
          </View>
          <View style={styles.selectionPanelActions}>
            {onEditSelectedTile ? (
              <Pressable style={[styles.selectionAction, styles.selectionActionPrimary]} onPress={onEditSelectedTile}>
                <Text style={styles.selectionActionText}>Edit tile</Text>
              </Pressable>
            ) : null}
            {onMoveTileToUnassigned ? (
              <Pressable style={[styles.selectionAction, styles.selectionActionSecondary]} onPress={onMoveTileToUnassigned}>
                <Text style={styles.selectionActionText}>Move to unassigned</Text>
              </Pressable>
            ) : null}
            {onClearSelection ? (
              <Pressable style={[styles.selectionAction, styles.selectionActionGhost]} onPress={onClearSelection}>
                <Text style={styles.selectionActionGhostText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.selectionHint}>
          <Text style={styles.selectionHintText}>Tap any board tile to select it and unlock move or merge actions.</Text>
        </View>
      )}

      <View style={styles.unassignedCard}>
        <View style={styles.setHeader}>
          <View style={styles.setHeaderCopy}>
            <Text style={styles.setTitle}>Unassigned board tiles</Text>
            <Text style={styles.setMeta}>
              Tiles here still exist in the image and will not be treated as false positives.
            </Text>
          </View>
        </View>

        {unassignedBoardTiles.length === 0 ? (
          <View style={styles.emptySet}>
            <Text style={styles.emptySetText}>
              No unassigned board tiles.
            </Text>
          </View>
        ) : (
          <View style={styles.unassignedList}>
            {unassignedBoardTiles.map((tile) => (
              <View key={tile.id} style={styles.unassignedTileCard}>
                <TileView
                  tile={tile.tile}
                  isSelected={selectedTileId === tile.id}
                  isInvalid={invalidTileKeys.includes(getTileKey(tile.tile))}
                  onPress={() => onUnassignedTilePress(tile.id)}
                />
                <Text style={styles.unassignedTileLabel}>{getTileLabel(tile.tile)}</Text>
                <Text style={styles.unassignedTileMeta}>{getReviewTileBadgeLabel(tile)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.list}>
        {board.map((tileSet, index) => {
          const isInvalidSet = invalidSetIndexes.includes(index);

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
                  {onMoveTileToSet ? (
                    <Pressable
                      style={[styles.secondaryButton, styles.secondaryButtonMove]}
                      onPress={() => onMoveTileToSet(tileSet.id)}
                    >
                      <Text style={styles.secondaryButtonText}>Move selected here</Text>
                    </Pressable>
                  ) : null}
                  {onMergeSelectedSetIntoSet && selectedSetId && selectedSetId !== 'board-unassigned' && selectedSetId !== tileSet.id ? (
                    <Pressable
                      style={[styles.secondaryButton, styles.secondaryButtonMerge]}
                      onPress={() => onMergeSelectedSetIntoSet(tileSet.id)}
                    >
                      <Text style={styles.secondaryButtonText}>Merge selected set here</Text>
                    </Pressable>
                  ) : null}
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
                </View>
              </View>

              {tileSet.tiles.length === 0 ? (
                <View style={styles.emptySet}>
                  <Text style={styles.emptySetText}>
                    Empty set. Add tiles here before solving.
                  </Text>
                </View>
              ) : (
                <View style={styles.tileRow}>
                  {tileSet.tiles.map((tile) => (
                    <View
                      key={tile.id}
                      style={[
                        styles.tileWrapper,
                        selectedTileId === tile.id && styles.tileWrapperSelected,
                      ]}
                    >
                      <TileView
                        tile={tile.tile}
                        isSelected={selectedTileId === tile.id}
                        isInvalid={invalidTileKeys.includes(getTileKey(tile.tile))}
                        onPress={() => onTilePress(tileSet.id, tile.id)}
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
  selectionPanel: {
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(13, 24, 54, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    gap: 12,
  },
  selectionPanelCopy: {
    gap: 4,
  },
  selectionPanelTitle: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectionPanelValue: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  selectionPanelMeta: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  selectionPanelActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectionAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectionActionPrimary: {
    backgroundColor: 'rgba(8, 145, 178, 0.24)',
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  selectionActionSecondary: {
    backgroundColor: 'rgba(14, 116, 144, 0.2)',
    borderColor: 'rgba(125, 211, 252, 0.28)',
  },
  selectionActionGhost: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  selectionActionText: {
    color: '#ecfeff',
    fontSize: 13,
    fontWeight: '800',
  },
  selectionActionGhostText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  selectionHint: {
    marginBottom: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  selectionHintText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  headerCopy: {
    gap: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#eff6ff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryHeaderButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14, 116, 144, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryHeaderButtonText: {
    color: '#cffafe',
    fontSize: 13,
    fontWeight: '800',
  },
  unassignedCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
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
    backgroundColor: 'rgba(127, 29, 29, 0.22)',
  },
  setHeader: {
    gap: 10,
    marginBottom: 12,
  },
  setHeaderCopy: {
    gap: 4,
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
  secondaryButtonMove: {
    backgroundColor: 'rgba(14, 116, 144, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  secondaryButtonMerge: {
    backgroundColor: 'rgba(91, 33, 182, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.35)',
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
  unassignedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unassignedTileCard: {
    width: 112,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  unassignedTileLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  unassignedTileMeta: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textAlign: 'center',
  },
});