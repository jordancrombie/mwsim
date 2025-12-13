// Environment configuration
// In production, these would come from environment variables

export const config = {
  // API URLs - update these to match your wsim deployment
  apiUrl: __DEV__
    ? 'https://wsim-dev.banksim.ca/api'
    : 'https://wsim.banksim.ca/api',

  authUrl: __DEV__
    ? 'https://wsim-auth-dev.banksim.ca'
    : 'https://wsim-auth.banksim.ca',

  // App identification
  appName: 'mwsim',
  appVersion: '0.1.0',

  // Timeouts
  apiTimeout: 30000, // 30 seconds

  // Token refresh buffer (refresh when this many seconds left)
  tokenRefreshBuffer: 300, // 5 minutes before expiry
} as const;

export type Config = typeof config;
