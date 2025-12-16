/**
 * Environment configuration service.
 *
 * Reads the environment setting from iOS Settings.bundle and provides
 * the appropriate API URLs for Development or Production environments.
 *
 * Users can switch environments in iOS Settings > mwsim > Server
 */
import Settings from 'expo-settings';
import { Platform } from 'react-native';

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
 * Gets the current environment from iOS Settings.
 * Falls back to 'development' if not set or on non-iOS platforms.
 */
export function getEnvironment(): Environment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  if (Platform.OS === 'ios') {
    try {
      // expo-settings reads from NSUserDefaults which is where Settings.bundle values are stored
      const settings = Settings.get('environment');
      if (settings === 'production' || settings === 'development') {
        cachedEnvironment = settings;
        console.log('[Environment] Loaded from iOS Settings:', settings);
        return settings;
      }
    } catch (error) {
      console.log('[Environment] Error reading settings:', error);
    }
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
