import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UploadCardProps {
  title: string;
  onPress?: () => void;
}

export default function UploadCard({ title, onPress }: UploadCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
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
