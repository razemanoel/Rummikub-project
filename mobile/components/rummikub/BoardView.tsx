import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TileSet } from '@/types/rummikub';
import TileView from './TileView';

interface Props {
  board: TileSet[];
  onTilePress?: (setIndex: number, tileIndex: number) => void;
  invalidSetIndexes?: number[];
  invalidTileKeys?: string[];
}

export default function BoardView({
  board,
  onTilePress,
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
                isInvalid={invalidTileKeys.includes(getTileKey(tile))}
                onPress={() => onTilePress?.(setIndex, tileIndex)}
              />
            </View>
          ))}
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
});