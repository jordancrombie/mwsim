import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { clearImageCache, getCacheStats } from '../services/imageCache';

interface SettingsScreenProps {
  user: { name: string; email: string } | null;
  onBack: () => void;
  onSignOut: () => void;
  onDeepSignOut: () => void;
  onProfileEdit: () => void;
  onAIAgents: () => void;
  onLinkDevice: () => void;
  environmentName: string;
  isDevelopment: boolean;
  appVersion: string;
  buildNumber: string;
}

interface SettingsRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightContent?: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
  rightContent,
}) => (
  <TouchableOpacity
    style={styles.settingsRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <Text style={styles.settingsRowIcon}>{icon}</Text>
    <View style={styles.settingsRowContent}>
      <Text style={[styles.settingsRowTitle, danger && styles.settingsRowTitleDanger]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>}
    </View>
    {rightContent}
    {showChevron && onPress && <Text style={styles.settingsRowChevron}>›</Text>}
  </TouchableOpacity>
);

const SettingsSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  onBack,
  onSignOut,
  onDeepSignOut,
  onProfileEdit,
  onAIAgents,
  onLinkDevice,
  environmentName,
  isDevelopment,
  appVersion,
  buildNumber,
}) => {
  const [cacheStats, setCacheStats] = useState<{ count: number; totalSizeMB: number } | null>(null);

  // Load cache stats on mount
  useEffect(() => {
    getCacheStats().then(setCacheStats);
  }, []);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Image Cache',
      'This will remove all cached profile images. They will be re-downloaded when needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await clearImageCache();
            setCacheStats({ count: 0, totalSizeMB: 0 });
            Alert.alert('Cache Cleared', 'Image cache has been cleared.');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onSignOut },
      ]
    );
  };

  const handleDeepSignOut = () => {
    Alert.alert(
      'Reset Device',
      'This will sign out and clear all device data. You will need to re-verify your email on next login. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onDeepSignOut },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <SettingsSectionHeader title="PROFILE" />
        <View style={styles.section}>
          <SettingsRow
            icon="👤"
            title="Profile & Image"
            subtitle="Edit your display name and photo"
            onPress={onProfileEdit}
          />
        </View>

        {/* Account Section */}
        <SettingsSectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          <SettingsRow
            icon="🏦"
            title="Enrolled Banks"
            subtitle="View and manage linked banks"
            onPress={() => {
              // TODO: Navigate to enrolled banks screen
              Alert.alert('Coming Soon', 'Bank management will be available in a future update.');
            }}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="🔔"
            title="Notifications"
            subtitle="Push notification preferences"
            onPress={() => {
              // TODO: Navigate to notifications screen
              Alert.alert('Coming Soon', 'Notification settings will be available in a future update.');
            }}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="🤖"
            title="AI Agents"
            subtitle="Manage AI shopping assistants"
            onPress={onAIAgents}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="🔗"
            title="Link Device"
            subtitle="Enter a code to connect an AI assistant"
            onPress={onLinkDevice}
          />
        </View>

        {/* About Section */}
        <SettingsSectionHeader title="ABOUT" />
        <View style={styles.section}>
          <SettingsRow
            icon="ℹ️"
            title="App Version"
            subtitle={`${appVersion} (Build ${buildNumber})`}
            showChevron={false}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="🌐"
            title="Environment"
            subtitle={environmentName}
            showChevron={false}
            rightContent={
              isDevelopment ? (
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>DEV</Text>
                </View>
              ) : null
            }
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="🗑️"
            title="Clear Image Cache"
            subtitle={cacheStats
              ? `${cacheStats.count} images (${cacheStats.totalSizeMB} MB)`
              : 'Loading...'}
            onPress={handleClearCache}
            showChevron={false}
          />
        </View>

        {/* Sign Out Section */}
        <SettingsSectionHeader title="ACCOUNT ACTIONS" />
        <View style={styles.section}>
          <SettingsRow
            icon="🚪"
            title="Sign Out"
            subtitle={user?.email}
            onPress={handleSignOut}
            showChevron={false}
            danger
          />
          {/* Reset Device: always visible for now (testing), can be gated by isDevelopment later */}
          <View style={styles.separator} />
          <SettingsRow
            icon="🔄"
            title="Reset Device"
            subtitle="Sign out and deregister push notifications"
            onPress={handleDeepSignOut}
            showChevron={false}
            danger
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>mwsim - Mobile Wallet Simulator</Text>
          <Text style={styles.footerText}>© 2026 BankSim</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  settingsRowIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    color: '#111827',
  },
  settingsRowTitleDanger: {
    color: '#ef4444',
  },
  settingsRowSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  settingsRowChevron: {
    fontSize: 20,
    color: '#9ca3af',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginLeft: 52,
  },
  devBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  devBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
});

export default SettingsScreen;
