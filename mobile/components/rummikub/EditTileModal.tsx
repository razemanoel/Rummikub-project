import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Tile, TileColor } from '@/types/rummikub';

interface Props {
  visible: boolean;
  tile: Tile | null;
  onClose: () => void;
  onSave: (updatedTile: Tile) => void;
  onDelete?: () => void;
}

const colors: TileColor[] = ['red', 'blue', 'yellow', 'black'];
const values = Array.from({ length: 13 }, (_, i) => i + 1);

export default function EditTileModal({
  visible,
  tile,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [value, setValue] = useState<number | null>(tile?.value ?? 1);
  const [color, setColor] = useState<TileColor | null>(tile?.color ?? 'blue');
  const [isJoker, setIsJoker] = useState<boolean>(tile?.is_joker ?? false);

  useEffect(() => {
    if (tile) {
      setValue(tile.value ?? 1);
      setColor(tile.color ?? 'blue');
      setIsJoker(tile.is_joker);
    }
  }, [tile]);

  const handleSave = () => {
    if (isJoker) {
      onSave({
        value: null,
        color: null,
        is_joker: true,
      });
      return;
    }

    onSave({
      value,
      color,
      is_joker: false,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit Tile</Text>

          <Text style={styles.label}>Tile Type</Text>

          <View style={styles.typeRow}>
          <Pressable
              style={[styles.typeButton, !isJoker && styles.typeButtonActive]}
              onPress={() => setIsJoker(false)}
          >
              <Text style={styles.typeButtonText}>Regular Tile</Text>
          </Pressable>

          <Pressable
              style={[styles.typeButton, isJoker && styles.typeButtonActive]}
              onPress={() => setIsJoker(true)}
          >
              <Text style={styles.typeButtonText}>Joker</Text>
          </Pressable>
          </View>

          {!isJoker && (
            <>
              <Text style={styles.label}>Number</Text>
              <View style={styles.grid}>
                {values.map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => setValue(num)}
                    style={[
                      styles.valueButton,
                      value === num && styles.selectedButton,
                    ]}
                  >
                    <Text style={styles.valueText}>{num}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorRow}>
                {colors.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorButton,
                      styles[c],
                      color === c && styles.selectedColor,
                    ]}
                  >
                    <Text style={styles.colorText}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={styles.actions}>
            {onDelete && (
              <Pressable style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.actionText}>Delete</Text>
              </Pressable>
            )}

            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>

            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.actionText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  jokerButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  jokerButtonActive: {
    backgroundColor: '#8b5cf6',
  },
  jokerText: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  valueButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedButton: {
    backgroundColor: '#4f8dfd',
  },
  valueText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#ffffff',
  },
  colorText: {
    color: '#ffffff',
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  red: {
    backgroundColor: '#ef4444',
  },
  blue: {
    backgroundColor: '#3b82f6',
  },
  yellow: {
    backgroundColor: '#facc15',
  },
  black: {
    backgroundColor: '#111111',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  saveButton: {
    backgroundColor: '#4f8dfd',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 'auto',
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#4f8dfd',
    borderColor: '#4f8dfd',
  },
  typeButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});