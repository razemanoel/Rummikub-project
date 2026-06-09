import React, { useEffect, useState } from 'react';import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '@/services/api';

export default function HistoryScreen() {
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const response = await apiService.getSolutionsHistory();

      if (!response.success || !response.data) {
        return;
      }

      setHistoryItems(response.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryItem = ({ item, index }: any) => (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(main)/solution',
          params: {
            originalGameState: JSON.stringify(item.originalGameState),
            solution: JSON.stringify(item.solution),
          },
        })
      }
      style={({ pressed }) => [
        styles.historyItem,
        pressed && styles.historyItemPressed,
      ]}
    >
      <View style={styles.itemNumber}>
        <Text style={styles.itemNumberText}>{historyItems.length - index}</Text>
      </View>
      <View style={styles.itemIcon}>
        <Ionicons
          name={item.boardType === 'My Board' ? 'square' : 'share-social'}
          size={20}
          color="#4f8dfd"
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemDate}>
          {new Date(item.createdAt).toLocaleDateString()} · {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
        <Text style={styles.itemMoves}>
          {item.solution?.tiles_used_count || 0} tiles used
        </Text>
      </View>
    </Pressable>
  );

  return (
    <LinearGradient
      colors={['#0b1020', '#1b2250', '#0b1020']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => pressed && styles.buttonPressed}
          >
            <Ionicons name="chevron-back" size={28} color="#9db4ff" />
          </Pressable>
          <Text style={styles.headerTitle}>History</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Content */}
        {!loading && historyItems.length > 0 ? (
          <FlatList
            data={historyItems}
            renderItem={renderHistoryItem}
            keyExtractor={(item, index) => item._id?.toString() || index.toString()}
            contentContainerStyle={styles.listContent}
          />
        ) : loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading history...</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="time" size={64} color="#4f8dfd" />
            <Text style={styles.emptyText}>No analysis history yet</Text>
            <Text style={styles.emptySubtext}>
              Start uploading photos to see your history
            </Text>
          </View>
        )}
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  listContent: {
    paddingVertical: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4f8dfd',
  },
  historyItemPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.15)',
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(79, 141, 253, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9db4ff',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 141, 253, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  itemMoves: {
    fontSize: 12,
    color: '#9db4ff',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
