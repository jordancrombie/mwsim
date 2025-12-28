/**
 * Environment configuration service.
 *
 * Reads the environment setting from iOS Settings.bundle and provides
 * the appropriate API URLs for Development or Production environments.
 *
 * Users can switch environments in iOS Settings > mwsim > Server
 *
 * Note: Settings.bundle defaults are registered in AppDelegate via withSettingsDefaults plugin.
 */
import { NativeModules, Platform, Settings } from 'react-native';

export type Environment = 'development' | 'production';

interface EnvironmentConfig {
  apiUrl: string;
  authUrl: string;
  transferSimUrl: string;
  name: string;
}

const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  development: {
    apiUrl: 'https://wsim-dev.banksim.ca/api',
    authUrl: 'https://wsim-auth-dev.banksim.ca',
    transferSimUrl: 'https://transfersim-dev.banksim.ca',
    name: 'Development',
  },
  production: {
    apiUrl: 'https://wsim.banksim.ca/api',
    authUrl: 'https://wsim-auth.banksim.ca',
    transferSimUrl: 'https://transfer.banksim.ca',
    name: 'Production',
  },
};

// Cache the environment to avoid repeated native calls
let cachedEnvironment: Environment | null = null;

/**
 * Reads a value from iOS UserDefaults (where Settings.bundle values are stored).
 * Defaults are registered in AppDelegate via withSettingsDefaults plugin.
 */
function getSettingsValue(key: string): string | null {
  if (Platform.OS !== 'ios') {
    console.log('[Environment] Not iOS, returning null');
    return null;
  }

  try {
    // Method 1: Try React Native's Settings.get() API
    const settingsValue = Settings.get(key);
    console.log(`[Environment] Settings.get("${key}"):`, settingsValue, `(type: ${typeof settingsValue})`);

    if (settingsValue !== null && settingsValue !== undefined) {
      return String(settingsValue);
    }

    // Method 2: Fallback to NativeModules.SettingsManager (snapshot at startup)
    const { SettingsManager } = NativeModules;
    console.log('[Environment] SettingsManager exists:', !!SettingsManager);
    console.log('[Environment] SettingsManager.settings exists:', !!(SettingsManager?.settings));

    if (SettingsManager && SettingsManager.settings) {
      const value = SettingsManager.settings[key];
      console.log(`[Environment] SettingsManager value for "${key}":`, value, `(type: ${typeof value})`);
      return value ?? null;
    }
  } catch (error) {
    console.log('[Environment] Error reading settings:', error);
  }

  return null;
}

/**
 * Gets the current environment from iOS Settings.
 * Falls back to 'production' if not set or on non-iOS platforms.
 */
export function getEnvironment(): Environment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const settings = getSettingsValue('environment');
  if (settings === 'production' || settings === 'development') {
    cachedEnvironment = settings;
    console.log('[Environment] Loaded from iOS Settings:', settings);
    return settings;
  }

  // Default to production (dev URL doesn't exist yet)
  cachedEnvironment = 'production';
  console.log('[Environment] Using default:', cachedEnvironment);
  return cachedEnvironment;
}

/**
 * Gets the configuration for the current environment.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = getEnvironment();
  return ENVIRONMENTS[env];
}

/**
 * Gets the API URL for the current environment.
 */
export function getApiUrl(): string {
  return getEnvironmentConfig().apiUrl;
}

/**
 * Gets the Auth URL for the current environment.
 */
export function getAuthUrl(): string {
  return getEnvironmentConfig().authUrl;
}

/**
 * Gets the TransferSim URL for the current environment.
 */
export function getTransferSimUrl(): string {
  return getEnvironmentConfig().transferSimUrl;
}

/**
 * Gets the display name for the current environment.
 */
export function getEnvironmentName(): string {
  return getEnvironmentConfig().name;
}

/**
 * Clears the cached environment.
 * Call this if you need to re-read the setting (e.g., after app foreground).
 */
export function clearEnvironmentCache(): void {
  cachedEnvironment = null;
  console.log('[Environment] Cache cleared');
}

/**
 * Checks if the current environment is production.
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Checks if the current environment is development.
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Gets debug information about environment settings.
 * Useful for troubleshooting Settings.bundle issues.
 */
export function getEnvironmentDebugInfo(): string {
  if (Platform.OS !== 'ios') {
    return 'Not iOS - Settings.bundle not available';
  }

  const lines: string[] = [];

  try {
    // Try Settings.get()
    const settingsValue = Settings.get('environment');
    lines.push(`Settings.get: ${JSON.stringify(settingsValue)}`);

    // Try SettingsManager
    const { SettingsManager } = NativeModules;
    lines.push(`SettingsManager: ${!!SettingsManager}`);
    lines.push(`settings obj: ${!!(SettingsManager?.settings)}`);

    if (SettingsManager?.settings) {
      lines.push(`env value: ${JSON.stringify(SettingsManager.settings.environment)}`);
    }

    lines.push(`Cached: ${cachedEnvironment}`);
    lines.push(`Active: ${getEnvironment()}`);
  } catch (error: any) {
    lines.push(`Error: ${error.message}`);
  }

  return lines.join('\n');
}
