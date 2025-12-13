import * as SecureStore from 'expo-secure-store';

// Keys for secure storage
const KEYS = {
  ACCESS_TOKEN: 'mwsim_access_token',
  REFRESH_TOKEN: 'mwsim_refresh_token',
  DEVICE_ID: 'mwsim_device_id',
  DEVICE_CREDENTIAL: 'mwsim_device_credential',
  BIOMETRIC_ID: 'mwsim_biometric_id',
  USER_DATA: 'mwsim_user_data',
  CACHED_CARDS: 'mwsim_cached_cards',
} as const;

export const secureStorage = {
  // Access Token
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async removeAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  },

  // Refresh Token
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async removeRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  },

  // Device ID (generated once, stored permanently)
  async setDeviceId(deviceId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
  },

  async getDeviceId(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.DEVICE_ID);
  },

  // Device Credential (from server registration)
  async setDeviceCredential(credential: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.DEVICE_CREDENTIAL, credential);
  },

  async getDeviceCredential(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.DEVICE_CREDENTIAL);
  },

  // Biometric ID
  async setBiometricId(biometricId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRIC_ID, biometricId);
  },

  async getBiometricId(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.BIOMETRIC_ID);
  },

  // User Data (cached for offline)
  async setUserData(user: object): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(user));
  },

  async getUserData<T>(): Promise<T | null> {
    const data = await SecureStore.getItemAsync(KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  // Cached Cards (for offline mode)
  async setCachedCards(cards: object[]): Promise<void> {
    await SecureStore.setItemAsync(KEYS.CACHED_CARDS, JSON.stringify(cards));
  },

  async getCachedCards<T>(): Promise<T[] | null> {
    const data = await SecureStore.getItemAsync(KEYS.CACHED_CARDS);
    return data ? JSON.parse(data) : null;
  },

  // Clear all stored data (logout)
  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.DEVICE_CREDENTIAL),
      SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ID),
      SecureStore.deleteItemAsync(KEYS.USER_DATA),
      SecureStore.deleteItemAsync(KEYS.CACHED_CARDS),
      // Note: We keep DEVICE_ID as it's permanent
    ]);
  },
};
