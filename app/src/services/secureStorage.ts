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
  // P2P Transfer keys
  P2P_USER_CONTEXT: 'mwsim_p2p_user_context',
  P2P_LAST_ACCOUNT: 'mwsim_p2p_last_account',
  P2P_ENROLLMENT: 'mwsim_p2p_enrollment',
} as const;

// P2P User Context type
export interface P2PUserContext {
  userId: string;      // WSIM user ID (for local reference)
  bsimId: string;      // Bank identifier (e.g., 'bsim-dev')
  fiUserRef: string;   // BSIM internal user ID (for P2P transfers via TransferSim)
}

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
    try {
      const data = await SecureStore.getItemAsync(KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[SecureStorage] Error getting UserData:', e);
      return null;
    }
  },

  // Cached Cards (for offline mode)
  async setCachedCards(cards: object[]): Promise<void> {
    await SecureStore.setItemAsync(KEYS.CACHED_CARDS, JSON.stringify(cards));
  },

  async getCachedCards<T>(): Promise<T[] | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.CACHED_CARDS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[SecureStorage] Error getting CachedCards:', e);
      return null;
    }
  },

  // P2P User Context (userId and bsimId for TransferSim auth)
  async setP2PUserContext(context: P2PUserContext): Promise<void> {
    await SecureStore.setItemAsync(KEYS.P2P_USER_CONTEXT, JSON.stringify(context));
  },

  async getP2PUserContext(): Promise<P2PUserContext | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.P2P_USER_CONTEXT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[SecureStorage] Error getting P2PUserContext:', e);
      return null;
    }
  },

  async removeP2PUserContext(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.P2P_USER_CONTEXT);
  },

  // P2P Last Used Account (remember for convenience)
  async setP2PLastAccount(accountId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.P2P_LAST_ACCOUNT, accountId);
  },

  async getP2PLastAccount(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.P2P_LAST_ACCOUNT);
  },

  // P2P Enrollment (cached enrollment status)
  async setP2PEnrollment(enrollment: object): Promise<void> {
    await SecureStore.setItemAsync(KEYS.P2P_ENROLLMENT, JSON.stringify(enrollment));
  },

  async getP2PEnrollment<T>(): Promise<T | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.P2P_ENROLLMENT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[SecureStorage] Error getting P2PEnrollment:', e);
      return null;
    }
  },

  async removeP2PEnrollment(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.P2P_ENROLLMENT);
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
      // P2P data
      SecureStore.deleteItemAsync(KEYS.P2P_USER_CONTEXT),
      SecureStore.deleteItemAsync(KEYS.P2P_LAST_ACCOUNT),
      SecureStore.deleteItemAsync(KEYS.P2P_ENROLLMENT),
      // Note: We keep DEVICE_ID as it's permanent
    ]);
  },

  // Generic set/get/remove for dynamic keys
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(`mwsim_${key}`, value);
  },

  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(`mwsim_${key}`);
  },

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(`mwsim_${key}`);
  },
};
