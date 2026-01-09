import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

// Avatar sizes in pixels
const AVATAR_SIZES = {
  small: 32,
  medium: 64,
  large: 128,
} as const;

// Font sizes relative to avatar size
const FONT_SIZE_RATIO = 0.4;

// Deterministic color palette for initials avatars
const AVATAR_COLORS = [
  '#E53935', // Red
  '#D81B60', // Pink
  '#8E24AA', // Purple
  '#5E35B1', // Deep Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#039BE5', // Light Blue
  '#00ACC1', // Cyan
  '#00897B', // Teal
  '#43A047', // Green
  '#7CB342', // Light Green
  '#C0CA33', // Lime
  '#FDD835', // Yellow
  '#FFB300', // Amber
  '#FB8C00', // Orange
  '#F4511E', // Deep Orange
];

export type AvatarSize = keyof typeof AVATAR_SIZES;

interface ProfileAvatarProps {
  /** URL of the profile image. If not provided, initials will be shown. */
  imageUrl?: string | null;
  /** Display name used to generate initials. */
  displayName: string;
  /** Size of the avatar: 'small' (32px), 'medium' (64px), or 'large' (128px). */
  size?: AvatarSize;
  /** Custom user/visitor ID for deterministic color generation. Falls back to displayName hash. */
  userId?: string;
  /** Override the automatically generated initials color. */
  initialsColor?: string;
}

/**
 * Generates initials from a display name.
 * - Single word: First two characters (e.g., "Jordan" → "JO")
 * - Multiple words: First char of first and last word (e.g., "Jordan Crombie" → "JC")
 */
export function generateInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';

  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    // Single word: take first two characters
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: first char of first and last word
  const firstInitial = parts[0][0] || '';
  const lastInitial = parts[parts.length - 1][0] || '';
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Generates a deterministic color based on a string (userId or displayName).
 * Same input always produces the same color.
 */
export function generateAvatarColor(identifier: string): string {
  if (!identifier) return AVATAR_COLORS[0];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * ProfileAvatar Component
 *
 * Displays a profile image or falls back to initials with a colored background.
 * Used throughout the app for user avatars in greetings, transaction history,
 * payment confirmations, and settings.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  imageUrl,
  displayName,
  size = 'medium',
  userId,
  initialsColor,
}) => {
  const [isLoading, setIsLoading] = useState(!!imageUrl);
  const [hasError, setHasError] = useState(false);

  const sizeValue = AVATAR_SIZES[size];
  const fontSize = Math.round(sizeValue * FONT_SIZE_RATIO);
  const borderRadius = sizeValue / 2; // Circular avatar

  const initials = generateInitials(displayName);
  const backgroundColor = initialsColor || generateAvatarColor(userId || displayName);

  const containerStyle = {
    width: sizeValue,
    height: sizeValue,
    borderRadius,
    backgroundColor,
  };

  // Show initials if no image URL, or if image failed to load
  const showInitials = !imageUrl || hasError;

  if (showInitials) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { width: sizeValue, height: sizeValue, borderRadius }]}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '600',
  },
  image: {
    resizeMode: 'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },
});

export default ProfileAvatar;
