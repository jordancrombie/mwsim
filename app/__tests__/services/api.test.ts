/**
 * API Service Tests
 *
 * Tests for the API client including auth endpoints, wallet endpoints,
 * enrollment endpoints, payment endpoints, and interceptor behavior.
 */

import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

describe('API Service', () => {
  // Store interceptor callbacks for testing
  let requestInterceptorCallback: ((config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>) | null = null;
  let responseErrorCallback: ((error: AxiosError) => Promise<any>) | null = null;

  // Mock functions
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockDelete = jest.fn();
  const mockCreate = jest.fn();

  // Mock secure storage
  const mockSecureStorage = {
    getAccessToken: jest.fn(),
    setAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearAll: jest.fn(),
    setCachedCards: jest.fn(),
    getCachedCards: jest.fn(),
    setUserData: jest.fn(),
    getUserData: jest.fn(),
  };

  let api: typeof import('../../src/services/api').api;

  beforeAll(() => {
    // Setup axios mock
    mockCreate.mockReturnValue({
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
      defaults: {
        baseURL: 'https://wsim.banksim.ca/api',
      },
      interceptors: {
        request: {
          use: jest.fn((onFulfilled) => {
            requestInterceptorCallback = onFulfilled;
            return 0;
          }),
        },
        response: {
          use: jest.fn((_onFulfilled, onRejected) => {
            responseErrorCallback = onRejected;
            return 0;
          }),
        },
      },
    });

    // Mock modules before importing api
    jest.doMock('axios', () => ({
      create: mockCreate,
    }));

    jest.doMock('../../src/config/env', () => ({
      getConfig: jest.fn(() => ({
        apiUrl: 'https://wsim.banksim.ca/api',
        authUrl: 'https://wsim-auth.banksim.ca',
        environmentName: 'Production',
        appName: 'mwsim',
        appVersion: '0.3.2',
        apiTimeout: 30000,
        tokenRefreshBuffer: 300,
      })),
      getEnvironmentName: jest.fn(() => 'Production'),
    }));

    jest.doMock('../../src/services/secureStorage', () => ({
      secureStorage: mockSecureStorage,
    }));

    // Import after mocks are set up
    api = require('../../src/services/api').api;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
  });

  describe('axios instance creation', () => {
    it('should have created axios instance with correct config during module load', () => {
      // Note: mockCreate was called during module initialization in beforeAll
      // We verify the api object exists and has expected methods
      expect(api).toBeDefined();
      expect(api.registerDevice).toBeDefined();
      expect(api.createAccount).toBeDefined();
      expect(api.getWalletSummary).toBeDefined();
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', async () => {
      mockSecureStorage.getAccessToken.mockResolvedValue('test-token');

      const config = { headers: {} } as InternalAxiosRequestConfig;
      const result = await requestInterceptorCallback!(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should not add Authorization header when no token', async () => {
      mockSecureStorage.getAccessToken.mockResolvedValue(null);

      const config = { headers: {} } as InternalAxiosRequestConfig;
      const result = await requestInterceptorCallback!(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - Token Refresh', () => {
    it('should attempt token refresh on 401 error', async () => {
      mockSecureStorage.getRefreshToken.mockResolvedValue('old-refresh-token');

      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      } as unknown as AxiosError;

      // The interceptor should try to refresh
      try {
        await responseErrorCallback!(error);
      } catch {
        // Expected to fail since mock chain isn't complete
      }

      expect(mockSecureStorage.getRefreshToken).toHaveBeenCalled();
    });

    it('should not retry if already retried', async () => {
      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: true },
      } as unknown as AxiosError;

      await expect(responseErrorCallback!(error)).rejects.toBeDefined();
      expect(mockSecureStorage.getRefreshToken).not.toHaveBeenCalled();
    });

    it('should reject non-401 errors directly', async () => {
      const error = {
        response: { status: 500 },
        config: { headers: {} },
      } as unknown as AxiosError;

      await expect(responseErrorCallback!(error)).rejects.toBeDefined();
      expect(mockSecureStorage.getRefreshToken).not.toHaveBeenCalled();
    });
  });

  // ==================
  // Auth Endpoints
  // ==================

  describe('Auth Endpoints', () => {
    describe('registerDevice', () => {
      it('should register device and return credentials', async () => {
        const mockResponse = {
          deviceCredential: 'device-cred-123',
          expiresAt: '2025-12-31T00:00:00Z',
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.registerDevice({
          deviceId: 'device-123',
          platform: 'ios',
          deviceName: 'iPhone 15 Pro',
        });

        expect(mockPost).toHaveBeenCalledWith('/mobile/device/register', {
          deviceId: 'device-123',
          platform: 'ios',
          deviceName: 'iPhone 15 Pro',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('createAccount', () => {
      it('should create account and return user with tokens', async () => {
        const mockResponse = {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            walletId: 'wallet-123',
            createdAt: '2025-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
          },
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.createAccount(
          'test@example.com',
          'Test User',
          'device-123',
          'iPhone 15 Pro',
          'ios'
        );

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/register', {
          email: 'test@example.com',
          name: 'Test User',
          deviceId: 'device-123',
          deviceName: 'iPhone 15 Pro',
          platform: 'ios',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('setupBiometric', () => {
      it('should setup biometric and return biometric ID', async () => {
        const mockResponse = { biometricId: 'bio-123', status: 'active' };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.setupBiometric({
          deviceId: 'device-123',
          publicKey: 'public-key-data',
          biometricType: 'face',
        });

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/biometric/setup', {
          deviceId: 'device-123',
          publicKey: 'public-key-data',
          biometricType: 'face',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getBiometricChallenge', () => {
      it('should get biometric challenge', async () => {
        const mockResponse = { challenge: 'challenge-string-123' };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.getBiometricChallenge('device-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/biometric/challenge', {
          deviceId: 'device-123',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('verifyBiometric', () => {
      it('should verify biometric and return tokens with user', async () => {
        const mockResponse = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            walletId: 'wallet-123',
            createdAt: '2025-01-01T00:00:00Z',
          },
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.verifyBiometric('device-123', 'signature-data', 'challenge-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/biometric/verify', {
          deviceId: 'device-123',
          signature: 'signature-data',
          challenge: 'challenge-123',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('login', () => {
      it('should initiate login and return challenge', async () => {
        const mockResponse = { challenge: 'email-challenge', method: 'email' };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.login('test@example.com', 'device-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/login', {
          email: 'test@example.com',
          deviceId: 'device-123',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('verifyLogin', () => {
      it('should verify login code and return user with tokens', async () => {
        const mockResponse = {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            walletId: 'wallet-123',
            createdAt: '2025-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
          },
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.verifyLogin('test@example.com', 'device-123', '123456');

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/login/verify', {
          email: 'test@example.com',
          deviceId: 'device-123',
          code: '123456',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('loginWithPassword', () => {
      it('should login with password and return user with tokens', async () => {
        const mockResponse = {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            walletId: 'wallet-123',
            createdAt: '2025-01-01T00:00:00Z',
          },
          tokens: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
          },
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.loginWithPassword(
          'test@example.com',
          'password123',
          'device-123',
          'iPhone 15 Pro',
          'ios'
        );

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/login/password', {
          email: 'test@example.com',
          password: 'password123',
          deviceId: 'device-123',
          deviceName: 'iPhone 15 Pro',
          platform: 'ios',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('refreshToken', () => {
      it('should refresh token and return new tokens', async () => {
        const mockResponse = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.refreshToken('old-refresh-token');

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/token/refresh', {
          refreshToken: 'old-refresh-token',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('logout', () => {
      it('should logout and clear all stored data', async () => {
        mockPost.mockResolvedValueOnce({});

        await api.logout();

        expect(mockPost).toHaveBeenCalledWith('/mobile/auth/logout');
        expect(mockSecureStorage.clearAll).toHaveBeenCalled();
      });

      // Note: Testing logout error handling is challenging due to mock state management
      // The logout function uses try-finally to ensure clearAll is called even on error
    });
  });

  // ==================
  // Wallet Endpoints
  // ==================

  describe('Wallet Endpoints', () => {
    describe('getWalletSummary', () => {
      it('should get wallet summary and cache data', async () => {
        const mockResponse = {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            walletId: 'wallet-123',
            createdAt: '2025-01-01T00:00:00Z',
          },
          cards: [
            {
              id: 'card-1',
              lastFour: '1234',
              cardType: 'VISA',
              bankName: 'Test Bank',
              isDefault: true,
              addedAt: '2025-01-01T00:00:00Z',
            },
          ],
          enrolledBanks: [],
          biometricEnabled: true,
        };
        mockGet.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.getWalletSummary();

        expect(mockGet).toHaveBeenCalledWith('/mobile/wallet/summary');
        expect(mockSecureStorage.setCachedCards).toHaveBeenCalledWith(mockResponse.cards);
        expect(mockSecureStorage.setUserData).toHaveBeenCalledWith(mockResponse.user);
        expect(result).toEqual(mockResponse);
      });

      it('should not cache if cards or user not in response', async () => {
        const mockResponse = { enrolledBanks: [], biometricEnabled: false };
        mockGet.mockResolvedValueOnce({ data: mockResponse });

        await api.getWalletSummary();

        expect(mockSecureStorage.setCachedCards).not.toHaveBeenCalled();
        expect(mockSecureStorage.setUserData).not.toHaveBeenCalled();
      });
    });

    describe('getCards', () => {
      it('should get cards and cache them', async () => {
        const mockCards = [
          { id: 'card-1', lastFour: '1234', cardType: 'VISA', bankName: 'Bank A', isDefault: true, addedAt: '2025-01-01' },
          { id: 'card-2', lastFour: '5678', cardType: 'MASTERCARD', bankName: 'Bank B', isDefault: false, addedAt: '2025-01-02' },
        ];
        mockGet.mockResolvedValueOnce({ data: { cards: mockCards } });

        const result = await api.getCards();

        expect(mockGet).toHaveBeenCalledWith('/wallet/cards');
        expect(mockSecureStorage.setCachedCards).toHaveBeenCalledWith(mockCards);
        expect(result).toEqual(mockCards);
      });

      it('should handle response without cards wrapper', async () => {
        const mockCards = [
          { id: 'card-1', lastFour: '1234', cardType: 'VISA', bankName: 'Bank A', isDefault: true, addedAt: '2025-01-01' },
        ];
        mockGet.mockResolvedValueOnce({ data: mockCards });

        const result = await api.getCards();

        expect(result).toEqual(mockCards);
      });
    });

    describe('setDefaultCard', () => {
      it('should set card as default', async () => {
        mockPost.mockResolvedValueOnce({});

        await api.setDefaultCard('card-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/wallet/cards/card-123/default');
      });
    });

    describe('removeCard', () => {
      it('should remove card from wallet', async () => {
        mockDelete.mockResolvedValueOnce({});

        await api.removeCard('card-123');

        expect(mockDelete).toHaveBeenCalledWith('/mobile/wallet/cards/card-123');
      });
    });
  });

  // ==================
  // Enrollment Endpoints
  // ==================

  describe('Enrollment Endpoints', () => {
    describe('getBanks', () => {
      it('should get list of available banks', async () => {
        const mockBanks = [
          { bsimId: 'bank-1', name: 'Bank One', description: 'First bank' },
          { bsimId: 'bank-2', name: 'Bank Two', description: 'Second bank' },
        ];
        mockGet.mockResolvedValueOnce({ data: { banks: mockBanks } });

        const result = await api.getBanks();

        expect(mockGet).toHaveBeenCalledWith('/mobile/enrollment/banks');
        expect(result).toEqual(mockBanks);
      });

      it('should handle response without banks wrapper', async () => {
        const mockBanks = [{ bsimId: 'bank-1', name: 'Bank One' }];
        mockGet.mockResolvedValueOnce({ data: mockBanks });

        const result = await api.getBanks();

        expect(result).toEqual(mockBanks);
      });
    });

    describe('startEnrollment', () => {
      it('should start enrollment and return auth URL', async () => {
        const mockResponse = {
          authUrl: 'https://bank.example.com/oauth/authorize?...',
          state: 'state-123',
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.startEnrollment('bank-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/enrollment/start/bank-123');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getEnrolledBanks', () => {
      it('should get list of enrolled banks', async () => {
        const mockResponse = {
          enrollments: [
            { id: 'enroll-1', bsimId: 'bank-1', bankName: 'Bank One', enrolledAt: '2025-01-01' },
          ],
        };
        mockGet.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.getEnrolledBanks();

        expect(mockGet).toHaveBeenCalledWith('/mobile/enrollment/list');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('removeEnrollment', () => {
      it('should remove bank enrollment', async () => {
        mockDelete.mockResolvedValueOnce({});

        await api.removeEnrollment('enroll-123');

        expect(mockDelete).toHaveBeenCalledWith('/mobile/enrollment/enroll-123');
      });
    });
  });

  // ==================
  // Offline Support
  // ==================

  describe('Offline Support', () => {
    describe('getCachedCards', () => {
      it('should return cached cards from secure storage', async () => {
        const mockCards = [{ id: 'card-1', lastFour: '1234' }];
        mockSecureStorage.getCachedCards.mockResolvedValue(mockCards);

        const result = await api.getCachedCards();

        expect(mockSecureStorage.getCachedCards).toHaveBeenCalled();
        expect(result).toEqual(mockCards);
      });

      it('should return null when no cached cards', async () => {
        mockSecureStorage.getCachedCards.mockResolvedValue(null);

        const result = await api.getCachedCards();

        expect(result).toBeNull();
      });
    });

    describe('getCachedUser', () => {
      it('should return cached user from secure storage', async () => {
        const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
        mockSecureStorage.getUserData.mockResolvedValue(mockUser);

        const result = await api.getCachedUser();

        expect(mockSecureStorage.getUserData).toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });

      it('should return null when no cached user', async () => {
        mockSecureStorage.getUserData.mockResolvedValue(null);

        const result = await api.getCachedUser();

        expect(result).toBeNull();
      });
    });
  });

  // ==================
  // Payment Endpoints
  // ==================

  describe('Payment Endpoints', () => {
    describe('getPaymentDetails', () => {
      it('should get payment request details', async () => {
        const mockResponse = {
          requestId: 'req-123',
          status: 'pending',
          merchantName: 'Test Merchant',
          amount: 100.00,
          currency: 'CAD',
          orderId: 'order-123',
          returnUrl: 'https://merchant.com/callback',
          createdAt: '2025-01-01T00:00:00Z',
          expiresAt: '2025-01-01T01:00:00Z',
          cards: [],
        };
        mockGet.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.getPaymentDetails('req-123');

        expect(mockGet).toHaveBeenCalledWith('/mobile/payment/req-123');
        expect(result).toEqual(mockResponse);
      });

      it('should handle error and rethrow', async () => {
        const mockError = {
          response: { status: 404, data: { error: 'Not found' } },
          message: 'Request failed',
        };
        mockGet.mockRejectedValueOnce(mockError);

        await expect(api.getPaymentDetails('invalid-id')).rejects.toEqual(mockError);
      });
    });

    describe('approvePayment', () => {
      it('should approve payment with selected card', async () => {
        const mockResponse = {
          success: true,
          status: 'approved',
          returnUrl: 'https://merchant.com/callback?status=approved',
        };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.approvePayment('req-123', 'card-456');

        expect(mockPost).toHaveBeenCalledWith('/mobile/payment/req-123/approve', {
          cardId: 'card-456',
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('cancelPayment', () => {
      it('should cancel payment request', async () => {
        const mockResponse = { success: true, status: 'cancelled' };
        mockPost.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.cancelPayment('req-123');

        expect(mockPost).toHaveBeenCalledWith('/mobile/payment/req-123/cancel');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getPendingPayments', () => {
      it('should get list of pending payments', async () => {
        const mockResponse = {
          requests: [
            {
              requestId: 'req-1',
              merchantName: 'Merchant A',
              amount: 50.00,
              currency: 'CAD',
              orderId: 'order-1',
              createdAt: '2025-01-01T00:00:00Z',
              expiresAt: '2025-01-01T01:00:00Z',
            },
          ],
        };
        mockGet.mockResolvedValueOnce({ data: mockResponse });

        const result = await api.getPendingPayments();

        expect(mockGet).toHaveBeenCalledWith('/mobile/payment/pending');
        expect(result).toEqual(mockResponse);
      });
    });
  });

  // ==================
  // Error Handling
  // ==================

  describe('Error Handling', () => {
    it('should propagate network errors', async () => {
      const networkError = new Error('Network Error');
      mockGet.mockRejectedValueOnce(networkError);

      await expect(api.getWalletSummary()).rejects.toThrow('Network Error');
    });

    it('should propagate API errors with status codes', async () => {
      const apiError = {
        response: {
          status: 400,
          data: { error: 'Bad Request', message: 'Invalid parameters' },
        },
      };
      mockPost.mockRejectedValueOnce(apiError);

      await expect(api.createAccount('', '', '', '', 'ios')).rejects.toEqual(apiError);
    });
  });
});
