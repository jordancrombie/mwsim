/**
 * NFC Passport Reading Service
 *
 * Reads passport data from NFC-enabled travel documents (ICAO 9303 compliant).
 * Uses react-native-nfc-passport-info for the native NFC communication.
 *
 * Passport reading requires BAC (Basic Access Control) keys derived from MRZ data:
 * - Document number (9 characters)
 * - Date of birth (YYMMDD)
 * - Date of expiry (YYMMDD)
 */

import { Platform, NativeModules } from 'react-native';
import { scanNfc, cancelScanNfc } from 'react-native-nfc-passport-info';

/**
 * MRZ data extracted from the Machine Readable Zone of a passport.
 * Required for BAC (Basic Access Control) to unlock passport chip data.
 */
export interface MRZData {
  documentNumber: string; // 9 characters from MRZ line 2
  dateOfBirth: string; // YYMMDD format
  dateOfExpiry: string; // YYMMDD format
}

/**
 * Photo data from the passport chip (DG2).
 */
export interface PassportPhoto {
  base64: string; // Data URI with base64-encoded PNG
  width: number;
  height: number;
}

/**
 * Passport data read from the NFC chip.
 * Includes biographical data (DG1) and photo (DG2).
 */
export interface PassportData {
  // Biographical data (DG1)
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  gender: string;
  nationality: string;
  personalNumber: string;
  passportMRZ: string;

  // Photo (DG2)
  photo: PassportPhoto;
}

/**
 * NFC support status.
 */
export interface NFCSupportStatus {
  isSupported: boolean;
  reason?: string;
}

/**
 * Check if NFC passport reading is supported on this device.
 *
 * Requirements:
 * - iOS 13+ with NFC hardware (iPhone 7 or later)
 * - Android with NFC hardware
 * - Must be running on physical device (not simulator)
 */
export function checkNFCSupport(): NFCSupportStatus {
  // Check platform
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return {
      isSupported: false,
      reason: 'NFC passport reading is only supported on iOS and Android',
    };
  }

  // Check if native module is available
  const ReadNfcPassport = NativeModules.ReadNfcPassport;
  if (!ReadNfcPassport) {
    return {
      isSupported: false,
      reason: 'NFC module not available. Running in Expo Go or simulator?',
    };
  }

  // Check iOS-specific support
  if (Platform.OS === 'ios') {
    const constants = ReadNfcPassport.getConstants?.() || ReadNfcPassport;
    if (constants.isSupported === false) {
      return {
        isSupported: false,
        reason: 'NFC not supported on this iOS device',
      };
    }
  }

  return { isSupported: true };
}

/**
 * Read passport data from an NFC-enabled passport.
 *
 * The passport chip is protected by BAC (Basic Access Control), which requires
 * the MRZ data (document number, DOB, expiry) to decrypt the chip contents.
 *
 * On iOS, this presents a native NFC scanning sheet.
 * On Android, the app must already be in the foreground with NFC enabled.
 *
 * @param mrzData - MRZ data extracted from scanning the passport's data page
 * @returns Promise resolving to passport data (biographical + photo)
 * @throws Error if NFC reading fails
 */
export async function readPassport(mrzData: MRZData): Promise<PassportData> {
  // Validate MRZ data format
  validateMRZData(mrzData);

  try {
    console.log('[NFCPassport] Starting passport read...');
    console.log('[NFCPassport] MRZ data for BAC:', {
      documentNumber: mrzData.documentNumber,
      documentNumberLength: mrzData.documentNumber.length,
      dateOfBirth: mrzData.dateOfBirth,
      dateOfExpiry: mrzData.dateOfExpiry,
    });

    const result = await scanNfc({
      documentNumber: mrzData.documentNumber,
      dateOfBirth: mrzData.dateOfBirth,
      dateOfExpiry: mrzData.dateOfExpiry,
    });

    console.log('[NFCPassport] Passport read successful');

    // Map the result to our interface
    const passportData: PassportData = {
      firstName: result.firstName || '',
      lastName: result.lastName || '',
      dateOfBirth: result.dateOfBirth || '',
      dateOfExpiry: result.dateOfExpiry || '',
      gender: result.gender || '',
      nationality: result.nationality || '',
      personalNumber: result.personalNumber || '',
      passportMRZ: result.passportMRZ || '',
      photo: {
        base64: result.photo?.base64 || '',
        width: result.photo?.width || 0,
        height: result.photo?.height || 0,
      },
    };

    return passportData;
  } catch (error) {
    console.log('[NFCPassport] Read failed:', error);

    // Translate common errors to user-friendly messages
    const errorMessage = getErrorMessage(error);
    throw new Error(errorMessage);
  }
}

/**
 * Cancel an ongoing NFC scan (Android only).
 * On iOS, the user can dismiss the native NFC sheet.
 */
export function cancelNFCScan(): void {
  if (Platform.OS === 'android') {
    cancelScanNfc();
    console.log('[NFCPassport] Scan cancelled');
  }
}

/**
 * Validate MRZ data format before attempting NFC read.
 */
function validateMRZData(mrzData: MRZData): void {
  if (!mrzData.documentNumber || mrzData.documentNumber.length < 1) {
    throw new Error('Invalid document number');
  }

  if (!isValidDateFormat(mrzData.dateOfBirth)) {
    throw new Error('Invalid date of birth format (expected YYMMDD)');
  }

  if (!isValidDateFormat(mrzData.dateOfExpiry)) {
    throw new Error('Invalid date of expiry format (expected YYMMDD)');
  }
}

/**
 * Check if a string is in YYMMDD format.
 */
function isValidDateFormat(date: string): boolean {
  return /^\d{6}$/.test(date);
}

/**
 * Translate NFC errors to user-friendly messages.
 */
function getErrorMessage(error: unknown): string {
  const errorStr = error instanceof Error ? error.message : String(error);

  // iOS CoreNFC errors
  if (errorStr.includes('NFCReaderError')) {
    if (errorStr.includes('sessionTimeout')) {
      return 'NFC scan timed out. Please try again.';
    }
    if (errorStr.includes('systemIsBusy')) {
      return 'NFC is busy. Please wait and try again.';
    }
    if (errorStr.includes('sessionInvalidated')) {
      return 'NFC session ended. Please try again.';
    }
  }

  // BAC authentication failure (wrong MRZ data)
  if (
    errorStr.includes('BAC') ||
    errorStr.includes('InvalidMRZKey') ||
    errorStr.includes('authentication') ||
    errorStr.includes('AUTHENTICATION')
  ) {
    return 'Failed to authenticate with passport. The scanned data may not match the chip. Try entering details manually.';
  }

  // Tag lost (passport moved away)
  if (errorStr.includes('TagLost') || errorStr.includes('tag was lost')) {
    return 'Lost connection to passport. Keep your phone still on the passport.';
  }

  // User cancelled
  if (
    errorStr.includes('cancelled') ||
    errorStr.includes('UserCancel') ||
    errorStr.includes('NFC_NOT_SUPPORTED')
  ) {
    return 'Scan cancelled';
  }

  // Generic fallback
  return `Failed to read passport: ${errorStr}`;
}

/**
 * Format a date from YYMMDD to a human-readable format.
 */
export function formatPassportDate(yymmdd: string): string {
  if (!yymmdd || yymmdd.length !== 6) return yymmdd;

  const yy = yymmdd.substring(0, 2);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  // Determine century: if year > 30, assume 1900s, else 2000s
  const year = parseInt(yy, 10);
  const fullYear = year > 30 ? 1900 + year : 2000 + year;

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthIndex = parseInt(mm, 10) - 1;
  const monthName = months[monthIndex] || mm;

  return `${dd} ${monthName} ${fullYear}`;
}
