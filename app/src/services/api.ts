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
  Contract,
  ContractListItem,
  CreateContractRequest,
  OracleEvent,
  VerificationLevel,
} from '../types';
import type { SignedVerification } from './verification';

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

// UUID regex for detecting raw user IDs that need profile resolution
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string looks like a UUID (raw user ID)
 */
function isUUID(value: string | undefined | null): boolean {
  return !!value && UUID_REGEX.test(value);
}

/**
 * Profile data for counterparty resolution
 */
interface ProfileLookupResult {
  displayName?: string;
  profileImageUrl?: string;
  initials?: string;
  initialsColor?: string;
  isVerified?: boolean;
  verificationLevel?: string;
}

/**
 * WSIM profile lookup response format (wrapped in success/profile)
 */
interface ProfileLookupResponse {
  success: boolean;
  profile?: ProfileLookupResult;
}

/**
 * Resolve a WSIM wallet ID to profile data via WSIM's mobile profile lookup API.
 * Uses the walletId parameter for contract counterparty resolution.
 */
async function resolveProfileByWalletId(walletId: string): Promise<ProfileLookupResult | null> {
  try {
    const token = await secureStorage.getAccessToken();
    if (!token) {
      console.log('[API] resolveProfileByWalletId - NO TOKEN available');
      return null;
    }

    const config = getConfig();
    const url = `${config.apiUrl}/mobile/profile/lookup?walletId=${encodeURIComponent(walletId)}`;

    console.log('[API] resolveProfileByWalletId - START');
    console.log('[API] resolveProfileByWalletId - walletId:', walletId);
    console.log('[API] resolveProfileByWalletId - URL:', url);

    const response = await axios.get<ProfileLookupResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    console.log('[API] resolveProfileByWalletId - HTTP status:', response.status);
    console.log('[API] resolveProfileByWalletId - response data:', JSON.stringify(response.data, null, 2));

    // WSIM returns { success: true, profile: {...} } format
    if (response.data?.profile) {
      console.log('[API] resolveProfileByWalletId - SUCCESS - displayName:', response.data.profile.displayName);
      return response.data.profile;
    }
    console.log('[API] resolveProfileByWalletId - no profile in response');
    return null;
  } catch (error: any) {
    console.log('[API] resolveProfileByWalletId - ERROR');
    console.log('[API] resolveProfileByWalletId - walletId:', walletId);
    console.log('[API] resolveProfileByWalletId - error message:', error.message);
    console.log('[API] resolveProfileByWalletId - error status:', error.response?.status);
    console.log('[API] resolveProfileByWalletId - error data:', JSON.stringify(error.response?.data, null, 2));
    return null;
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
      // Get cached user data for fields not returned by wallet/summary
      const existingUser = await secureStorage.getUserData<{
        profileImageUrl?: string | null;
        isVerified?: boolean;
        verifiedAt?: string;
        verificationLevel?: string;
      }>();

      // Log what we're merging for debugging
      console.log('[API] getWalletSummary - server user verification:', {
        isVerified: data.user.isVerified,
        verificationLevel: data.user.verificationLevel,
        hasField: 'isVerified' in data.user,
      });
      console.log('[API] getWalletSummary - cached user verification:', {
        isVerified: existingUser?.isVerified,
        verificationLevel: existingUser?.verificationLevel,
      });

      // Preserve verification status from cache if server doesn't return it
      // Use explicit check for undefined since server might not include these fields
      const mergedUser = {
        ...data.user,
        profileImageUrl: data.user.profileImageUrl ?? existingUser?.profileImageUrl,
        // Only use server value if it's explicitly true; otherwise preserve cache
        // This handles the case where WSIM doesn't return verification fields yet
        isVerified: data.user.isVerified === true ? true : (existingUser?.isVerified ?? false),
        verifiedAt: data.user.verifiedAt || existingUser?.verifiedAt || null,
        verificationLevel: data.user.verificationLevel || existingUser?.verificationLevel || 'none',
      };

      console.log('[API] getWalletSummary - merged verification:', {
        isVerified: mergedUser.isVerified,
        verificationLevel: mergedUser.verificationLevel,
      });

      await secureStorage.setUserData(mergedUser);
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

  // ==================
  // Contract Endpoints (via WSIM Proxy to ContractSim)
  // ==================

  /**
   * Get list of user's contracts
   * Returns contracts where user is either creator or counterparty
   *
   * @param status Optional filter by status
   * @param limit Max number of results (default 20)
   * @param offset Pagination offset
   */
  async getContracts(
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ contracts: ContractListItem[]; total: number }> {
    console.log('[API] getContracts - fetching...');
    const params: Record<string, string | number> = { limit, offset };
    if (status) {
      params.status = status;
    }
    const { data } = await apiClient.get('/mobile/contracts', { params });
    console.log('[API] getContracts - received:', data.contracts?.length || 0, 'contracts');

    // Enrich contracts with resolved profiles for UUID counterparty names
    let contracts = data.contracts || [];
    console.log('[API] getContracts - starting profile enrichment for', contracts.length, 'contracts');

    if (contracts.length > 0) {
      // Collect all unique wallet IDs that need resolution
      const walletIdsToResolve = new Set<string>();
      for (const c of contracts) {
        console.log(`[API] Contract ${c.id}:`);
        console.log(`  - counterpartyId: ${c.counterpartyId || 'NOT SET'}`);
        console.log(`  - counterpartyName: ${c.counterpartyName}`);
        console.log(`  - counterpartyName isUUID: ${isUUID(c.counterpartyName)}`);
        console.log(`  - counterpartyProfileImageUrl: ${c.counterpartyProfileImageUrl || 'NOT SET'}`);

        // Check if counterpartyId or counterpartyName is a UUID that needs resolution
        const walletId = c.counterpartyId || (isUUID(c.counterpartyName) ? c.counterpartyName : null);
        console.log(`  - walletId for lookup: ${walletId || 'NONE'}`);

        if (walletId && isUUID(walletId) && !c.counterpartyProfileImageUrl) {
          walletIdsToResolve.add(walletId);
          console.log(`  - ADDING to resolution queue`);
        } else {
          console.log(`  - SKIPPING resolution (walletId=${!!walletId}, isUUID=${isUUID(walletId || '')}, hasProfileImage=${!!c.counterpartyProfileImageUrl})`);
        }
      }

      console.log('[API] getContracts - walletIds to resolve:', Array.from(walletIdsToResolve));

      if (walletIdsToResolve.size > 0) {
        console.log('[API] Resolving', walletIdsToResolve.size, 'contract counterparty profile(s) by walletId');

        // Resolve all profiles in parallel using walletId
        const profileMap = new Map<string, ProfileLookupResult>();
        const resolvePromises = Array.from(walletIdsToResolve).map(async (walletId) => {
          const profile = await resolveProfileByWalletId(walletId);
          console.log(`[API] Profile resolution result for ${walletId}:`, profile ? 'FOUND' : 'NOT FOUND');
          if (profile) {
            console.log(`[API] Profile for ${walletId}: displayName=${profile.displayName}, profileImageUrl=${profile.profileImageUrl || 'NOT SET'}`);
            profileMap.set(walletId, profile);
          }
        });
        await Promise.all(resolvePromises);

        console.log('[API] getContracts - profileMap size after resolution:', profileMap.size);

        // Enrich contracts with resolved profiles
        contracts = contracts.map((c: ContractListItem) => {
          const walletId = c.counterpartyId || (isUUID(c.counterpartyName) ? c.counterpartyName : null);
          if (walletId && profileMap.has(walletId)) {
            const profile = profileMap.get(walletId)!;
            console.log(`[API] Enriching contract ${c.id}: ${c.counterpartyName} -> ${profile.displayName}`);
            return {
              ...c,
              counterpartyName: profile.displayName || c.counterpartyName,
              counterpartyProfileImageUrl: profile.profileImageUrl || c.counterpartyProfileImageUrl,
              counterpartyInitialsColor: profile.initialsColor || c.counterpartyInitialsColor,
              counterpartyIsVerified: profile.isVerified,
              counterpartyVerificationLevel: profile.verificationLevel as any,
            };
          }
          return c;
        });
      } else {
        console.log('[API] getContracts - no walletIds need resolution');
      }
    }

    // Debug: Log profile image URLs for contracts
    if (contracts.length > 0) {
      contracts.forEach((c: ContractListItem) => {
        console.log(`[API] Contract ${c.id} - counterparty:`, c.counterpartyName, '- profileImageUrl:', c.counterpartyProfileImageUrl || 'NOT SET');
      });
    }

    return {
      contracts,
      total: data.total || 0,
    };
  },

  /**
   * Get contract details by ID
   * Returns full contract object with parties, conditions, and outcome
   *
   * @param contractId The contract ID
   */
  async getContract(contractId: string): Promise<Contract> {
    console.log('[API] getContract - fetching:', contractId);
    const { data } = await apiClient.get(`/mobile/contracts/${contractId}`);
    console.log('[API] getContract - received:', data);

    // Enrich parties with resolved profiles if displayName is a UUID (using walletId lookup)
    if (data.parties?.length > 0) {
      const walletIdsToResolve = new Set<string>();
      for (const p of data.parties) {
        const walletId = p.userId || (isUUID(p.displayName) ? p.displayName : null);
        if (walletId && isUUID(walletId) && !p.profileImageUrl) {
          walletIdsToResolve.add(walletId);
          console.log(`[API] Contract party displayName is UUID:`, p.displayName);
        }
      }

      if (walletIdsToResolve.size > 0) {
        console.log('[API] Resolving', walletIdsToResolve.size, 'contract party profile(s) by walletId');
        const profileMap = new Map<string, ProfileLookupResult>();
        const resolvePromises = Array.from(walletIdsToResolve).map(async (walletId) => {
          const profile = await resolveProfileByWalletId(walletId);
          if (profile) {
            profileMap.set(walletId, profile);
          }
        });
        await Promise.all(resolvePromises);

        // Enrich parties with resolved profiles
        data.parties = data.parties.map((p: { userId?: string; displayName: string; profileImageUrl?: string; initialsColor?: string }) => {
          const walletId = p.userId || (isUUID(p.displayName) ? p.displayName : null);
          if (walletId && profileMap.has(walletId)) {
            const profile = profileMap.get(walletId)!;
            return {
              ...p,
              displayName: profile.displayName || p.displayName,
              profileImageUrl: profile.profileImageUrl || p.profileImageUrl,
              initialsColor: profile.initialsColor || p.initialsColor,
              isVerified: profile.isVerified,
              verificationLevel: profile.verificationLevel,
            };
          }
          return p;
        });

        // Also update counterparty convenience field if present
        if (data.counterparty) {
          const cpWalletId = data.counterparty.userId || (isUUID(data.counterparty.displayName) ? data.counterparty.displayName : null);
          if (cpWalletId && profileMap.has(cpWalletId)) {
            const profile = profileMap.get(cpWalletId)!;
            data.counterparty = {
              ...data.counterparty,
              displayName: profile.displayName || data.counterparty.displayName,
              profileImageUrl: profile.profileImageUrl || data.counterparty.profileImageUrl,
              initialsColor: profile.initialsColor || data.counterparty.initialsColor,
            };
          }
        }
      }
    }

    // Debug: Log party profile info
    if (data.parties?.length > 0) {
      data.parties.forEach((p: { displayName: string; profileImageUrl?: string }) => {
        console.log(`[API] Contract party ${p.displayName} - profileImageUrl:`, p.profileImageUrl || 'NOT SET');
      });
    }

    return data;
  },

  /**
   * Create a new contract
   * User becomes the creator party
   *
   * @param request Contract creation details
   */
  async createContract(request: CreateContractRequest): Promise<Contract> {
    console.log('[API] createContract - creating:', request);
    const { data } = await apiClient.post('/mobile/contracts', request);
    console.log('[API] createContract - created:', data.id);
    return data;
  },

  /**
   * Accept a contract invitation
   * Called by counterparty to accept proposed contract
   *
   * @param contractId The contract ID to accept
   */
  async acceptContract(contractId: string): Promise<Contract> {
    console.log('[API] acceptContract - START');
    console.log('[API] acceptContract - contractId:', contractId);
    console.log('[API] acceptContract - endpoint:', `/mobile/contracts/${contractId}/accept`);
    console.log('[API] acceptContract - body:', JSON.stringify({ consent: true }));

    try {
      const { data } = await apiClient.post(`/mobile/contracts/${contractId}/accept`, { consent: true });
      console.log('[API] acceptContract - SUCCESS');
      console.log('[API] acceptContract - response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error: any) {
      console.log('[API] acceptContract - ERROR');
      console.log('[API] acceptContract - error message:', error.message);
      console.log('[API] acceptContract - error status:', error.response?.status);
      console.log('[API] acceptContract - error data:', JSON.stringify(error.response?.data, null, 2));
      throw error;
    }
  },

  /**
   * Decline a contract invitation
   * Called by counterparty to decline proposed contract
   *
   * @param contractId The contract ID to decline
   */
  async declineContract(contractId: string): Promise<{ success: boolean }> {
    console.log('[API] declineContract - declining:', contractId);
    const { data } = await apiClient.post(`/mobile/contracts/${contractId}/decline`);
    console.log('[API] declineContract - declined');
    return data;
  },

  /**
   * Fund a contract
   * Creates escrow hold on user's account for their stake
   *
   * @param contractId The contract ID to fund
   * @param accountId The bank account ID to fund from
   * @param idempotencyKey Unique key to prevent duplicate funding
   */
  async fundContract(
    contractId: string,
    accountId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; escrowId: string }> {
    console.log('[API] fundContract - START');
    console.log('[API] fundContract - contractId:', contractId);
    console.log('[API] fundContract - accountId:', accountId);
    console.log('[API] fundContract - idempotencyKey:', idempotencyKey);
    console.log('[API] fundContract - endpoint:', `/mobile/contracts/${contractId}/fund`);

    try {
      const { data } = await apiClient.post(
        `/mobile/contracts/${contractId}/fund`,
        { accountId },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
      console.log('[API] fundContract - SUCCESS');
      console.log('[API] fundContract - response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error: any) {
      console.log('[API] fundContract - ERROR');
      console.log('[API] fundContract - error message:', error.message);
      console.log('[API] fundContract - error status:', error.response?.status);
      console.log('[API] fundContract - error data:', JSON.stringify(error.response?.data, null, 2));
      throw error;
    }
  },

  /**
   * Cancel a contract
   * Only creator can cancel, only while in draft/proposed state
   *
   * @param contractId The contract ID to cancel
   */
  async cancelContract(contractId: string): Promise<{ success: boolean }> {
    console.log('[API] cancelContract - cancelling:', contractId);
    const { data } = await apiClient.post(`/mobile/contracts/${contractId}/cancel`);
    console.log('[API] cancelContract - cancelled');
    return data;
  },

  /**
   * Get available oracle events
   * Returns upcoming events user can create contracts for
   *
   * @param oracleId Optional filter by oracle
   * @param eventType Optional filter by event type
   */
  async getOracleEvents(
    oracleId?: string,
    eventType?: string
  ): Promise<{ events: OracleEvent[] }> {
    console.log('[API] getOracleEvents - fetching...');
    const params: Record<string, string> = {};
    if (oracleId) params.oracleId = oracleId;
    if (eventType) params.eventType = eventType;
    const { data } = await apiClient.get('/mobile/contracts/events', { params });
    console.log('[API] getOracleEvents - received:', data.events?.length || 0, 'events');
    return data;
  },

  // ==================
  // Identity Verification Endpoints
  // ==================

  /**
   * Register device signing key with WSIM
   * This must be called before submitting verification so the server can validate signatures.
   * The key is used for HMAC-SHA256 signing of verification payloads.
   *
   * @param deviceId The unique device identifier
   * @param signingKey The hex-encoded signing key (shared secret for HMAC)
   * @returns Registration result
   */
  async registerDeviceKey(deviceId: string, signingKey: string): Promise<{
    success: boolean;
    registered: boolean;
    deviceId: string;
  }> {
    console.log('[API] registerDeviceKey - registering device:', deviceId);
    try {
      const { data } = await apiClient.post('/mobile/device/register-key', {
        deviceId,
        publicKey: signingKey,  // WSIM expects 'publicKey' field name
        keyType: 'HMAC-SHA256',
      });
      console.log('[API] registerDeviceKey - success:', data);
      return data;
    } catch (error: any) {
      // If already registered, that's fine
      if (error.response?.status === 409) {
        console.log('[API] registerDeviceKey - already registered');
        return { success: true, registered: true, deviceId };
      }
      console.error('[API] registerDeviceKey - failed:', error.response?.status, error.response?.data);
      throw error;
    }
  },

  /**
   * Submit signed verification result to server
   * Server validates signature and records verification status
   *
   * @param signedVerification The signed verification payload from createSignedVerification()
   * @returns Verification result with ID and status
   */
  async submitVerification(signedVerification: SignedVerification): Promise<{
    success: boolean;
    verificationId: string;
    isVerified: boolean;
    verifiedAt: string;
    verificationLevel: VerificationLevel;
  }> {
    console.log('[API] submitVerification - submitting...');
    try {
      const { data } = await apiClient.post('/mobile/verification/submit', {
        signedVerification,
      });
      console.log('[API] submitVerification - success:', data);

      // Update cached user with verification status
      const existingUser = await secureStorage.getUserData<Record<string, unknown>>();
      if (existingUser) {
        await secureStorage.setUserData({
          ...existingUser,
          isVerified: data.isVerified,
          verifiedAt: data.verifiedAt,
          verificationLevel: data.verificationLevel,
        });
        console.log('[API] submitVerification - cached user updated');
      }

      return data;
    } catch (error: any) {
      console.error('[API] submitVerification - failed:', error.response?.status, error.response?.data);
      throw error;
    }
  },

  /**
   * Remove identity verification from account
   * Clears verification status so user can re-verify
   * Used for testing the verification flow
   */
  async removeVerification(): Promise<{ success: boolean }> {
    console.log('[API] removeVerification - removing...');
    const { data } = await apiClient.delete('/mobile/verification');
    console.log('[API] removeVerification - success');

    // Update cached user to clear verification status
    const existingUser = await secureStorage.getUserData<Record<string, unknown>>();
    if (existingUser) {
      await secureStorage.setUserData({
        ...existingUser,
        isVerified: false,
        verifiedAt: null,
        verificationLevel: 'none',
      });
      console.log('[API] removeVerification - cached user updated');
    }

    return data;
  },

  /**
   * Delete user account entirely
   * WARNING: This is irreversible! Removes all WSIM account data.
   * Used for testing - allows user to start fresh
   */
  async deleteAccount(): Promise<{ success: boolean }> {
    console.log('[API] deleteAccount - deleting...');
    const { data } = await apiClient.delete('/mobile/account');
    console.log('[API] deleteAccount - success');
    // Clear local storage after account deletion
    await secureStorage.clearAll();
    return data;
  },
};
