import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UploadCardProps {
  title: string;
  images?: string[];
  onPress?: () => void;
  onRemoveImage?: (index: number) => void;
}

export default function UploadCard({ title, images = [], onPress, onRemoveImage }: UploadCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Display uploaded images */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imagesScrollView}
          contentContainerStyle={styles.imagesContainer}
        >
          {images.map((uri, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.image} />
              <Pressable
                onPress={() => onRemoveImage?.(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upload button — only shown when no photo uploaded yet */}
      {images.length === 0 && (
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
        >
          <Animated.View
            style={[
              styles.cardContent,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={48}
              color="#4f8dfd"
              style={styles.icon}
            />
            <Text style={styles.uploadText}>Snap and Upload Photo</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    marginLeft: 4,
  },
  imagesScrollView: {
    marginBottom: 12,
  },
  imagesContainer: {
    paddingRight: 16,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 141, 253, 0.1)',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
  },
  card: {
    borderRadius: 16,
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(79, 141, 253, 0.4)',
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.12)',
  },
  cardContent: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#9db4ff',
    fontWeight: '500',
    textAlign: 'center',
  },
});
