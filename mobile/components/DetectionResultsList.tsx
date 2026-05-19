import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DetectedTileCard from '@/components/DetectedTileCard';
import { EditableTile } from '@/types/rummikub';

interface Props {
  title: string;
  tiles: EditableTile[];
  editMode: boolean;
  onEditTile: (index: number) => void;
  onAddTile: () => void;
}

export default function DetectionResultsList({
  title,
  tiles,
  editMode,
  onEditTile,
  onAddTile,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {tiles.length} tile{tiles.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {tiles.length === 0 ? (
        <Text style={styles.empty}>No tiles detected</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tiles.map((tile, index) => (
            <DetectedTileCard
              key={tile.id}
              tile={tile}
              editMode={editMode}
              onEdit={() => onEditTile(index)}
            />
          ))}
        </ScrollView>
      )}

      {editMode && (
        <Pressable
          onPress={onAddTile}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color="#4f8dfd"
            style={styles.addIcon}
          />
          <Text style={styles.addButtonText}>Add Tile</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  count: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  scrollContent: {
    paddingRight: 8,
    paddingBottom: 4,
  },
  empty: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.4)',
  },
  addButtonPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.1)',
  },
  addIcon: {
    marginRight: 6,
  },
  addButtonText: {
    fontSize: 13,
    color: '#4f8dfd',
    fontWeight: '500',
  },
});
