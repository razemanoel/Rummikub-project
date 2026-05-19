import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TileSet } from '@/types/rummikub';
import TileView from './TileView';

interface Props {
  title: string;
  tileSet: TileSet;
}

export default function TileSetView({ title, tileSet }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.tilesRow}>
        {tileSet.tiles.map((tile, index) => (
          <TileView key={index} tile={tile} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  tilesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});