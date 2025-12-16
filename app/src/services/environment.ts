/**
 * Environment configuration service.
 *
 * Reads the environment setting from iOS Settings.bundle and provides
 * the appropriate API URLs for Development or Production environments.
 *
 * Users can switch environments in iOS Settings > mwsim > Server
 */
import { NativeModules, Platform } from 'react-native';

export type Environment = 'development' | 'production';

interface EnvironmentConfig {
  apiUrl: string;
  authUrl: string;
  name: string;
}

const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  development: {
    apiUrl: 'https://wsim-dev.banksim.ca/api',
    authUrl: 'https://wsim-auth-dev.banksim.ca',
    name: 'Development',
  },
  production: {
    apiUrl: 'https://wsim.banksim.ca/api',
    authUrl: 'https://wsim-auth.banksim.ca',
    name: 'Production',
  },
};

// Cache the environment to avoid repeated native calls
let cachedEnvironment: Environment | null = null;

/**
 * Reads a value from iOS UserDefaults (where Settings.bundle values are stored).
 * Uses React Native's Settings module on iOS.
 */
function getSettingsValue(key: string): string | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    // React Native's SettingsManager reads from NSUserDefaults
    const { SettingsManager } = NativeModules;
    if (SettingsManager && SettingsManager.settings) {
      const value = SettingsManager.settings[key];
      return value ?? null;
    }
  } catch (error) {
    console.log('[Environment] Error reading settings:', error);
  }

  return null;
}

/**
 * Gets the current environment from iOS Settings.
 * Falls back to 'development' if not set or on non-iOS platforms.
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

  // Default to development
  cachedEnvironment = 'development';
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
