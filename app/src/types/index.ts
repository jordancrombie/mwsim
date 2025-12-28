// User types
export interface User {
  id: string;
  email: string;
  name: string;
  walletId: string;
  createdAt: string;
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

  // Recipient info (for sent transfers)
  recipientAlias?: string;
  recipientDisplayName?: string;
  recipientBankName?: string;

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
