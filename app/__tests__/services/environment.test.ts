/**
 * Environment Service Tests
 *
 * Tests for the environment configuration service that reads
 * settings from iOS Settings.bundle.
 */

// Mock react-native modules before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj: any) => obj.ios),
  },
  Settings: {
    get: jest.fn(),
  },
  NativeModules: {
    SettingsManager: {
      settings: {
        environment: 'production',
      },
    },
  },
}));

import { Settings } from 'react-native';

// Use require to import after mocking
const {
  getEnvironment,
  getEnvironmentConfig,
  getApiUrl,
  getAuthUrl,
  getEnvironmentName,
  clearEnvironmentCache,
  isProduction,
  isDevelopment,
} = require('../../src/services/environment');

describe('Environment Service', () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearEnvironmentCache();
    jest.clearAllMocks();
  });

  describe('getEnvironment', () => {
    it('should return production when Settings.get returns production', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(getEnvironment()).toBe('production');
    });

    it('should return development when Settings.get returns development', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(getEnvironment()).toBe('development');
    });

    it('should default to production when Settings.get returns null', () => {
      (Settings.get as jest.Mock).mockReturnValue(null);
      expect(getEnvironment()).toBe('production');
    });

    it('should cache the environment value', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');

      // First call
      expect(getEnvironment()).toBe('development');

      // Change the mock
      (Settings.get as jest.Mock).mockReturnValue('production');

      // Second call should still return cached value
      expect(getEnvironment()).toBe('development');
    });

    it('should re-read after cache is cleared', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(getEnvironment()).toBe('development');

      // Clear cache and change mock
      clearEnvironmentCache();
      (Settings.get as jest.Mock).mockReturnValue('production');

      // Should now return new value
      expect(getEnvironment()).toBe('production');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return production config', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe('https://wsim.banksim.ca/api');
      expect(config.authUrl).toBe('https://wsim-auth.banksim.ca');
      expect(config.name).toBe('Production');
    });

    it('should return development config', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      const config = getEnvironmentConfig();
      expect(config.apiUrl).toBe('https://wsim-dev.banksim.ca/api');
      expect(config.authUrl).toBe('https://wsim-auth-dev.banksim.ca');
      expect(config.name).toBe('Development');
    });
  });

  describe('getApiUrl', () => {
    it('should return production API URL', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(getApiUrl()).toBe('https://wsim.banksim.ca/api');
    });

    it('should return development API URL', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(getApiUrl()).toBe('https://wsim-dev.banksim.ca/api');
    });
  });

  describe('getAuthUrl', () => {
    it('should return production auth URL', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(getAuthUrl()).toBe('https://wsim-auth.banksim.ca');
    });

    it('should return development auth URL', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(getAuthUrl()).toBe('https://wsim-auth-dev.banksim.ca');
    });
  });

  describe('getEnvironmentName', () => {
    it('should return Production for production environment', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(getEnvironmentName()).toBe('Production');
    });

    it('should return Development for development environment', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(getEnvironmentName()).toBe('Development');
    });
  });

  describe('isProduction', () => {
    it('should return true for production', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(isProduction()).toBe(true);
    });

    it('should return false for development', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(isProduction()).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return true for development', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      expect(isDevelopment()).toBe(true);
    });

    it('should return false for production', () => {
      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('clearEnvironmentCache', () => {
    it('should clear the cached environment', () => {
      (Settings.get as jest.Mock).mockReturnValue('development');
      getEnvironment(); // Cache it

      clearEnvironmentCache();

      (Settings.get as jest.Mock).mockReturnValue('production');
      expect(getEnvironment()).toBe('production');
    });
  });
});
