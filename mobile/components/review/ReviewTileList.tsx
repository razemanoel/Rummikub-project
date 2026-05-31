import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TileView from '@/components/rummikub/TileView';
import {
  getReviewTileBadgeLabel,
  getTileKey,
  getTileLabel,
  ReviewTileState,
} from './reviewTypes';

interface Props {
  title: string;
  subtitle?: string;
  tiles: ReviewTileState[];
  selectedTileId?: string;
  invalidTileKeys?: string[];
  emptyMessage?: string;
  addLabel?: string;
  onTilePress: (tileId: string) => void;
  onAddTile?: () => void;
}

export default function ReviewTileList({
  title,
  subtitle,
  tiles,
  selectedTileId,
  invalidTileKeys = [],
  emptyMessage = 'No tiles available yet.',
  addLabel = 'Add tile',
  onTilePress,
  onAddTile,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onAddTile ? (
          <Pressable style={styles.addButton} onPress={onAddTile}>
            <Text style={styles.addButtonText}>{addLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {tiles.length === 0 ? (
        <Text style={styles.emptyMessage}>{emptyMessage}</Text>
      ) : (
        <View style={styles.grid}>
          {tiles.map((tile) => {
            const isSelected = selectedTileId === tile.id;

            return (
              <View key={tile.id} style={[styles.card, isSelected && styles.cardSelected]}>
                <TileView
                  tile={tile.tile}
                  isSelected={isSelected}
                  isInvalid={invalidTileKeys.includes(getTileKey(tile.tile))}
                  onPress={() => onTilePress(tile.id)}
                />
                <Text style={styles.tileLabel}>{getTileLabel(tile.tile)}</Text>
                <Text style={styles.tileMeta}>{getReviewTileBadgeLabel(tile)}</Text>
              </View>
            );
          })}
        </View>
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerCopy: {
    flex: 1,
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
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#eff6ff',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyMessage: {
    color: '#94a3b8',
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: 100,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  cardSelected: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
  },
  tileLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  tileMeta: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textAlign: 'center',
  },
});