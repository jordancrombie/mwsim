/**
 * Tests for the biometric service.
 *
 * Tests biometric capability detection, authentication flows,
 * and error handling with mocked expo-local-authentication.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { biometricService, BiometricCapabilities } from '../../src/services/biometric';

// Mock expo-local-authentication
jest.mock('expo-local-authentication');

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

const mockLocalAuthentication = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe('biometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCapabilities', () => {
    it('should return unavailable when no hardware', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await biometricService.getCapabilities();

      expect(result).toEqual({
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      });
      expect(mockLocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });

    it('should return unavailable when hardware exists but not enrolled', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await biometricService.getCapabilities();

      expect(result).toEqual({
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      });
    });

    it('should return face biometric when facial recognition is supported', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);

      const result = await biometricService.getCapabilities();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'face',
        isEnrolled: true,
      });
    });

    it('should return fingerprint when only fingerprint is supported', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);

      const result = await biometricService.getCapabilities();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
      });
    });

    it('should default to fingerprint when no specific type detected', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([]);

      const result = await biometricService.getCapabilities();

      expect(result).toEqual({
        isAvailable: true,
        biometricType: 'fingerprint',
        isEnrolled: true,
      });
    });
  });

  describe('getBiometricName', () => {
    describe('on iOS', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should return "Face ID" for face type', () => {
        const result = biometricService.getBiometricName('face');
        expect(result).toBe('Face ID');
      });

      it('should return "Touch ID" for fingerprint type', () => {
        const result = biometricService.getBiometricName('fingerprint');
        expect(result).toBe('Touch ID');
      });

      it('should return "Biometric" for none type', () => {
        const result = biometricService.getBiometricName('none');
        expect(result).toBe('Biometric');
      });
    });

    describe('on Android', () => {
      beforeEach(() => {
        (Platform as any).OS = 'android';
      });

      afterEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should return "Face Recognition" for face type', () => {
        const result = biometricService.getBiometricName('face');
        expect(result).toBe('Face Recognition');
      });

      it('should return "Fingerprint" for fingerprint type', () => {
        const result = biometricService.getBiometricName('fingerprint');
        expect(result).toBe('Fingerprint');
      });

      it('should return "Biometric" for none type', () => {
        const result = biometricService.getBiometricName('none');
        expect(result).toBe('Biometric');
      });
    });
  });

  describe('authenticate', () => {
    it('should return success when authentication succeeds', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      const result = await biometricService.authenticate();

      expect(result).toEqual({ success: true });
      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to continue',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should use custom prompt message', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await biometricService.authenticate('Custom prompt');

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Custom prompt',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should handle user cancellation', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'Authentication cancelled',
      });
    });

    it('should handle user fallback to passcode', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_fallback',
      });

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'User chose passcode fallback',
      });
    });

    it('should handle generic authentication failure', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout',
      });

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'lockout',
      });
    });

    it('should handle failure with no error message', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
      });

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'Authentication failed',
      });
    });

    it('should handle thrown Error', async () => {
      mockLocalAuthentication.authenticateAsync.mockRejectedValue(
        new Error('Hardware error')
      );

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'Hardware error',
      });
    });

    it('should handle thrown non-Error exception', async () => {
      mockLocalAuthentication.authenticateAsync.mockRejectedValue('Unknown exception');

      const result = await biometricService.authenticate();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });
  });

  describe('authenticateForPayment', () => {
    it('should use amount in prompt when provided', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await biometricService.authenticateForPayment('$50.00');

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to pay $50.00',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should use default prompt when amount not provided', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await biometricService.authenticateForPayment();

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to confirm payment',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should return authentication result', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.authenticateForPayment('$100.00');

      expect(result).toEqual({
        success: false,
        error: 'Authentication cancelled',
      });
    });
  });

  describe('authenticateToUnlock', () => {
    it('should use unlock prompt', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await biometricService.authenticateToUnlock();

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Unlock your wallet',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should return authentication result', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      const result = await biometricService.authenticateToUnlock();

      expect(result).toEqual({ success: true });
    });
  });

  describe('authenticateToEnroll', () => {
    it('should use enrollment prompt', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      await biometricService.authenticateToEnroll();

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to add this bank',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });
    });

    it('should return authentication result', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout',
      });

      const result = await biometricService.authenticateToEnroll();

      expect(result).toEqual({
        success: false,
        error: 'lockout',
      });
    });
  });
});
