/**
 * BLE Discovery Service
 *
 * Handles Bluetooth Low Energy proximity discovery for P2P transfers.
 * Uses service UUID encoding for cross-platform compatibility.
 *
 * - Advertising (peripheral mode):
 *   - iOS: Native BleGattAdvertise module (standard GATT advertising)
 *   - Android: react-native-ble-advertise (iBeacon format)
 * - Scanning (central mode): react-native-ble-plx
 */

import { BleManager, State, Device, BleError } from '@sfourdrinier/react-native-ble-plx';
import BleAdvertise from 'react-native-ble-advertise';
import { Platform, PermissionsAndroid, Alert, Linking, NativeModules } from 'react-native';

// Native module for iOS GATT advertising (standard BLE, not iBeacon)
const { BleGattAdvertise } = NativeModules;
import axios, { AxiosInstance } from 'axios';
import { Buffer } from 'buffer';
import { secureStorage } from './secureStorage';
import { getTransferSimUrl } from './environment';
import type { AliasType, MerchantCategory } from '../types';

// Apple's company ID for iBeacon format (Android only - iOS blocks this)
const APPLE_COMPANY_ID = 0x004c;

// mwsim's unique iBeacon UUID (used to identify our app's beacons)
export const MWSIM_BEACON_UUID = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

// mwsim's base service UUID for proximity discovery
// Format: E2C56DB5-DFFB-{MAJOR}-{MINOR}-D0F5A71096E0
// This works on iOS (which blocks iBeacon advertising) by encoding token in service UUID
export const MWSIM_SERVICE_UUID_PREFIX = 'E2C56DB5-DFFB-';
export const MWSIM_SERVICE_UUID_SUFFIX = '-D0F5A71096E0';

// ============================================================================
// TransferSim Discovery API Client
// ============================================================================

// TransferSim API key (same as transferSim.ts)
const TRANSFERSIM_API_KEY = 'tsim_1c34f53eabdeb18474b87ec27b093d5c481ff08a0b5e07267dcaf183d1ee52af';

// Lazy-initialized Discovery API client
let _discoveryClient: AxiosInstance | null = null;

function getDiscoveryClient(): AxiosInstance {
  if (_discoveryClient) {
    return _discoveryClient;
  }

  const baseURL = getTransferSimUrl();
  console.log(`[BLE Discovery] Initializing client: ${baseURL}`);

  const client = axios.create({
    baseURL,
    timeout: 10000, // Shorter timeout for discovery calls
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': TRANSFERSIM_API_KEY,
    },
  });

  // Request interceptor - add user authorization
  client.interceptors.request.use(async (requestConfig) => {
    const userContext = await secureStorage.getP2PUserContext();
    if (userContext) {
      requestConfig.headers.Authorization = `Bearer ${userContext.userId}:${userContext.bsimId}`;
    }
    return requestConfig;
  });

  // Response interceptor - log errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      console.log('[BLE Discovery] API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );

  _discoveryClient = client;
  return client;
}

// ============================================================================
// Singleton BleManager
// ============================================================================

// Singleton BleManager instance
let bleManager: BleManager | null = null;

/**
 * Get or create the BLE manager singleton
 */
export function getBleManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

/**
 * Destroy the BLE manager (call on app unmount)
 */
export function destroyBleManager(): void {
  if (bleManager) {
    bleManager.destroy();
    bleManager = null;
  }
}

/**
 * Check if Bluetooth is supported and powered on
 */
export async function checkBluetoothState(): Promise<{ supported: boolean; enabled: boolean; state: State }> {
  const manager = getBleManager();
  const state = await manager.state();

  return {
    supported: state !== State.Unsupported,
    enabled: state === State.PoweredOn,
    state,
  };
}

/**
 * Wait for Bluetooth to be powered on
 * Returns true if Bluetooth is ready, false if timed out or unsupported
 */
export function waitForBluetoothReady(timeoutMs: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const manager = getBleManager();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        resolve(false);
      }
    }, timeoutMs);

    const subscription = manager.onStateChange((state) => {
      if (state === State.PoweredOn && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        subscription.remove();
        resolve(true);
      } else if (state === State.Unsupported && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        subscription.remove();
        resolve(false);
      }
    }, true);
  });
}

/**
 * Request Bluetooth permissions for Android
 * iOS permissions are handled automatically via infoPlist
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS permissions are requested automatically when using BLE
    // Check initial state
    const { supported } = await checkBluetoothState();

    if (!supported) {
      Alert.alert(
        'Bluetooth Not Supported',
        'This device does not support Bluetooth Low Energy.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Wait for Bluetooth to be ready (handles permission grant delay)
    // This gives time for the system to process the permission and enable BLE
    const isReady = await waitForBluetoothReady(5000);

    if (!isReady) {
      // Check why it's not ready
      const { enabled, state } = await checkBluetoothState();

      if (!enabled) {
        // Only show alert if Bluetooth is actually off (not just waiting for permission)
        if (state === State.PoweredOff) {
          Alert.alert(
            'Bluetooth Required',
            'Please enable Bluetooth in Settings to discover nearby users.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openURL('App-Prefs:Bluetooth') },
            ]
          );
          return false;
        } else if (state === State.Unauthorized) {
          Alert.alert(
            'Bluetooth Permission Required',
            'Please allow Bluetooth access in Settings to discover nearby users.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
            ]
          );
          return false;
        }
        // For other states (Resetting, Unknown), return false but don't show alert
        console.log('[BLE] Bluetooth not ready, state:', state);
        return false;
      }
    }

    return true;
  }

  // Android 12+ requires BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT
  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version;

    if (typeof apiLevel === 'number' && apiLevel >= 31) {
      // Android 12+ (API 31+)
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(results).every(
        (result) => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        Alert.alert(
          'Bluetooth Permissions Required',
          'mwsim needs Bluetooth permissions to discover nearby users for transfers. Please grant permissions in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      return true;
    } else {
      // Android 11 and below
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'mwsim needs location permission to scan for nearby Bluetooth devices.',
          buttonPositive: 'Grant',
          buttonNegative: 'Cancel',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  return false;
}

/**
 * Initialize BLE and request permissions
 * Call this before using any BLE features
 */
export async function initializeBle(): Promise<boolean> {
  try {
    // First request permissions
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      return false;
    }

    // Wait for Bluetooth to be ready
    const isReady = await waitForBluetoothReady();
    if (!isReady) {
      const { state } = await checkBluetoothState();

      if (state === State.PoweredOff) {
        Alert.alert(
          'Bluetooth is Off',
          'Please turn on Bluetooth to discover nearby users.',
          [{ text: 'OK' }]
        );
      } else if (state === State.Unauthorized) {
        Alert.alert(
          'Bluetooth Permission Denied',
          'Please allow Bluetooth access in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }},
          ]
        );
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('[BLE] Initialization error:', error);
    return false;
  }
}

// ============================================================================
// Beacon Token Utilities
// ============================================================================

/**
 * Parse a 32-bit beacon token into Major (16-bit) and Minor (16-bit) values
 */
export function tokenToMajorMinor(token: number): { major: number; minor: number } {
  // Token is 32-bit: upper 16 bits = major, lower 16 bits = minor
  const major = (token >> 16) & 0xFFFF;
  const minor = token & 0xFFFF;
  return { major, minor };
}

/**
 * Combine Major and Minor values back into a 32-bit token
 * Uses >>> 0 to ensure unsigned 32-bit integer (JavaScript bitwise ops are signed)
 */
export function majorMinorToToken(major: number, minor: number): number {
  return (((major & 0xFFFF) << 16) | (minor & 0xFFFF)) >>> 0;
}

/**
 * Convert token number to 8-character hex string (as stored in backend)
 */
export function tokenToHex(token: number): string {
  return token.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Convert 8-character hex string to token number
 */
export function hexToToken(hex: string): number {
  return parseInt(hex, 16);
}

/**
 * Create a service UUID that encodes major/minor values
 * This allows iOS devices to advertise our beacon token via service UUIDs
 * (since iOS blocks third-party iBeacon/manufacturer data advertising)
 *
 * Format: E2C56DB5-DFFB-{MAJOR}-{MINOR}-D0F5A71096E0
 */
export function createServiceUuidWithToken(major: number, minor: number): string {
  const majorHex = major.toString(16).toUpperCase().padStart(4, '0');
  const minorHex = minor.toString(16).toUpperCase().padStart(4, '0');
  return `${MWSIM_SERVICE_UUID_PREFIX}${majorHex}-${minorHex}${MWSIM_SERVICE_UUID_SUFFIX}`;
}

/**
 * Check if a UUID matches our service UUID pattern
 */
export function isMwsimServiceUuid(uuid: string): boolean {
  const normalized = uuid.toUpperCase();
  return normalized.startsWith(MWSIM_SERVICE_UUID_PREFIX) &&
         normalized.endsWith(MWSIM_SERVICE_UUID_SUFFIX);
}

/**
 * Parse major/minor from a service UUID
 * Returns null if the UUID doesn't match our format
 */
export function parseTokenFromServiceUuid(uuid: string): { major: number; minor: number; token: string } | null {
  const normalized = uuid.toUpperCase();

  if (!isMwsimServiceUuid(normalized)) {
    return null;
  }

  // Extract the middle part: XXXX-YYYY
  const middlePart = normalized
    .replace(MWSIM_SERVICE_UUID_PREFIX, '')
    .replace(MWSIM_SERVICE_UUID_SUFFIX, '');

  const parts = middlePart.split('-');
  if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 4) {
    return null;
  }

  const major = parseInt(parts[0], 16);
  const minor = parseInt(parts[1], 16);

  if (isNaN(major) || isNaN(minor)) {
    return null;
  }

  const tokenValue = majorMinorToToken(major, minor);
  const token = tokenToHex(tokenValue);

  return { major, minor, token };
}

// ============================================================================
// Types
// ============================================================================

export type DiscoveryContext = 'P2P_RECEIVE' | 'MERCHANT_RECEIVE';

/** Response from beacon registration */
export interface BeaconRegistration {
  beaconToken: string;  // 8-char hex token
  major: number;
  minor: number;
  expiresAt: string;    // ISO timestamp
  ttlSeconds: number;
}

/** Discovered beacon from BLE scanning */
export interface DiscoveredBeacon {
  token: string;        // 8-char hex token
  major: number;
  minor: number;
  rssi: number;         // Signal strength (negative dBm)
  distance: number;     // Estimated distance in meters
  deviceId: string;     // BLE device identifier
  timestamp: number;    // Discovery timestamp
}

/** Recipient info from beacon lookup */
export interface BeaconRecipient {
  displayName: string;
  bankName?: string;
  profileImageUrl?: string;
  initialsColor?: string;
  isMerchant?: boolean;
  merchantLogoUrl?: string;
  merchantName?: string;
  merchantCategory?: MerchantCategory;
  recipientAlias?: string;
  aliasType?: AliasType;
}

/** Single token lookup result */
export interface BeaconLookupResult {
  token: string;
  found: boolean;
  context?: DiscoveryContext;
  recipient?: BeaconRecipient;
  metadata?: {
    amount?: number;
    description?: string;
  };
}

/** Batch lookup response */
export interface BeaconLookupResponse {
  results: BeaconLookupResult[];
  rateLimitRemaining?: number;
  rateLimitReset?: string;
}

/** Nearby user (beacon + resolved info) for UI display */
export interface NearbyUser {
  token: string;
  displayName: string;
  bankName?: string;
  profileImageUrl?: string;
  initialsColor?: string;
  isMerchant: boolean;
  merchantLogoUrl?: string;
  merchantName?: string;
  merchantCategory?: MerchantCategory;
  recipientAlias?: string;
  aliasType?: AliasType;
  context: DiscoveryContext;
  metadata?: {
    amount?: number;
    description?: string;
  };
  rssi: number;
  distance: number;
  lastSeen: number;
}

// ============================================================================
// RSSI to Distance Estimation
// ============================================================================

// Calibration constant: RSSI at 1 meter (typical for iBeacon)
const RSSI_AT_1M = -59;

// Path loss exponent (2.0 for free space, 2.7-4.3 for indoor environments)
const PATH_LOSS_EXPONENT = 2.5;

/**
 * Estimate distance from RSSI using log-distance path loss model
 */
export function estimateDistance(rssi: number): number {
  if (rssi >= 0) return 0;

  const ratio = (RSSI_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT);
  const distance = Math.pow(10, ratio);

  // Round to 1 decimal place
  return Math.round(distance * 10) / 10;
}

/**
 * Get a human-readable proximity description
 */
export function getProximityDescription(distance: number): string {
  if (distance <= 0.5) return 'Very close';
  if (distance <= 1.5) return 'Nearby';
  if (distance <= 3) return 'In range';
  if (distance <= 5) return 'Further away';
  return 'At edge of range';
}

// ============================================================================
// Discovery Service API
// ============================================================================

/**
 * Register as a discoverable user (get beacon token from backend)
 *
 * POST /api/v1/discovery/beacon/register
 */
export async function registerForDiscovery(
  context: DiscoveryContext,
  options?: {
    expiresIn?: number;  // TTL in seconds (default 300, max 600)
    amount?: number;
    description?: string;
  }
): Promise<BeaconRegistration | null> {
  try {
    console.log('[BLE Discovery] Registering beacon:', { context, options });

    const { data } = await getDiscoveryClient().post<BeaconRegistration>(
      '/api/v1/discovery/beacon/register',
      {
        context,
        expiresIn: options?.expiresIn ?? 300,
        metadata: options?.amount || options?.description
          ? { amount: options.amount, description: options.description }
          : undefined,
      }
    );

    console.log('[BLE Discovery] Registered beacon:', {
      token: data.beaconToken,
      major: data.major,
      minor: data.minor,
      expiresAt: data.expiresAt,
    });

    return data;
  } catch (error: any) {
    console.error('[BLE Discovery] Registration failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Lookup multiple beacon tokens (batch)
 *
 * POST /api/v1/discovery/beacon/lookup
 */
export async function lookupBeaconTokens(
  tokens: string[],
  options?: {
    minRssi?: number;
  }
): Promise<BeaconLookupResponse | null> {
  if (tokens.length === 0) {
    return { results: [] };
  }

  // Limit to 20 tokens per request (rate limit)
  const batchTokens = tokens.slice(0, 20);

  try {
    console.log('[BLE Discovery] Looking up tokens:', batchTokens.length);

    const { data } = await getDiscoveryClient().post<BeaconLookupResponse>(
      '/api/v1/discovery/beacon/lookup',
      {
        tokens: batchTokens,
        rssiFilter: options?.minRssi ? { minRssi: options.minRssi } : undefined,
      }
    );

    console.log('[BLE Discovery] Lookup results:', {
      found: data.results.filter(r => r.found).length,
      total: data.results.length,
      rateLimitRemaining: data.rateLimitRemaining,
    });

    return data;
  } catch (error: any) {
    console.error('[BLE Discovery] Lookup failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * List all active beacons (server-side fallback when BLE advertising isn't available)
 *
 * GET /api/v1/discovery/beacon/active
 *
 * This is a fallback for demo/development since iOS doesn't allow third-party
 * iBeacon advertising. Returns all currently active P2P_RECEIVE beacons.
 */
export async function listActiveBeacons(
  context?: DiscoveryContext
): Promise<NearbyUser[]> {
  try {
    console.log('[BLE Discovery] Fetching active beacons from server...');

    const params: Record<string, string> = {};
    if (context) {
      params.context = context;
    }

    const { data } = await getDiscoveryClient().get<{
      beacons: Array<{
        token: string;
        context: DiscoveryContext;
        recipient: BeaconRecipient;
        metadata?: { amount?: number; description?: string };
        expiresAt: string;
      }>;
    }>('/api/v1/discovery/beacon/active', { params });

    console.log('[BLE Discovery] Found', data.beacons?.length || 0, 'active beacons');

    // Convert to NearbyUser format with simulated RSSI (since we don't have actual BLE)
    return (data.beacons || []).map((beacon) => ({
      token: beacon.token,
      displayName: beacon.recipient.displayName,
      bankName: beacon.recipient.bankName,
      profileImageUrl: beacon.recipient.profileImageUrl,
      initialsColor: beacon.recipient.initialsColor,
      isMerchant: beacon.recipient.isMerchant || false,
      merchantLogoUrl: beacon.recipient.merchantLogoUrl,
      merchantName: beacon.recipient.merchantName,
      merchantCategory: beacon.recipient.merchantCategory,
      recipientAlias: beacon.recipient.recipientAlias,
      aliasType: beacon.recipient.aliasType,
      context: beacon.context,
      metadata: beacon.metadata,
      rssi: -50, // Simulated "close" RSSI since we can't measure actual distance
      distance: 1.0, // Simulated 1 meter distance
      lastSeen: Date.now(),
    }));
  } catch (error: any) {
    // If endpoint doesn't exist, return empty (fallback gracefully)
    if (error.response?.status === 404) {
      console.log('[BLE Discovery] Active beacons endpoint not available');
      return [];
    }
    console.error('[BLE Discovery] Failed to list active beacons:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Deregister a beacon token (when stopping broadcast)
 *
 * DELETE /api/v1/discovery/beacon/{token}
 */
export async function deregisterBeacon(token: string): Promise<boolean> {
  try {
    console.log('[BLE Discovery] Deregistering beacon:', token);
    await getDiscoveryClient().delete(`/api/v1/discovery/beacon/${token}`);
    console.log('[BLE Discovery] Beacon deregistered');
    return true;
  } catch (error: any) {
    console.error('[BLE Discovery] Deregistration failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Convert beacon lookup results to NearbyUser objects for UI display
 */
export function beaconResultsToNearbyUsers(
  results: BeaconLookupResult[],
  beaconRssi: Map<string, { rssi: number; timestamp: number }>
): NearbyUser[] {
  return results
    .filter((r): r is BeaconLookupResult & { found: true; recipient: BeaconRecipient; context: DiscoveryContext } =>
      r.found && !!r.recipient && !!r.context
    )
    .map((result) => {
      const rssiData = beaconRssi.get(result.token) || { rssi: -70, timestamp: Date.now() };
      const distance = estimateDistance(rssiData.rssi);

      return {
        token: result.token,
        displayName: result.recipient.displayName,
        bankName: result.recipient.bankName,
        profileImageUrl: result.recipient.profileImageUrl,
        initialsColor: result.recipient.initialsColor,
        isMerchant: result.recipient.isMerchant || false,
        merchantLogoUrl: result.recipient.merchantLogoUrl,
        merchantName: result.recipient.merchantName,
        merchantCategory: result.recipient.merchantCategory,
        recipientAlias: result.recipient.recipientAlias,
        aliasType: result.recipient.aliasType,
        context: result.context,
        metadata: result.metadata,
        rssi: rssiData.rssi,
        distance,
        lastSeen: rssiData.timestamp,
      };
    })
    .sort((a, b) => b.rssi - a.rssi); // Sort by signal strength (closest first)
}

// ============================================================================
// BLE Advertising (Peripheral Mode) - using react-native-ble-advertise
// ============================================================================

// Current advertising state
let currentAdvertisingToken: string | null = null;
let isCurrentlyAdvertising = false;

/**
 * Request Android permissions for BLE advertising (API 31+)
 */
async function requestAndroidAdvertisePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // For Android 12+ (API 31+), we need BLUETOOTH_ADVERTISE
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        {
          title: 'Bluetooth Advertise Permission',
          message: 'mwsim needs Bluetooth advertising permission to let nearby users find you.',
          buttonPositive: 'OK',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[BLE Discovery] BLUETOOTH_ADVERTISE permission denied');
        return false;
      }
    }

    // Also need location permission for BLE
    const locationGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'mwsim needs location permission for Bluetooth discovery.',
        buttonPositive: 'OK',
      }
    );

    return locationGranted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.error('[BLE Discovery] Permission request error:', error);
    return false;
  }
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start advertising our beacon for proximity discovery
 *
 * Platform-specific implementations:
 * - iOS: Uses native BleGattAdvertise module for standard GATT advertising
 *        (iBeacon format is not scannable by other iOS devices via CoreBluetooth)
 * - Android: Uses react-native-ble-advertise with iBeacon format
 *
 * Dynamic UUID format: E2C56DB5-DFFB-{MAJOR}-{MINOR}-D0F5A71096E0
 */
export async function startAdvertising(
  registration: BeaconRegistration
): Promise<boolean> {
  // Create dynamic service UUID that encodes the token
  const dynamicServiceUuid = createServiceUuidWithToken(registration.major, registration.minor);

  // Create local name for identification
  const localName = `mwsim:${registration.beaconToken}`;

  console.log('[BLE Discovery] Starting BLE advertising:', {
    platform: Platform.OS,
    dynamicUuid: dynamicServiceUuid,
    localName,
    major: registration.major,
    minor: registration.minor,
    token: registration.beaconToken,
  });

  // Wait for Bluetooth to be ready (handles permission grant delay)
  console.log('[BLE Discovery] Waiting for Bluetooth to be ready...');
  const isReady = await waitForBluetoothReady(5000);
  if (!isReady) {
    const { state } = await checkBluetoothState();
    console.error('[BLE Discovery] Bluetooth not ready for advertising, state:', state);
    return false;
  }
  console.log('[BLE Discovery] Bluetooth is ready');

  // Platform-specific advertising
  if (Platform.OS === 'ios') {
    return startAdvertisingIOS(dynamicServiceUuid, localName, registration);
  } else {
    return startAdvertisingAndroid(dynamicServiceUuid, registration);
  }
}

/**
 * iOS advertising using native BleGattAdvertise module
 * Uses standard GATT advertising which is detectable via BLE scanning
 */
async function startAdvertisingIOS(
  serviceUuid: string,
  localName: string,
  registration: BeaconRegistration
): Promise<boolean> {
  console.log('[BLE Discovery] startAdvertisingIOS called');
  console.log('[BLE Discovery] BleGattAdvertise module:', BleGattAdvertise ? 'available' : 'NOT FOUND');

  if (!BleGattAdvertise) {
    console.error('[BLE Discovery] BleGattAdvertise native module not available');
    console.error('[BLE Discovery] Available NativeModules:', Object.keys(NativeModules));
    return false;
  }

  console.log('[BLE Discovery] BleGattAdvertise methods:', Object.keys(BleGattAdvertise));

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BLE Discovery] iOS GATT advertising attempt ${attempt}/${maxRetries}...`);
      console.log('[BLE Discovery] Calling startAdvertising with:', { serviceUuid, localName });

      const result = await BleGattAdvertise.startAdvertising(serviceUuid, localName);
      console.log('[BLE Discovery] startAdvertising returned:', result);

      currentAdvertisingToken = registration.beaconToken;
      isCurrentlyAdvertising = true;

      console.log('[BLE Discovery] iOS GATT advertising started successfully');
      return true;
    } catch (error: any) {
      console.warn(`[BLE Discovery] iOS advertising attempt ${attempt} failed:`, error);
      console.warn('[BLE Discovery] Error details:', {
        message: error.message,
        code: error.code,
        nativeStackIOS: error.nativeStackIOS,
      });

      if (attempt < maxRetries) {
        await delay(500);
      } else {
        console.error('[BLE Discovery] Failed to start iOS advertising after all retries:', error);
        isCurrentlyAdvertising = false;
        return false;
      }
    }
  }

  return false;
}

/**
 * Android advertising using react-native-ble-advertise (iBeacon format)
 */
async function startAdvertisingAndroid(
  serviceUuid: string,
  registration: BeaconRegistration
): Promise<boolean> {
  // Request permissions on Android
  const hasPermission = await requestAndroidAdvertisePermissions();
  if (!hasPermission) {
    console.error('[BLE Discovery] Missing Android permissions for advertising');
    return false;
  }

  // Set Apple's company ID for iBeacon format
  BleAdvertise.setCompanyId(APPLE_COMPANY_ID);

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BLE Discovery] Android iBeacon advertising attempt ${attempt}/${maxRetries}...`);

      await BleAdvertise.broadcast(
        serviceUuid,
        registration.major,
        registration.minor
      );

      currentAdvertisingToken = registration.beaconToken;
      isCurrentlyAdvertising = true;

      console.log('[BLE Discovery] Android iBeacon advertising started successfully');
      return true;
    } catch (error: any) {
      console.warn(`[BLE Discovery] Android advertising attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        await delay(500);
      } else {
        console.error('[BLE Discovery] Failed to start Android advertising after all retries:', error);
        isCurrentlyAdvertising = false;
        return false;
      }
    }
  }

  return false;
}

/**
 * Stop advertising
 */
export async function stopAdvertising(): Promise<void> {
  console.log('[BLE Discovery] Stopping advertising...');

  try {
    // Stop BLE broadcast (platform-specific)
    if (isCurrentlyAdvertising) {
      if (Platform.OS === 'ios' && BleGattAdvertise) {
        await BleGattAdvertise.stopAdvertising();
        console.log('[BLE Discovery] iOS GATT advertising stopped');
      } else {
        await BleAdvertise.stopBroadcast();
        console.log('[BLE Discovery] Android iBeacon advertising stopped');
      }
    }
  } catch (error) {
    console.warn('[BLE Discovery] Error stopping broadcast:', error);
  }

  // Deregister from backend
  if (currentAdvertisingToken) {
    await deregisterBeacon(currentAdvertisingToken);
  }

  currentAdvertisingToken = null;
  isCurrentlyAdvertising = false;
}

/**
 * Check if currently advertising
 */
export function isAdvertising(): boolean {
  return isCurrentlyAdvertising && currentAdvertisingToken !== null;
}

/**
 * Get current advertising token
 */
export function getCurrentAdvertisingToken(): string | null {
  return currentAdvertisingToken;
}

// ============================================================================
// BLE Scanning (Central Mode)
// ============================================================================

// Scanning state
let isScanning = false;
let scanSubscription: { remove: () => void } | null = null;
let discoveredBeacons: Map<string, DiscoveredBeacon> = new Map();

// Callbacks for scan results
type ScanCallback = (beacons: DiscoveredBeacon[]) => void;
let scanCallbacks: Set<ScanCallback> = new Set();

// Debounce timer for batch updates
let debounceTimer: NodeJS.Timeout | null = null;
const SCAN_DEBOUNCE_MS = 2000; // 2 second debounce per proposal

// Beacon timeout (remove beacons not seen recently)
const BEACON_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Extract beacon token from device service UUIDs (cross-platform)
 * This is the primary method that works on both iOS and Android
 */
function parseBeaconFromServiceUuids(device: Device): DiscoveredBeacon | null {
  if (!device.serviceUUIDs || device.serviceUUIDs.length === 0) {
    return null;
  }

  // Check each service UUID for our pattern
  for (const uuid of device.serviceUUIDs) {
    const parsed = parseTokenFromServiceUuid(uuid);
    if (parsed) {
      const rssi = device.rssi || -100;
      console.log('[BLE Discovery] Found mwsim service UUID:', uuid, '-> token:', parsed.token);

      return {
        token: parsed.token,
        major: parsed.major,
        minor: parsed.minor,
        rssi,
        distance: estimateDistance(rssi),
        deviceId: device.id,
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Extract beacon token from device manufacturer data (Android iBeacon fallback)
 * This only works on Android as iOS strips manufacturer data from third-party apps
 */
function parseBeaconFromManufacturerData(device: Device): DiscoveredBeacon | null {
  try {
    const manufacturerData = device.manufacturerData;
    if (!manufacturerData) {
      return null;
    }

    // Decode base64 manufacturer data
    const buffer = Buffer.from(manufacturerData, 'base64');

    // iBeacon format (after Apple company ID):
    // Byte 0: iBeacon type (0x02)
    // Byte 1: Data length (0x15 = 21)
    // Byte 2-17: UUID (16 bytes)
    // Byte 18-19: Major (big-endian)
    // Byte 20-21: Minor (big-endian)
    // Byte 22: TX Power (signed int8)

    if (buffer.length < 23) {
      return null;
    }

    // Check iBeacon type marker
    if (buffer[0] !== 0x02 || buffer[1] !== 0x15) {
      return null;
    }

    // Extract UUID and compare (check if it starts with our prefix)
    const uuidBytes = buffer.slice(2, 18);
    const uuid = [
      uuidBytes.slice(0, 4).toString('hex'),
      uuidBytes.slice(4, 6).toString('hex'),
      uuidBytes.slice(6, 8).toString('hex'),
      uuidBytes.slice(8, 10).toString('hex'),
      uuidBytes.slice(10, 16).toString('hex'),
    ].join('-').toUpperCase();

    // Check if it's our beacon UUID pattern
    if (!isMwsimServiceUuid(uuid)) {
      return null;
    }

    // Extract major and minor from iBeacon data
    const major = buffer.readUInt16BE(18);
    const minor = buffer.readUInt16BE(20);

    // Combine to get token
    const token = majorMinorToToken(major, minor);
    const tokenHex = tokenToHex(token);

    const rssi = device.rssi || -100;
    console.log('[BLE Discovery] Found iBeacon manufacturer data, token:', tokenHex);

    return {
      token: tokenHex,
      major,
      minor,
      rssi,
      distance: estimateDistance(rssi),
      deviceId: device.id,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[BLE Discovery] Failed to parse iBeacon data:', error);
    return null;
  }
}

/**
 * Extract beacon token from device local name (mwsim:TOKEN format)
 * This is a fallback for iOS-to-iOS discovery when service UUIDs aren't visible
 */
function parseBeaconFromLocalName(device: Device): DiscoveredBeacon | null {
  const deviceName = device.name || device.localName || '';

  // Check for mwsim local name pattern
  if (!deviceName.startsWith('mwsim:')) {
    return null;
  }

  // Extract token from name (format: mwsim:XXXXXXXX)
  const token = deviceName.substring(6).toUpperCase();

  // Validate token format (8 hex characters)
  if (!/^[0-9A-F]{8}$/.test(token)) {
    console.warn('[BLE Discovery] Invalid token in local name:', deviceName);
    return null;
  }

  // Parse major/minor from token
  const tokenValue = parseInt(token, 16);
  const { major, minor } = tokenToMajorMinor(tokenValue);

  const rssi = device.rssi || -100;
  console.log('[BLE Discovery] Found mwsim local name:', deviceName, '-> token:', token);

  return {
    token,
    major,
    minor,
    rssi,
    distance: estimateDistance(rssi),
    deviceId: device.id,
    timestamp: Date.now(),
  };
}

/**
 * Extract beacon token from device advertisement data
 * Tries multiple methods for cross-platform support:
 * 1. Service UUIDs (works on iOS and Android)
 * 2. Local name (mwsim:TOKEN format)
 * 3. Manufacturer data / iBeacon format (Android only)
 */
function parseBeaconFromDevice(device: Device): DiscoveredBeacon | null {
  // Try service UUID first (works cross-platform)
  const fromServiceUuid = parseBeaconFromServiceUuids(device);
  if (fromServiceUuid) {
    return fromServiceUuid;
  }

  // Try local name (mwsim:TOKEN format)
  const fromLocalName = parseBeaconFromLocalName(device);
  if (fromLocalName) {
    return fromLocalName;
  }

  // Fall back to manufacturer data (Android iBeacon)
  return parseBeaconFromManufacturerData(device);
}

/**
 * Clean up old beacons that haven't been seen recently
 */
function cleanupOldBeacons(): void {
  const now = Date.now();
  const toRemove: string[] = [];

  discoveredBeacons.forEach((beacon, token) => {
    if (now - beacon.timestamp > BEACON_TIMEOUT_MS) {
      toRemove.push(token);
    }
  });

  toRemove.forEach((token) => discoveredBeacons.delete(token));

  if (toRemove.length > 0) {
    console.log('[BLE Discovery] Cleaned up', toRemove.length, 'stale beacons');
  }
}

/**
 * Notify all registered callbacks with current beacon list
 */
function notifyCallbacks(): void {
  // Clean up old beacons first
  cleanupOldBeacons();

  const beacons = Array.from(discoveredBeacons.values());
  scanCallbacks.forEach((callback) => callback(beacons));
}

/**
 * Schedule a debounced callback notification
 * Note: Don't reset if timer already scheduled - ensures periodic updates
 * even with continuous beacon discoveries
 */
function scheduleCallbackNotification(): void {
  // If timer already scheduled, let it fire - don't reset
  // This ensures we get updates every SCAN_DEBOUNCE_MS even with continuous discoveries
  if (debounceTimer) {
    return;
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    notifyCallbacks();
  }, SCAN_DEBOUNCE_MS);
}

/**
 * Start scanning for nearby beacons
 *
 * @param onBeaconsFound - Callback when beacons are discovered (debounced)
 * @param options - Scan options
 */
export async function startScanning(
  onBeaconsFound: ScanCallback,
  options?: {
    minRssi?: number;  // Filter by minimum signal strength (default -80)
  }
): Promise<boolean> {
  try {
    const minRssi = options?.minRssi ?? -80;

    // Initialize BLE if needed
    const initialized = await initializeBle();
    if (!initialized) {
      console.error('[BLE Discovery] Cannot start scanning - BLE not initialized');
      return false;
    }

    // Add callback
    scanCallbacks.add(onBeaconsFound);

    // If already scanning, just register the callback
    if (isScanning) {
      console.log('[BLE Discovery] Already scanning, callback registered');
      return true;
    }

    console.log('[BLE Discovery] Starting beacon scan, minRssi:', minRssi);
    isScanning = true;
    discoveredBeacons.clear();

    const manager = getBleManager();

    // Debug: Track seen devices to avoid spamming logs
    const seenDevices = new Set<string>();

    // Start scanning for devices
    manager.startDeviceScan(
      null, // Scan for all devices (filter by manufacturer data)
      {
        allowDuplicates: true, // We want RSSI updates
      },
      (error, device) => {
        if (error) {
          console.error('[BLE Discovery] Scan error:', error);
          return;
        }

        if (!device) {
          return;
        }

        // Check RSSI threshold first (skip weak signals)
        if (device.rssi && device.rssi < minRssi) {
          return;
        }

        // Check if device has any data we can parse
        const hasServiceUuids = device.serviceUUIDs && device.serviceUUIDs.length > 0;
        const hasManufacturerData = !!device.manufacturerData;
        const deviceName = device.name || device.localName || '';

        // Check for mwsim local name pattern (fallback for iOS advertising)
        const isMwsimDevice = deviceName.startsWith('mwsim:');

        // Debug: Log new devices found (only once per device to avoid spam)
        if (!seenDevices.has(device.id)) {
          seenDevices.add(device.id);

          // Log ALL named devices to help debug what's visible
          if (deviceName) {
            console.log('[BLE Discovery] Device found:', {
              id: device.id,
              name: deviceName,
              rssi: device.rssi,
              hasManufacturerData,
              manufacturerDataLength: hasManufacturerData ? Buffer.from(device.manufacturerData!, 'base64').length : 0,
              serviceUUIDs: device.serviceUUIDs,
              isMwsimDevice,
            });
          }
        }

        // Skip devices with no parseable data (unless it's an mwsim device by name)
        if (!hasServiceUuids && !hasManufacturerData && !isMwsimDevice) {
          return;
        }

        // Try to parse as mwsim beacon (checks service UUIDs first, then manufacturer data)
        const beacon = parseBeaconFromDevice(device);
        if (beacon) {
          // Update or add beacon
          const existing = discoveredBeacons.get(beacon.token);
          if (existing) {
            // Update with new RSSI (could do averaging for stability)
            existing.rssi = beacon.rssi;
            existing.distance = beacon.distance;
            existing.timestamp = beacon.timestamp;
          } else {
            console.log('[BLE Discovery] New beacon found:', beacon.token, 'RSSI:', beacon.rssi);
            discoveredBeacons.set(beacon.token, beacon);
          }

          // Schedule debounced callback
          scheduleCallbackNotification();
        }
      }
    );

    // Store subscription reference (BleManager.startDeviceScan returns void, we track state separately)
    scanSubscription = {
      remove: () => {
        manager.stopDeviceScan();
      },
    };

    return true;
  } catch (error) {
    console.error('[BLE Discovery] Failed to start scanning:', error);
    isScanning = false;
    return false;
  }
}

/**
 * Stop scanning for beacons
 */
export function stopScanning(): void {
  console.log('[BLE Discovery] Stopping scan');

  if (scanSubscription) {
    scanSubscription.remove();
    scanSubscription = null;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  isScanning = false;
  scanCallbacks.clear();
  discoveredBeacons.clear();
}

/**
 * Remove a specific scan callback
 */
export function removeScanCallback(callback: ScanCallback): void {
  scanCallbacks.delete(callback);

  // If no more callbacks, stop scanning
  if (scanCallbacks.size === 0 && isScanning) {
    stopScanning();
  }
}

/**
 * Check if currently scanning
 */
export function isScanningActive(): boolean {
  return isScanning;
}

/**
 * Get currently discovered beacons
 */
export function getDiscoveredBeacons(): DiscoveredBeacon[] {
  cleanupOldBeacons();
  return Array.from(discoveredBeacons.values());
}

/**
 * Get RSSI map for batch lookup
 */
export function getBeaconRssiMap(): Map<string, { rssi: number; timestamp: number }> {
  const rssiMap = new Map<string, { rssi: number; timestamp: number }>();
  discoveredBeacons.forEach((beacon, token) => {
    rssiMap.set(token, { rssi: beacon.rssi, timestamp: beacon.timestamp });
  });
  return rssiMap;
}
