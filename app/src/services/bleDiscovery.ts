/**
 * BLE Discovery Service
 *
 * Handles Bluetooth Low Energy proximity discovery for P2P transfers.
 * Uses iBeacon format with Major/Minor for token encoding.
 */

import { BleManager, State, Device, BleError } from '@sfourdrinier/react-native-ble-plx';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// mwsim's unique iBeacon UUID (used to identify our app's beacons)
export const MWSIM_BEACON_UUID = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

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

export interface DiscoveredBeacon {
  token: string;        // 8-char hex token
  major: number;
  minor: number;
  rssi: number;         // Signal strength (negative dBm)
  distance: number;     // Estimated distance in meters
  deviceId: string;     // BLE device identifier
  timestamp: number;    // Discovery timestamp
}

export interface NearbyUser {
  userId: string;
  bsimId: string;
  displayName: string;
  profileImageUrl?: string;
  initialsColor?: string;
  isMerchant: boolean;
  merchantLogoUrl?: string;
  merchantName?: string;
  merchantCategory?: string;
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
// Placeholder functions for backend integration
// These will be implemented once TransferSim's Discovery Service is ready
// ============================================================================

/**
 * Register as a discoverable user (get beacon token from backend)
 * Placeholder - requires TransferSim Discovery Service
 */
export async function registerForDiscovery(
  _context: 'P2P_SEND' | 'P2P_RECEIVE' | 'MERCHANT_RECEIVE'
): Promise<{ token: string; major: number; minor: number; expiresAt: number } | null> {
  console.warn('[BLE] registerForDiscovery: Not yet implemented - waiting for TransferSim Discovery Service');
  return null;
}

/**
 * Start advertising our beacon
 * Placeholder - requires backend token first
 */
export async function startAdvertising(
  _token: string,
  _major: number,
  _minor: number
): Promise<boolean> {
  console.warn('[BLE] startAdvertising: Not yet implemented');
  return false;
}

/**
 * Stop advertising
 */
export async function stopAdvertising(): Promise<void> {
  console.warn('[BLE] stopAdvertising: Not yet implemented');
}

/**
 * Lookup a discovered beacon token to get user info
 * Placeholder - requires TransferSim Discovery Service
 */
export async function lookupBeaconToken(
  _token: string
): Promise<NearbyUser | null> {
  console.warn('[BLE] lookupBeaconToken: Not yet implemented - waiting for TransferSim Discovery Service');
  return null;
}
