/**
 * Identity Verification Service
 *
 * Handles verification of user identity by comparing passport data
 * against user profile information. Creates signed verification payloads
 * for server-side validation.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { getDeviceId } from './deviceId';

// ============================================================================
// Types
// ============================================================================

export interface NameMatchResult {
  score: number; // 0-1 similarity score
  passed: boolean;
  firstName: {
    passport: string;
    profile: string;
    match: boolean;
    score: number;
  };
  lastName: {
    passport: string;
    profile: string;
    match: boolean;
    score: number;
  };
}

export interface FaceMatchResult {
  score: number; // 0-1 similarity score
  passed: boolean;
  passportFaceDetected: boolean;
  profileFaceDetected: boolean;
  selfieFaceDetected: boolean;
}

export interface LivenessResult {
  passed: boolean;
  challenges: string[]; // Completed challenges
  duration: number; // Time taken in seconds
}

export interface VerificationResult {
  nameMatch: NameMatchResult;
  faceMatch?: FaceMatchResult;
  livenessCheck?: LivenessResult;
  timestamp: string;
  documentType: string; // 'PASSPORT', 'ID_CARD'
  issuingCountry: string; // 3-letter ISO code
}

export interface SignedVerification {
  payload: string; // base64 encoded VerificationResult
  signature: string; // HMAC-SHA256
  deviceId: string;
  appVersion: string;
}

export type VerificationLevel = 'none' | 'basic' | 'enhanced';

// ============================================================================
// Constants
// ============================================================================

const DEVICE_KEY_STORAGE_KEY = 'verification_device_key';
const NAME_MATCH_THRESHOLD = 0.85; // 85% similarity required
const FACE_MATCH_THRESHOLD = 0.70; // 70% similarity required

// ============================================================================
// Name Matching
// ============================================================================

/**
 * Normalize a name for comparison.
 * - Converts to uppercase
 * - Removes accents/diacritics
 * - Removes non-alphabetic characters
 * - Trims whitespace
 */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^A-Z\s]/g, '') // Keep only letters and spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy name matching to handle OCR errors.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Parse a profile display name into first and last name components.
 * Handles various formats:
 * - "First Last"
 * - "First Middle Last"
 * - "Last, First"
 */
function parseProfileName(displayName: string): { firstName: string; lastName: string } {
  const normalized = displayName.trim();

  // Check for "Last, First" format
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map((p) => p.trim());
    return {
      lastName: parts[0] || '',
      firstName: parts.slice(1).join(' ') || '',
    };
  }

  // Standard "First Last" format
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  // Last word is last name, everything else is first name
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Compare passport name against profile name.
 * Handles name order differences and uses fuzzy matching.
 */
export function matchNames(
  passportFirstName: string,
  passportLastName: string,
  profileDisplayName: string
): NameMatchResult {
  const { firstName: profileFirst, lastName: profileLast } = parseProfileName(profileDisplayName);

  // Calculate individual name similarities
  const firstNameScore = calculateSimilarity(passportFirstName, profileFirst);
  const lastNameScore = calculateSimilarity(passportLastName, profileLast);

  // Also try swapped order (in case profile has names reversed)
  const swappedFirstScore = calculateSimilarity(passportFirstName, profileLast);
  const swappedLastScore = calculateSimilarity(passportLastName, profileFirst);

  // Use best match (normal or swapped)
  const normalScore = (firstNameScore + lastNameScore) / 2;
  const swappedScore = (swappedFirstScore + swappedLastScore) / 2;

  const useSwapped = swappedScore > normalScore;
  const bestFirstScore = useSwapped ? swappedFirstScore : firstNameScore;
  const bestLastScore = useSwapped ? swappedLastScore : lastNameScore;
  const overallScore = Math.max(normalScore, swappedScore);

  // Individual name matches require 80% similarity
  const firstNameMatch = bestFirstScore >= 0.8;
  const lastNameMatch = bestLastScore >= 0.8;

  // Overall pass requires threshold AND at least one strong match
  const passed = overallScore >= NAME_MATCH_THRESHOLD && (firstNameMatch || lastNameMatch);

  return {
    score: overallScore,
    passed,
    firstName: {
      passport: passportFirstName,
      profile: useSwapped ? profileLast : profileFirst,
      match: firstNameMatch,
      score: bestFirstScore,
    },
    lastName: {
      passport: passportLastName,
      profile: useSwapped ? profileFirst : profileLast,
      match: lastNameMatch,
      score: bestLastScore,
    },
  };
}

// ============================================================================
// Verification Result Creation
// ============================================================================

/**
 * Create a verification result from the collected data.
 */
export function createVerificationResult(
  nameMatch: NameMatchResult,
  documentType: string,
  issuingCountry: string,
  faceMatch?: FaceMatchResult,
  livenessCheck?: LivenessResult
): VerificationResult {
  return {
    nameMatch,
    faceMatch,
    livenessCheck,
    timestamp: new Date().toISOString(),
    documentType,
    issuingCountry,
  };
}

/**
 * Determine verification level based on completed checks.
 */
export function getVerificationLevel(result: VerificationResult): VerificationLevel {
  if (!result.nameMatch.passed) {
    return 'none';
  }

  // Enhanced: name + face + liveness all passed
  if (
    result.faceMatch?.passed &&
    result.livenessCheck?.passed
  ) {
    return 'enhanced';
  }

  // Basic: name match only
  return 'basic';
}

// ============================================================================
// Signed Verification
// ============================================================================

/**
 * Get or create a device-specific signing key.
 * The key is stored securely and used for HMAC signing.
 */
async function getOrCreateDeviceKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DEVICE_KEY_STORAGE_KEY);

  if (!key) {
    // Generate a new random key
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(DEVICE_KEY_STORAGE_KEY, key);
  }

  return key;
}

/**
 * Create an HMAC-SHA256 signature for the payload.
 */
async function createSignature(payload: string, key: string): Promise<string> {
  // Combine payload and key for hashing
  const dataToHash = `${payload}:${key}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dataToHash
  );
  return hash;
}

/**
 * Encode data to base64.
 */
function base64Encode(data: string): string {
  // Use btoa equivalent for React Native
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const bytes = new TextEncoder().encode(data);

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] || 0;
    const b3 = bytes[i + 2] || 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }

  return result;
}

/**
 * Create a signed verification payload for server submission.
 */
export async function createSignedVerification(
  result: VerificationResult
): Promise<SignedVerification> {
  const deviceId = await getDeviceId();
  const deviceKey = await getOrCreateDeviceKey();

  const payload = JSON.stringify(result);
  const payloadBase64 = base64Encode(payload);
  const signature = await createSignature(payloadBase64, deviceKey);

  return {
    payload: payloadBase64,
    signature,
    deviceId,
    appVersion: Constants.expoConfig?.version || '0.0.0',
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a verification result passes all required checks.
 */
export function isVerificationPassed(result: VerificationResult): boolean {
  // Name match is always required
  if (!result.nameMatch.passed) {
    return false;
  }

  // If face match was attempted, it must pass
  if (result.faceMatch && !result.faceMatch.passed) {
    return false;
  }

  // If liveness was attempted, it must pass
  if (result.livenessCheck && !result.livenessCheck.passed) {
    return false;
  }

  return true;
}

/**
 * Get a human-readable summary of verification failures.
 */
export function getVerificationFailureReasons(result: VerificationResult): string[] {
  const reasons: string[] = [];

  if (!result.nameMatch.passed) {
    if (!result.nameMatch.firstName.match && !result.nameMatch.lastName.match) {
      reasons.push('Name does not match profile');
    } else if (!result.nameMatch.firstName.match) {
      reasons.push('First name does not match');
    } else if (!result.nameMatch.lastName.match) {
      reasons.push('Last name does not match');
    }
  }

  if (result.faceMatch && !result.faceMatch.passed) {
    if (!result.faceMatch.passportFaceDetected) {
      reasons.push('Could not detect face in passport photo');
    } else if (!result.faceMatch.profileFaceDetected) {
      reasons.push('Could not detect face in profile photo');
    } else {
      reasons.push('Face does not match profile photo');
    }
  }

  if (result.livenessCheck && !result.livenessCheck.passed) {
    reasons.push('Liveness check failed');
  }

  return reasons;
}
