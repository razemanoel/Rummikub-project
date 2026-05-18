import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { GameState } from '@/types/rummikub';
import TileView from '@/components/rummikub/TileView';
import TileSetView from '@/components/rummikub/TileSetView';
import BoardView from '@/components/rummikub/BoardView';
import EditTileModal from '@/components/rummikub/EditTileModal';
import { Tile } from '@/types/rummikub';
import { apiService } from '@/services/api';

const mockGameState: GameState = {
  rack: [
    { value: null, color: null, is_joker: true },

    { value: 8, color: 'red', is_joker: false },
    { value: 8, color: 'blue', is_joker: false },

    { value: 6, color: 'red', is_joker: false },
    { value: 7, color: 'red', is_joker: false },
    { value: 8, color: 'red', is_joker: false },

    { value: 12, color: 'blue', is_joker: false },
    { value: 13, color: 'blue', is_joker: false },

    { value: 4, color: 'yellow', is_joker: false },
    { value: 5, color: 'yellow', is_joker: false },

    { value: 12, color: 'black', is_joker: false },
  ],

  board: [
    {
      tiles: [
        { value: 8, color: 'black', is_joker: false },
        { value: 9, color: 'black', is_joker: false },
        { value: 10, color: 'black', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 11, color: 'black', is_joker: false },
        { value: 12, color: 'black', is_joker: false },
        { value: 13, color: 'black', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 3, color: 'blue', is_joker: false },
        { value: 4, color: 'blue', is_joker: false },
        { value: 5, color: 'blue', is_joker: false },
        { value: 6, color: 'blue', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 9, color: 'red', is_joker: false },
        { value: 10, color: 'red', is_joker: false },
        { value: 11, color: 'red', is_joker: false },
        { value: 12, color: 'red', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 4, color: 'black', is_joker: false },
        { value: 4, color: 'blue', is_joker: false },
        { value: 4, color: 'red', is_joker: false },
      ],
    },
    {
      tiles: [
        { value: 7, color: 'yellow', is_joker: false },
        { value: 8, color: 'yellow', is_joker: false },
        { value: 9, color: 'yellow', is_joker: false },
      ],
    },
  ],
};

export default function ReviewScreen() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>(mockGameState);

  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [editingLocation, setEditingLocation] = useState<
    | { type: 'rack'; index: number }
    | { type: 'board'; setIndex: number; tileIndex: number }
    | null
  >(null);

  const handleEditRackTile = (index: number) => {
    setEditingTile(gameState.rack[index]);
    setEditingLocation({ type: 'rack', index });
  };

  const handleEditBoardTile = (setIndex: number, tileIndex: number) => {
    setEditingTile(gameState.board[setIndex].tiles[tileIndex]);
    setEditingLocation({ type: 'board', setIndex, tileIndex });
  };

  const handleSaveTile = (updatedTile: Tile) => {
    if (!editingLocation) return;

    setGameState((prev) => {
      const next: GameState = {
        rack: [...prev.rack],
        board: prev.board.map((set) => ({
          tiles: [...set.tiles],
        })),
      };

      if (editingLocation.type === 'rack') {
        next.rack[editingLocation.index] = updatedTile;
      } else {
        next.board[editingLocation.setIndex].tiles[editingLocation.tileIndex] = updatedTile;
      }

      return next;
    });

    setEditingTile(null);
    setEditingLocation(null);
  };

  const handleDeleteTile = () => {
    if (!editingLocation) return;

    setGameState((prev) => {
      const next: GameState = {
        rack: [...prev.rack],
        board: prev.board.map((set) => ({
          tiles: [...set.tiles],
        })),
      };

      if (editingLocation.type === 'rack') {
        next.rack.splice(editingLocation.index, 1);
      } else {
        next.board[editingLocation.setIndex].tiles.splice(editingLocation.tileIndex, 1);
      }

      return next;
    });

    setEditingTile(null);
    setEditingLocation(null);
  };

  const handleConfirm = async () => {
  try {
    const response = await apiService.solveGameState(gameState);

    if (!response.success || !response.data) {
      Alert.alert('Solver Error', response.message || 'Failed to solve game state');
      return;
    }

    router.push({
      pathname: '/(main)/solution',
      params: {
        originalGameState: JSON.stringify(gameState),
        solution: JSON.stringify(response.data),
      },
    });
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to calculate solution');
  }
};
  

  return (
    <LinearGradient colors={['#0b1020', '#1b2250', '#0b1020']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>
          <Text style={styles.headerTitle}>Review Tiles</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Review the detected tiles. Tap a tile to edit it before solving.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Rack</Text>
            <View style={styles.rackRow}>
              {gameState.rack.map((tile, index) => (
                <TileView key={index} tile={tile} onPress={() => handleEditRackTile(index)} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared Board</Text>
            <BoardView board={gameState.board} onTilePress={handleEditBoardTile} />
          </View>

          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
            <Text style={styles.confirmText}>Confirm and Solve</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <EditTileModal
      visible={!!editingTile}
      tile={editingTile}
      onClose={() => {
        setEditingTile(null);
        setEditingLocation(null);
      }}
      onSave={handleSaveTile}
      onDelete={handleDeleteTile}
    />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  rackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 2,
    rowGap: 2,
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.18)',
  },
  confirmButton: {
    marginTop: 8,
    backgroundColor: '#4f8dfd',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
});