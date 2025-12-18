import * as SecureStore from 'expo-secure-store';
import { secureStorage } from '../../src/services/secureStorage';

jest.mock('expo-secure-store');

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('SecureStorage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Access Token', () => {
    it('should set access token', async () => {
      await secureStorage.setAccessToken('test-token');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_access_token',
        'test-token'
      );
    });

    it('should get access token', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('test-token');
      const token = await secureStorage.getAccessToken();
      expect(token).toBe('test-token');
      expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('mwsim_access_token');
    });

    it('should return null when no access token', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);
      const token = await secureStorage.getAccessToken();
      expect(token).toBeNull();
    });

    it('should remove access token', async () => {
      await secureStorage.removeAccessToken();
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_access_token');
    });
  });

  describe('Refresh Token', () => {
    it('should set refresh token', async () => {
      await secureStorage.setRefreshToken('refresh-token');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_refresh_token',
        'refresh-token'
      );
    });

    it('should get refresh token', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('refresh-token');
      const token = await secureStorage.getRefreshToken();
      expect(token).toBe('refresh-token');
    });

    it('should remove refresh token', async () => {
      await secureStorage.removeRefreshToken();
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_refresh_token');
    });
  });

  describe('Device ID', () => {
    it('should set device ID', async () => {
      await secureStorage.setDeviceId('device-123');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_device_id',
        'device-123'
      );
    });

    it('should get device ID', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('device-123');
      const deviceId = await secureStorage.getDeviceId();
      expect(deviceId).toBe('device-123');
    });
  });

  describe('Device Credential', () => {
    it('should set device credential', async () => {
      await secureStorage.setDeviceCredential('credential-abc');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_device_credential',
        'credential-abc'
      );
    });

    it('should get device credential', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('credential-abc');
      const credential = await secureStorage.getDeviceCredential();
      expect(credential).toBe('credential-abc');
    });
  });

  describe('Biometric ID', () => {
    it('should set biometric ID', async () => {
      await secureStorage.setBiometricId('bio-123');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_biometric_id',
        'bio-123'
      );
    });

    it('should get biometric ID', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('bio-123');
      const biometricId = await secureStorage.getBiometricId();
      expect(biometricId).toBe('bio-123');
    });
  });

  describe('User Data', () => {
    const testUser = { id: '1', name: 'Test User', email: 'test@example.com' };

    it('should set user data as JSON', async () => {
      await secureStorage.setUserData(testUser);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_user_data',
        JSON.stringify(testUser)
      );
    });

    it('should get and parse user data', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(testUser));
      const user = await secureStorage.getUserData();
      expect(user).toEqual(testUser);
    });

    it('should return null when no user data', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);
      const user = await secureStorage.getUserData();
      expect(user).toBeNull();
    });
  });

  describe('Cached Cards', () => {
    const testCards = [
      { id: '1', lastFour: '1234', type: 'VISA' },
      { id: '2', lastFour: '5678', type: 'MASTERCARD' },
    ];

    it('should set cached cards as JSON', async () => {
      await secureStorage.setCachedCards(testCards);
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_cached_cards',
        JSON.stringify(testCards)
      );
    });

    it('should get and parse cached cards', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(JSON.stringify(testCards));
      const cards = await secureStorage.getCachedCards();
      expect(cards).toEqual(testCards);
    });

    it('should return null when no cached cards', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);
      const cards = await secureStorage.getCachedCards();
      expect(cards).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all stored data except device ID', async () => {
      await secureStorage.clearAll();

      // Should delete these keys
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_access_token');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_refresh_token');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_device_credential');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_biometric_id');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_user_data');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_cached_cards');

      // Should NOT delete device ID
      expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalledWith('mwsim_device_id');
    });
  });

  describe('Generic set/get/remove', () => {
    it('should set with prefixed key', async () => {
      await secureStorage.set('custom_key', 'custom_value');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'mwsim_custom_key',
        'custom_value'
      );
    });

    it('should get with prefixed key', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('custom_value');
      const value = await secureStorage.get('custom_key');
      expect(value).toBe('custom_value');
      expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith('mwsim_custom_key');
    });

    it('should remove with prefixed key', async () => {
      await secureStorage.remove('custom_key');
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('mwsim_custom_key');
    });
  });
});
