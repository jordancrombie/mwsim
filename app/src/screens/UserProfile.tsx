/**
 * User Profile Screen (Read-Only)
 *
 * Displays another user's profile information and trust status.
 * Used when tapping on a user's avatar in transfers or contracts.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { VerificationLevel } from '../types';

export interface UserProfileData {
  id?: string;
  displayName: string;
  email?: string;
  alias?: string;
  profileImageUrl?: string | null;
  initialsColor?: string;
  isVerified?: boolean;
  verificationLevel?: VerificationLevel;
  verifiedAt?: string;
}

interface UserProfileScreenProps {
  user: UserProfileData;
  onBack: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  user,
  onBack,
}) => {
  const getVerificationBadge = () => {
    if (user.verificationLevel === 'enhanced') {
      return { icon: '🥇', label: 'Gold Verified', color: '#D4AF37' };
    } else if (user.verificationLevel === 'basic') {
      return { icon: '🥈', label: 'Silver Verified', color: '#9CA3AF' };
    }
    return { icon: '⚪', label: 'Not Verified', color: '#9CA3AF' };
  };

  const badge = getVerificationBadge();

  const formatVerifiedDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <ProfileAvatar
            imageUrl={user.profileImageUrl}
            displayName={user.displayName}
            initialsColor={user.initialsColor}
            size="large"
            userId={user.id}
            isVerified={user.isVerified}
            verificationLevel={user.verificationLevel}
          />
          <Text style={styles.displayName}>{user.displayName}</Text>
          {/* Show alias below if it's different from displayName */}
          {user.alias && user.alias !== user.displayName && (
            <Text style={styles.alias}>
              {user.alias.startsWith('@') ? user.alias : `@${user.alias}`}
            </Text>
          )}
        </View>

        {/* Trust Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trust Status</Text>
          <View style={styles.trustStatusRow}>
            <Text style={styles.trustBadgeIcon}>{badge.icon}</Text>
            <View style={styles.trustStatusInfo}>
              <Text style={[styles.trustStatusLabel, { color: badge.color }]}>
                {badge.label}
              </Text>
              <Text style={styles.trustStatusDescription}>
                {user.verificationLevel === 'enhanced'
                  ? 'This user has completed full identity verification including passport check, face match, and liveness detection.'
                  : user.verificationLevel === 'basic'
                  ? 'This user has verified their identity with passport name matching.'
                  : 'This user has not completed identity verification.'}
              </Text>
              {user.isVerified && user.verifiedAt && (
                <Text style={styles.verifiedDate}>
                  Verified on {formatVerifiedDate(user.verifiedAt)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* What This Means Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What This Means</Text>
          {user.isVerified && user.verificationLevel !== 'none' ? (
            <View style={styles.meaningList}>
              <View style={styles.meaningItem}>
                <Text style={styles.meaningIcon}>✓</Text>
                <Text style={styles.meaningText}>
                  Identity has been verified against government-issued ID
                </Text>
              </View>
              <View style={styles.meaningItem}>
                <Text style={styles.meaningIcon}>✓</Text>
                <Text style={styles.meaningText}>
                  Higher transfer limits enabled
                </Text>
              </View>
              {user.verificationLevel === 'enhanced' && (
                <View style={styles.meaningItem}>
                  <Text style={styles.meaningIcon}>✓</Text>
                  <Text style={styles.meaningText}>
                    Face match and liveness check completed
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.unverifiedText}>
              Unverified users have standard transfer limits. You can still send and receive payments with this user, but they haven't completed identity verification.
            </Text>
          )}
        </View>

        {/* Contact Info (if available) */}
        {user.email && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>
        )}
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
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    minWidth: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  alias: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  trustStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  trustBadgeIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  trustStatusInfo: {
    flex: 1,
  },
  trustStatusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  trustStatusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  verifiedDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  meaningList: {
    gap: 12,
  },
  meaningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meaningIcon: {
    fontSize: 16,
    color: '#22c55e',
    marginRight: 8,
    marginTop: 2,
  },
  meaningText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  unverifiedText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
});

export default UserProfileScreen;
