import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all analysis history? This cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            Alert.alert('Success', 'History cleared successfully');
          },
          style: 'destructive',
        },
      ]
    );
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    value,
    showToggle = false,
  }: any) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        pressed && styles.settingItemPressed,
      ]}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color="#4f8dfd" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showToggle ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#374151', true: '#4f8dfd' }}
          thumbColor={value ? '#73a9ff' : '#9ca3af'}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      )}
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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <SettingItem
              icon="person-circle"
              title="Profile"
              subtitle="View and edit your profile"
              onPress={() => Alert.alert('Profile', 'Profile editing coming soon')}
            />
            <SettingItem
              icon="shield-checkmark"
              title="Security"
              subtitle="Change password and security settings"
              onPress={() =>
                Alert.alert('Security', 'Security settings coming soon')
              }
            />
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <SettingItem
              icon="notifications"
              title="Notifications"
              subtitle={notifications ? 'On' : 'Off'}
              value={notifications}
              showToggle={true}
              onPress={() => setNotifications(!notifications)}
            />
            <SettingItem
              icon="moon"
              title="Dark Mode"
              subtitle={darkMode ? 'Always on' : 'Off'}
              value={darkMode}
              showToggle={true}
              onPress={() => setDarkMode(!darkMode)}
            />
            <SettingItem
              icon="save"
              title="Save Analysis History"
              subtitle={saveHistory ? 'Enabled' : 'Disabled'}
              value={saveHistory}
              showToggle={true}
              onPress={() => setSaveHistory(!saveHistory)}
            />
          </View>

          {/* Data Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data</Text>
            <SettingItem
              icon="trash"
              title="Clear History"
              subtitle="Delete all analysis records"
              onPress={handleClearHistory}
            />
            <SettingItem
              icon="download"
              title="Export Data"
              subtitle="Export your analysis data"
              onPress={() => Alert.alert('Export', 'Export feature coming soon')}
            />
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <SettingItem
              icon="information"
              title="About App"
              subtitle="Version 1.0.0"
              onPress={() =>
                Alert.alert(
                  'About',
                  'Rummikub Solver\nVersion 1.0.0\n\nAnalyze your board and find the best moves.'
                )
              }
            />
            <SettingItem
              icon="help-circle"
              title="Help & Support"
              subtitle="Get help or contact us"
              onPress={() =>
                Alert.alert(
                  'Support',
                  'Support contact coming soon\n\nsupport@rummikubsolver.com'
                )
              }
            />
            <SettingItem
              icon="document-text"
              title="Privacy Policy"
              subtitle="Read our privacy policy"
              onPress={() =>
                Alert.alert('Privacy', 'Privacy policy content coming soon')
              }
            />
          </View>

          {/* App Info */}
          <View style={styles.appInfoContainer}>
            <Ionicons name="key" size={40} color="#f59e0b" />
            <Text style={styles.appName}>Rummikub Solver</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              Smart analysis for Rummikub games
            </Text>
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
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9db4ff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 141, 253, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(79, 141, 253, 0.4)',
  },
  settingItemPressed: {
    backgroundColor: 'rgba(79, 141, 253, 0.15)',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 141, 253, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  appInfoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(79, 141, 253, 0.2)',
    marginTop: 32,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  appDescription: {
    fontSize: 13,
    color: '#9db4ff',
    fontStyle: 'italic',
  },
});
