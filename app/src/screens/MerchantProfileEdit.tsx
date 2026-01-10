import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ProfileAvatar } from '../components/ProfileAvatar';
import type { MerchantProfile, MerchantCategory } from '../types';

// Category display mapping
const MERCHANT_CATEGORIES: Record<MerchantCategory, { label: string; icon: string }> = {
  FOOD_AND_BEVERAGE: { label: 'Food & Beverage', icon: '☕' },
  RETAIL: { label: 'Retail & Shopping', icon: '🛍️' },
  SERVICES: { label: 'Services', icon: '💼' },
  HEALTH_AND_BEAUTY: { label: 'Health & Beauty', icon: '💆' },
  ENTERTAINMENT: { label: 'Entertainment', icon: '🎭' },
  CRAFTS_AND_HANDMADE: { label: 'Crafts & Artisan', icon: '🎨' },
  OTHER: { label: 'Other', icon: '🏪' },
};

interface MerchantProfileEditScreenProps {
  merchant: MerchantProfile;
  onBack: () => void;
  onSave: (updates: { merchantName: string; description?: string }, logoUri?: string | null) => Promise<void>;
  onPickImage: () => Promise<string | null>;
}

export const MerchantProfileEditScreen: React.FC<MerchantProfileEditScreenProps> = ({
  merchant,
  onBack,
  onSave,
  onPickImage,
}) => {
  const [merchantName, setMerchantName] = useState(merchant.merchantName || '');
  const [description, setDescription] = useState(merchant.description || '');
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const nameChanged = merchantName.trim() !== (merchant.merchantName || '').trim();
    const descChanged = description.trim() !== (merchant.description || '').trim();
    const logoChanged = pendingLogoUri !== null;
    setHasChanges(nameChanged || descChanged || logoChanged);
  }, [merchantName, description, pendingLogoUri, merchant.merchantName, merchant.description]);

  const handlePickImage = async () => {
    try {
      const uri = await onPickImage();
      if (uri) {
        setPendingLogoUri(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSave = async () => {
    const trimmedName = merchantName.trim();

    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Business name cannot be empty.');
      return;
    }

    if (trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Business name must be at least 2 characters.');
      return;
    }

    if (trimmedName.length > 100) {
      Alert.alert('Invalid Name', 'Business name must be 100 characters or less.');
      return;
    }

    if (description.trim().length > 500) {
      Alert.alert('Invalid Description', 'Description must be 500 characters or less.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          merchantName: trimmedName,
          description: description.trim() || undefined,
        },
        pendingLogoUri
      );
      onBack();
    } catch (error) {
      console.error('Error saving merchant profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onBack },
        ]
      );
    } else {
      onBack();
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove your business logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setPendingLogoUri('__REMOVE__'),
        },
      ]
    );
  };

  // Determine which logo to display
  const displayLogoUrl = pendingLogoUri === '__REMOVE__'
    ? null
    : pendingLogoUri || merchant.logoImageUrl;

  const hasExistingLogo = merchant.logoImageUrl || (pendingLogoUri && pendingLogoUri !== '__REMOVE__');

  // Get category display info
  const categoryInfo = MERCHANT_CATEGORIES[merchant.merchantCategory] || MERCHANT_CATEGORIES.OTHER;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} disabled={isSaving}>
          <Text style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Business Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Text
              style={[
                styles.headerButton,
                styles.headerButtonSave,
                (!hasChanges || isSaving) && styles.headerButtonDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={isSaving}>
            <View style={styles.avatarWrapper}>
              <ProfileAvatar
                imageUrl={displayLogoUrl}
                displayName={merchantName || merchant.merchantName || 'Business'}
                size="large"
                userId={merchant.merchantId}
                variant="merchant"
              />
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>Edit</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={handlePickImage}
              disabled={isSaving}
            >
              <Text style={styles.imageButtonText}>Change Logo</Text>
            </TouchableOpacity>

            {hasExistingLogo && (
              <TouchableOpacity
                style={[styles.imageButton, styles.imageButtonDanger]}
                onPress={handleRemoveLogo}
                disabled={isSaving}
              >
                <Text style={[styles.imageButtonText, styles.imageButtonTextDanger]}>
                  Remove Logo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Business Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUSINESS NAME</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="Enter your business name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
              editable={!isSaving}
            />
          </View>
          <Text style={styles.inputHint}>
            This name will be displayed to customers when they pay you.
          </Text>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESCRIPTION (OPTIONAL)</Text>
          <View style={styles.inputContainerMultiline}>
            <TextInput
              style={styles.inputMultiline}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your business..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="sentences"
              autoCorrect
              maxLength={500}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isSaving}
            />
          </View>
          <Text style={styles.inputHint}>
            {description.length}/500 characters
          </Text>
        </View>

        {/* Category Section (read-only) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUSINESS CATEGORY</Text>
          <View style={styles.inputContainer}>
            <View style={styles.categoryDisplay}>
              <Text style={styles.categoryIcon}>{categoryInfo.icon}</Text>
              <Text style={styles.readOnlyValue}>{categoryInfo.label}</Text>
            </View>
          </View>
          <Text style={styles.inputHint}>
            Category was set during enrollment and cannot be changed.
          </Text>
        </View>

        {/* Merchant ID Section (read-only) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MERCHANT ID</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.readOnlyValue}>{merchant.merchantId}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerButton: {
    fontSize: 17,
    color: '#10B981', // Green for merchant theme
    minWidth: 60,
  },
  headerButtonSave: {
    fontWeight: '600',
    textAlign: 'right',
  },
  headerButtonDisabled: {
    color: '#9CA3AF',
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
  avatarWrapper: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981', // Green for merchant theme
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  imageButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  imageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  imageButtonDanger: {
    backgroundColor: '#fef2f2',
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981', // Green for merchant theme
  },
  imageButtonTextDanger: {
    color: '#ef4444',
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainerMultiline: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
  },
  input: {
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  inputMultiline: {
    fontSize: 16,
    color: '#111827',
    padding: 0,
    minHeight: 60,
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#6b7280',
  },
  categoryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    fontSize: 20,
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});

export default MerchantProfileEditScreen;
