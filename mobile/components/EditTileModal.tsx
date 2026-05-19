import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { EditableTile, TileColor } from '@/types/rummikub';

interface Props {
  visible: boolean;
  /** The tile being edited. Pass null to add a new tile. */
  tile: EditableTile | null;
  onSave: (updated: EditableTile) => void;
  onRemove: () => void;
  onClose: () => void;
}

const COLORS: { value: TileColor | null; label: string; bg: string }[] = [
  { value: 'red',    label: 'Red',    bg: '#ef4444' },
  { value: 'blue',   label: 'Blue',   bg: '#3b82f6' },
  { value: 'yellow', label: 'Yellow', bg: '#fbbf24' },
  { value: 'black',  label: 'Black',  bg: '#374151' },
  { value: null,     label: 'Joker',  bg: '#a855f7' },
];

const NUMBERS = Array.from({ length: 13 }, (_, i) => i + 1); // 1-13

export default function EditTileModal({
  visible,
  tile,
  onSave,
  onRemove,
  onClose,
}: Props) {
  const [number, setNumber] = useState<number | null>(null);
  const [color, setColor] = useState<TileColor | null>(null);
  const [isJoker, setIsJoker] = useState(false);

  // Sync local state whenever the target tile changes
  useEffect(() => {
    if (tile) {
      setNumber(tile.number);
      setColor(tile.color);
      setIsJoker(tile.isJoker);
    }
  }, [tile]);

  const selectJoker = () => {
    setIsJoker(true);
    setNumber(null);
    setColor(null);
  };

  const selectNumber = (n: number) => {
    setIsJoker(false);
    setNumber(n);
  };

  const selectColor = (c: TileColor | null) => {
    if (c === null) {
      selectJoker();
    } else {
      setIsJoker(false);
      setColor(c);
    }
  };

  const handleSave = () => {
    if (!tile) return;
    onSave({
      ...tile,
      number: isJoker ? null : number,
      color: isJoker ? null : color,
      isJoker,
    });
  };

  if (!tile) return null;

  const previewBg = isJoker
    ? '#a855f7'
    : (COLORS.find((c) => c.value === color)?.bg ?? '#6b7280');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>Edit Tile</Text>

          {/* ── Number picker ── */}
          <Text style={styles.sectionLabel}>Number</Text>
          <View style={styles.numberGrid}>
            {NUMBERS.map((n) => {
              const selected = !isJoker && number === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => selectNumber(n)}
                  style={[styles.numButton, selected && styles.numButtonSelected]}
                >
                  <Text style={[styles.numText, selected && styles.numTextSelected]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={selectJoker}
              style={[
                styles.numButton,
                styles.jokerButton,
                isJoker && styles.numButtonSelected,
              ]}
            >
              <Text style={[styles.numText, isJoker && styles.numTextSelected]}>
                J
              </Text>
            </Pressable>
          </View>

          {/* ── Color picker ── */}
          <Text style={styles.sectionLabel}>Color</Text>
          <View style={styles.colorRow}>
            {COLORS.map((c) => {
              const selected = isJoker ? c.value === null : color === c.value;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => selectColor(c.value)}
                  style={[
                    styles.colorButton,
                    { backgroundColor: c.bg },
                    selected && styles.colorButtonSelected,
                  ]}
                >
                  <Text style={styles.colorLabel}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Live preview ── */}
          <View style={styles.previewRow}>
            <Text style={[styles.sectionLabel, { marginBottom: 0, marginRight: 12 }]}>
              Preview
            </Text>
            <View style={[styles.previewTile, { backgroundColor: previewBg }]}>
              <Text
                style={[
                  styles.previewValue,
                  { color: color === 'yellow' && !isJoker ? '#1f2937' : '#ffffff' },
                ]}
              >
                {isJoker ? 'J' : (number ?? '?')}
              </Text>
            </View>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => [
                styles.removeButton,
                pressed && styles.removeButtonPressed,
              ]}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>

            <View style={styles.rightActions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.saveButtonPressed,
                ]}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#1b2250',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.3)',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  numButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  numButtonSelected: {
    backgroundColor: '#4f8dfd',
    borderColor: '#4f8dfd',
  },
  jokerButton: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  numText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  numTextSelected: {
    color: '#ffffff',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  colorButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#ffffff',
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  previewTile: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  removeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  removeButtonPressed: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  removeText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#4f8dfd',
  },
  saveButtonPressed: {
    backgroundColor: '#3b7fe0',
  },
  saveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
