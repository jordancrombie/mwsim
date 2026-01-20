/**
 * Pitch Page Service
 *
 * Manages promotional/educational pages shown to users on login based on
 * eligibility criteria. Tracks which pages users have permanently dismissed.
 *
 * MVP: Client-side implementation with local storage for dismissals.
 * Future: Server-side pitch page definitions and dismissal tracking via WSIM.
 *
 * @see LOCAL_DEPLOYMENT_PLANS/PITCH_PAGE_WSIM_PROPOSAL.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { VerificationLevel } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * User context for evaluating pitch page conditions.
 * This is a subset of user data needed for condition evaluation.
 */
export interface PitchPageUserContext {
  isVerified?: boolean;
  verificationLevel?: VerificationLevel;
  isMerchant?: boolean;
  // Add more fields as needed for future pitch page conditions
}

/**
 * A benefit item displayed in the pitch page.
 */
export interface PitchPageBenefit {
  icon: string;           // Emoji or icon name
  title: string;          // Short benefit title
  description: string;    // Longer description
}

/**
 * Call-to-action button configuration.
 */
export interface PitchPageCTA {
  label: string;
  action: 'navigate' | 'dismiss';
  screen?: string;        // Screen to navigate to (if action is 'navigate')
}

/**
 * Content structure for a pitch page.
 */
export interface PitchPageContent {
  title: string;
  subtitle?: string;
  benefits: PitchPageBenefit[];
  instructions?: string[];  // How-to steps
  ctaButton?: PitchPageCTA;
  dismissButtonLabel?: string;  // Default: "Not Now"
}

/**
 * Pitch page definition with condition and content.
 */
export interface PitchPage {
  id: string;                                           // Unique identifier
  condition: (user: PitchPageUserContext) => boolean;   // Show when true
  priority: number;                                     // Higher = show first (for future multi-page support)
  content: PitchPageContent;
}

// ============================================================================
// Constants
// ============================================================================

const DISMISSED_PITCH_PAGES_KEY = 'dismissed_pitch_pages';

// ============================================================================
// Pitch Page Definitions
// ============================================================================

/**
 * Trusted User Verification pitch page.
 * Shown to users who are not yet verified (no badge).
 */
const TRUSTED_USER_PITCH: PitchPage = {
  id: 'trusted-user-upsell',
  condition: (user) => !user.isVerified || user.verificationLevel === 'none',
  priority: 100,
  content: {
    title: 'Become a Trusted User',
    subtitle: 'Unlock higher limits and exclusive features by verifying your identity',
    benefits: [
      {
        icon: '💰',
        title: 'Higher Transfer Limits',
        description: 'Silver: Up to $100 per transfer\nGold: Up to $1,000 per transfer',
      },
      {
        icon: '📱',
        title: 'More QR Transfers',
        description: 'Silver: 10 QR transfers per day\nGold: Unlimited QR transfers',
      },
      {
        icon: '🏪',
        title: 'Accept Business Payments',
        description: 'Gold members can accept payments as a small business with custom QR codes',
      },
      {
        icon: '✓',
        title: 'Verified Badge',
        description: 'Show others you\'re a trusted user with a silver or gold verification badge',
      },
    ],
    instructions: [
      'Open Settings from the home screen',
      'Tap "Verify Your Identity"',
      'Scan your passport MRZ or enter details manually',
      'Hold your phone to your passport for NFC verification',
      'Complete liveness check for Gold status',
    ],
    ctaButton: {
      label: 'Get Verified',
      action: 'navigate',
      screen: 'settings',  // Will navigate to settings, user can tap Verify Identity
    },
    dismissButtonLabel: 'Maybe Later',
  },
};

/**
 * All registered pitch pages.
 * Add new pitch pages here as they are created.
 */
const PITCH_PAGES: PitchPage[] = [
  TRUSTED_USER_PITCH,
  // Future pitch pages can be added here:
  // MERCHANT_ENROLLMENT_PITCH,
  // CONTRACT_FEATURES_PITCH,
  // etc.
];

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Get the list of dismissed pitch page IDs.
 */
async function getDismissedPitchPages(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(DISMISSED_PITCH_PAGES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[PitchPages] Failed to get dismissed pages:', error);
  }
  return [];
}

/**
 * Mark a pitch page as permanently dismissed.
 */
export async function dismissPitchPage(pitchPageId: string): Promise<void> {
  try {
    const dismissed = await getDismissedPitchPages();
    if (!dismissed.includes(pitchPageId)) {
      dismissed.push(pitchPageId);
      await AsyncStorage.setItem(DISMISSED_PITCH_PAGES_KEY, JSON.stringify(dismissed));
      console.log('[PitchPages] Dismissed pitch page:', pitchPageId);
    }
  } catch (error) {
    console.error('[PitchPages] Failed to dismiss pitch page:', error);
  }
}

/**
 * Check if a pitch page has been dismissed.
 */
async function isPitchPageDismissed(pitchPageId: string): Promise<boolean> {
  const dismissed = await getDismissedPitchPages();
  return dismissed.includes(pitchPageId);
}

/**
 * Clear all dismissed pitch pages (useful for testing).
 */
export async function clearDismissedPitchPages(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_PITCH_PAGES_KEY);
    console.log('[PitchPages] Cleared all dismissed pitch pages');
  } catch (error) {
    console.error('[PitchPages] Failed to clear dismissed pages:', error);
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Get the pitch page to show for the current user, if any.
 *
 * Returns the highest priority pitch page that:
 * 1. Has a condition that evaluates to true for the user
 * 2. Has not been permanently dismissed by the user
 *
 * @param user User context for condition evaluation
 * @returns The pitch page to show, or null if none apply
 */
export async function getPitchPageForUser(
  user: PitchPageUserContext
): Promise<PitchPage | null> {
  console.log('[PitchPages] Evaluating pitch pages for user:', {
    isVerified: user.isVerified,
    verificationLevel: user.verificationLevel,
    isMerchant: user.isMerchant,
  });

  // Get all dismissed pitch pages
  const dismissed = await getDismissedPitchPages();
  console.log('[PitchPages] Dismissed pages:', dismissed);

  // Filter to applicable pitch pages (condition true, not dismissed)
  const applicablePitchPages = PITCH_PAGES.filter((page) => {
    const conditionMet = page.condition(user);
    const isDismissed = dismissed.includes(page.id);

    console.log(`[PitchPages] ${page.id}: condition=${conditionMet}, dismissed=${isDismissed}`);

    return conditionMet && !isDismissed;
  });

  if (applicablePitchPages.length === 0) {
    console.log('[PitchPages] No applicable pitch pages');
    return null;
  }

  // Sort by priority (highest first) and return the first one
  applicablePitchPages.sort((a, b) => b.priority - a.priority);
  const selectedPage = applicablePitchPages[0];

  console.log('[PitchPages] Selected pitch page:', selectedPage.id);
  return selectedPage;
}

/**
 * Get all registered pitch page IDs.
 * Useful for debugging and admin features.
 */
export function getAllPitchPageIds(): string[] {
  return PITCH_PAGES.map((page) => page.id);
}
