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
  bankLogo?: string;
  isDefault: boolean;
  addedAt: string;
}

// Bank types
export interface Bank {
  bsimId: string;
  name: string;
  logo?: string;
  description?: string;
}

export interface EnrolledBank {
  bsimId: string;
  name: string;
  cardCount: number;
  enrolledAt: string;
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
};
