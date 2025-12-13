import { create } from 'zustand';
import { secureStorage } from '../services/secureStorage';
import { api } from '../services/api';
import { biometricService } from '../services/biometric';
import type { User, AuthTokens } from '../types';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  biometricType: 'face' | 'fingerprint' | 'none';
  deviceId: string | null;

  // Actions
  initialize: () => Promise<void>;
  createAccount: (email: string, name: string) => Promise<void>;
  setupBiometric: () => Promise<boolean>;
  authenticateWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,
  biometricType: 'none',
  deviceId: null,

  // Initialize app - check for existing session
  initialize: async () => {
    try {
      set({ isLoading: true });

      // Get or create device ID
      let deviceId = await secureStorage.getDeviceId();
      if (!deviceId) {
        deviceId = uuidv4();
        await secureStorage.setDeviceId(deviceId);
      }

      // Check biometric capabilities
      const capabilities = await biometricService.getCapabilities();

      // Check if we have stored tokens
      const accessToken = await secureStorage.getAccessToken();
      const biometricId = await secureStorage.getBiometricId();

      if (accessToken) {
        // Try to get user data from cache first (offline support)
        const cachedUser = await api.getCachedUser();

        try {
          // Try to fetch fresh data
          const summary = await api.getWalletSummary();
          set({
            user: summary.user,
            isAuthenticated: true,
            biometricEnabled: summary.biometricEnabled || !!biometricId,
            biometricType: capabilities.biometricType,
            deviceId,
            isLoading: false,
          });
        } catch (error) {
          // Use cached data if network fails (offline mode)
          if (cachedUser) {
            set({
              user: cachedUser,
              isAuthenticated: true,
              biometricEnabled: !!biometricId,
              biometricType: capabilities.biometricType,
              deviceId,
              isLoading: false,
            });
          } else {
            // No cached data and network failed
            set({
              user: null,
              isAuthenticated: false,
              biometricType: capabilities.biometricType,
              deviceId,
              isLoading: false,
            });
          }
        }
      } else {
        // Not authenticated
        set({
          user: null,
          isAuthenticated: false,
          biometricType: capabilities.biometricType,
          deviceId,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isLoading: false });
    }
  },

  // Create a new account
  createAccount: async (email: string, name: string) => {
    const { deviceId } = get();
    if (!deviceId) {
      throw new Error('Device not initialized');
    }

    set({ isLoading: true });

    try {
      // Register device first
      const deviceName = Device.deviceName || `${Platform.OS} device`;
      await api.registerDevice({
        deviceId,
        platform: Platform.OS as 'ios' | 'android',
        deviceName,
      });

      // Create account
      const { user, tokens } = await api.createAccount(
        email,
        name,
        deviceId,
        deviceName,
        Platform.OS as 'ios' | 'android'
      );

      // Store tokens
      await secureStorage.setAccessToken(tokens.accessToken);
      await secureStorage.setRefreshToken(tokens.refreshToken);

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Set up biometric authentication
  setupBiometric: async () => {
    const { deviceId, biometricType } = get();
    if (!deviceId || biometricType === 'none') {
      return false;
    }

    try {
      // First verify user with biometric
      const authResult = await biometricService.authenticate(
        'Enable biometric authentication'
      );

      if (!authResult.success) {
        return false;
      }

      // For now, we'll use a placeholder for the public key
      // In a real implementation, you'd generate a keypair in Secure Enclave
      const publicKey = `mwsim_${deviceId}_${Date.now()}`;

      // Register with server
      const { biometricId } = await api.setupBiometric({
        deviceId,
        publicKey,
        biometricType: biometricType as 'face' | 'fingerprint',
      });

      // Store biometric ID
      await secureStorage.setBiometricId(biometricId);

      set({ biometricEnabled: true });
      return true;
    } catch (error) {
      console.error('Failed to setup biometric:', error);
      return false;
    }
  },

  // Authenticate with biometric
  authenticateWithBiometric: async () => {
    const { deviceId, biometricEnabled } = get();
    if (!deviceId || !biometricEnabled) {
      return false;
    }

    try {
      // Prompt for biometric
      const authResult = await biometricService.authenticateToUnlock();
      if (!authResult.success) {
        return false;
      }

      // Get challenge from server
      const { challenge } = await api.getBiometricChallenge(deviceId);

      // In a real implementation, you'd sign the challenge with the private key
      // For now, we'll use a placeholder signature
      const signature = `signed_${challenge}_${Date.now()}`;

      // Verify with server (biometricId removed per API v1.1)
      const result = await api.verifyBiometric(
        deviceId,
        signature,
        challenge
      );

      // Store new tokens
      await secureStorage.setAccessToken(result.accessToken);
      await secureStorage.setRefreshToken(result.refreshToken);

      set({
        user: result.user,
        isAuthenticated: true,
      });

      return true;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.logout();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        biometricEnabled: false,
      });
    }
  },

  // Set user (for external updates)
  setUser: (user) => set({ user }),
}));
