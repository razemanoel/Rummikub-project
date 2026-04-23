import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import UploadCard from '@/components/upload-card';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [selectedImages, setSelectedImages] = useState<number>(0);
  const [analyzeButtonScale] = useState(new Animated.Value(1));
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleUploadMyBoard = () => {
    Alert.alert(
      'Upload Photo',
      'Open camera or gallery to select a photo from My Board'
    );
    // Future implementation for image upload
  };

  const handleUploadSharedBoard = () => {
    Alert.alert(
      'Upload Photo',
      'Open camera or gallery to select a photo from Shared Board'
    );
    // Future implementation for image upload
  };

  const handleAnalyzePhotos = () => {
    if (selectedImages === 0) {
      Alert.alert(
        'No Photos',
        'Please upload at least one photo before analyzing'
      );
      return;
    }

    Alert.alert(
      'Analyzing',
      `Starting analysis for ${selectedImages} photo(s)...`
    );
    // Future implementation for analysis
  };

  const handleAnalyzePressIn = () => {
    Animated.spring(analyzeButtonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handleAnalyzePressOut = () => {
    Animated.spring(analyzeButtonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleHistory = () => {
    router.push('/(main)/history');
  };

  const handleSettings = () => {
    router.push('/(main)/settings');
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const isDisabled = selectedImages === 0;

  return (
    <LinearGradient
      colors={['#0b1020', '#1b2250', '#0b1020']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="key" size={24} color="#f59e0b" />
              <Text style={styles.headerTitle}>rummikub solver</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleHistory}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Ionicons name="time" size={20} color="#9db4ff" />
              </Pressable>
              <Pressable
                onPress={handleSettings}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Ionicons name="settings" size={20} color="#9db4ff" />
              </Pressable>
              <Pressable
                onPress={handleLogout}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && !isLoggingOut && styles.actionButtonPressed,
                  isLoggingOut && styles.actionButtonDisabled,
                ]}
              >
                <Ionicons name="log-out" size={20} color={isLoggingOut ? '#9ca3af' : '#ef4444'} />
              </Pressable>
            </View>
          </View>

          {/* Main Title */}
          <View style={styles.titleSection}>
            <Text style={styles.mainTitle}>Snap and Upload</Text>
            <Text style={styles.mainTitle}>Photos</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Upload your board photos to get instant solutions and game analysis
          </Text>

          {/* Upload Cards */}
          <View style={styles.cardsContainer}>
            <UploadCard
              title="My Board"
              onPress={handleUploadMyBoard}
            />
            <UploadCard
              title="Shared Board"
              onPress={handleUploadSharedBoard}
            />
          </View>

          {/* Selected Images Counter */}
          {selectedImages > 0 && (
            <View style={styles.counterContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.counterText}>
                {selectedImages} photo{selectedImages !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Analyze Button */}
          <Pressable
            onPress={handleAnalyzePhotos}
            onPressIn={handleAnalyzePressIn}
            onPressOut={handleAnalyzePressOut}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && !isDisabled && styles.analyzeButtonPressed,
              isDisabled && styles.analyzeButtonDisabled,
            ]}
          >
            <Animated.View
              style={[
                styles.analyzeButtonContent,
                {
                  transform: [{ scale: analyzeButtonScale }],
                },
              ]}
            >
              <LinearGradient
                colors={
                  isDisabled
                    ? ['#374151', '#1f2937']
                    : ['#4f8dfd', '#73a9ff']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.analyzeGradient}
              >
                <Ionicons
                  name="flash"
                  size={20}
                  color={isDisabled ? '#9ca3af' : '#ffffff'}
                  style={styles.analyzeIcon}
                />
                <Text
                  style={[
                    styles.analyzeText,
                    isDisabled && styles.analyzeTextDisabled,
                  ]}
                >
                  Analyze Photos
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Ionicons name="camera" size={20} color="#4f8dfd" />
              <Text style={styles.infoText}>Clear photos for best results</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="speedometer" size={20} color="#4f8dfd" />
              <Text style={styles.infoText}>Get results in seconds</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 141, 253, 0.1)',
  },
  actionButtonPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.2)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  titleSection: {
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 44,
  },
  description: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 32,
    lineHeight: 20,
  },
  cardsContainer: {
    marginBottom: 24,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  counterText: {
    fontSize: 14,
    color: '#86efac',
    fontWeight: '500',
    marginLeft: 8,
  },
  analyzeButton: {
    marginBottom: 24,
  },
  analyzeButtonContent: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  analyzeGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeIcon: {
    marginRight: 8,
  },
  analyzeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  analyzeTextDisabled: {
    color: '#9ca3af',
  },
  analyzeButtonPressed: {
    opacity: 0.9,
  },
  analyzeButtonDisabled: {
    opacity: 0.6,
  },
  infoSection: {
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4f8dfd',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginLeft: 12,
    fontWeight: '500',
  },
});