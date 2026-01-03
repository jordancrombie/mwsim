/**
 * TransferSim P2P Service
 *
 * Handles all P2P transfer operations via the TransferSim API.
 * This is a separate service from the main WSIM API.
 *
 * Authentication:
 * - X-API-Key: Orchestrator API key (mwsim is registered as an orchestrator)
 * - Authorization: Bearer userId:bsimId (identifies the user making the request)
 *
 * Environment:
 * - Development: https://transfersim-dev.banksim.ca
 * - Production: https://transfersim.banksim.ca
 * - Controlled via iOS Settings > mwsim > Server
 */
import axios, { AxiosInstance } from 'axios';
import { secureStorage } from './secureStorage';
import { getTransferSimUrl } from './environment';
import type {
  Alias,
  AliasType,
  AliasLookupResult,
  P2PEnrollment,
  Transfer,
  ReceiveToken,
  ResolvedToken,
  BankAccount,
  MerchantProfile,
  MerchantCategory,
  MerchantEnrollmentRequest,
  ResolvedMerchantToken,
  TransferWithRecipientType,
} from '../types';

// TransferSim API key (same key works for both environments)
const TRANSFERSIM_API_KEY = 'tsim_1c34f53eabdeb18474b87ec27b093d5c481ff08a0b5e07267dcaf183d1ee52af';

// Lazy-initialized TransferSim API client
// We don't create this at module load time because getTransferSimUrl()
// needs React Native's native modules to be fully initialized
let _transferSimClient: AxiosInstance | null = null;

const getTransferSimClient = (): AxiosInstance => {
  if (_transferSimClient) {
    return _transferSimClient;
  }

  const baseURL = getTransferSimUrl();
  console.log(`[TransferSim] Initializing client: ${baseURL}`);

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': TRANSFERSIM_API_KEY,
    },
  });

  // Request interceptor - add user authorization
  client.interceptors.request.use(async (requestConfig) => {
    // Get user context for Authorization header
    const userContext = await secureStorage.getP2PUserContext();
    if (userContext) {
      requestConfig.headers.Authorization = `Bearer ${userContext.userId}:${userContext.bsimId}`;
    }
    return requestConfig;
  });

  // Response interceptor - log errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      console.log('[TransferSim] API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );

  _transferSimClient = client;
  return client;
};

// API response types
interface EnrollmentResponse {
  enrollmentId: string;
  userId: string;
  bsimId: string;
  enrolledAt: string;
}

interface AliasResponse {
  id: string;
  type: AliasType;
  value: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: string;
}

interface TransferResponse {
  transferId: string;
  status: string;
  amount: number;
  recipientDisplayName: string;
  createdAt: string;
}

interface TransferListResponse {
  transfers: Transfer[];
  total: number;
}

export const transferSimApi = {
  // ==================
  // Enrollment
  // ==================

  /**
   * Check if user is enrolled in P2P network
   */
  async checkEnrollment(): Promise<{ enrolled: boolean; enrollment?: P2PEnrollment }> {
    try {
      const { data } = await getTransferSimClient().get('/api/v1/enrollments');
      if (data.enrollments && data.enrollments.length > 0) {
        return { enrolled: true, enrollment: data.enrollments[0] };
      }
      return { enrolled: false };
    } catch (error: any) {
      // 404 means not enrolled
      if (error.response?.status === 404) {
        return { enrolled: false };
      }
      throw error;
    }
  },

  /**
   * Enroll user in P2P network
   */
  async enrollUser(userId: string, bsimId: string): Promise<P2PEnrollment> {
    const { data } = await getTransferSimClient().post<EnrollmentResponse>('/api/v1/enrollments', {
      userId,
      bsimId,
      consentScopes: ['p2p:send', 'p2p:receive', 'p2p:alias'],
    });
    return {
      enrollmentId: data.enrollmentId,
      userId: data.userId,
      bsimId: data.bsimId,
      enrolledAt: data.enrolledAt,
      isActive: true,
    };
  },

  // ==================
  // Aliases
  // ==================

  /**
   * Get user's aliases
   */
  async getAliases(): Promise<Alias[]> {
    const { data } = await getTransferSimClient().get<{ aliases: AliasResponse[] }>('/api/v1/aliases');
    return data.aliases.map((a) => ({
      id: a.id,
      type: a.type,
      value: a.value,
      isPrimary: a.isPrimary,
      isVerified: a.isVerified,
      createdAt: a.createdAt,
    }));
  },

  /**
   * Register a new alias
   */
  async createAlias(type: AliasType, value: string): Promise<Alias> {
    const { data } = await getTransferSimClient().post<AliasResponse>('/api/v1/aliases', {
      type,
      value,
    });
    return {
      id: data.id,
      type: data.type,
      value: data.value,
      isPrimary: data.isPrimary,
      isVerified: data.isVerified,
      createdAt: data.createdAt,
    };
  },

  /**
   * Delete an alias
   */
  async deleteAlias(aliasId: string): Promise<void> {
    await getTransferSimClient().delete(`/api/v1/aliases/${aliasId}`);
  },

  /**
   * Set alias as primary
   */
  async setPrimaryAlias(aliasId: string): Promise<void> {
    await getTransferSimClient().put(`/api/v1/aliases/${aliasId}/primary`);
  },

  /**
   * Verify alias (for email/phone)
   */
  async verifyAlias(aliasId: string, code: string): Promise<{ verified: boolean }> {
    const { data } = await getTransferSimClient().post(`/api/v1/aliases/${aliasId}/verify`, { code });
    return data;
  },

  /**
   * Look up an alias (for sending)
   */
  async lookupAlias(alias: string): Promise<AliasLookupResult> {
    const { data } = await getTransferSimClient().get<AliasLookupResult>('/api/v1/aliases/lookup', {
      params: { alias },
    });
    return data;
  },

  // ==================
  // Transfers
  // ==================

  /**
   * Initiate a P2P transfer
   * @param senderBsimId - Required for multi-bank support. Identifies which bank to debit.
   */
  async sendMoney(
    recipientAlias: string,
    amount: number,
    sourceAccountId: string,
    senderBsimId: string,
    description?: string
  ): Promise<{ transferId: string; status: string }> {
    const { data } = await getTransferSimClient().post<TransferResponse>('/api/v1/transfers', {
      recipientAlias,
      amount,
      currency: 'CAD',
      sourceAccountId,
      senderBsimId,
      description,
    });
    return {
      transferId: data.transferId,
      status: data.status,
    };
  },

  /**
   * Get transfer details
   */
  async getTransfer(transferId: string): Promise<Transfer> {
    const { data } = await getTransferSimClient().get<Transfer>(`/api/v1/transfers/${transferId}`);
    return data;
  },

  /**
   * Get transfer history
   */
  async getTransfers(
    direction?: 'sent' | 'received' | 'all',
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transfers: Transfer[]; total: number }> {
    const { data } = await getTransferSimClient().get<TransferListResponse>('/api/v1/transfers', {
      params: { direction: direction || 'all', limit, offset },
    });
    return data;
  },

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId: string): Promise<void> {
    await getTransferSimClient().post(`/api/v1/transfers/${transferId}/cancel`);
  },

  // ==================
  // Tokens (QR/NFC)
  // ==================

  /**
   * Generate a receive token (for QR code display)
   */
  async generateReceiveToken(amount?: number, description?: string): Promise<ReceiveToken> {
    const { data } = await getTransferSimClient().post<ReceiveToken>('/api/v1/tokens/receive', {
      amount,
      description,
      expiresInSeconds: 300, // 5 minutes
    });
    return data;
  },

  /**
   * Resolve a token (when scanning QR)
   */
  async resolveToken(tokenId: string): Promise<ResolvedToken> {
    const { data } = await getTransferSimClient().get<ResolvedToken>(`/api/v1/tokens/${tokenId}`);
    return data;
  },

  // ==================
  // Accounts (via WSIM Open Banking)
  // ==================

  /**
   * Get user's bank accounts for P2P transfers
   * Calls WSIM proxy endpoint which fetches accounts from BSIM Open Banking API
   * using the user's stored OAuth tokens.
   */
  async getAccounts(): Promise<BankAccount[]> {
    console.log('[TransferSim] getAccounts - fetching from WSIM proxy');
    try {
      // Import api dynamically to avoid circular dependency
      const { api } = await import('./api');
      const { accounts } = await api.getAccounts();

      console.log(`[TransferSim] getAccounts - received ${accounts.length} accounts from WSIM`);

      // Map WSIM response to BankAccount type
      return accounts.map((account) => ({
        accountId: account.accountId,
        accountType: account.accountType as 'CHECKING' | 'SAVINGS',
        displayName: account.displayName,
        balance: account.balance,
        currency: account.currency,
        bankName: account.bankName,
        bankLogoUrl: account.bankLogoUrl,
        bsimId: account.bsimId,
      }));
    } catch (error: any) {
      console.error('[TransferSim] getAccounts error:', error.message);
      // Return empty array on error - UI will show appropriate message
      return [];
    }
  },

  // ==================
  // Micro Merchant
  // ==================

  /**
   * Check if user is enrolled as a Micro Merchant
   * GET /api/v1/micro-merchants/me
   */
  async getMerchantProfile(): Promise<MerchantProfile | null> {
    try {
      const { data } = await getTransferSimClient().get<MerchantProfile>('/api/v1/micro-merchants/me');
      return data;
    } catch (error: any) {
      // 404 means not enrolled as merchant
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Enroll as a Micro Merchant
   * POST /api/v1/micro-merchants
   */
  async enrollMerchant(request: MerchantEnrollmentRequest): Promise<MerchantProfile> {
    const { data } = await getTransferSimClient().post<MerchantProfile>('/api/v1/micro-merchants', request);
    return data;
  },

  /**
   * Update Micro Merchant profile
   * PUT /api/v1/micro-merchants/me
   */
  async updateMerchantProfile(updates: {
    businessName?: string;
    category?: MerchantCategory;
    receivingAccountId?: string;
  }): Promise<MerchantProfile> {
    const { data } = await getTransferSimClient().put<MerchantProfile>('/api/v1/micro-merchants/me', updates);
    return data;
  },

  /**
   * Deactivate Micro Merchant account
   * DELETE /api/v1/micro-merchants/me (or POST with isActive: false)
   */
  async deactivateMerchant(): Promise<void> {
    await getTransferSimClient().put('/api/v1/micro-merchants/me', { isActive: false });
  },

  /**
   * Generate a merchant receive token (for QR code display)
   * Uses the standard token endpoint with asMerchant: true
   * POST /api/v1/tokens/receive
   */
  async generateMerchantToken(amount?: number, description?: string): Promise<ReceiveToken> {
    const { data } = await getTransferSimClient().post<ReceiveToken>('/api/v1/tokens/receive', {
      amount,
      description,
      asMerchant: true,  // Key flag to generate merchant token
      expiresInSeconds: 300, // 5 minutes
    });
    return data;
  },

  /**
   * Resolve a token (when scanning QR)
   * Returns recipientType and merchant info automatically
   * GET /api/v1/tokens/:tokenId
   */
  async resolveTokenWithMerchantInfo(tokenId: string): Promise<ResolvedMerchantToken> {
    const { data } = await getTransferSimClient().get<ResolvedMerchantToken>(`/api/v1/tokens/${tokenId}`);
    // Ensure we have a recipientType, default to 'individual' if not provided
    return {
      ...data,
      recipientType: data.recipientType || 'individual',
    };
  },

  /**
   * Get merchant transaction history (received payments as merchant)
   * GET /api/v1/micro-merchants/me/transactions
   */
  async getMerchantTransfers(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transfers: TransferWithRecipientType[]; total: number }> {
    const { data } = await getTransferSimClient().get<{ transfers: TransferWithRecipientType[]; total: number }>(
      '/api/v1/micro-merchants/me/transactions',
      { params: { limit, offset } }
    );
    return data;
  },

  /**
   * Get merchant dashboard stats (today's revenue, transaction count)
   * GET /api/v1/micro-merchants/me/dashboard
   */
  async getMerchantStats(): Promise<{ todayRevenue: number; todayTransactionCount: number; weekRevenue: number }> {
    const { data } = await getTransferSimClient().get('/api/v1/micro-merchants/me/dashboard');
    return data;
  },

  /**
   * Calculate fee for a given amount (for display purposes)
   * Fee structure: $0.25 for amounts < $200, $0.50 for amounts >= $200
   */
  calculateMerchantFee(amount: number): number {
    if (amount < 200) {
      return 0.25;
    }
    return 0.50;
  },
};
