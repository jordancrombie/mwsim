import axios, { AxiosInstance, AxiosError } from 'axios';
import { getConfig, getEnvironmentName } from '../config/env';
import { secureStorage } from './secureStorage';
import type {
  User,
  Card,
  Bank,
  WalletSummary,
  AuthTokens,
  DeviceRegistration,
  BiometricSetup,
  PaymentRequest,
  PendingPayment,
} from '../types';

// Create axios instance with current environment config
const createApiClient = (): AxiosInstance => {
  const config = getConfig();
  console.log(`[API] Initializing: ${getEnvironmentName()} (${config.apiUrl})`);

  const client = axios.create({
    baseURL: config.apiUrl,
    timeout: config.apiTimeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  client.interceptors.request.use(async (requestConfig) => {
    const token = await secureStorage.getAccessToken();
    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  });

  // Response interceptor - handle 401 and token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      // If 401 and we haven't retried yet, try to refresh token
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await secureStorage.getRefreshToken();
          if (refreshToken) {
            const tokens = await api.refreshToken(refreshToken);
            await secureStorage.setAccessToken(tokens.accessToken);
            await secureStorage.setRefreshToken(tokens.refreshToken);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return client(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and let error propagate
          await secureStorage.clearAll();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

const apiClient = createApiClient();

// Extend AxiosRequestConfig to include _retry
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

export const api = {
  // ==================
  // Auth Endpoints
  // ==================

  /**
   * Register a new device with the server
   */
  async registerDevice(device: DeviceRegistration): Promise<{ deviceCredential: string; expiresAt: string }> {
    const { data } = await apiClient.post('/mobile/device/register', device);
    return data;
  },

  /**
   * Create a new user account
   */
  async createAccount(
    email: string,
    name: string,
    deviceId: string,
    deviceName: string,
    platform: 'ios' | 'android'
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post('/mobile/auth/register', {
      email,
      name,
      deviceId,
      deviceName,
      platform,
    });
    return data;
  },

  /**
   * Set up biometric authentication
   */
  async setupBiometric(setup: BiometricSetup): Promise<{ biometricId: string; status: string }> {
    const { data } = await apiClient.post('/mobile/auth/biometric/setup', setup);
    return data;
  },

  /**
   * Get authentication challenge for biometric verify
   */
  async getBiometricChallenge(deviceId: string): Promise<{ challenge: string }> {
    const { data } = await apiClient.post('/mobile/auth/biometric/challenge', { deviceId });
    return data;
  },

  /**
   * Verify biometric authentication (simplified - no biometricId)
   */
  async verifyBiometric(
    deviceId: string,
    signature: string,
    challenge: string
  ): Promise<AuthTokens & { user: User }> {
    const { data } = await apiClient.post('/mobile/auth/biometric/verify', {
      deviceId,
      signature,
      challenge,
    });
    return data;
  },

  /**
   * Login with existing account (initiates email verification)
   */
  async login(email: string, deviceId: string): Promise<{ challenge: string; method: string }> {
    const { data } = await apiClient.post('/mobile/auth/login', {
      email,
      deviceId,
    });
    return data;
  },

  /**
   * Verify login with email code
   */
  async verifyLogin(
    email: string,
    deviceId: string,
    code: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post('/mobile/auth/login/verify', {
      email,
      deviceId,
      code,
    });
    return data;
  },

  /**
   * Login with email and password (for development/testing)
   */
  async loginWithPassword(
    email: string,
    password: string,
    deviceId: string,
    deviceName: string,
    platform: 'ios' | 'android'
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post('/mobile/auth/login/password', {
      email,
      password,
      deviceId,
      deviceName,
      platform,
    });
    return data;
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const { data } = await apiClient.post('/mobile/auth/token/refresh', {
      refreshToken,
    });
    return data;
  },

  /**
   * Logout and invalidate tokens
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/mobile/auth/logout');
    } finally {
      await secureStorage.clearAll();
    }
  },

  // ==================
  // Wallet Endpoints
  // ==================

  /**
   * Get wallet summary (optimized for mobile)
   */
  async getWalletSummary(): Promise<WalletSummary> {
    const { data } = await apiClient.get('/mobile/wallet/summary');

    // Cache cards for offline use
    if (data.cards) {
      await secureStorage.setCachedCards(data.cards);
    }
    if (data.user) {
      // Preserve existing profileImageUrl if API doesn't return it
      // (profileImageUrl comes from /profile endpoint, not wallet summary)
      const existingUser = await secureStorage.getUserData<{ profileImageUrl?: string | null }>();
      const mergedUser = {
        ...data.user,
        profileImageUrl: data.user.profileImageUrl ?? existingUser?.profileImageUrl,
      };
      await secureStorage.setUserData(mergedUser);
      // Return the merged user so callers get the preserved profileImageUrl
      data.user = mergedUser;
    }

    return data;
  },

  /**
   * Get user's cards
   */
  async getCards(): Promise<Card[]> {
    const { data } = await apiClient.get('/wallet/cards');

    // Cache for offline
    await secureStorage.setCachedCards(data.cards || data);

    return data.cards || data;
  },

  /**
   * Set default card
   */
  async setDefaultCard(cardId: string): Promise<void> {
    await apiClient.post(`/mobile/wallet/cards/${cardId}/default`);
  },

  /**
   * Remove a card from wallet
   */
  async removeCard(cardId: string): Promise<void> {
    await apiClient.delete(`/mobile/wallet/cards/${cardId}`);
  },

  // ==================
  // Enrollment Endpoints (Mobile-specific)
  // ==================

  /**
   * Get list of available banks (mobile endpoint - no auth required)
   */
  async getBanks(): Promise<Bank[]> {
    const { data } = await apiClient.get('/mobile/enrollment/banks');
    return data.banks || data;
  },

  /**
   * Start bank enrollment (JWT authenticated)
   * Returns the OAuth authUrl to open in WebView
   */
  async startEnrollment(bsimId: string): Promise<{ authUrl: string; state: string }> {
    const { data } = await apiClient.post(`/mobile/enrollment/start/${bsimId}`);
    return data;
  },

  /**
   * List user's enrolled banks (JWT authenticated)
   */
  async getEnrolledBanks(): Promise<{ enrollments: Array<{ id: string; bsimId: string; bankName: string; enrolledAt: string }> }> {
    const { data } = await apiClient.get('/mobile/enrollment/list');
    return data;
  },

  /**
   * Remove bank enrollment (JWT authenticated)
   */
  async removeEnrollment(enrollmentId: string): Promise<void> {
    await apiClient.delete(`/mobile/enrollment/${enrollmentId}`);
  },

  // ==================
  // Offline Support
  // ==================

  /**
   * Get cached cards (for offline mode)
   */
  async getCachedCards(): Promise<Card[] | null> {
    return secureStorage.getCachedCards<Card>();
  },

  /**
   * Get cached user data (for offline mode)
   */
  async getCachedUser(): Promise<User | null> {
    return secureStorage.getUserData<User>();
  },

  // ==================
  // Payment Endpoints (Mobile Payment Flow)
  // ==================

  /**
   * Get payment request details for approval screen.
   * Called when user opens a payment deep link.
   */
  async getPaymentDetails(requestId: string): Promise<PaymentRequest> {
    const { data } = await apiClient.get(`/mobile/payment/${requestId}`);
    return data;
  },

  /**
   * Approve a payment request with selected card.
   * Called after user confirms and biometric succeeds.
   */
  async approvePayment(requestId: string, cardId: string): Promise<{ success: boolean; status: string; returnUrl: string }> {
    const { data } = await apiClient.post(`/mobile/payment/${requestId}/approve`, { cardId });
    return data;
  },

  /**
   * Cancel a payment request from the app.
   */
  async cancelPayment(requestId: string): Promise<{ success: boolean; status: string }> {
    const { data } = await apiClient.post(`/mobile/payment/${requestId}/cancel`);
    return data;
  },

  /**
   * Get list of pending payment requests for the user.
   * Used for "Pending Payments" section on home screen.
   */
  async getPendingPayments(): Promise<{ requests: PendingPayment[] }> {
    const { data } = await apiClient.get('/mobile/payment/pending');
    return data;
  },

  // ==================
  // P2P Account Endpoints (via WSIM Proxy to BSIM Open Banking)
  // ==================

  /**
   * Get user's bank accounts for P2P transfers.
   * WSIM proxies this request to BSIM Open Banking API using stored OAuth tokens.
   * Returns accounts from all enrolled banks.
   */
  async getAccounts(): Promise<{ accounts: Array<{ accountId: string; accountType: string; displayName: string; balance?: number; currency: string; bankName: string; bankLogoUrl?: string; bsimId: string }> }> {
    console.log('[API] getAccounts - fetching...');
    const { data } = await apiClient.get('/mobile/accounts');
    console.log('[API] getAccounts - response:', JSON.stringify(data, null, 2));
    return data;
  },

  // ==================
  // Push Notification Endpoints
  // ==================

  /**
   * Register push notification token with WSIM
   * WSIM will store this token and use it to send notifications directly via APNs/FCM
   *
   * @param registration Push token registration data
   * @returns Success status
   *
   * @note This uses native APNs/FCM tokens for a fully self-hosted solution.
   *       WSIM sends notifications directly to APNs/FCM without Expo's service.
   * @see LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_PROPOSAL.md
   */
  async registerPushToken(registration: {
    deviceId: string;
    pushToken: string;
    platform: 'ios' | 'android';
    tokenType: 'apns' | 'fcm'; // Native token types
  }): Promise<{ success: boolean; registeredAt: string }> {
    console.log('[API] registerPushToken - registering...');
    try {
      const { data } = await apiClient.post('/mobile/device/push-token', registration);
      console.log('[API] registerPushToken - success');
      return data;
    } catch (error: any) {
      // Endpoint may not exist yet (WSIM Phase 1 not complete)
      // Fail gracefully - push notifications will work once WSIM is ready
      console.log('[API] registerPushToken - endpoint not available yet:', error.response?.status || error.message);
      throw error;
    }
  },

  /**
   * Deactivate push token on logout
   * Marks the token as inactive so notifications stop being sent
   *
   * @note This endpoint is part of Phase 1 push notification work.
   */
  async deactivatePushToken(deviceId: string): Promise<void> {
    console.log('[API] deactivatePushToken - deactivating...');
    try {
      await apiClient.delete(`/mobile/device/push-token/${deviceId}`);
      console.log('[API] deactivatePushToken - success');
    } catch (error: any) {
      // Endpoint may not exist yet
      console.log('[API] deactivatePushToken - endpoint not available yet:', error.response?.status || error.message);
    }
  },

  // ==================
  // Profile Endpoints
  // ==================

  /**
   * Get user profile data
   * Returns display name, profile image URL, and thumbnails
   */
  async getProfile(): Promise<{
    success: boolean;
    profile: {
      displayName: string;
      profileImageUrl?: string | null;
      thumbnails?: {
        small: string;
        medium: string;
      };
    };
  }> {
    console.log('[API] getProfile - fetching...');
    const { data } = await apiClient.get('/mobile/profile');
    console.log('[API] getProfile - success:', data);
    return data;
  },

  /**
   * Update user profile (display name)
   * Note: WSIM expects 'name' field, not 'displayName'
   */
  async updateProfile(profile: { displayName: string }): Promise<{
    displayName: string;
    profileImageUrl?: string | null;
  }> {
    console.log('[API] updateProfile - updating with:', profile);
    try {
      // WSIM expects 'name' field
      const { data } = await apiClient.put('/mobile/profile', { name: profile.displayName });
      console.log('[API] updateProfile - success:', data);
      return data;
    } catch (error: any) {
      console.error('[API] updateProfile - failed:', error.response?.status, error.response?.data);
      throw error;
    }
  },

  /**
   * Upload profile image
   * Accepts multipart/form-data with image file
   * Image will be resized to 512x512 and thumbnails created
   *
   * @param imageUri Local file URI from expo-image-picker
   * @returns Updated profile with new image URL
   */
  async uploadProfileImage(imageUri: string): Promise<{
    success: boolean;
    profileImageUrl: string;
    thumbnails?: {
      small: string;
      medium: string;
    };
  }> {
    console.log('[API] uploadProfileImage - uploading...');
    console.log('[API] uploadProfileImage - imageUri:', imageUri);

    // Create form data for multipart upload
    const formData = new FormData();

    // Extract filename and determine mime type
    const filename = imageUri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    console.log('[API] uploadProfileImage - filename:', filename);
    console.log('[API] uploadProfileImage - mime type:', type);

    // Append file to form data
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    console.log('[API] uploadProfileImage - FormData created, sending to server...');

    try {
      const { data } = await apiClient.post('/mobile/profile/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[API] uploadProfileImage - success');

      // Update cached user with new profileImageUrl so it persists across navigation
      const existingUser = await secureStorage.getUserData<Record<string, unknown>>();
      if (existingUser) {
        await secureStorage.setUserData({
          ...existingUser,
          profileImageUrl: data.profileImageUrl,
        });
        console.log('[API] uploadProfileImage - cached user updated');
      }

      return data;
    } catch (error: any) {
      console.error('[API] uploadProfileImage - failed:', error.response?.status, error.response?.data);
      throw error;
    }
  },

  /**
   * Delete profile image
   * Removes the user's profile image, reverting to initials avatar
   */
  async deleteProfileImage(): Promise<{ success: boolean }> {
    console.log('[API] deleteProfileImage - deleting...');
    const { data } = await apiClient.delete('/mobile/profile/image');
    console.log('[API] deleteProfileImage - success');

    // Clear cached profileImageUrl so it persists as removed across navigation
    const existingUser = await secureStorage.getUserData<Record<string, unknown>>();
    if (existingUser) {
      await secureStorage.setUserData({
        ...existingUser,
        profileImageUrl: null,
      });
      console.log('[API] deleteProfileImage - cached user updated');
    }

    return data;
  },
};
