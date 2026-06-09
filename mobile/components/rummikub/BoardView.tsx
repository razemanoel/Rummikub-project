import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TileSet } from '@/types/rummikub';
import TileView from './TileView';

interface Props {
  board: TileSet[];
  onTilePress?: (setIndex: number, tileIndex: number) => void;
  onAddTileToSet?: (setIndex: number) => void;
  invalidSetIndexes?: number[];
  invalidTileKeys?: string[];
}

export default function BoardView({
  board,
  onTilePress,
  onAddTileToSet,
  invalidSetIndexes = [],
  invalidTileKeys = [],
}: Props) {
  const getTileKey = (tile: any) => {
    if (tile.is_joker) return 'joker';
    return `${tile.value}-${tile.color}`;
  };

  return (
    <View style={styles.boardContainer}>
      {board.map((tileSet, setIndex) => (
        <View
          key={setIndex}
          style={[
            styles.setGroup,
            invalidSetIndexes.includes(setIndex) && styles.invalidSetGroup,
          ]}
        >
          {tileSet.tiles.map((tile, tileIndex) => (
            <View key={tileIndex} style={styles.tileWrapper}>
              <TileView
                tile={tile}
                isInvalid={invalidSetIndexes.includes(setIndex) || invalidTileKeys.includes(getTileKey(tile))}
                onPress={() => onTilePress?.(setIndex, tileIndex)}
              />
            </View>
          ))}

          {onAddTileToSet && (
            <Pressable
              style={styles.addTileButton}
              onPress={() => onAddTileToSet(setIndex)}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boardContainer: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  setGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginRight: 10,
    marginBottom: 10,
  },
  tileWrapper: {
    marginRight: 0,
  },
  invalidSetGroup: {
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  addTileButton: {
    width: 34,
    height: 64,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
});