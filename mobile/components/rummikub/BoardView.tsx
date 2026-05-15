import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TileSet } from '@/types/rummikub';
import TileView from './TileView';

interface Props {
  board: TileSet[];
  onTilePress?: (setIndex: number, tileIndex: number) => void;
}

export default function BoardView({ board, onTilePress }: Props) {
  return (
    <View style={styles.boardContainer}>
      {board.map((tileSet, setIndex) => (
        <View key={setIndex} style={styles.setGroup}>
          {tileSet.tiles.map((tile, tileIndex) => (
            <View key={tileIndex} style={styles.tileWrapper}>
              <TileView tile={tile} onPress={() => onTilePress?.(setIndex, tileIndex)} />
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
});