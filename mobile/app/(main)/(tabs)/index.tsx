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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import UploadCard from '@/components/upload-card';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [myBoardImages, setMyBoardImages] = useState<string[]>([]);
  const [sharedBoardImages, setSharedBoardImages] = useState<string[]>([]);
  const [analyzeButtonScale] = useState(new Animated.Value(1));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPickerForType, setShowPickerForType] = useState<'myBoard' | 'shared' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);

  const logSelectedAsset = (source: 'camera' | 'gallery', type: 'myBoard' | 'shared', asset: ImagePicker.ImagePickerAsset) => {
    console.log('[image-picker] selected asset', {
      source,
      type,
      width: asset.width,
      height: asset.height,
      uri: asset.uri,
    });
  };

  const handleUploadMyBoard = () => {
    if (Platform.OS === 'web') {
      setShowPickerForType('myBoard');
    } else {
      showImagePickerOptions((uri) => {
        setMyBoardImages([...myBoardImages, uri]);
      });
    }
  };

  const handleUploadSharedBoard = () => {
    if (Platform.OS === 'web') {
      setShowPickerForType('shared');
    } else {
      showImagePickerOptions((uri) => {
        setSharedBoardImages([...sharedBoardImages, uri]);
      });
    }
  };

  const pickFromGallery = async (type: 'myBoard' | 'shared') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        logSelectedAsset('gallery', type, asset);
        const uri = asset.uri;
        if (type === 'myBoard') {
          setMyBoardImages([...myBoardImages, uri]);
        } else {
          setSharedBoardImages([...sharedBoardImages, uri]);
        }
      }
      setShowPickerForType(null);
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const pickFromCamera = async (type: 'myBoard' | 'shared') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        logSelectedAsset('camera', type, asset);
        const uri = asset.uri;
        if (type === 'myBoard') {
          setMyBoardImages([...myBoardImages, uri]);
        } else {
          setSharedBoardImages([...sharedBoardImages, uri]);
        }
      }
      setShowPickerForType(null);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const showImagePickerOptions = async (onImagePicked: (uri: string) => void) => {
    Alert.alert('Select Photo Source', 'Choose where to get the photo', [
      {
        text: 'Camera',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (permission.granted) {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets.length > 0) {
              const asset = result.assets[0];
              logSelectedAsset('camera', showPickerForType ?? 'myBoard', asset);
              onImagePicked(asset.uri);
            }
          } else {
            Alert.alert(
              'Camera Permission Needed',
              'Allow camera access so you can take a photo of your personal rack or the shared board.'
            );
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permission.granted) {
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets.length > 0) {
              const asset = result.assets[0];
              logSelectedAsset('gallery', showPickerForType ?? 'myBoard', asset);
              onImagePicked(asset.uri);
            }
          } else {
            Alert.alert(
              'Photo Library Permission Needed',
              'Allow photo library access so you can choose a picture of your personal rack or the shared board.'
            );
          }
        },
      },
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
    ]);
  };

  const removeImage = (type: 'myBoard' | 'shared', index: number) => {
    if (type === 'myBoard') {
      setMyBoardImages(myBoardImages.filter((_, i) => i !== index));
    } else {
      setSharedBoardImages(sharedBoardImages.filter((_, i) => i !== index));
    }
  };

  const handleAnalyzePhotos = async () => {
    const totalImages = myBoardImages.length + sharedBoardImages.length;
    if (totalImages === 0) {
      Alert.alert(
        'No Photos',
        'Please upload at least one photo before analyzing'
      );
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResults(null);
      
      // Send images to API for board analysis
      const result = await apiService.analyzeBoards(
        myBoardImages[0],
        sharedBoardImages[0]
      );

      setAnalysisResults(result);
      if (result.success) {
        const gameState = result.data?.gameState;
        const rackRows = result.data?.rackRows;
        const rackDetections = result.data?.rackDetections;
        const boardDetections = result.data?.boardDetections;
        const classifierModelVersion = result.data?.classifierModelVersion;
        const detectorModelVersion = result.data?.detectorModelVersion;

        if (!gameState) {
          Alert.alert(
            'Analysis Error',
            'Vision did not return a valid game state'
          );
          return;
        }

        router.push({
          pathname: '/(main)/review',
          params: {
            gameState: JSON.stringify(gameState),
            rackRows: JSON.stringify(rackRows ?? []),
            rackDetections: JSON.stringify(rackDetections ?? []),
            boardDetections: JSON.stringify(boardDetections ?? []),
            rackImageUri: myBoardImages[0] ?? '',
            boardImageUri: sharedBoardImages[0] ?? '',
            classifierModelVersion: classifierModelVersion ?? '',
            detectorModelVersion: detectorModelVersion ?? '',
          },
        });
      } else {
        Alert.alert('Analysis Failed', result.message);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to analyze photos. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzePressIn = () => {
    Animated.spring(analyzeButtonScale, {
      toValue: 0.95,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  

  const handleAnalyzePressOut = () => {
    Animated.spring(analyzeButtonScale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handleHistory = () => {
    router.push('/(main)/history');
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

  const isDisabled = myBoardImages.length === 0 && sharedBoardImages.length === 0;
  const totalImages = myBoardImages.length + sharedBoardImages.length;

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
              images={myBoardImages}
              onPress={handleUploadMyBoard}
              onRemoveImage={(index) => removeImage('myBoard', index)}
            />
            <UploadCard
              title="Shared Board"
              images={sharedBoardImages}
              onPress={handleUploadSharedBoard}
              onRemoveImage={(index) => removeImage('shared', index)}
            />
          </View>

          {/* Web Photo Picker Modal */}
          {showPickerForType && Platform.OS === 'web' && (
            <View style={styles.pickerModal}>
              <View style={styles.pickerContent}>
                <Text style={styles.pickerTitle}>Select Photo Source</Text>
                <Pressable
                  onPress={() => pickFromCamera(showPickerForType)}
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && styles.pickerButtonPressed,
                  ]}
                >
                  <Ionicons name="camera" size={24} color="#4f8dfd" style={{ marginRight: 12 }} />
                  <Text style={styles.pickerButtonText}>Take Photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => pickFromGallery(showPickerForType)}
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && styles.pickerButtonPressed,
                  ]}
                >
                  <Ionicons name="images" size={24} color="#4f8dfd" style={{ marginRight: 12 }} />
                  <Text style={styles.pickerButtonText}>Choose from Gallery</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowPickerForType(null)}
                  style={({ pressed }) => [
                    styles.pickerCancelButton,
                    pressed && styles.pickerCancelButtonPressed,
                  ]}
                >
                  <Text style={styles.pickerCancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Selected Images Counter */}
          {totalImages > 0 && (
            <View style={styles.counterContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.counterText}>
                {totalImages} photo{totalImages !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Analyze Button */}
          <Pressable
            onPress={handleAnalyzePhotos}
            onPressIn={handleAnalyzePressIn}
            onPressOut={handleAnalyzePressOut}
            disabled={isDisabled || isAnalyzing}
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && !isDisabled && !isAnalyzing && styles.analyzeButtonPressed,
              (isDisabled || isAnalyzing) && styles.analyzeButtonDisabled,
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
                  isDisabled || isAnalyzing
                    ? ['#374151', '#1f2937']
                    : ['#4f8dfd', '#73a9ff']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.analyzeGradient}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons
                    name="flash"
                    size={20}
                    color={isDisabled ? '#9ca3af' : '#ffffff'}
                    style={styles.analyzeIcon}
                  />
                )}
                <Text
                  style={[
                    styles.analyzeText,
                    (isDisabled || isAnalyzing) && styles.analyzeTextDisabled,
                  ]}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Photos'}
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
          
                    {/* Temporary Review Screen Button */}
          <Pressable
            onPress={() => router.push('/(main)/review')}
            style={({ pressed }) => [
              styles.reviewButton,
              pressed && styles.reviewButtonPressed,
            ]}
          >
            <Ionicons name="create" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.reviewButtonText}>Open Review Screen</Text>
          </Pressable>

          {/* Analysis Results */}
          {analysisResults && analysisResults.success && (
            <>
              {/* My Board Results */}
              {analysisResults.data?.myBoardDetections && analysisResults.data.myBoardDetections.length > 0 && (
                <View style={styles.resultsContainer}>
                  <View style={styles.resultsHeader}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.resultsTitle}>My Board - {analysisResults.data.myBoardDetections.length} Tiles</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tilesScroll}
                  >
                    {analysisResults.data.myBoardDetections.map((tile: any, idx: number) => (
                      <View key={`myboard-${idx}`} style={styles.tileResult}>
                        <View
                          style={[
                            styles.tileNumber,
                            {
                              backgroundColor:
                                tile.tile_color === 'red'
                                  ? '#ef4444'
                                  : tile.tile_color === 'blue'
                                  ? '#3b82f6'
                                  : tile.tile_color === 'yellow'
                                  ? '#fbbf24'
                                  : '#000000',
                            },
                          ]}
                        >
                          <Text style={styles.tileValue}>
                            {tile.tile_number || '?'}
                          </Text>
                        </View>
                        <Text style={styles.tileColor}>{tile.tile_color}</Text>
                        <Text style={styles.tileConfidence}>
                          {(tile.confidence * 100).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Shared Board Results */}
              {analysisResults.data?.sharedBoardDetections && analysisResults.data.sharedBoardDetections.length > 0 && (
                <View style={styles.resultsContainer}>
                  <View style={styles.resultsHeader}>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.resultsTitle}>Shared Board - {analysisResults.data.sharedBoardDetections.length} Tiles</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tilesScroll}
                  >
                    {analysisResults.data.sharedBoardDetections.map((tile: any, idx: number) => (
                      <View key={`shared-${idx}`} style={styles.tileResult}>
                        <View
                          style={[
                            styles.tileNumber,
                            {
                              backgroundColor:
                                tile.tile_color === 'red'
                                  ? '#ef4444'
                                  : tile.tile_color === 'blue'
                                  ? '#3b82f6'
                                  : tile.tile_color === 'yellow'
                                  ? '#fbbf24'
                                  : '#000000',
                            },
                          ]}
                        >
                          <Text style={styles.tileValue}>
                            {tile.tile_number || '?'}
                          </Text>
                        </View>
                        <Text style={styles.tileColor}>{tile.tile_color}</Text>
                        <Text style={styles.tileConfidence}>
                          {(tile.confidence * 100).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

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

    reviewButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 24,
  },
  reviewButtonPressed: {
    opacity: 0.85,
  },
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
  pickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContent: {
    backgroundColor: '#1b2250',
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.3)',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 141, 253, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.3)',
  },
  pickerButtonPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.2)',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9db4ff',
  },
  pickerCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  pickerCancelButtonPressed: {
    opacity: 0.7,
  },
  pickerCancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    textAlign: 'center',
  },
  resultsContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 8,
  },
  tilesScroll: {
    flexDirection: 'row',
  },
  tileResult: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 12,
  },
  tileNumber: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  tileColor: {
    fontSize: 12,
    color: '#86efac',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  tileConfidence: {
    fontSize: 11,
    color: '#a1f3d1',
    fontWeight: '400',
  },
});