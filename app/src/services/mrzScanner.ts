/**
 * MRZ Scanner Service
 *
 * Provides utilities for working with Machine Readable Zone (MRZ) data.
 * Includes parsing MRZ strings and extracting data needed for NFC passport reading.
 */

import { parse as parseMRZ, type ParseResult } from 'mrz';
import type { MRZData } from './nfcPassport';

/**
 * Parsed MRZ data from a passport.
 */
export interface ParsedMRZ {
  documentNumber: string;
  dateOfBirth: string; // YYMMDD
  dateOfExpiry: string; // YYMMDD
  firstName: string;
  lastName: string;
  nationality: string;
  sex: string;
  issuingCountry: string;
  documentType: string;
  isValid: boolean;
}

/**
 * Parse MRZ lines from a passport.
 * Accepts either 2 lines (TD3/passport) or 3 lines (TD1/ID card).
 *
 * @param mrzLines - Array of MRZ lines from the passport
 * @returns Parsed MRZ data or null if parsing fails
 */
export function parseMRZLines(mrzLines: string[]): ParsedMRZ | null {
  try {
    // Clean up the lines - remove spaces and normalize
    const cleanedLines = mrzLines.map((line) =>
      line.trim().toUpperCase().replace(/\s/g, '')
    );

    console.log('[MRZScanner] Parsing lines:', cleanedLines.map(l => `"${l}" (${l.length})`));

    // First try with autocorrect enabled (more tolerant of OCR errors)
    let result = parseMRZ(cleanedLines, { autocorrect: true }) as ParseResult;

    if (!result.valid) {
      // Log which fields failed validation
      const failedFields = result.details
        .filter((d) => !d.valid)
        .map((d) => d.field || d.error);
      console.log('[MRZScanner] Autocorrect failed, invalid fields:', failedFields);

      // Try without autocorrect to get exact error details
      result = parseMRZ(cleanedLines) as ParseResult;
      if (!result.valid) {
        console.log('[MRZScanner] Invalid MRZ details:', result.details.filter((d) => !d.valid));
      }
    }

    // Even if validation fails, try to extract fields if they exist
    // This allows us to use data even with check digit errors
    const fields = result.fields;

    // Check if we have the minimum required fields for NFC
    const hasRequiredFields = fields.documentNumber && fields.birthDate && fields.expirationDate;

    if (!result.valid && !hasRequiredFields) {
      console.log('[MRZScanner] Missing required fields, cannot proceed');
      return null;
    }

    if (!result.valid && hasRequiredFields) {
      console.log('[MRZScanner] Check digit errors but have required fields, proceeding with warning');
    }

    return {
      documentNumber: fields.documentNumber || '',
      dateOfBirth: fields.birthDate || '',
      dateOfExpiry: fields.expirationDate || '',
      firstName: fields.firstName || '',
      lastName: fields.lastName || '',
      nationality: fields.nationality || '',
      sex: fields.sex || '',
      issuingCountry: fields.issuingState || '',
      documentType: fields.documentCode || '',
      isValid: result.valid,
    };
  } catch (error) {
    console.log('[MRZScanner] Parse error:', error);
    return null;
  }
}

/**
 * Extract MRZ data needed for NFC passport reading from parsed MRZ.
 *
 * @param parsedMRZ - Parsed MRZ data
 * @returns MRZData for NFC reading, or null if essential fields are missing
 */
export function extractMRZData(parsedMRZ: ParsedMRZ): MRZData | null {
  const { documentNumber, dateOfBirth, dateOfExpiry } = parsedMRZ;

  // All three fields are required for BAC authentication
  if (!documentNumber || !dateOfBirth || !dateOfExpiry) {
    console.log('[MRZScanner] Missing required MRZ fields:', {
      hasDocNumber: !!documentNumber,
      hasDob: !!dateOfBirth,
      hasExpiry: !!dateOfExpiry,
    });
    return null;
  }

  // Clean document number - remove trailing fillers, then re-pad to 9 chars
  // This is needed because react-native-nfc-passport-info has a bug where it
  // left-pads instead of right-pads the document number. By pre-padding to
  // exactly 9 chars, we avoid the bug.
  const cleanDocNumber = documentNumber.replace(/<+$/, '');
  const paddedDocNumber = (cleanDocNumber + '<'.repeat(9)).slice(0, 9);

  console.log('[MRZScanner] Extracted MRZ data for NFC:', {
    rawDocNumber: documentNumber,
    cleanDocNumber,
    paddedDocNumber,
    dateOfBirth,
    dateOfExpiry,
  });

  return {
    documentNumber: paddedDocNumber,
    dateOfBirth,
    dateOfExpiry,
  };
}

/**
 * Create MRZ data from individual fields (manual entry).
 *
 * @param documentNumber - Passport number (up to 9 characters)
 * @param dateOfBirth - Date of birth in YYMMDD format
 * @param dateOfExpiry - Expiry date in YYMMDD format
 * @returns MRZData for NFC reading, or null if validation fails
 */
export function createMRZDataFromFields(
  documentNumber: string,
  dateOfBirth: string,
  dateOfExpiry: string
): MRZData | null {
  // Validate document number
  const cleanDocNumber = documentNumber.trim().toUpperCase().replace(/\s/g, '');
  if (!cleanDocNumber || cleanDocNumber.length > 9) {
    console.log('[MRZScanner] Invalid document number');
    return null;
  }

  // Validate date formats (should be YYMMDD)
  if (!isValidMrzDate(dateOfBirth) || !isValidMrzDate(dateOfExpiry)) {
    console.log('[MRZScanner] Invalid date format');
    return null;
  }

  // Pad document number to 9 characters (workaround for library bug)
  const paddedDocNumber = (cleanDocNumber + '<'.repeat(9)).slice(0, 9);

  return {
    documentNumber: paddedDocNumber,
    dateOfBirth,
    dateOfExpiry,
  };
}

/**
 * Convert a Date object to MRZ date format (YYMMDD).
 */
export function dateToMrzDate(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Convert MRZ date format (YYMMDD) to a Date object.
 * MRZ dates use 2-digit years: >30 = 1900s, <=30 = 2000s
 */
export function mrzDateToDate(yymmdd: string): Date | null {
  if (!yymmdd || yymmdd.length !== 6) return null;

  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = parseInt(yymmdd.substring(2, 4), 10) - 1; // JS months are 0-indexed
  const dd = parseInt(yymmdd.substring(4, 6), 10);

  // Determine century: if year > 30, assume 1900s, else 2000s
  const fullYear = yy > 30 ? 1900 + yy : 2000 + yy;

  return new Date(fullYear, mm, dd);
}

/**
 * Validate that a string is in YYMMDD format.
 */
function isValidMrzDate(date: string): boolean {
  if (!/^\d{6}$/.test(date)) return false;

  const mm = parseInt(date.substring(2, 4), 10);
  const dd = parseInt(date.substring(4, 6), 10);

  // Basic validation: month 1-12, day 1-31
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

/**
 * Check if passport is expired based on MRZ expiry date.
 */
export function isPassportExpired(expiryDate: string): boolean {
  const expiry = mrzDateToDate(expiryDate);
  if (!expiry) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expiry < today;
}

/**
 * Get human-readable country name from 3-letter ISO country code.
 */
export function getCountryName(isoCode: string): string {
  const countries: Record<string, string> = {
    USA: 'United States',
    GBR: 'United Kingdom',
    CAN: 'Canada',
    AUS: 'Australia',
    DEU: 'Germany',
    FRA: 'France',
    ITA: 'Italy',
    ESP: 'Spain',
    JPN: 'Japan',
    CHN: 'China',
    IND: 'India',
    BRA: 'Brazil',
    MEX: 'Mexico',
    NLD: 'Netherlands',
    BEL: 'Belgium',
    CHE: 'Switzerland',
    AUT: 'Austria',
    SWE: 'Sweden',
    NOR: 'Norway',
    DNK: 'Denmark',
    FIN: 'Finland',
    IRL: 'Ireland',
    NZL: 'New Zealand',
    SGP: 'Singapore',
    KOR: 'South Korea',
  };

  return countries[isoCode?.toUpperCase()] || isoCode;
}

/**
 * Get human-readable gender from MRZ gender code.
 */
export function getGenderDisplay(genderCode: string): string {
  switch (genderCode?.toUpperCase()) {
    case 'M':
      return 'Male';
    case 'F':
      return 'Female';
    case 'X':
      return 'Unspecified';
    default:
      return genderCode || 'Unknown';
  }
}

/**
 * Format MRZ data for display (debugging/logging).
 */
export function formatMRZDataForDisplay(mrzData: MRZData): string {
  return `Doc#: ${mrzData.documentNumber}, DOB: ${mrzData.dateOfBirth}, Exp: ${mrzData.dateOfExpiry}`;
}

/**
 * Clean and normalize a potential MRZ line.
 * Corrects common OCR mistakes with MRZ fonts (OCR-B).
 */
function normalizeMRZLine(line: string): string {
  let result = line
    .trim()
    .toUpperCase()
    .replace(/\s/g, ''); // Remove spaces

  // Common OCR mistakes for the < character (MRZ filler)
  // The < character in OCR-B font is often misread as various characters
  result = result
    .replace(/[«»‹›]/g, '<')
    .replace(/\(/g, '<')
    .replace(/\)/g, '<')
    .replace(/\{/g, '<')
    .replace(/\}/g, '<')
    .replace(/\[/g, '<')
    .replace(/\]/g, '<')
    .replace(/\|/g, '<')
    .replace(/!/g, '<')
    .replace(/£/g, '<')
    .replace(/€/g, '<')
    .replace(/¢/g, '<')
    .replace(/`/g, '<')
    .replace(/'/g, '<')
    .replace(/"/g, '<')
    .replace(/~/g, '<')
    .replace(/\^/g, '<')
    .replace(/_/g, '<')
    .replace(/\*/g, '<');

  // K is often misread < in OCR, but only in filler contexts
  // Replace K only when adjacent to < or in sequences (not in names)
  result = result
    .replace(/K(?=<)/g, '<')  // K followed by <
    .replace(/(?<=<)K/g, '<') // K preceded by <
    .replace(/^P[K<](?=[A-Z]{3})/g, 'P<'); // Fix P< at start of passport line

  // In sequences of special chars, normalize to <
  result = result.replace(/[^A-Z0-9]{2,}/g, (match) => '<'.repeat(match.length));

  // Common letter/number confusions in MRZ OCR-B font
  result = result
    .replace(/O(?=[A-Z<])/g, '0') // O before letter is likely 0
    .replace(/(?<=[0-9])O/g, '0') // O after digit is likely 0
    .replace(/O(?=[0-9])/g, '0') // O before digit is likely 0 (e.g., ABO12345 -> AB012345)
    .replace(/l/g, '1') // lowercase l to 1
    .replace(/I(?=[0-9])/g, '1') // I before digit is likely 1
    .replace(/(?<=[0-9])I/g, '1') // I after digit is likely 1
    .replace(/S(?=[0-9])/g, '5') // S before digit might be 5
    .replace(/B(?=[0-9])/g, '8') // B before digit might be 8
    .replace(/Z(?=[0-9])/g, '2') // Z before digit might be 2
    .replace(/G(?=[0-9])/g, '6'); // G before digit might be 6

  // Fix sex field OCR errors: W and N are common misreads of M
  // Pattern: nationality (3 letters) + DOB (6 digits) + sex (should be M/F/<)
  // e.g., CAN900101W -> CAN900101M
  result = result.replace(/([A-Z]{3}\d{6})[WN](\d{6})/g, '$1M$2');

  // Remove any remaining non-MRZ characters
  result = result.replace(/[^A-Z0-9<]/g, '');

  return result;
}

/**
 * Check if a line looks like an MRZ line (has MRZ characteristics).
 */
function looksLikeMRZ(line: string): boolean {
  // MRZ lines have these characteristics:
  // - Only uppercase letters, digits, and <
  // - Multiple < characters (fillers)
  // - Start with specific patterns (P< for passport line 1, or alphanumeric for line 2)

  // Must be at least 25 chars (allow some tolerance for partial scans)
  if (line.length < 25) return false;

  // Must only contain valid MRZ characters
  const mrzPattern = /^[A-Z0-9<]+$/;
  if (!mrzPattern.test(line)) return false;

  // Must have at least some < characters (MRZ filler)
  const chevronCount = (line.match(/</g) || []).length;
  if (chevronCount < 2) return false;

  // Additional check: MRZ lines have high density of < at certain positions
  // or have specific patterns like P< at start
  const hasPassportStart = line.startsWith('P<');
  const hasIdCardStart = /^[A-Z]{2}/.test(line);
  const hasChevronSequence = /<<</.test(line);
  const hasDocNumberPattern = /^[A-Z0-9]{9}/.test(line);

  return hasPassportStart || hasChevronSequence || (hasIdCardStart && hasDocNumberPattern);
}

/**
 * Extract MRZ lines from OCR text.
 * MRZ lines are 44 characters for TD3 (passport) or 30 characters for TD1 (ID card).
 * They contain only uppercase letters, digits, and < characters.
 */
export function extractMRZFromText(ocrText: string): string[] | null {
  // Split text into lines and normalize each
  const rawLines = ocrText.split(/[\n\r]+/);

  console.log('[MRZScanner] Processing', rawLines.length, 'lines from OCR');

  const candidates: { line: string; score: number; rawLength: number }[] = [];

  // First pass: look for direct MRZ line matches
  for (const rawLine of rawLines) {
    const normalized = normalizeMRZLine(rawLine);

    // Skip very short lines
    if (normalized.length < 20) continue;

    // Log longer lines for debugging
    if (normalized.length >= 25) {
      console.log('[MRZScanner] Potential line:', normalized.substring(0, 30), '... len:', normalized.length);
    }

    // Check if it looks like MRZ
    if (looksLikeMRZ(normalized)) {
      // Score based on how "MRZ-like" it is
      let score = 0;

      // Prefer lines closer to 44 chars (TD3) or 30 chars (TD1)
      if (normalized.length >= 42 && normalized.length <= 46) score += 10;
      else if (normalized.length >= 28 && normalized.length <= 32) score += 8;

      // Bonus for starting with P< (passport first line)
      if (normalized.startsWith('P<')) score += 20;

      // Bonus for having lots of < at the end (common in MRZ)
      if (normalized.match(/<{3,}$/)) score += 5;

      // Bonus for having alphanumeric start (second line pattern)
      if (/^[A-Z0-9]{9}/.test(normalized)) score += 5;

      // Bonus for containing typical MRZ patterns
      if (/[A-Z]{3}\d{6}[MF<]/.test(normalized)) score += 10; // nationality + date + gender

      candidates.push({ line: normalized, score, rawLength: rawLine.length });
    }
  }

  // Second pass: try concatenating adjacent short lines (OCR sometimes splits MRZ)
  if (candidates.length < 2) {
    console.log('[MRZScanner] Trying to concatenate adjacent lines...');
    for (let i = 0; i < rawLines.length - 1; i++) {
      const combined = normalizeMRZLine(rawLines[i] + rawLines[i + 1]);
      if (combined.length >= 40 && combined.length <= 50 && looksLikeMRZ(combined)) {
        let score = 5; // Lower base score for concatenated lines
        if (combined.startsWith('P<')) score += 20;
        if (/^[A-Z0-9]{9}/.test(combined)) score += 5;
        candidates.push({ line: combined, score, rawLength: combined.length });
        console.log('[MRZScanner] Found concatenated candidate:', combined.substring(0, 25) + '...');
      }
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Log what we found for debugging
  if (candidates.length > 0) {
    console.log('[MRZScanner] Found', candidates.length, 'candidates:', candidates.slice(0, 4).map(c => ({
      line: c.line.substring(0, 25) + '...',
      len: c.line.length,
      score: c.score
    })));
  } else {
    // Log all longer lines for debugging when no candidates found
    const longerLines = rawLines
      .map(l => normalizeMRZLine(l))
      .filter(l => l.length >= 15)
      .slice(0, 5);
    console.log('[MRZScanner] No MRZ candidates. Longer normalized lines:', longerLines.map(l => ({
      text: l.substring(0, 30),
      len: l.length
    })));
  }

  // TD3 passport has 2 lines of 44 characters
  const td3Lines = candidates.filter((c) => c.line.length >= 40 && c.line.length <= 48);
  if (td3Lines.length >= 2) {
    console.log('[MRZScanner] Using TD3 format (2 lines)');
    // Normalize to exactly 44 chars
    return td3Lines.slice(0, 2).map(c => {
      let line = c.line;
      if (line.length < 44) line = line + '<'.repeat(44 - line.length);
      if (line.length > 44) line = line.substring(0, 44);
      return line;
    });
  }

  // TD1 ID card has 3 lines of 30 characters
  const td1Lines = candidates.filter((c) => c.line.length >= 26 && c.line.length <= 34);
  if (td1Lines.length >= 3) {
    console.log('[MRZScanner] Using TD1 format (3 lines)');
    return td1Lines.slice(0, 3).map(c => {
      let line = c.line;
      if (line.length < 30) line = line + '<'.repeat(30 - line.length);
      if (line.length > 30) line = line.substring(0, 30);
      return line;
    });
  }

  // Try any 2 candidates that look reasonable - normalize to TD3 (44 chars)
  if (candidates.length >= 2) {
    console.log('[MRZScanner] Trying best 2 candidates (normalizing to TD3)');
    return candidates.slice(0, 2).map(c => {
      let line = c.line;
      // Normalize to 44 chars (TD3 passport format)
      if (line.length < 44) line = line + '<'.repeat(44 - line.length);
      if (line.length > 44) line = line.substring(0, 44);
      return line;
    });
  }

  // If we have 1 candidate that looks like the first MRZ line (P<...)
  // we might have partial data - still report it for debugging
  if (candidates.length === 1 && candidates[0].line.startsWith('P<')) {
    console.log('[MRZScanner] Found only first MRZ line, need to scan more');
  }

  console.log('[MRZScanner] Could not find valid MRZ lines in OCR text');
  return null;
}

/**
 * Attempt to parse MRZ from OCR text result.
 * Returns parsed MRZ data if successful, null otherwise.
 */
export function parseMRZFromOCR(ocrText: string): ParsedMRZ | null {
  const mrzLines = extractMRZFromText(ocrText);
  if (!mrzLines) {
    return null;
  }

  return parseMRZLines(mrzLines);
}
