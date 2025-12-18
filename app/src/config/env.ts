/**
 * Environment configuration.
 *
 * The API URLs are now determined by the iOS Settings toggle.
 * Users can switch between Development and Production in:
 * iOS Settings > mwsim > Server
 *
 * @see src/services/environment.ts
 */
import { getApiUrl, getAuthUrl, getEnvironmentName } from '../services/environment';

// Re-export environment functions for convenience
export { getEnvironment, getEnvironmentName, isProduction, isDevelopment, clearEnvironmentCache, getEnvironmentDebugInfo } from '../services/environment';

/**
 * Get the current configuration.
 * Note: This reads the environment setting, so values may change between app launches.
 */
export function getConfig() {
  return {
    // API URLs - determined by iOS Settings toggle
    apiUrl: getApiUrl(),
    authUrl: getAuthUrl(),
    environmentName: getEnvironmentName(),

    // App identification
    appName: 'mwsim',
    appVersion: '0.3.2',

    // Timeouts
    apiTimeout: 30000, // 30 seconds

    // Token refresh buffer (refresh when this many seconds left)
    tokenRefreshBuffer: 300, // 5 minutes before expiry
  };
}

// For backwards compatibility, export a config object
// Note: This captures the environment at import time
export const config = getConfig();

export type Config = ReturnType<typeof getConfig>;
