import React from 'react';
import {
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

export default function HistoryScreen() {
  const router = useRouter();

  // Placeholder data - replace with actual API call
  const historyItems = [
    {
      id: '1',
      date: 'Apr 23, 2026',
      time: '2:30 PM',
      moves: '5 moves found',
      boardType: 'My Board',
    },
    {
      id: '2',
      date: 'Apr 22, 2026',
      time: '10:15 AM',
      moves: '3 moves found',
      boardType: 'Shared Board',
    },
    {
      id: '3',
      date: 'Apr 21, 2026',
      time: '7:45 PM',
      moves: '7 moves found',
      boardType: 'My Board',
    },
  ];

  const renderHistoryItem = ({ item }: any) => (
    <Pressable
      style={({ pressed }) => [
        styles.historyItem,
        pressed && styles.historyItemPressed,
      ]}
    >
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Ionicons
            name={item.boardType === 'My Board' ? 'square' : 'share-social'}
            size={20}
            color="#4f8dfd"
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemDate}>{item.date}</Text>
          <Text style={styles.itemMoves}>{item.moves}</Text>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemTime}>{item.time}</Text>
        <Text style={styles.itemType}>{item.boardType}</Text>
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
        {historyItems.length > 0 ? (
          <FlatList
            data={historyItems}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="time" size={64} color="#4f8dfd" />
            <Text style={styles.emptyText}>No analysis history yet</Text>
            <Text style={styles.emptySubtext}>
              Start uploading photos to see your history
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color="#4f8dfd" />
          <Text style={styles.infoText}>
            Your analysis history is stored locally on your device
          </Text>
        </View>
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
    justifyContent: 'space-between',
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
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  itemRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  itemTime: {
    fontSize: 12,
    color: '#d1d5db',
    marginBottom: 4,
    fontWeight: '500',
  },
  itemType: {
    fontSize: 11,
    color: '#9ca3af',
    backgroundColor: 'rgba(79, 141, 253, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#4f8dfd',
  },
  infoText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginLeft: 12,
    fontWeight: '500',
    flex: 1,
  },
});
