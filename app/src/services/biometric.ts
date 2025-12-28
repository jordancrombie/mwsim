import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricType = 'face' | 'fingerprint' | 'none';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
}

export const biometricService = {
  /**
   * Check device biometric capabilities
   */
  async getCapabilities(): Promise<BiometricCapabilities> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return {
        isAvailable: false,
        biometricType: 'none',
        isEnrolled: false,
      };
    }

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = 'fingerprint';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'face';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    }

    return {
      isAvailable: true,
      biometricType,
      isEnrolled: true,
    };
  },

  /**
   * Get user-friendly name for biometric type
   */
  getBiometricName(type: BiometricType): string {
    if (type === 'face') {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
    }
    if (type === 'fingerprint') {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }
    return 'Biometric';
  },

  /**
   * Authenticate user with biometrics
   */
  async authenticate(reason: string = 'Authenticate to continue'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow passcode fallback
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      }

      // Handle different error cases
      if (result.error === 'user_cancel') {
        return { success: false, error: 'Authentication cancelled' };
      }

      if (result.error === 'user_fallback') {
        return { success: false, error: 'User chose passcode fallback' };
      }

      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Authenticate for a specific action (with custom prompt)
   */
  async authenticateForPayment(amount?: string): Promise<{ success: boolean; error?: string }> {
    const prompt = amount
      ? `Authenticate to pay ${amount}`
      : 'Authenticate to confirm payment';
    return this.authenticate(prompt);
  },

  async authenticateToUnlock(): Promise<{ success: boolean; error?: string }> {
    return this.authenticate('Unlock your wallet');
  },

  async authenticateToEnroll(): Promise<{ success: boolean; error?: string }> {
    return this.authenticate('Authenticate to add this bank');
  },

  async authenticateForTransfer(amount: string, recipientName: string): Promise<{ success: boolean; error?: string }> {
    return this.authenticate(`Authenticate to send ${amount} to ${recipientName}`);
  },
};
