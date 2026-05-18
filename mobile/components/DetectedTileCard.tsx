import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EditableTile, TileColor } from '@/types/rummikub';

interface Props {
  tile: EditableTile;
  editMode: boolean;
  onEdit: () => void;
}

const COLOR_BG: Record<TileColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#fbbf24',
  black: '#374151',
};

export const JOKER_BG = '#a855f7';

function tileBg(color: TileColor | null): string {
  if (color === null) return JOKER_BG;
  return COLOR_BG[color];
}

export default function DetectedTileCard({ tile, editMode, onEdit }: Props) {
  const bg = tileBg(tile.color);
  const displayValue = tile.isJoker ? 'J' : (tile.number?.toString() ?? '?');
  // Yellow tiles need dark text to stay readable
  const textColor = tile.color === 'yellow' ? '#1f2937' : '#ffffff';
  const label = tile.isJoker ? 'joker' : (tile.color ?? '?');
  const confidence = `${Math.round(tile.confidence * 100)}%`;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={editMode ? onEdit : undefined}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: bg },
          editMode && styles.cardEditable,
          pressed && editMode && styles.cardPressed,
        ]}
      >
        <Text style={[styles.value, { color: textColor }]}>{displayValue}</Text>

        {editMode && (
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={9} color="#ffffff" />
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>{label}</Text>
      <Text style={styles.confidence}>{confidence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginRight: 12,
  },
  card: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardEditable: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  cardPressed: {
    opacity: 0.75,
  },
  editBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    padding: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: '#cbd5e1',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  confidence: {
    fontSize: 10,
    color: '#94a3b8',
  },
});
