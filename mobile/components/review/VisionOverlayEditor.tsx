import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  areTilesEqual,
  getTileLabel,
  getShortTileLabel,
  getTileColorHex,
  ReviewTileState,
} from './reviewTypes';

interface Props {
  title: string;
  subtitle: string;
  imageUri?: string;
  tiles: ReviewTileState[];
  selectedTileId?: string;
  selectedTile?: ReviewTileState | null;
  onTilePress: (tileId: string) => void;
  onSelectedTileEdit?: () => void;
  onSelectedTileDelete?: () => void;
}

type Size = {
  width: number;
  height: number;
};

export default function VisionOverlayEditor({
  title,
  subtitle,
  imageUri,
  tiles,
  selectedTileId,
  selectedTile,
  onTilePress,
  onSelectedTileEdit,
  onSelectedTileDelete,
}: Props) {
  const getSelectedBadgeTextColor = (tile: ReviewTileState['tile']) => {
    if (tile.is_joker) {
      return '#f8fafc';
    }

    if (tile.color === 'black') {
      return '#f8fafc';
    }

    return getTileColorHex(tile.color);
  };

  const detectedTiles = useMemo(
    () => tiles.filter((tile) => tile.origin === 'detected' && tile.bbox),
    [tiles],
  );
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [canvasSize, setCanvasSize] = useState<Size | null>(null);

  useEffect(() => {
    if (!imageUri) {
      setImageSize(null);
      return;
    }

    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(null),
    );
  }, [imageUri]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  const canRenderBoxes = !!imageSize && !!canvasSize && detectedTiles.length > 0;
  const overlayItems = useMemo(() => {
    if (!imageSize || !canvasSize) {
      return [];
    }

    const scaleX = canvasSize.width / imageSize.width;
    const scaleY = canvasSize.height / imageSize.height;

    return detectedTiles
      .map((tile) => {
        if (!tile.bbox) {
          return null;
        }

        const boxLeft = tile.bbox.x * scaleX;
        const boxTop = tile.bbox.y * scaleY;
        const boxWidth = Math.max(tile.bbox.width * scaleX, 42);
        const boxHeight = Math.max(tile.bbox.height * scaleY, 42);

        return {
          tile,
          boxLeft,
          boxTop,
          boxWidth,
          boxHeight,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.boxTop - right.boxTop || left.boxLeft - right.boxLeft);
  }, [canvasSize, detectedTiles, imageSize]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendSwatchDefault]} />
          <Text style={styles.legendText}>Detected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendSwatchSelected]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendSwatchEdited]} />
          <Text style={styles.legendText}>Edited</Text>
        </View>
      </View>

      {imageUri ? (
        <View
          style={[
            styles.canvas,
            imageSize ? { aspectRatio: imageSize.width / imageSize.height } : styles.canvasFallback,
          ]}
          onLayout={handleLayout}
        >
          <Image source={{ uri: imageUri }} style={styles.canvasImage} resizeMode="contain" />

          {canRenderBoxes
            ? overlayItems.map(({ tile, boxLeft, boxTop, boxWidth, boxHeight }) => {
                const isSelected = selectedTileId === tile.id;
                const isEdited = !!tile.originalPrediction && !areTilesEqual(tile.originalPrediction, tile.tile);
                const tileColor = getSelectedBadgeTextColor(tile.tile);
                const isBlackTile = tile.tile.color === 'black' && !tile.tile.is_joker;

                return (
                  <View key={tile.id}>
                    <Pressable
                      style={[
                        styles.box,
                        {
                          left: boxLeft,
                          top: boxTop,
                          width: boxWidth,
                          height: boxHeight,
                        },
                        isSelected && styles.boxSelected,
                        isEdited && styles.boxEdited,
                      ]}
                      onPress={() => {
                        if (isSelected && onSelectedTileEdit) {
                          onSelectedTileEdit();
                          return;
                        }

                        onTilePress(tile.id);
                      }}
                    >
                      {isSelected ? (
                        <View style={[styles.selectedBadge, isBlackTile && styles.selectedBadgeBlackTile]}>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={[styles.selectedBadgeText, { color: tileColor }]}
                          >
                            {getShortTileLabel(tile.tile)}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })
            : null}
        </View>
      ) : (
        <View style={[styles.canvas, styles.canvasFallback, styles.canvasPlaceholder]}>
          <Text style={styles.placeholderTitle}>No image available</Text>
          <Text style={styles.placeholderText}>
            You can still edit tiles from the synced lists below and feedback will use the current review state.
          </Text>
        </View>
      )}

      {selectedTile ? (
        <View style={styles.selectedTileCard}>
          <Text style={styles.selectedTileEyebrow}>Selected tile</Text>
          <Text style={styles.selectedTileValue}>{getTileLabel(selectedTile.tile)}</Text>
          <Text style={styles.selectedTileMeta}>Source: {selectedTile.source}</Text>
          <View style={styles.selectedTileActions}>
            <Pressable style={styles.selectedTileActionPrimary} onPress={onSelectedTileEdit}>
              <Text style={styles.selectedTileActionPrimaryText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.selectedTileActionSecondary} onPress={onSelectedTileDelete}>
              <Text style={styles.selectedTileActionSecondaryText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.selectionHintCard}>
          <Text style={styles.selectionHintText}>Tap a box to view or edit its detected tile.</Text>
        </View>
      )}

      <Text style={styles.footerNote}>
        Tap a box to select it. Tap the selected box again, or use the panel below, to edit that detection.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8, 15, 33, 0.72)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 180, 255, 0.18)',
  },
  header: {
    marginBottom: 14,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  legendSwatchDefault: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  legendSwatchSelected: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
  },
  legendSwatchEdited: {
    borderColor: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  legendText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  canvas: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  canvasFallback: {
    aspectRatio: 1.4,
  },
  canvasImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
  },
  boxSelected: {
    borderColor: '#60a5fa',
    borderWidth: 3,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  boxEdited: {
    borderColor: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  selectedBadge: {
    position: 'absolute',
    top: -12,
    right: -4,
    minWidth: 34,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeBlackTile: {
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderColor: 'rgba(226, 232, 240, 0.7)',
  },
  selectedBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
  },
  selectedTileCard: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.28)',
    padding: 14,
    gap: 6,
  },
  selectedTileEyebrow: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectedTileValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
  },
  selectedTileMeta: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedTileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  selectedTileActionPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectedTileActionPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedTileActionSecondary: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectedTileActionSecondaryText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '800',
  },
  selectionHintCard: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.74)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectionHintText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  canvasPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  placeholderTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerNote: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
});