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
 * Content structure for a single pitch page screen.
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
 * Content structure for a page in a multi-page pitch (swipeable).
 * Simpler than full PitchPageContent - no CTA buttons (those go on last page only).
 */
export interface PitchPageSlide {
  title: string;
  subtitle?: string;
  benefits: PitchPageBenefit[];
  instructions?: string[];
}

/**
 * Pitch page definition with condition and content.
 * Supports both single-page and multi-page (swipeable) pitch pages.
 */
export interface PitchPage {
  id: string;                                           // Unique identifier
  condition: (user: PitchPageUserContext) => boolean;   // Show when true
  priority: number;                                     // Higher = show first
  content?: PitchPageContent;                           // Single page content
  pages?: PitchPageSlide[];                             // Multi-page swipeable content
  finalPageCTA?: PitchPageCTA;                          // CTA button shown on last page of multi-page
  finalPageDismissLabel?: string;                       // Dismiss button label for last page
}

// ============================================================================
// Constants
// ============================================================================

const DISMISSED_PITCH_PAGES_KEY = 'dismissed_pitch_pages';

// ============================================================================
// Pitch Page Definitions
// ============================================================================

/**
 * Welcome/Getting Started pitch page.
 * Shown to all users on first login after install.
 * Multi-page swipeable tutorial covering all app features.
 * Takes priority over other pitch pages until permanently dismissed.
 */
const WELCOME_PITCH: PitchPage = {
  id: 'welcome-tutorial',
  condition: () => true,  // Always show (until dismissed)
  priority: 200,  // Higher than other pitch pages
  pages: [
    // Page 1: My Cards
    {
      title: 'Welcome to mwsim',
      subtitle: 'Your cards, all in one place',
      benefits: [
        {
          icon: '💳',
          title: 'View Your Cards',
          description: 'See all your linked bank cards and their balances at a glance',
        },
        {
          icon: '🏦',
          title: 'Add Another Bank',
          description: 'Link multiple bank accounts to manage all your money in one app',
        },
        {
          icon: '📷',
          title: 'Scan QR to Pay',
          description: 'Tap the camera icon to scan merchant QR codes for instant payments',
        },
      ],
    },
    // Page 2: P2P Transfers
    {
      title: 'Send Money Instantly',
      subtitle: 'Fast, free peer-to-peer transfers',
      benefits: [
        {
          icon: '👥',
          title: 'P2P Transfers',
          description: 'Send money to friends and family instantly using their email or phone',
        },
        {
          icon: '📱',
          title: 'QR Code Transfers',
          description: 'Generate your QR code or scan others for quick transfers',
        },
        {
          icon: '📍',
          title: 'Nearby Discovery',
          description: 'Find nearby users via Bluetooth for even faster transfers',
        },
      ],
      instructions: [
        'Tap the P2P tab to get started',
        'Enroll with your email to receive transfers',
        'Send to anyone using their email, phone, or QR code',
      ],
    },
    // Page 3: Business Payments
    {
      title: 'Accept Business Payments',
      subtitle: 'Turn your phone into a payment terminal',
      benefits: [
        {
          icon: '🏪',
          title: 'Micro Merchant',
          description: 'Accept payments as a small business with your own custom QR code',
        },
        {
          icon: '📊',
          title: 'Transaction History',
          description: 'Track all your business payments and see detailed reports',
        },
        {
          icon: '⚡',
          title: 'Instant Settlement',
          description: 'Funds arrive in your account immediately after payment',
        },
      ],
      instructions: [
        'Go to Settings and enable Business Profile',
        'Set your business name and category',
        'Share your QR code with customers',
      ],
    },
    // Page 4: Contracts
    {
      title: 'Smart Contracts & Wagers',
      subtitle: 'Conditional payments made easy',
      benefits: [
        {
          icon: '📜',
          title: 'Create Contracts',
          description: 'Set up conditional payments that execute automatically',
        },
        {
          icon: '🎲',
          title: 'Friendly Wagers',
          description: 'Bet on sports, events, or anything with friends - funds held securely',
        },
        {
          icon: '🤝',
          title: 'Escrow Payments',
          description: 'Hold funds until conditions are met for secure transactions',
        },
      ],
      instructions: [
        'Tap Contracts in the menu',
        'Choose an oracle event or create a custom condition',
        'Both parties fund their stake and wait for the outcome',
      ],
    },
    // Page 5: Settings & Security
    {
      title: 'Settings & Security',
      subtitle: 'Customize your experience',
      benefits: [
        {
          icon: '🛡️',
          title: 'Identity Verification',
          description: 'Verify with your passport to become a Trusted User with higher limits',
        },
        {
          icon: '👤',
          title: 'Profile Management',
          description: 'Update your display name, photo, and notification preferences',
        },
        {
          icon: '🔒',
          title: 'Security Controls',
          description: 'Manage your devices, sign out remotely, and control your data',
        },
      ],
      instructions: [
        'Access Settings from the gear icon on the home screen',
        'Verify your identity for higher transfer limits',
        'Customize notifications and preferences',
      ],
    },
  ],
  finalPageCTA: {
    label: 'Get Started',
    action: 'dismiss',
  },
  finalPageDismissLabel: 'Maybe Later',
};

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
 * Ordered by priority (highest first).
 */
const PITCH_PAGES: PitchPage[] = [
  WELCOME_PITCH,       // Priority 200 - First-time user tutorial
  TRUSTED_USER_PITCH,  // Priority 100 - Verification upsell
  // Future pitch pages can be added here
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
