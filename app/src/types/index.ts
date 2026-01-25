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
  profileImageUrl?: string;   // Recipient's personal profile image URL (from WSIM)
  initialsColor?: string;     // Hex color for initials avatar fallback (e.g., "#3949AB")
  isMerchant?: boolean;       // Whether recipient is a registered Micro Merchant
  merchantLogoUrl?: string;   // Merchant logo URL (only if isMerchant: true)
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
  description?: string;              // Business description
  primaryAlias: string;              // e.g., "@javajoes"
  receivingAccountId: string;        // Bank account for receiving payments
  receivingBankName: string;
  isActive: boolean;
  createdAt: string;
  // Logo fields (Phase 2)
  logoImageUrl?: string;             // CDN URL for merchant logo
  logoThumbnails?: {
    small: string;                   // 64x64
    medium: string;                  // 128x128
  };
  initialsColor?: string;            // Background color for initials fallback
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
  logoImageUrl?: string;             // Merchant logo URL (legacy)
  merchantLogoUrl?: string;          // Merchant logo URL (from TransferSim API)
  profileImageUrl?: string;          // Individual recipient's profile image URL (from WSIM)
  initialsColor?: string;            // Hex color for initials fallback
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

// ===========================
// ContractSim Types
// ===========================

/**
 * Contract type determines the nature of the agreement
 */
export type ContractType = 'wager' | 'escrow' | 'milestone' | 'custom';

/**
 * Contract status represents the current state in the lifecycle
 */
export type ContractStatus =
  | 'draft'
  | 'proposed'
  | 'funding'
  | 'active'
  | 'settling'
  | 'settled'
  | 'expired'
  | 'cancelled'
  | 'disputed';

/**
 * Escrow type determines how funds are held
 */
export type EscrowType = 'full' | 'partial' | 'none';

/**
 * Settlement type determines how funds are distributed
 */
export type SettlementType = 'winner_takes_all' | 'proportional' | 'custom';

/**
 * Party role in the contract
 */
export type PartyRole = 'creator' | 'counterparty';

/**
 * Outcome type for a party
 */
export type OutcomeType = 'winner' | 'loser' | 'refund' | 'custom';

/**
 * Predicate operator for conditions
 */
export type PredicateOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';

/**
 * Condition status
 */
export type ConditionStatus = 'pending' | 'resolved' | 'disputed';

/**
 * Contract party - one participant in a contract
 */
export interface ContractParty {
  id: string;
  walletId: string;
  bankId?: string;
  userId?: string;
  role: PartyRole;
  displayName: string;
  profileImageUrl?: string;
  initialsColor?: string;
  stake: {
    amount: number;
    currency: string;
  };
  outcomeIfTrue: OutcomeType;
  outcomeIfFalse: OutcomeType;
  accepted: boolean;
  acceptedAt?: string;
  funded: boolean;
  fundedAt?: string;
  escrowId?: string;
}

/**
 * Predicate for condition evaluation
 */
export interface ContractPredicate {
  field: string;
  operator: PredicateOperator;
  value: any;
}

/**
 * Condition in a contract
 */
export interface ContractCondition {
  index: number;
  oracleId: string;
  eventType: string;
  eventId: string;
  predicate: ContractPredicate;
  status: ConditionStatus;
  result?: boolean;
  evidence?: Record<string, any>;
  resolvedAt?: string;
}

/**
 * Contract outcome after resolution
 */
export interface ContractOutcome {
  winnerId?: string;
  winnerDisplayName?: string;
  result: 'party_a_wins' | 'party_b_wins' | 'draw' | 'cancelled' | 'expired';
  settledAmount?: number;
  settledAt?: string;
}

/**
 * Dispute on a contract
 */
export interface ContractDispute {
  id: string;
  partyId: string;
  reason: string;
  evidence?: {
    description?: string;
    url?: string;
  };
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

/**
 * Full contract object
 */
export interface Contract {
  id: string;
  type: ContractType;
  status: ContractStatus;
  title: string;
  description?: string;
  parties: ContractParty[];
  conditions: ContractCondition[];
  escrowType: EscrowType;
  settlementType: SettlementType;
  totalPot: number;
  currency: string;
  createdAt: string;
  acceptedAt?: string;
  fundedAt?: string;
  resolvedAt?: string;
  settledAt?: string;
  expiresAt: string;
  fundingDeadline: string;
  outcome?: ContractOutcome;
  dispute?: ContractDispute;
  // Convenience fields for UI
  myRole?: PartyRole;
  counterparty?: ContractParty;
  conditionsSummary?: string;
}

/**
 * Contract list item (simplified for list views)
 */
export interface ContractListItem {
  id: string;
  type: ContractType;
  status: ContractStatus;
  title: string;
  totalPot: number;
  currency: string;
  myRole: PartyRole;
  counterpartyName: string;
  counterpartyProfileImageUrl?: string;
  counterpartyInitialsColor?: string;
  conditionsSummary?: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Oracle event (for browsing available events)
 */
export interface OracleEvent {
  event_id: string;
  oracle: string;
  title: string;
  description?: string;
  eventType: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  startsAt: string;
  endsAt?: string;
  teams?: { id: string; name: string }[];
  result?: {
    winner?: string;
    score?: string;
  };
}

/**
 * Create contract request
 */
export interface CreateContractRequest {
  type: ContractType;
  title: string;
  description?: string;
  counterpartyAlias: string;
  event: {
    oracle: string;
    event_id: string;
    myPrediction: string;
  };
  myStake: number;
  theirStake: number;
  expiresInHours?: number;
}

/**
 * Contract notification types
 */
export type ContractNotificationType =
  | 'contract.proposed'
  | 'contract.accepted'
  | 'contract.funded'
  | 'contract.outcome'
  | 'contract.settled'
  | 'contract.disputed'
  | 'contract.expired'
  | 'contract.cancelled';

/**
 * Contract status display info
 */
export const CONTRACT_STATUS_INFO: Record<ContractStatus, { label: string; color: string; icon: string }> = {
  draft: { label: 'Draft', color: '#9CA3AF', icon: '✏️' },
  proposed: { label: 'Pending', color: '#F59E0B', icon: '⏳' },
  funding: { label: 'Funding', color: '#3B82F6', icon: '💰' },
  active: { label: 'Active', color: '#10B981', icon: '⚡' },
  settling: { label: 'Settling', color: '#8B5CF6', icon: '⚖️' },
  settled: { label: 'Settled', color: '#059669', icon: '✅' },
  expired: { label: 'Expired', color: '#6B7280', icon: '⏰' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: '❌' },
  disputed: { label: 'Disputed', color: '#DC2626', icon: '⚠️' },
};

/**
 * Contract type display info
 */
export const CONTRACT_TYPE_INFO: Record<ContractType, { label: string; icon: string; description: string }> = {
  wager: { label: 'Wager', icon: '🎲', description: 'Bet on an outcome' },
  escrow: { label: 'Escrow', icon: '🔒', description: 'Hold funds until condition met' },
  milestone: { label: 'Milestone', icon: '🎯', description: 'Release on achievement' },
  custom: { label: 'Custom', icon: '📝', description: 'Custom terms' },
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

// Agent Commerce types (SACP)
export * from './agent';
