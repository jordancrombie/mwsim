import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { clearImageCache, getCacheStats } from '../services/imageCache';
import { api } from '../services/api';

interface SettingsScreenProps {
  user: { name: string; email: string; isVerified?: boolean; verificationLevel?: string } | null;
  onBack: () => void;
  onSignOut: () => void;
  onDeepSignOut: () => void;
  onProfileEdit: () => void;
  onVerifyIdentity?: () => void;
  onVerificationRemoved?: () => void;  // Called after verification is removed to update user state
  onAccountDeleted?: () => void;  // Called after account deletion to return to login
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
  onVerifyIdentity,
  onVerificationRemoved,
  onAccountDeleted,
  environmentName,
  isDevelopment,
  appVersion,
  buildNumber,
}) => {
  const [cacheStats, setCacheStats] = useState<{ count: number; totalSizeMB: number } | null>(null);
  const [isRemovingVerification, setIsRemovingVerification] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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

  const handleRemoveVerification = () => {
    Alert.alert(
      'Remove Verification',
      'This will remove your identity verification status. You will need to verify again to regain your trusted status. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsRemovingVerification(true);
            try {
              await api.removeVerification();
              // Update user state to reflect removal
              onVerificationRemoved?.();
              Alert.alert('Verification Removed', 'Your identity verification has been removed. You can verify again at any time.');
            } catch (error: any) {
              const message = error.response?.data?.message || error.message || 'Failed to remove verification';
              Alert.alert('Error', message);
            } finally {
              setIsRemovingVerification(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await api.deleteAccount();
      setShowDeleteModal(false);
      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [{ text: 'OK', onPress: onAccountDeleted }]
      );
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to delete account';
      Alert.alert('Error', message);
      setIsDeletingAccount(false);
    }
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
          {/* Only show Verify Identity if user is NOT already verified */}
          {onVerifyIdentity && !user?.isVerified && (
            <>
              <View style={styles.separator} />
              <SettingsRow
                icon="🛂"
                title="Verify Identity"
                subtitle="Scan your passport to become a Trusted User"
                onPress={onVerifyIdentity}
              />
            </>
          )}
          {/* Show verification status if user IS verified */}
          {user?.isVerified && (
            <>
              <View style={styles.separator} />
              <SettingsRow
                icon="✓"
                title="Identity Verified"
                subtitle={`Trusted User (${user.verificationLevel === 'enhanced' ? 'Enhanced' : 'Basic'})`}
                showChevron={false}
                rightContent={
                  <View style={[styles.devBadge, { backgroundColor: user.verificationLevel === 'enhanced' ? '#D4AF37' : '#C0C0C0' }]}>
                    <Text style={styles.devBadgeText}>{user.verificationLevel === 'enhanced' ? '★' : '☆'}</Text>
                  </View>
                }
              />
            </>
          )}
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
          {/* Remove Verification - only show if user is verified */}
          {user?.isVerified && (
            <>
              <View style={styles.separator} />
              <SettingsRow
                icon="🛡️"
                title={isRemovingVerification ? "Removing..." : "Remove Verification"}
                subtitle="Clear your trusted user status"
                onPress={isRemovingVerification ? undefined : handleRemoveVerification}
                showChevron={false}
                danger
              />
            </>
          )}
          {/* Delete Account */}
          <View style={styles.separator} />
          <SettingsRow
            icon="💀"
            title="Delete Account"
            subtitle="Permanently delete your WSIM account"
            onPress={() => setShowDeleteModal(true)}
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

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalWarning}>This action cannot be undone!</Text>
            <Text style={styles.modalDescription}>
              This will permanently delete your WSIM account and all associated data including:
            </Text>
            <View style={styles.modalList}>
              <Text style={styles.modalListItem}>• Your profile and display name</Text>
              <Text style={styles.modalListItem}>• All device registrations</Text>
              <Text style={styles.modalListItem}>• Identity verification records</Text>
              <Text style={styles.modalListItem}>• Bank enrollments</Text>
            </View>
            <Text style={styles.modalInstruction}>
              Type DELETE to confirm:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeletingAccount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeletingAccount}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteConfirmText !== 'DELETE' && styles.modalDeleteButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalWarning: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 16,
  },
  modalListItem: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  modalInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalDeleteButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  modalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default SettingsScreen;
