// User types
export interface User {
  id: string;
  email: string;
  name: string;
  walletId: string;
  createdAt: string;
  profileImageUrl?: string | null;
}

// Card types
export interface Card {
  id: string;
  lastFour: string;
  cardType: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' | 'DEBIT';
  bankName: string;
  bankLogoUrl?: string;  // Bank logo URL (null if not configured)
  isDefault: boolean;
  addedAt: string;
}

// Bank types
export interface Bank {
  bsimId: string;
  name: string;
  logoUrl?: string;  // Bank logo URL
  description?: string;
}

export interface EnrolledBank {
  bsimId: string;
  name: string;
  logoUrl?: string;  // Bank logo URL
  cardCount: number;
  enrolledAt: string;
  credentialExpiry?: string;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DeviceRegistration {
  deviceId: string;
  platform: 'ios' | 'android';
  deviceName: string;
  pushToken?: string;
}

export interface BiometricSetup {
  deviceId: string;
  publicKey: string;
  biometricType: 'face' | 'fingerprint';
}

// Wallet summary (mobile-optimized response)
export interface WalletSummary {
  user: User;
  cards: Card[];
  enrolledBanks: EnrolledBank[];
  biometricEnabled: boolean;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Order Details types (for enhanced payment approval)
export interface OrderLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  imageUrl?: string;
}

export interface OrderShipping {
  method?: string;
  amount: number;
}

export interface OrderTax {
  amount: number;
  rate?: number;      // 0.13 for 13%
  label?: string;     // "HST", "GST", "Sales Tax"
}

export interface OrderDiscount {
  code?: string;
  description?: string;
  amount: number;     // Positive number (displayed as negative)
}

export interface OrderFee {
  label: string;
  amount: number;
}

export interface OrderDetails {
  version?: number;
  items?: OrderLineItem[];
  subtotal?: number;
  shipping?: OrderShipping;
  tax?: OrderTax;
  discounts?: OrderDiscount[];
  fees?: OrderFee[];
}

// Payment types
export interface PaymentRequest {
  requestId: string;
  status: 'pending' | 'approved' | 'cancelled' | 'expired' | 'completed';
  merchantName: string;
  merchantLogoUrl?: string;
  amount: number;
  currency: string;
  orderId: string;
  orderDescription?: string;
  returnUrl: string;
  createdAt: string;
  expiresAt: string;
  cards: PaymentCard[];
  orderDetails?: OrderDetails;  // Enhanced purchase info (optional)
}

export interface PaymentCard {
  id: string;
  cardType: string;
  lastFour: string;
  cardholderName?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName: string;
  bankLogoUrl?: string;  // Bank logo URL
  isDefault: boolean;
}

export interface PendingPayment {
  requestId: string;
  merchantName: string;
  merchantLogoUrl?: string;
  amount: number;
  currency: string;
  orderId: string;
  createdAt: string;
  expiresAt: string;
}

// P2P Transfer types

export type AliasType = 'EMAIL' | 'PHONE' | 'USERNAME' | 'RANDOM_KEY';

export interface Alias {
  id: string;
  type: AliasType;
  value: string;           // e.g., "user@email.com" or "@johndoe"
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface P2PEnrollment {
  enrollmentId: string;
  userId: string;
  bsimId: string;
  enrolledAt: string;
  isActive: boolean;
}

export type TransferStatus =
  | 'PENDING'
  | 'RESOLVING'
  | 'RECIPIENT_NOT_FOUND'
  | 'DEBITING'
  | 'DEBIT_FAILED'
  | 'CREDITING'
  | 'CREDIT_FAILED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REVERSED';

export type TransferDirection = 'sent' | 'received';

export interface Transfer {
  transferId: string;
  direction: TransferDirection;
  amount: number;
  currency: string;
  description?: string;
  status: TransferStatus;

  // Sender info (for received transfers)
  senderAlias?: string;
  senderDisplayName?: string;
  senderBankName?: string;
  senderAccountLast4?: string;     // Last 4 digits of sender's account (for merchant payments)
  senderBsimId?: string;           // Sender's bank identifier
  senderProfileImageUrl?: string;  // Profile image URL (if available from API)

  // Recipient info (for sent transfers)
  recipientAlias?: string;
  recipientDisplayName?: string;
  recipientBankName?: string;
  recipientProfileImageUrl?: string;  // Profile image URL (if available from API)

  createdAt: string;
  completedAt?: string;
}

export interface AliasLookupResult {
  found: boolean;
  displayName?: string;   // Partial name (e.g., "John D.")
  bankName?: string;
  aliasType?: AliasType;
}

export interface ReceiveToken {
  tokenId: string;
  qrPayload: string;       // Encode this in QR code
  expiresAt: string;
  amount?: number;
  description?: string;
}

export interface ResolvedToken {
  tokenId: string;
  recipientAlias: string;
  recipientAliasType?: AliasType;  // EMAIL, PHONE, USERNAME, RANDOM_KEY
  recipientDisplayName: string;
  recipientBankName: string;
  amount?: number;
  description?: string;
  expiresAt: string;
}

// Bank Account types (for P2P - different from Cards)
export interface BankAccount {
  accountId: string;
  accountType: 'CHECKING' | 'SAVINGS';
  displayName: string;     // e.g., "Chequing ****1234"
  balance?: number;
  currency: string;
  bankName: string;
  bankLogoUrl?: string;
  bsimId: string;
}

// P2P State for the app
export interface P2PState {
  isEnrolled: boolean;
  enrollmentLoading: boolean;
  aliases: Alias[];
  aliasesLoading: boolean;
  accounts: BankAccount[];
  accountsLoading: boolean;
  recentTransfers: Transfer[];
  transfersLoading: boolean;
  lastUsedAccountId?: string;
}

// ===========================
// Micro Merchant Types
// ===========================

/**
 * P2P mode for the toggle between Personal and Business views
 */
export type P2PMode = 'personal' | 'business';

/**
 * Recipient type for visual differentiation
 */
export type RecipientType = 'individual' | 'merchant';

/**
 * Business category for Micro Merchants
 * Must match TransferSim API enum values
 */
export type MerchantCategory =
  | 'FOOD_AND_BEVERAGE'  // Restaurants, cafes, food trucks
  | 'RETAIL'             // Shops, vendors
  | 'SERVICES'           // Tutoring, consulting, freelance
  | 'HEALTH_AND_BEAUTY'  // Salons, wellness
  | 'ENTERTAINMENT'      // Events, performances
  | 'CRAFTS_AND_HANDMADE'// Handmade goods, art
  | 'OTHER';             // General/uncategorized

/**
 * Micro Merchant profile
 * Field names match TransferSim API response
 */
export interface MerchantProfile {
  merchantId: string;
  merchantName: string;
  merchantCategory: MerchantCategory;
  primaryAlias: string;              // e.g., "@javajoes"
  receivingAccountId: string;        // Bank account for receiving payments
  receivingBankName: string;
  isActive: boolean;
  createdAt: string;
  // Stats (optional, for dashboard)
  todayRevenue?: number;
  todayTransactionCount?: number;
}

/**
 * Extended transfer info with recipient type for Micro Merchant differentiation
 */
export interface TransferWithRecipientType extends Transfer {
  recipientType?: RecipientType;     // 'individual' or 'merchant'
  merchantName?: string;             // Business name if merchant
  merchantCategory?: MerchantCategory;
  feeAmount?: number;                // Fee deducted (for merchant payments)
  grossAmount?: number;              // Amount before fee
}

/**
 * Resolved token with merchant info (extended for QR scanning)
 */
export interface ResolvedMerchantToken extends ResolvedToken {
  recipientType: RecipientType;
  merchantName?: string;
  merchantCategory?: MerchantCategory;
  feeAmount?: number;                // Calculated fee for display
}

/**
 * Merchant enrollment request
 * Field names must match TransferSim API contract
 */
export interface MerchantEnrollmentRequest {
  merchantName: string;
  merchantCategory: MerchantCategory;
  receivingAccountId: string;
}

/**
 * Category display info for UI
 * Keys must match TransferSim API enum values
 */
export const MERCHANT_CATEGORIES: Record<MerchantCategory, { label: string; icon: string }> = {
  FOOD_AND_BEVERAGE: { label: 'Food & Beverage', icon: '☕' },
  RETAIL: { label: 'Retail & Shopping', icon: '🛍️' },
  SERVICES: { label: 'Services', icon: '💼' },
  HEALTH_AND_BEAUTY: { label: 'Health & Beauty', icon: '💆' },
  ENTERTAINMENT: { label: 'Entertainment', icon: '🎭' },
  CRAFTS_AND_HANDMADE: { label: 'Crafts & Artisan', icon: '🎨' },
  OTHER: { label: 'Other', icon: '🏪' },
};

/**
 * Merchant dashboard time period stats
 * Matches TransferSim API response structure
 */
export interface MerchantPeriodStats {
  totalReceived: string;      // Decimal string, e.g., "500.00"
  totalTransactions: number;
  totalFees: string;          // Decimal string, e.g., "3.50"
}

/**
 * Full merchant dashboard response from TransferSim
 * GET /api/v1/micro-merchants/me/dashboard
 */
export interface MerchantDashboardResponse {
  merchantId: string;
  merchantName: string;
  today?: MerchantPeriodStats;     // Added by TransferSim (Option B)
  last7Days: MerchantPeriodStats;
  last30Days: MerchantPeriodStats;
  allTime: MerchantPeriodStats;
  recentTransactions: TransferWithRecipientType[];
}

/**
 * Theme colors for P2P modes
 */
export const P2P_THEME_COLORS = {
  individual: {
    primary: '#7C3AED',      // Purple
    light: '#EDE9FE',        // Purple-50
    icon: '👤',
  },
  merchant: {
    primary: '#10B981',      // Green
    light: '#D1FAE5',        // Green-50
    icon: '🏪',
  },
};

// Navigation types
export type RootStackParamList = {
  Welcome: undefined;
  CreateAccount: undefined;
  BiometricSetup: undefined;
  BankSelection: undefined;
  BankEnrollment: { bsimId: string; bankName: string };
  CardSelection: { bsimId: string; cards: Card[] };
  WalletHome: undefined;
  Login: undefined;
  Settings: undefined;
  PaymentApproval: { requestId: string };
};
