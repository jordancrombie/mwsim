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

interface ProfileEditScreenProps {
  user: { id?: string; name: string; email: string; profileImageUrl?: string | null } | null;
  onBack: () => void;
  onSave: (displayName: string, imageUri?: string | null) => Promise<void>;
  onPickImage: () => Promise<string | null>;
}

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  user,
  onBack,
  onSave,
  onPickImage,
}) => {
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const nameChanged = displayName.trim() !== (user?.name || '').trim();
    const imageChanged = pendingImageUri !== null;
    setHasChanges(nameChanged || imageChanged);
  }, [displayName, pendingImageUri, user?.name]);

  const handlePickImage = async () => {
    try {
      const uri = await onPickImage();
      if (uri) {
        setPendingImageUri(uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }

    if (trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Display name must be at least 2 characters.');
      return;
    }

    if (trimmedName.length > 50) {
      Alert.alert('Invalid Name', 'Display name must be 50 characters or less.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedName, pendingImageUri);
      onBack();
    } catch (error) {
      console.error('Error saving profile:', error);
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

  const handleRemoveImage = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setPendingImageUri('__REMOVE__'),
        },
      ]
    );
  };

  // Determine which image to display
  const displayImageUrl = pendingImageUri === '__REMOVE__'
    ? null
    : pendingImageUri || user?.profileImageUrl;

  const hasExistingImage = user?.profileImageUrl || (pendingImageUri && pendingImageUri !== '__REMOVE__');

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#007AFF" />
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
        {/* Profile Image Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={isSaving}>
            <View style={styles.avatarWrapper}>
              <ProfileAvatar
                imageUrl={displayImageUrl}
                displayName={displayName || user?.name || 'User'}
                size="large"
                userId={user?.id}
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
              <Text style={styles.imageButtonText}>Change Photo</Text>
            </TouchableOpacity>

            {hasExistingImage && (
              <TouchableOpacity
                style={[styles.imageButton, styles.imageButtonDanger]}
                onPress={handleRemoveImage}
                disabled={isSaving}
              >
                <Text style={[styles.imageButtonText, styles.imageButtonTextDanger]}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={50}
              editable={!isSaving}
            />
          </View>
          <Text style={styles.inputHint}>
            This name will be visible to others when you send or receive payments.
          </Text>
        </View>

        {/* Email Section (read-only) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EMAIL</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.readOnlyValue}>{user?.email || 'Not available'}</Text>
          </View>
          <Text style={styles.inputHint}>
            Your email cannot be changed.
          </Text>
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
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
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
    color: '#007AFF',
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
  input: {
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  readOnlyValue: {
    fontSize: 16,
    color: '#6b7280',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});

export default ProfileEditScreen;
