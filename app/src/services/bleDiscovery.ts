/**
 * BLE Discovery Service
 *
 * Handles Bluetooth Low Energy proximity discovery for P2P transfers.
 * Uses iBeacon format with Major/Minor for token encoding.
 */

import { BleManager, State, Device, BleError } from '@sfourdrinier/react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import axios, { AxiosInstance } from 'axios';
import { Buffer } from 'buffer';
import { secureStorage } from './secureStorage';
import { getTransferSimUrl } from './environment';
import type { AliasType, MerchantCategory } from '../types';

// mwsim's unique iBeacon UUID (used to identify our app's beacons)
export const MWSIM_BEACON_UUID = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

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
    // Just need to ensure Bluetooth is enabled
    const { enabled, supported } = await checkBluetoothState();

    if (!supported) {
      Alert.alert(
        'Bluetooth Not Supported',
        'This device does not support Bluetooth Low Energy.',
        [{ text: 'OK' }]
      );
      return false;
    }

    if (!enabled) {
      Alert.alert(
        'Bluetooth Required',
        'Please enable Bluetooth in Settings to discover nearby users.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openURL('App-Prefs:Bluetooth') },
        ]
      );
      return false;
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
 */
export function majorMinorToToken(major: number, minor: number): number {
  return ((major & 0xFFFF) << 16) | (minor & 0xFFFF);
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
// BLE Advertising (Peripheral Mode)
// TODO: Implement actual iBeacon advertising
// ============================================================================

// Current advertising state
let currentAdvertisingToken: string | null = null;

/**
 * Start advertising our beacon
 * NOTE: iOS CoreBluetooth can advertise as peripheral but not as true iBeacon
 * from a third-party app. We'll use a service UUID + characteristics approach.
 */
export async function startAdvertising(
  registration: BeaconRegistration
): Promise<boolean> {
  try {
    console.log('[BLE Discovery] Starting advertising:', {
      token: registration.beaconToken,
      major: registration.major,
      minor: registration.minor,
    });

    // TODO: Implement actual BLE advertising using react-native-ble-plx
    // For now, just track the state
    currentAdvertisingToken = registration.beaconToken;

    console.warn('[BLE Discovery] Advertising not yet fully implemented - token registered but not broadcasting');
    return true;
  } catch (error) {
    console.error('[BLE Discovery] Failed to start advertising:', error);
    return false;
  }
}

/**
 * Stop advertising
 */
export async function stopAdvertising(): Promise<void> {
  if (currentAdvertisingToken) {
    console.log('[BLE Discovery] Stopping advertising:', currentAdvertisingToken);

    // Deregister from backend
    await deregisterBeacon(currentAdvertisingToken);

    // TODO: Stop actual BLE advertising
    currentAdvertisingToken = null;
  }
}

/**
 * Check if currently advertising
 */
export function isAdvertising(): boolean {
  return currentAdvertisingToken !== null;
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
 * Extract beacon token from device advertisement data
 * This parses iBeacon format to extract major/minor values
 */
function parseBeaconFromDevice(device: Device): DiscoveredBeacon | null {
  try {
    // Check if this is our beacon UUID
    const manufacturerData = device.manufacturerData;
    if (!manufacturerData) {
      return null;
    }

    // Decode base64 manufacturer data
    const buffer = Buffer.from(manufacturerData, 'base64');

    // iBeacon format (after Apple company ID):
    // Byte 0-1: Apple company ID (0x004C) - handled by BLE stack
    // Byte 2: iBeacon type (0x02)
    // Byte 3: Data length (0x15 = 21)
    // Byte 4-19: UUID (16 bytes)
    // Byte 20-21: Major (big-endian)
    // Byte 22-23: Minor (big-endian)
    // Byte 24: TX Power (signed int8)

    if (buffer.length < 25) {
      return null;
    }

    // Check iBeacon type marker
    if (buffer[0] !== 0x02 || buffer[1] !== 0x15) {
      return null;
    }

    // Extract UUID and compare
    const uuidBytes = buffer.slice(2, 18);
    const uuid = [
      uuidBytes.slice(0, 4).toString('hex'),
      uuidBytes.slice(4, 6).toString('hex'),
      uuidBytes.slice(6, 8).toString('hex'),
      uuidBytes.slice(8, 10).toString('hex'),
      uuidBytes.slice(10, 16).toString('hex'),
    ].join('-').toUpperCase();

    // Check if it's our beacon UUID
    if (uuid !== MWSIM_BEACON_UUID) {
      return null;
    }

    // Extract major and minor
    const major = buffer.readUInt16BE(18);
    const minor = buffer.readUInt16BE(20);

    // Combine to get token
    const token = majorMinorToToken(major, minor);
    const tokenHex = tokenToHex(token);

    const rssi = device.rssi || -100;

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
    console.error('[BLE Discovery] Failed to parse beacon:', error);
    return null;
  }
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
 */
function scheduleCallbackNotification(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
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

        if (!device || !device.manufacturerData) {
          return;
        }

        // Check RSSI threshold
        if (device.rssi && device.rssi < minRssi) {
          return;
        }

        // Try to parse as beacon
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
