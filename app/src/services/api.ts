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
  console.log(`[API] Initializing with ${getEnvironmentName()} environment: ${config.apiUrl}`);

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
      await secureStorage.setUserData(data.user);
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
    const url = `/mobile/payment/${requestId}`;
    console.log(`[API] getPaymentDetails: Fetching from ${apiClient.defaults.baseURL}${url}`);
    try {
      const { data } = await apiClient.get(url);
      console.log('[API] getPaymentDetails: Success');
      return data;
    } catch (error: any) {
      console.log('[API] getPaymentDetails: Error', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    }
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
};
