import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Tile } from '@/types/rummikub';
import { Image } from 'react-native';

interface Props {
  tile: Tile;
  onPress?: () => void;
}

const colorMap: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#facc15',
  black: '#111827',
};

export default function TileView({ tile, onPress }: Props) {
  const tileColor = tile.is_joker
    ? '#8b5cf6'
    : tile.color
    ? colorMap[tile.color]
    : '#6b7280';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}>
      <View style={styles.tile}>
        <Text style={[styles.value, { color: tileColor }]}>
          {tile.is_joker ? (
        <Image
            source={require('@/assets/images/joker.jpg')}
            style={styles.jokerImage}
            resizeMode="contain"
        />
        ) : (
        <Text style={[styles.value, { color: tileColor }]}>
            {tile.value ?? '?'}
        </Text>
        )}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginRight: -1,
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  tile: {
    width: 46,
    height: 64,
    borderRadius: 7,
    backgroundColor: '#fdfaf2',

    borderWidth: 1.2,
    borderColor: '#1f2937',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: {
        width: 0,
        height: 2,
    },

    elevation: 4,
    },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  color: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  darkText: {
    color: '#111827',
  },
  jokerImage: {
    width: 28,
    height: 28,
  },
});