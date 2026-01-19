import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getCachedImageUri, cacheImage } from '../services/imageCache';
import type { VerificationLevel } from '../types';

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
export type AvatarVariant = 'user' | 'merchant';

// Verification badge colors
const VERIFICATION_BADGE_COLORS = {
  none: 'transparent',
  basic: '#A0AEC0',     // Silver/gray for basic verification
  enhanced: '#F6AD55',  // Gold for enhanced verification
} as const;

interface ProfileAvatarProps {
  /** URL of the profile image. If not provided, initials will be shown. */
  imageUrl?: string | null;
  /** Display name used to generate initials (user name or merchant business name). */
  displayName: string;
  /** Size of the avatar: 'small' (32px), 'medium' (64px), or 'large' (128px). */
  size?: AvatarSize;
  /** Custom user/visitor ID for deterministic color generation. Falls back to displayName hash. */
  userId?: string;
  /** Override the automatically generated initials color. */
  initialsColor?: string;
  /** Avatar variant: 'user' for personal profiles, 'merchant' for business logos. Default: 'user' */
  variant?: AvatarVariant;
  /** Whether the user is verified. Shows a badge on the avatar. */
  isVerified?: boolean;
  /** Level of verification: 'basic' (silver) or 'enhanced' (gold). */
  verificationLevel?: VerificationLevel;
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
/**
 * VerificationBadge Component
 * Shows a checkmark badge on verified user avatars
 */
const VerificationBadge: React.FC<{
  size: number;
  level: VerificationLevel;
}> = ({ size, level }) => {
  if (level === 'none') return null;

  // Badge size is proportional to avatar (about 30% of avatar size)
  const badgeSize = Math.max(12, Math.round(size * 0.3));
  const checkSize = Math.round(badgeSize * 0.6);
  const badgeColor = VERIFICATION_BADGE_COLORS[level];

  return (
    <View
      style={[
        styles.verificationBadge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: badgeColor,
          // Position at bottom-right of avatar
          right: 0,
          bottom: 0,
        },
      ]}
    >
      <Text style={[styles.verificationCheck, { fontSize: checkSize }]}>
        {'\u2713'}
      </Text>
    </View>
  );
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  imageUrl,
  displayName,
  size = 'medium',
  userId,
  initialsColor,
  variant = 'user',
  isVerified = false,
  verificationLevel = 'none',
}) => {
  const [isLoading, setIsLoading] = useState(!!imageUrl);
  const [hasError, setHasError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Debug logging - only log when imageUrl changes (not on every render)

  // Check cache and resolve image URI when imageUrl changes
  useEffect(() => {
    let cancelled = false;

    const resolveImage = async () => {
      if (!imageUrl) {
        setResolvedUri(null);
        setIsCached(false);
        setIsLoading(false);
        return;
      }

      // Reset state
      setHasError(false);
      setIsLoading(true);

      // Check cache first
      try {
        const cachedUri = await getCachedImageUri(imageUrl);
        if (cancelled) return;

        if (cachedUri) {
          console.log(`[ProfileAvatar] Using cached image for ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
          setResolvedUri(cachedUri);
          setIsCached(true);
          setIsLoading(false);
        } else {
          // Use network URL, will cache after successful load
          setResolvedUri(imageUrl);
          setIsCached(false);
        }
      } catch (error) {
        if (cancelled) return;
        // Fallback to network URL on cache error
        setResolvedUri(imageUrl);
        setIsCached(false);
      }
    };

    resolveImage();

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Cache image after successful network load
  const handleImageLoad = () => {
    setIsLoading(false);

    // If loaded from network (not cached), cache it for next time
    if (imageUrl && !isCached) {
      cacheImage(imageUrl).catch(() => {
        // Ignore cache errors
      });
    }
  };

  const sizeValue = AVATAR_SIZES[size];
  const fontSize = Math.round(sizeValue * FONT_SIZE_RATIO);
  // Circular for users, rounded square for merchants
  const borderRadius = variant === 'merchant'
    ? Math.round(sizeValue * 0.2) // 20% of size for rounded corners
    : sizeValue / 2; // Full circle for users

  const initials = generateInitials(displayName);
  const backgroundColor = initialsColor || generateAvatarColor(userId || displayName);

  const containerStyle = {
    width: sizeValue,
    height: sizeValue,
    borderRadius,
    backgroundColor,
  };

  // Show initials if no resolved URI, image failed to load, or while loading
  // This prevents showing stale cached images while new ones load
  const showInitials = !resolvedUri || hasError || isLoading;

  // Determine the effective verification level to show
  const effectiveLevel = isVerified ? (verificationLevel || 'basic') : 'none';

  if (showInitials) {
    return (
      <View style={styles.avatarWrapper}>
        <View style={[styles.container, containerStyle]}>
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
          {/* Hidden Image to trigger loading when we have a resolved URI */}
          {resolvedUri && !hasError && (
            <Image
              key={resolvedUri}
              source={{ uri: resolvedUri }}
              style={{ width: 0, height: 0, position: 'absolute' }}
              onLoadEnd={handleImageLoad}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
            />
          )}
        </View>
        <VerificationBadge size={sizeValue} level={effectiveLevel} />
      </View>
    );
  }

  return (
    <View style={styles.avatarWrapper}>
      <View style={[styles.container, containerStyle]}>
        <Image
          key={resolvedUri}
          source={{ uri: resolvedUri }}
          style={[styles.image, { width: sizeValue, height: sizeValue, borderRadius }]}
          onError={() => {
            setHasError(true);
          }}
        />
      </View>
      <VerificationBadge size={sizeValue} level={effectiveLevel} />
    </View>
  );
};

const styles = StyleSheet.create({
  avatarWrapper: {
    position: 'relative',
  },
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
  verificationBadge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  verificationCheck: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

export default ProfileAvatar;
