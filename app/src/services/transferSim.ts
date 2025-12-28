/**
 * TransferSim P2P Service
 *
 * Handles all P2P transfer operations via the TransferSim API.
 * This is a separate service from the main WSIM API.
 *
 * Authentication:
 * - X-API-Key: Orchestrator API key (mwsim is registered as an orchestrator)
 * - Authorization: Bearer userId:bsimId (identifies the user making the request)
 */
import axios, { AxiosInstance } from 'axios';
import { secureStorage } from './secureStorage';
import type {
  Alias,
  AliasType,
  AliasLookupResult,
  P2PEnrollment,
  Transfer,
  ReceiveToken,
  ResolvedToken,
  BankAccount,
} from '../types';

// TransferSim configuration
// For development, use localhost. For production, use transfersim-dev.banksim.ca
const TRANSFERSIM_URL = 'http://localhost:3010';
const TRANSFERSIM_API_KEY = 'tsim_1c34f53eabdeb18474b87ec27b093d5c481ff08a0b5e07267dcaf183d1ee52af';

// Create TransferSim API client
const createTransferSimClient = (): AxiosInstance => {
  console.log(`[TransferSim] Initializing client: ${TRANSFERSIM_URL}`);

  const client = axios.create({
    baseURL: TRANSFERSIM_URL,
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

  return client;
};

const transferSimClient = createTransferSimClient();

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
      const { data } = await transferSimClient.get('/api/v1/enrollments');
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
    const { data } = await transferSimClient.post<EnrollmentResponse>('/api/v1/enrollments', {
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
    const { data } = await transferSimClient.get<{ aliases: AliasResponse[] }>('/api/v1/aliases');
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
    const { data } = await transferSimClient.post<AliasResponse>('/api/v1/aliases', {
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
    await transferSimClient.delete(`/api/v1/aliases/${aliasId}`);
  },

  /**
   * Set alias as primary
   */
  async setPrimaryAlias(aliasId: string): Promise<void> {
    await transferSimClient.put(`/api/v1/aliases/${aliasId}/primary`);
  },

  /**
   * Verify alias (for email/phone)
   */
  async verifyAlias(aliasId: string, code: string): Promise<{ verified: boolean }> {
    const { data } = await transferSimClient.post(`/api/v1/aliases/${aliasId}/verify`, { code });
    return data;
  },

  /**
   * Look up an alias (for sending)
   */
  async lookupAlias(alias: string): Promise<AliasLookupResult> {
    const { data } = await transferSimClient.get<AliasLookupResult>('/api/v1/aliases/lookup', {
      params: { alias },
    });
    return data;
  },

  // ==================
  // Transfers
  // ==================

  /**
   * Initiate a P2P transfer
   */
  async sendMoney(
    recipientAlias: string,
    amount: number,
    sourceAccountId: string,
    description?: string
  ): Promise<{ transferId: string; status: string }> {
    const { data } = await transferSimClient.post<TransferResponse>('/api/v1/transfers', {
      recipientAlias,
      amount,
      currency: 'CAD',
      sourceAccountId,
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
    const { data } = await transferSimClient.get<Transfer>(`/api/v1/transfers/${transferId}`);
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
    const { data } = await transferSimClient.get<TransferListResponse>('/api/v1/transfers', {
      params: { direction: direction || 'all', limit, offset },
    });
    return data;
  },

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId: string): Promise<void> {
    await transferSimClient.post(`/api/v1/transfers/${transferId}/cancel`);
  },

  // ==================
  // Tokens (QR/NFC)
  // ==================

  /**
   * Generate a receive token (for QR code display)
   */
  async generateReceiveToken(amount?: number, description?: string): Promise<ReceiveToken> {
    const { data } = await transferSimClient.post<ReceiveToken>('/api/v1/tokens/receive', {
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
    const { data } = await transferSimClient.get<ResolvedToken>(`/api/v1/tokens/${tokenId}`);
    return data;
  },

  // ==================
  // Accounts (via WSIM Open Banking)
  // ==================

  /**
   * Get user's bank accounts for P2P transfers
   * Note: This calls WSIM/BSIM Open Banking API, not TransferSim
   */
  async getAccounts(): Promise<BankAccount[]> {
    // TODO: Implement via WSIM Open Banking API
    // For now, return mock data for development
    console.log('[TransferSim] getAccounts - returning mock data for development');
    return [
      {
        accountId: 'acc_mock_checking_001',
        accountType: 'CHECKING',
        displayName: 'Chequing ****1234',
        balance: 1500.00,
        currency: 'CAD',
        bankName: 'Bank Simulator',
        bsimId: 'bsim-dev-001',
      },
      {
        accountId: 'acc_mock_savings_001',
        accountType: 'SAVINGS',
        displayName: 'Savings ****5678',
        balance: 5000.00,
        currency: 'CAD',
        bankName: 'Bank Simulator',
        bsimId: 'bsim-dev-001',
      },
    ];
  },
};
