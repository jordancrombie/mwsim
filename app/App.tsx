import 'react-native-get-random-values';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Image,
  Share,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';

import { api } from './src/services/api';
import { secureStorage } from './src/services/secureStorage';
import { biometricService } from './src/services/biometric';
import { openReturnUrl, parseSourceBrowser } from './src/services/browserReturn';
import { transferSimApi } from './src/services/transferSim';
import * as notificationService from './src/services/notifications';
import { getEnvironmentName, isDevelopment, getEnvironmentDebugInfo } from './src/config/env';
import { SplashScreen } from './src/components/SplashScreen';
import { OrderSummary } from './src/components/OrderSummary';
import { SuccessAnimation } from './src/components/SuccessAnimation';
import { MerchantPaymentSuccess } from './src/components/MerchantPaymentSuccess';
import { SettingsScreen } from './src/screens/Settings';
import { ProfileEditScreen } from './src/screens/ProfileEdit';
import { MerchantProfileEditScreen } from './src/screens/MerchantProfileEdit';
import { ContractsListScreen } from './src/screens/ContractsList';
import { ContractDetailScreen } from './src/screens/ContractDetail';
import { CreateContractScreen } from './src/screens/CreateContract';
import { IDVerificationScreen, type VerificationFlowResult } from './src/screens/IDVerification';
import { ProfileAvatar } from './src/components/ProfileAvatar';
import { NearbyUsersPanel } from './src/components/NearbyUsersPanel';
import { PitchPageModal } from './src/components/PitchPageModal';
import { getPitchPageForUser, PitchPage, PitchPageUserContext } from './src/services/pitchPages';
import {
  registerForDiscovery,
  startAdvertising,
  stopAdvertising,
  isAdvertising,
  type NearbyUser,
  type BeaconRegistration,
} from './src/services/bleDiscovery';
import QRCode from 'react-native-qrcode-svg';
import type { User, Card, Bank, PaymentRequest, PaymentCard, Alias, AliasLookupResult, P2PEnrollment, BankAccount, Transfer, ResolvedToken, ResolvedMerchantToken, P2PMode, MerchantProfile, MerchantCategory, TransferWithRecipientType } from './src/types';
import { MERCHANT_CATEGORIES, P2P_THEME_COLORS } from './src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep the splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync();

type Screen =
  | 'loading'
  | 'welcome'
  | 'createAccount'
  | 'login'
  | 'verifyCode'
  | 'biometricSetup'
  | 'bankSelection'
  | 'home'
  | 'cardDetails'
  | 'paymentApproval'
  | 'qrScanner'
  | 'settings'
  | 'profileEdit'
  // P2P screens
  | 'p2pHome'
  | 'p2pEnrollment'
  | 'aliasManagement'
  | 'sendMoney'
  | 'sendConfirm'
  | 'receiveMoney'
  | 'transferHistory'
  | 'transferDetail'
  | 'p2pQrScan'
  // Micro Merchant screens
  | 'merchantEnrollment'
  | 'merchantDashboard'
  | 'merchantHistory'
  | 'merchantProfile'
  | 'merchantProfileEdit'
  // Contract screens
  | 'contractsList'
  | 'contractDetail'
  | 'createContract'
  // IDV screens
  | 'idVerification';

// Home tabs
type HomeTab = 'cards' | 'p2p';

// Animated path component for SVG
const AnimatedPath = Animated.createAnimatedComponent(Path);

// QR Countdown Border Component
// Displays a countdown border around a QR code that depletes counter-clockwise
interface QRCountdownBorderProps {
  expiresAt: string;
  size: number;
  strokeWidth?: number;
  onExpired?: () => void;
  children: React.ReactNode;
}

const QRCountdownBorder: React.FC<QRCountdownBorderProps> = ({
  expiresAt,
  size,
  strokeWidth = 4,
  onExpired,
  children,
}) => {
  const [progress, setProgress] = useState(1); // 1 = full, 0 = empty
  const animatedValue = useRef(new Animated.Value(1)).current;
  const hasExpiredRef = useRef(false);

  // QR tokens typically last 5 minutes (300 seconds)
  const TOKEN_DURATION_MS = 5 * 60 * 1000;

  useEffect(() => {
    // Reset expired flag when expiresAt changes (new QR generated)
    hasExpiredRef.current = false;
  }, [expiresAt]);

  useEffect(() => {
    const updateProgress = () => {
      const now = Date.now();
      const expiryTime = new Date(expiresAt).getTime();
      const createdTime = expiryTime - TOKEN_DURATION_MS;
      const totalDuration = expiryTime - createdTime;
      const elapsed = now - createdTime;
      const remaining = Math.max(0, 1 - elapsed / totalDuration);
      setProgress(remaining);

      Animated.timing(animatedValue, {
        toValue: remaining,
        duration: 500,
        useNativeDriver: false,
      }).start();

      // Call onExpired when timer reaches zero (only once)
      if (remaining === 0 && !hasExpiredRef.current && onExpired) {
        hasExpiredRef.current = true;
        onExpired();
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, animatedValue, onExpired]);

  // Calculate the path for a square border
  // Starting from top-center, going counter-clockwise (left)
  const padding = strokeWidth / 2;
  const innerSize = size - strokeWidth;
  const halfSize = innerSize / 2;

  // Path starts at top-center, goes counter-clockwise:
  // top-center -> top-left -> bottom-left -> bottom-right -> top-right -> back to top-center
  const pathD = `
    M ${size / 2} ${padding}
    L ${padding} ${padding}
    L ${padding} ${size - padding}
    L ${size - padding} ${size - padding}
    L ${size - padding} ${padding}
    L ${size / 2} ${padding}
  `;

  // Perimeter of the square path
  const perimeter = innerSize * 4;

  // Interpolate stroke-dashoffset based on progress
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [perimeter, 0],
  });

  // Color interpolation: green (full) -> yellow (half) -> red (empty)
  const strokeColor = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: ['#EF4444', '#F59E0B', '#10B981', '#10B981'],
  });

  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      {/* SVG border overlay */}
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Background track (subtle gray) */}
        <Path
          d={pathD}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Animated countdown stroke */}
        <AnimatedPath
          d={pathD}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${perimeter}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {/* QR code content */}
      <View style={{
        position: 'absolute',
        top: strokeWidth,
        left: strokeWidth,
        width: size - strokeWidth * 2,
        height: size - strokeWidth * 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {children}
      </View>
    </View>
  );
};

export default function App() {
  console.log('[App] Component rendering - START');

  // Screen dimensions for responsive layout
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 768; // iPad or larger
  const merchantQRSize = isTablet ? 380 : 200;
  const merchantQRInnerSize = isTablet ? 360 : 180;
  const merchantQRStrokeWidth = isTablet ? 6 : 4;

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');

  // Auth state
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Wallet state
  const [cards, setCards] = useState<Card[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Biometric state
  const [biometricType, setBiometricType] = useState<string>('Biometric');

  // Enrollment state
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  // Card details state
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Payment approval state
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [selectedPaymentCard, setSelectedPaymentCard] = useState<PaymentCard | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'ready' | 'approving' | 'success' | 'error'>('loading');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [sourceBrowser, setSourceBrowser] = useState<string | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [paymentReturnUrl, setPaymentReturnUrl] = useState<string | null>(null);

  // Splash screen state
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  // QR Scanner state
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [qrScanned, setQrScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Home tab state (for bottom tabs)
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>('cards');

  // P2P state
  const [p2pEnrolled, setP2pEnrolled] = useState(false);
  const [p2pEnrollment, setP2pEnrollment] = useState<P2PEnrollment | null>(null);
  const [p2pLoading, setP2pLoading] = useState(false);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [transferDetailReturnScreen, setTransferDetailReturnScreen] = useState<'transferHistory' | 'home' | 'p2pHome'>('transferHistory');
  const [isViewingMerchantPayment, setIsViewingMerchantPayment] = useState(false);

  // Contract state
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractRefreshTrigger, setContractRefreshTrigger] = useState(0);

  // Notification-triggered refresh triggers
  const [transferHistoryRefreshTrigger, setTransferHistoryRefreshTrigger] = useState(0);
  const [p2pHomeRefreshTrigger, setP2pHomeRefreshTrigger] = useState(0);

  // Pitch page state (promotional screens shown on login)
  const [activePitchPage, setActivePitchPage] = useState<PitchPage | null>(null);
  const [showPitchPage, setShowPitchPage] = useState(false);

  // Alias Management screen state
  const [newAliasType, setNewAliasType] = useState<'USERNAME' | 'EMAIL' | 'PHONE'>('USERNAME');
  const [newAliasValue, setNewAliasValue] = useState('');
  const [aliasLoading, setAliasLoading] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);

  // Receive Money screen state
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveToken, setReceiveToken] = useState<{ tokenId: string; qrPayload: string; expiresAt: string } | null>(null);
  const [nearbyBroadcastEnabled, setNearbyBroadcastEnabled] = useState(false);
  const [nearbyBeaconRegistration, setNearbyBeaconRegistration] = useState<BeaconRegistration | null>(null);

  // Send Money screen state
  const [sendStep, setSendStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [sendInputMode, setSendInputMode] = useState<'alias' | 'nearby'>('alias');
  const [recipientAlias, setRecipientAlias] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [recipientInfo, setRecipientInfo] = useState<AliasLookupResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [completedTransfer, setCompletedTransfer] = useState<{ transferId: string; status: string } | null>(null);
  const [selectedNearbyUser, setSelectedNearbyUser] = useState<NearbyUser | null>(null);

  // Transfer History screen state
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false); // For pull-to-refresh animation
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [historyTransfers, setHistoryTransfers] = useState<Transfer[]>([]);
  const [historyViewMode, setHistoryViewMode] = useState<'personal' | 'business'>('personal');

  // P2P QR Scanner screen state
  const [p2pQrScanned, setP2pQrScanned] = useState(false);
  const [p2pTorchOn, setP2pTorchOn] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<ResolvedMerchantToken | null>(null);
  const [p2pSendAmount, setP2pSendAmount] = useState('');
  const [p2pSendNote, setP2pSendNote] = useState('');
  const [p2pSelectedAccount, setP2pSelectedAccount] = useState<BankAccount | null>(null);
  const [p2pSending, setP2pSending] = useState(false);

  // Micro Merchant state
  const [p2pMode, setP2pMode] = useState<P2PMode>('personal');
  const [isMicroMerchant, setIsMicroMerchant] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantTransfers, setMerchantTransfers] = useState<TransferWithRecipientType[]>([]);

  // Merchant enrollment form state
  const [merchantBusinessName, setMerchantBusinessName] = useState('');
  const [merchantCategory, setMerchantCategory] = useState<MerchantCategory>('OTHER');
  const [merchantReceivingAccount, setMerchantReceivingAccount] = useState<BankAccount | null>(null);
  const [merchantEnrollLoading, setMerchantEnrollLoading] = useState(false);
  const [merchantEnrollError, setMerchantEnrollError] = useState<string | null>(null);

  // Merchant QR state
  const [merchantQrToken, setMerchantQrToken] = useState<{ tokenId: string; qrPayload: string; expiresAt: string } | null>(null);
  const [merchantQrLoading, setMerchantQrLoading] = useState(false);

  // Merchant dashboard stats (from /me/dashboard endpoint)
  const [merchantStats, setMerchantStats] = useState<{
    todayRevenue: number;
    todayTransactionCount: number;
    weekRevenue: number;
  } | null>(null);

  // Merchant payment success animation state
  const [showMerchantPaymentSuccess, setShowMerchantPaymentSuccess] = useState(false);
  const [merchantPaymentSuccessMessage, setMerchantPaymentSuccessMessage] = useState('');

  // Push notification state
  const [notificationsRequested, setNotificationsRequested] = useState(false);
  const notificationListenerRef = useRef<any>(null);
  const notificationResponseRef = useRef<any>(null);
  // Refs to track current state for notification callbacks (avoids stale closure)
  const p2pModeRef = useRef(p2pMode);
  const isMicroMerchantRef = useRef(isMicroMerchant);
  const currentScreenRef = useRef(currentScreen);
  const selectedContractIdRef = useRef(selectedContractId);

  // Track if we've handled the initial URL
  const initialUrlHandled = useRef(false);

  // QR scanner lock refs (synchronous to prevent rapid-fire scans)
  const qrScanLockRef = useRef(false);
  const p2pQrScanLockRef = useRef(false);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  // Keep refs in sync with state (for notification callbacks)
  useEffect(() => {
    p2pModeRef.current = p2pMode;
  }, [p2pMode]);

  useEffect(() => {
    isMicroMerchantRef.current = isMicroMerchant;
  }, [isMicroMerchant]);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    selectedContractIdRef.current = selectedContractId;
  }, [selectedContractId]);

  // Load banks when entering bank selection screen
  useEffect(() => {
    if (currentScreen === 'bankSelection') {
      handleLoadBanks();
    }
  }, [currentScreen]);

  // Initialize selected account when bank accounts are loaded
  useEffect(() => {
    console.log('[useEffect bankAccounts] bankAccounts.length:', bankAccounts.length);
    if (bankAccounts.length > 0) {
      console.log('[useEffect bankAccounts] Setting selected accounts from:', bankAccounts[0]?.displayName);
      if (!selectedAccount) {
        setSelectedAccount(bankAccounts[0]);
      }
      if (!p2pSelectedAccount) {
        setP2pSelectedAccount(bankAccounts[0]);
      }
    }
  }, [bankAccounts]);

  // Initialize history transfers from recent transfers
  useEffect(() => {
    setHistoryTransfers(recentTransfers);
  }, [recentTransfers]);

  // Function to load transfer history (silent - no pull-down animation)
  const loadHistoryTransfers = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await transferSimApi.getTransfers(historyFilter, 50, 0);
      setHistoryTransfers(result.transfers);
    } catch (e: any) {
      console.error('[History] Load failed:', e);
      Alert.alert('Error', 'Failed to load transfer history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter]);

  // Function to refresh transfer history (shows pull-down animation)
  const refreshHistoryTransfers = useCallback(async () => {
    setHistoryRefreshing(true);
    try {
      const result = await transferSimApi.getTransfers(historyFilter, 50, 0);
      setHistoryTransfers(result.transfers);
    } catch (e: any) {
      console.error('[History] Refresh failed:', e);
    } finally {
      setHistoryRefreshing(false);
    }
  }, [historyFilter]);

  // Load transfers when history filter changes (only when on transferHistory screen in personal mode)
  // Also reloads when transferHistoryRefreshTrigger changes (e.g., from notification tap)
  useEffect(() => {
    if (currentScreen === 'transferHistory' && historyViewMode === 'personal') {
      loadHistoryTransfers();
    }
  }, [historyFilter, currentScreen, historyViewMode, loadHistoryTransfers, transferHistoryRefreshTrigger]);

  // Refresh P2P data when p2pHomeRefreshTrigger changes (e.g., from notification tap)
  useEffect(() => {
    if (p2pHomeRefreshTrigger > 0 && p2pEnrolled) {
      console.log('[P2P] Refreshing data from notification trigger');
      loadP2PData();
    }
  }, [p2pHomeRefreshTrigger]);

  // Handle deep link for payment requests and Universal Links
  const handleDeepLink = useCallback(async (url: string) => {
    console.log('[DeepLink] Received URL:', url);

    // Check for TransferSim Universal Link: https://transfer.banksim.ca/pay/{tokenId}
    const transferSimMatch = url.match(/https:\/\/transfer(?:sim-dev)?\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
    if (transferSimMatch) {
      const tokenId = transferSimMatch[1];
      console.log('[DeepLink] TransferSim token ID:', tokenId);

      // Store for cold start recovery
      await secureStorage.set('pendingTransferSimTokenId', tokenId);

      // Check if we're authenticated
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        console.log('[DeepLink] Not authenticated, redirecting to login');
        setCurrentScreen('login');
        return;
      }

      // Resolve token and navigate to P2P send
      try {
        setResolving(true);
        const resolved = await transferSimApi.resolveTokenWithMerchantInfo(tokenId);
        setResolvedToken(resolved);

        if (resolved.amount) {
          setP2pSendAmount(resolved.amount.toString());
        }
        if (resolved.description) {
          setP2pSendNote(resolved.description);
        }

        // Clear the pending token since we've handled it
        await secureStorage.remove('pendingTransferSimTokenId');

        // Navigate to P2P send confirmation
        setP2pQrScanned(true);
        setCurrentScreen('p2pQrScan');
      } catch (e: any) {
        console.error('[DeepLink] TransferSim token resolve failed:', e);
        Alert.alert(
          'Invalid Link',
          'This payment link has expired or is invalid.',
          [{ text: 'OK' }]
        );
      } finally {
        setResolving(false);
      }
      return;
    }

    // Check for WSIM Universal Link: https://wsim.banksim.ca/pay/{requestId}
    const wsimMatch = url.match(/https:\/\/wsim(?:-dev)?\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
    if (wsimMatch) {
      const requestId = wsimMatch[1];
      console.log('[DeepLink] WSIM payment request ID:', requestId);

      // Store for cold start recovery
      await secureStorage.set('pendingPaymentRequestId', requestId);
      setPendingRequestId(requestId);
      setSourceBrowser(null);

      // Check if we're authenticated
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        console.log('[DeepLink] Not authenticated, redirecting to login');
        setCurrentScreen('login');
        return;
      }

      // Navigate to payment approval
      await loadPaymentRequest(requestId);
      return;
    }

    // Check for payment deep link: mwsim://payment/:requestId
    const paymentMatch = url.match(/mwsim:\/\/payment\/([^?]+)/);
    if (paymentMatch) {
      const requestId = paymentMatch[1];
      console.log('[DeepLink] Payment request ID:', requestId);

      // Parse sourceBrowser parameter for browser-aware return
      const browser = parseSourceBrowser(url);
      console.log('[DeepLink] Source browser:', browser);
      setSourceBrowser(browser);

      // Store both for cold start recovery
      await secureStorage.set('pendingPaymentRequestId', requestId);
      if (browser) {
        await secureStorage.set('pendingPaymentSourceBrowser', browser);
      }
      setPendingRequestId(requestId);

      // Check if we're authenticated
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        // Store request ID and go to login
        console.log('[DeepLink] Not authenticated, redirecting to login');
        setCurrentScreen('login');
        return;
      }

      // Navigate to payment approval
      await loadPaymentRequest(requestId);
      return;
    }

    // Check for tsim deep link: tsim://pay/{tokenId} (legacy)
    const tsimMatch = url.match(/tsim:\/\/pay\/([a-zA-Z0-9_-]+)/);
    if (tsimMatch) {
      const tokenId = tsimMatch[1];
      console.log('[DeepLink] Legacy tsim token ID:', tokenId);

      // Store for cold start recovery
      await secureStorage.set('pendingTransferSimTokenId', tokenId);

      // Check if we're authenticated
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        console.log('[DeepLink] Not authenticated, redirecting to login');
        setCurrentScreen('login');
        return;
      }

      // Resolve token and navigate to P2P send
      try {
        setResolving(true);
        const resolved = await transferSimApi.resolveTokenWithMerchantInfo(tokenId);
        setResolvedToken(resolved);

        if (resolved.amount) {
          setP2pSendAmount(resolved.amount.toString());
        }
        if (resolved.description) {
          setP2pSendNote(resolved.description);
        }

        // Clear the pending token since we've handled it
        await secureStorage.remove('pendingTransferSimTokenId');

        // Navigate to P2P send confirmation
        setP2pQrScanned(true);
        setCurrentScreen('p2pQrScan');
      } catch (e: any) {
        console.error('[DeepLink] TransferSim token resolve failed:', e);
        Alert.alert(
          'Invalid Link',
          'This payment link has expired or is invalid.',
          [{ text: 'OK' }]
        );
      } finally {
        setResolving(false);
      }
    }
  }, []);

  // Listen for deep links
  useEffect(() => {
    // Handle initial URL (cold start)
    const handleInitialUrl = async () => {
      if (initialUrlHandled.current) return;
      initialUrlHandled.current = true;

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('[DeepLink] Initial URL:', initialUrl);
        await handleDeepLink(initialUrl);
      }
    };

    // Only check initial URL once initialization is complete
    if (currentScreen !== 'loading') {
      handleInitialUrl();
    }

    // Listen for incoming links while app is open
    const subscription = Linking.addEventListener('url', async (event) => {
      await handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [currentScreen, handleDeepLink]);

  // Check for pending payment request on login success
  useEffect(() => {
    const checkPendingPayment = async () => {
      if (currentScreen === 'home' && pendingRequestId) {
        console.log('[Payment] Found pending request after login:', pendingRequestId);
        // Restore sourceBrowser if not already set
        if (!sourceBrowser) {
          const storedBrowser = await secureStorage.get('pendingPaymentSourceBrowser');
          if (storedBrowser) {
            console.log('[Payment] Restored sourceBrowser:', storedBrowser);
            setSourceBrowser(storedBrowser);
          }
        }
        await loadPaymentRequest(pendingRequestId);
      }
    };
    checkPendingPayment();
  }, [currentScreen, pendingRequestId]);

  // Check for pending TransferSim token on login success (cold start recovery)
  useEffect(() => {
    const checkPendingTransferSimToken = async () => {
      if (currentScreen === 'home') {
        const tokenId = await secureStorage.get('pendingTransferSimTokenId');
        if (tokenId) {
          console.log('[Payment] Found pending TransferSim token after login:', tokenId);
          try {
            setResolving(true);
            const resolved = await transferSimApi.resolveTokenWithMerchantInfo(tokenId);
            setResolvedToken(resolved);

            if (resolved.amount) {
              setP2pSendAmount(resolved.amount.toString());
            }
            if (resolved.description) {
              setP2pSendNote(resolved.description);
            }

            // Clear the pending token since we've handled it
            await secureStorage.remove('pendingTransferSimTokenId');

            // Navigate to P2P send confirmation
            setP2pQrScanned(true);
            setCurrentScreen('p2pQrScan');
          } catch (e: any) {
            console.error('[Payment] Pending TransferSim token resolve failed:', e);
            // Clear invalid token
            await secureStorage.remove('pendingTransferSimTokenId');
            Alert.alert(
              'Link Expired',
              'The payment link you opened has expired or is invalid.',
              [{ text: 'OK' }]
            );
          } finally {
            setResolving(false);
          }
        }
      }
    };
    checkPendingTransferSimToken();
  }, [currentScreen]);

  // Auto-generate personal QR code when Receive Money screen opens
  useEffect(() => {
    if (currentScreen === 'receiveMoney' && !receiveToken && !receiveLoading) {
      console.log('[Receive] Auto-generating QR code on screen open');
      // Use a small delay to allow screen to render first
      const timer = setTimeout(() => {
        generatePersonalQR();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Auto-generate merchant QR code when Business mode is activated
  useEffect(() => {
    if (p2pMode === 'business' && isMicroMerchant && !merchantQrToken && !merchantQrLoading) {
      console.log('[Merchant] Auto-generating QR code on business mode');
      // Use a small delay to allow screen to render first
      const timer = setTimeout(() => {
        generateMerchantQR();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [p2pMode, isMicroMerchant]);

  // Load payment request details
  const loadPaymentRequest = async (requestId: string) => {
    setPaymentStatus('loading');
    setPaymentError(null);
    setCurrentScreen('paymentApproval');

    try {
      const request = await api.getPaymentDetails(requestId);
      setPaymentRequest(request);

      // Pre-select the default card
      const defaultCard = request.cards.find(c => c.isDefault);
      setSelectedPaymentCard(defaultCard || request.cards[0] || null);

      setPaymentStatus('ready');
    } catch (e: any) {
      console.error('[Payment] Failed to load request:', e);
      const errorCode = e.response?.data?.error;
      const errorMessage = e.response?.data?.message || e.message || 'Failed to load payment request';

      if (errorCode === 'PAYMENT_EXPIRED') {
        setPaymentError('This payment request has expired. Please return to the store to try again.');
      } else if (errorCode === 'PAYMENT_ALREADY_PROCESSED') {
        setPaymentError('This payment has already been processed.');
      } else if (errorCode === 'PAYMENT_NOT_FOUND') {
        setPaymentError('Payment request not found.');
      } else {
        setPaymentError(errorMessage);
      }
      setPaymentStatus('error');
    }
  };

  // Approve payment with biometric
  const handleApprovePayment = async () => {
    if (!paymentRequest || !selectedPaymentCard) return;

    // Trigger biometric authentication
    try {
      const authResult = await biometricService.authenticate('Approve payment');
      if (!authResult.success) {
        Alert.alert('Authentication Failed', 'Biometric authentication is required to approve payments.');
        return;
      }
    } catch (e: any) {
      Alert.alert('Authentication Error', e.message || 'Could not authenticate');
      return;
    }

    setPaymentStatus('approving');
    setPaymentError(null);

    try {
      const result = await api.approvePayment(paymentRequest.requestId, selectedPaymentCard.id);

      // Clear pending request ID
      await secureStorage.remove('pendingPaymentRequestId');
      setPendingRequestId(null);

      // Store return URL for use after animation
      if (result.returnUrl) {
        const separator = result.returnUrl.includes('?') ? '&' : '?';
        const returnUrlWithContext = `${result.returnUrl}${separator}mwsim_return=${paymentRequest.requestId}`;
        setPaymentReturnUrl(returnUrlWithContext);
        console.log('[Payment] Stored returnUrl for after animation:', returnUrlWithContext);
      }

      setPaymentStatus('success');
      setShowSuccessAnimation(true);
    } catch (e: any) {
      console.error('[Payment] Approval failed:', e);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to approve payment';
      setPaymentError(errorMessage);
      setPaymentStatus('error');
    }
  };

  // Cancel payment
  const handleCancelPayment = async () => {
    if (!paymentRequest) {
      handleClosePayment();
      return;
    }

    Alert.alert(
      'Cancel Payment',
      'Are you sure you want to cancel this payment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.cancelPayment(paymentRequest.requestId);
            } catch (e) {
              // Ignore errors on cancel
              console.log('[Payment] Cancel error (ignored):', e);
            }
            handleClosePayment();
          },
        },
      ]
    );
  };

  // Handle merchant payment success animation completion
  const handleMerchantPaymentSuccessComplete = useCallback(() => {
    setShowMerchantPaymentSuccess(false);
    setMerchantPaymentSuccessMessage('');
  }, []);

  // Handle success animation completion - show stay/redirect options
  const handleSuccessAnimationComplete = () => {
    setShowSuccessAnimation(false);

    Alert.alert(
      'Payment Approved',
      'Your payment has been approved successfully.',
      [
        {
          text: 'Return to Store',
          onPress: async () => {
            if (paymentReturnUrl) {
              console.log('[Payment] Opening returnUrl:', paymentReturnUrl);
              console.log('[Payment] sourceBrowser:', sourceBrowser);
              await openReturnUrl(paymentReturnUrl, sourceBrowser);
            }
            handleClosePayment();
          },
        },
        {
          text: 'Stay in Wallet',
          onPress: handleClosePayment,
          style: 'cancel',
        },
      ]
    );
  };

  // Close payment screen and return to home
  const handleClosePayment = async () => {
    await secureStorage.remove('pendingPaymentRequestId');
    await secureStorage.remove('pendingPaymentSourceBrowser');
    setPendingRequestId(null);
    setSourceBrowser(null);
    setPaymentRequest(null);
    setSelectedPaymentCard(null);
    setPaymentStatus('loading');
    setPaymentError(null);
    setShowSuccessAnimation(false);
    setPaymentReturnUrl(null);
    setCurrentScreen('home');
  };

  /**
   * Check for pitch pages to show the user.
   * Called after login/session restore, before showing home screen.
   */
  const checkAndShowPitchPage = async (userContext: PitchPageUserContext): Promise<boolean> => {
    console.log('[PitchPage] Checking for pitch pages...');
    try {
      const pitchPage = await getPitchPageForUser(userContext);
      if (pitchPage) {
        console.log('[PitchPage] Found pitch page to show:', pitchPage.id);
        setActivePitchPage(pitchPage);
        setShowPitchPage(true);
        return true; // Indicates a pitch page will be shown
      }
      console.log('[PitchPage] No pitch pages to show');
    } catch (error) {
      console.error('[PitchPage] Error checking pitch pages:', error);
    }
    return false; // No pitch page to show
  };

  /**
   * Handle pitch page dismissal - navigate to home screen.
   */
  const handlePitchPageDismiss = () => {
    console.log('[PitchPage] Pitch page dismissed');
    setShowPitchPage(false);
    setActivePitchPage(null);
    setCurrentScreen('home');
  };

  /**
   * Handle pitch page CTA navigation.
   */
  const handlePitchPageNavigate = (screen: string) => {
    console.log('[PitchPage] Navigating to:', screen);
    setShowPitchPage(false);
    setActivePitchPage(null);
    // Navigate to the requested screen
    if (screen === 'settings') {
      setCurrentScreen('settings');
    } else {
      // Default to home for unknown screens
      setCurrentScreen('home');
    }
  };

  const initializeApp = async () => {
    console.log('[initializeApp] Starting...');
    try {
      // Get or create device ID
      console.log('[initializeApp] Getting device ID...');
      let storedDeviceId = await secureStorage.getDeviceId();
      console.log('[initializeApp] Device ID:', storedDeviceId ? 'exists' : 'creating new');
      if (!storedDeviceId) {
        storedDeviceId = uuidv4();
        await secureStorage.setDeviceId(storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      // Check biometric capabilities
      console.log('[initializeApp] Checking biometrics...');
      const capabilities = await biometricService.getCapabilities();
      setBiometricType(biometricService.getBiometricName(capabilities.biometricType));
      console.log('[initializeApp] Biometrics done');

      // Check for existing session
      console.log('[initializeApp] Getting access token...');
      const accessToken = await secureStorage.getAccessToken();
      console.log('[initializeApp] Token:', accessToken ? 'exists' : 'none');
      if (accessToken) {
        try {
          console.log('[initializeApp] Calling getWalletSummary...');
          // Add a 10 second timeout to prevent hanging on debug builds
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API timeout')), 10000)
          );
          const summary = await Promise.race([
            api.getWalletSummary(),
            timeoutPromise
          ]) as { user: User; cards: Card[] };
          console.log('[initializeApp] Got wallet summary');
          console.log('[initializeApp] Verification status:', {
            isVerified: summary.user.isVerified,
            verificationLevel: summary.user.verificationLevel,
            verifiedAt: summary.user.verifiedAt,
          });
          setUser(summary.user);
          setCards(summary.cards || []);

          // Check for pitch pages before going to home
          const hasPitchPage = await checkAndShowPitchPage({
            isVerified: summary.user.isVerified,
            verificationLevel: summary.user.verificationLevel,
          });
          if (!hasPitchPage) {
            setCurrentScreen('home');
          }
          // If hasPitchPage is true, the modal will show and navigate to home when dismissed

          // Fetch profile to get profileImageUrl (not returned by wallet summary)
          console.log('[initializeApp] Fetching profile for image URL...');
          api.getProfile().then((profileData) => {
            if (profileData.profile?.profileImageUrl) {
              console.log('[initializeApp] Got profile image URL, updating user');
              setUser((prev) => prev ? { ...prev, profileImageUrl: profileData.profile.profileImageUrl } : prev);
            }
          }).catch((e) => console.log('[initializeApp] Profile fetch failed (non-blocking):', e));

          // Check P2P enrollment status after login
          // Set loading=true FIRST to prevent showing enrollment prompt before check completes
          console.log('[initializeApp] Checking P2P enrollment...');
          setP2pLoading(true);
          checkP2PEnrollment().catch((e) => console.log('[initializeApp] P2P enrollment check failed:', e));
        } catch (e) {
          // Token invalid or timeout, clear and show welcome
          console.log('[initializeApp] getWalletSummary failed:', e);
          await secureStorage.clearAll();
          setCurrentScreen('welcome');
        }
      } else {
        // Register device if needed
        try {
          const resolvedDeviceName = Device.deviceName || `${Platform.OS} device`;
          setDeviceName(resolvedDeviceName);
          await api.registerDevice({
            deviceId: storedDeviceId,
            platform: Platform.OS as 'ios' | 'android',
            deviceName: resolvedDeviceName,
          });
        } catch (e) {
          // Device might already be registered, that's ok
          console.log('Device registration:', e);
        }
        setCurrentScreen('welcome');
      }
    } catch (e) {
      console.error('Init error:', e);
      setCurrentScreen('welcome');
    } finally {
      // Mark app as ready and hide native splash
      console.log('[initializeApp] Finally block - hiding splash...');
      setAppIsReady(true);
      await ExpoSplashScreen.hideAsync();
      console.log('[initializeApp] Splash hidden, done!');
    }
  };

  /**
   * Initialize push notifications
   * Per M3: Request after first successful login, not on app install
   */
  const initializeNotifications = async () => {
    if (!deviceId || notificationsRequested) {
      return;
    }

    console.log('[Notifications] Initializing push notifications...');

    // Check for notification that launched the app (when killed)
    const initialDestination = await notificationService.getInitialNotification();
    if (initialDestination) {
      console.log('[Notifications] App launched from notification:', initialDestination);
      handleNotificationDeepLink(initialDestination);
    }

    // Request permissions and register token
    const registration = await notificationService.registerForPushNotifications(deviceId);
    if (registration) {
      console.log('[Notifications] Token registered locally:', registration.pushToken);

      // Send to WSIM (will fail gracefully if endpoint not ready)
      try {
        await api.registerPushToken(registration);
      } catch (e) {
        // Expected to fail until WSIM Phase 1 is complete
        console.log('[Notifications] WSIM registration pending - endpoint not ready');
      }
    }

    setNotificationsRequested(true);
  };

  /**
   * Handle deep link from push notification
   * Navigate to the appropriate screen based on DeepLinkDestination
   * @see LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_DEEP_LINKING_PROPOSAL.md
   */
  const handleNotificationDeepLink = async (destination: notificationService.DeepLinkDestination) => {
    console.log('[Notifications] Handling deep link:', destination);

    const { screen, params } = destination;

    switch (screen) {
      case 'TransferDetail':
        if (params.transferId) {
          console.log('[Notifications] Deep linking to transfer:', params.transferId);
          try {
            const transfer = await transferSimApi.getTransferById(params.transferId);

            // Use notification data as fallback for sender info
            // (TransferSim API may not return sender profile data)
            if (transfer.direction === 'received' && !transfer.senderDisplayName && params.senderName) {
              console.log('[Notifications] Using notification senderName as fallback:', params.senderName);
              transfer.senderDisplayName = params.senderName;
            }

            setSelectedTransfer(transfer);
            setTransferDetailReturnScreen('transferHistory');
            setCurrentScreen('transferDetail');
          } catch (e) {
            console.error('[Notifications] Failed to fetch transfer:', e);
            // Fall back to transfer history with refresh
            setTransferHistoryRefreshTrigger(prev => prev + 1);
            setCurrentScreen('transferHistory');
          }
        }
        break;

      case 'RequestApproval':
        if (params.requestId) {
          console.log('[Notifications] Deep linking to request:', params.requestId);
          // TODO: Implement dedicated request approval screen
          // For now, navigate to P2P home where pending requests are shown
          setP2pHomeRefreshTrigger(prev => prev + 1); // Force refresh on notification tap
          setActiveHomeTab('p2p');
          setCurrentScreen('home');
        }
        break;

      case 'ContractDetail':
        if (params.contractId) {
          console.log('[Notifications] Deep linking to contract:', params.contractId);
          setSelectedContractId(params.contractId);
          setContractRefreshTrigger(prev => prev + 1); // Force refresh on notification tap
          setCurrentScreen('contractDetail');
        }
        break;

      case 'ContractsList':
        console.log('[Notifications] Deep linking to contracts list');
        setCurrentScreen('contractsList');
        break;

      case 'TransferHistory':
        console.log('[Notifications] Deep linking to transfer history');
        setTransferHistoryRefreshTrigger(prev => prev + 1); // Force refresh on notification tap
        setCurrentScreen('transferHistory');
        break;

      default:
        console.warn('[Notifications] Unknown deep link screen:', screen);
    }
  };

  /**
   * Set up notification listeners when user is authenticated
   */
  useEffect(() => {
    if (!user || !deviceId) {
      return;
    }

    // Initialize notifications on login (per M3)
    initializeNotifications();

    // Set up foreground notification listener
    notificationListenerRef.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('[Notifications] Foreground notification received:', notification.request.content);
        console.log('[Notifications] Raw data:', JSON.stringify(notification.request.content.data, null, 2));

        // Parse notification data to check for transfer notifications
        const notifData = notificationService.parseNotificationData(notification);
        console.log('[Notifications] Parsed data:', notifData);

        // Extract title and body for fallback detection
        const { title, body } = notification.request.content;

        if (notifData) {
          const isTransfer = notificationService.isTransferNotification(notifData);
          const isMerchantPayment = notificationService.isMerchantPaymentNotification(notifData);
          console.log('[Notifications] Is transfer:', isTransfer, 'Is merchant payment:', isMerchantPayment);
          console.log('[Notifications] Current p2pMode:', p2pModeRef.current, 'isMicroMerchant:', isMicroMerchantRef.current);

          // Refresh merchant dashboard for ANY transfer notification when in business mode
          // This handles cases where WSIM doesn't include recipientType in the push payload
          if (isTransfer && p2pModeRef.current === 'business' && isMicroMerchantRef.current) {
            console.log('[Notifications] Transfer received in business mode, refreshing merchant dashboard...');
            loadMerchantDashboard();

            // Show payment success animation
            const amount = notifData.amount ? `$${notifData.amount.toFixed(2)}` : 'Payment';
            const sender = notifData.senderName || 'Customer';
            setMerchantPaymentSuccessMessage(`${amount} from ${sender}`);
            setShowMerchantPaymentSuccess(true);
          }

          // Handle contract notifications - refresh contract detail screen if viewing the same contract
          const rawData = notification.request.content.data as Record<string, unknown> | null;
          if (rawData && typeof rawData.type === 'string' && rawData.type.startsWith('contract.')) {
            const notificationContractId = rawData.contract_id as string;
            console.log('[Notifications] Contract notification:', rawData.type, 'contractId:', notificationContractId);
            console.log('[Notifications] Current screen:', currentScreenRef.current, 'selectedContractId:', selectedContractIdRef.current);

            // If user is viewing the contract detail screen for this contract, refresh it
            if (currentScreenRef.current === 'contractDetail' &&
                selectedContractIdRef.current === notificationContractId) {
              console.log('[Notifications] Refreshing contract detail screen for contract:', notificationContractId);
              setContractRefreshTrigger(prev => prev + 1);
            }

            // Also refresh contracts list if viewing it
            if (currentScreenRef.current === 'contractsList') {
              console.log('[Notifications] Refreshing contracts list');
              setContractRefreshTrigger(prev => prev + 1);
            }
          }
        } else {
          // FALLBACK: Detect payment notifications by title/body when data is null
          // This handles expo-notifications not passing through APNs custom payload
          const isPaymentNotification = title === 'Payment Received!' && body?.includes('received $');
          console.log('[Notifications] Fallback detection - isPaymentNotification:', isPaymentNotification);

          if (isPaymentNotification && p2pModeRef.current === 'business' && isMicroMerchantRef.current) {
            console.log('[Notifications] Payment detected via fallback, refreshing merchant dashboard...');
            loadMerchantDashboard();

            // Parse amount from body (e.g., "Demo shop 2 received $123.00")
            const amountMatch = body?.match(/received \$(\d+(?:\.\d{2})?)/);
            const amount = amountMatch ? `$${amountMatch[1]}` : 'Payment';
            setMerchantPaymentSuccessMessage(`${amount} received`);
            setShowMerchantPaymentSuccess(true);
          }

          // FALLBACK: Detect contract notifications by title pattern
          // Contract titles typically: "Contract Accepted!", "Contract Funded!", "Contract Outcome!", etc.
          const isContractNotification = title?.includes('Contract') && (
            title.includes('Accepted') ||
            title.includes('Funded') ||
            title.includes('Outcome') ||
            title.includes('Settled') ||
            title.includes('Cancelled') ||
            title.includes('Expired') ||
            title.includes('Disputed')
          );

          if (isContractNotification) {
            console.log('[Notifications] Contract notification detected via fallback, title:', title);

            // Refresh contract detail screen if viewing any contract (we don't have contract_id in fallback)
            if (currentScreenRef.current === 'contractDetail') {
              console.log('[Notifications] Refreshing contract detail screen (fallback)');
              setContractRefreshTrigger(prev => prev + 1);
            }

            // Also refresh contracts list if viewing it
            if (currentScreenRef.current === 'contractsList') {
              console.log('[Notifications] Refreshing contracts list (fallback)');
              setContractRefreshTrigger(prev => prev + 1);
            }
          }
        }

        // Notification will be shown automatically by the handler
      }
    );

    // Set up notification tap listener - navigate to screen from push notification
    notificationResponseRef.current = notificationService.addNotificationResponseListener(
      (response) => {
        const destination = notificationService.handleNotificationResponse(response);
        if (destination) {
          handleNotificationDeepLink(destination);
        }
      }
    );

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (notificationResponseRef.current) {
        notificationResponseRef.current.remove();
      }
    };
  }, [user, deviceId]);

  const handleCreateAccount = async () => {
    if (!email.trim() || !name.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (!deviceId) {
      setError('Device not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure deviceName has a fallback value
      const resolvedDeviceName = deviceName || Device.deviceName || `${Platform.OS} device`;

      const result = await api.createAccount(
        email.trim(),
        name.trim(),
        deviceId,
        resolvedDeviceName,
        Platform.OS as 'ios' | 'android'
      );

      // Store tokens
      await secureStorage.setAccessToken(result.tokens.accessToken);
      await secureStorage.setRefreshToken(result.tokens.refreshToken);

      setUser(result.user);
      setCurrentScreen('biometricSetup');
    } catch (e: any) {
      console.error('[CreateAccount] Error:', e);
      console.error('[CreateAccount] Response data:', e.response?.data);
      console.error('[CreateAccount] Status:', e.response?.status);
      const message = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to create account';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    if (!deviceId) {
      setError('Device not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure deviceName has a fallback value
      const resolvedDeviceName = deviceName || Device.deviceName || `${Platform.OS} device`;

      const result = await api.loginWithPassword(
        email.trim(),
        password,
        deviceId,
        resolvedDeviceName,
        Platform.OS as 'ios' | 'android'
      );

      // Store tokens
      await secureStorage.setAccessToken(result.tokens.accessToken);
      await secureStorage.setRefreshToken(result.tokens.refreshToken);

      setUser(result.user);
      setPassword(''); // Clear password from memory

      // Load wallet data (includes verification status)
      try {
        const walletData = await api.getWalletSummary();
        setCards(walletData.cards || []);
        // Update user with verification fields from wallet summary
        if (walletData.user) {
          console.log('[Login] Updating user with wallet summary (verification fields)');
          setUser(walletData.user);
        }
      } catch (e) {
        console.log('[Login] Failed to load wallet, continuing anyway');
      }

      // Go to home
      setCurrentScreen('home');

      // Fetch profile to get profileImageUrl (not returned by login response)
      api.getProfile().then((profileData) => {
        if (profileData.profile?.profileImageUrl) {
          console.log('[Login] Got profile image URL, updating user');
          setUser((prev) => prev ? { ...prev, profileImageUrl: profileData.profile.profileImageUrl } : prev);
        }
      }).catch((e) => console.log('[Login] Profile fetch failed (non-blocking):', e));

      // Check P2P enrollment in background after login
      // This ensures P2P data is fresh when user switches to P2P tab
      // Set loading=true FIRST to prevent showing enrollment prompt before check completes
      setP2pLoading(true);
      checkP2PEnrollment().catch((e) => {
        console.log('[Login] P2P enrollment check failed:', e);
      });
    } catch (e: any) {
      const message = e.response?.data?.message || e.message || 'Failed to login';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }
    if (!deviceId) {
      setError('Device not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.verifyLogin(email.trim(), deviceId, verificationCode.trim());

      // Store tokens
      await secureStorage.setAccessToken(result.tokens.accessToken);
      await secureStorage.setRefreshToken(result.tokens.refreshToken);

      setUser(result.user);

      // Load wallet data (includes verification status)
      try {
        const summary = await api.getWalletSummary();
        setCards(summary.cards || []);
        // Update user with verification fields from wallet summary
        if (summary.user) {
          console.log('[VerifyCode] Updating user with wallet summary (verification fields)');
          setUser(summary.user);
        }
      } catch (e) {
        // Continue anyway
      }

      setCurrentScreen('home');

      // Fetch profile to get profileImageUrl (not returned by login response)
      api.getProfile().then((profileData) => {
        if (profileData.profile?.profileImageUrl) {
          console.log('[VerifyCode] Got profile image URL, updating user');
          setUser((prev) => prev ? { ...prev, profileImageUrl: profileData.profile.profileImageUrl } : prev);
        }
      }).catch((e) => console.log('[VerifyCode] Profile fetch failed (non-blocking):', e));

      // Check P2P enrollment in background after login
      // This ensures P2P data is fresh when user switches to P2P tab
      // Set loading=true FIRST to prevent showing enrollment prompt before check completes
      setP2pLoading(true);
      checkP2PEnrollment().catch((e) => {
        console.log('[VerifyCode] P2P enrollment check failed:', e);
      });
    } catch (e: any) {
      const message = e.response?.data?.message || e.message || 'Invalid verification code';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricSetup = async () => {
    if (!deviceId) return;

    setIsLoading(true);
    try {
      const authResult = await biometricService.authenticate(`Enable ${biometricType}`);
      if (!authResult.success) {
        Alert.alert('Setup Cancelled', 'You can enable biometrics later in settings.');
        setCurrentScreen('bankSelection');
        return;
      }

      // Generate a placeholder public key (real implementation would use Secure Enclave)
      const publicKey = `mwsim_${deviceId}_${Date.now()}`;

      const capabilities = await biometricService.getCapabilities();
      await api.setupBiometric({
        deviceId,
        publicKey,
        biometricType: capabilities.biometricType as 'face' | 'fingerprint',
      });

      Alert.alert('Success', `${biometricType} enabled successfully!`);
      setCurrentScreen('bankSelection');
    } catch (e: any) {
      // Check if it's a 404 (endpoint not yet implemented)
      if (e.response?.status === 404) {
        Alert.alert(
          'Coming Soon',
          `${biometricType} setup is not yet available. You can continue without it for now.`
        );
      } else {
        Alert.alert('Setup Failed', e.message || 'Could not enable biometrics');
      }
      setCurrentScreen('bankSelection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipBiometric = () => {
    setCurrentScreen('bankSelection');
  };

  const handleLoadBanks = async () => {
    try {
      const bankList = await api.getBanks();
      setBanks(bankList);
    } catch (e) {
      console.error('Failed to load banks:', e);
    }
  };

  const handleStartEnrollment = async (bank: Bank) => {
    setSelectedBank(bank);
    setIsLoading(true);

    try {
      // Call the JWT-authenticated endpoint to get the OAuth URL
      const { authUrl } = await api.startEnrollment(bank.bsimId);

      console.log('[Enrollment] Opening browser with URL:', authUrl);

      // Open the OAuth flow in the system browser
      // The second parameter tells expo-web-browser what URL scheme to listen for
      const redirectUrl = 'mwsim://enrollment/callback';
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      console.log('[Enrollment] Browser result:', result);

      if (result.type === 'success' && result.url) {
        console.log('[Enrollment] Redirect URL:', result.url);

        // Parse the redirect URL to check success/error
        try {
          const urlObj = new URL(result.url);
          const success = urlObj.searchParams.get('success');
          const errorParam = urlObj.searchParams.get('error');

          if (success === 'true') {
            Alert.alert('Success', 'Bank enrolled successfully! Your cards have been added.');
            await handleRefreshWallet();
            // Also refresh P2P accounts in background (new bank = new accounts for P2P)
            loadP2PData().catch((e) => console.log('[Enrollment] P2P refresh failed:', e));
            setCurrentScreen('home');
          } else if (success === 'false' || errorParam) {
            const errorMsg = urlObj.searchParams.get('message') || errorParam;
            Alert.alert('Enrollment Failed', errorMsg || 'Could not complete bank enrollment');
          } else {
            // No explicit success/error param - assume success if we got here
            Alert.alert('Success', 'Bank enrolled successfully! Your cards have been added.');
            await handleRefreshWallet();
            // Also refresh P2P accounts in background
            loadP2PData().catch((e) => console.log('[Enrollment] P2P refresh failed:', e));
            setCurrentScreen('home');
          }
        } catch (parseError) {
          console.error('[Enrollment] URL parse error:', parseError);
          // If URL parsing fails, assume success since we got a redirect
          await handleRefreshWallet();
          loadP2PData().catch((e) => console.log('[Enrollment] P2P refresh failed:', e));
          setCurrentScreen('home');
        }
      } else if (result.type === 'cancel') {
        // User cancelled the browser
        console.log('[Enrollment] User cancelled');
      } else if (result.type === 'dismiss') {
        // Browser was dismissed (iOS)
        console.log('[Enrollment] Browser dismissed');
      }
    } catch (e: any) {
      const message = e.response?.data?.message || e.message || 'Failed to start enrollment';
      Alert.alert('Enrollment Error', message);
    } finally {
      setIsLoading(false);
      setSelectedBank(null);
    }
  };

  const handleRefreshWallet = async () => {
    setIsRefreshing(true);
    try {
      const summary = await api.getWalletSummary();
      setCards(summary.cards || []);
      // Preserve profileImageUrl since getWalletSummary doesn't return it
      setUser(prev => ({
        ...summary.user,
        profileImageUrl: prev?.profileImageUrl,
      }));
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSetDefaultCard = async (card: Card) => {
    if (card.isDefault) return;

    setIsLoading(true);
    try {
      await api.setDefaultCard(card.id);
      // Update local state
      setCards(prevCards =>
        prevCards.map(c => ({
          ...c,
          isDefault: c.id === card.id,
        }))
      );
      // Update selected card if viewing details
      if (selectedCard?.id === card.id) {
        setSelectedCard({ ...card, isDefault: true });
      }
      Alert.alert('Success', 'Card set as default');
    } catch (e: any) {
      const message = e.response?.data?.message || e.message || 'Failed to set default card';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCard = async (card: Card) => {
    Alert.alert(
      'Remove Card',
      `Are you sure you want to remove this ${card.cardType} card ending in ${card.lastFour}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await api.removeCard(card.id);
              // Update local state
              setCards(prevCards => prevCards.filter(c => c.id !== card.id));
              // Go back to home if viewing this card's details
              if (selectedCard?.id === card.id) {
                setSelectedCard(null);
                setCurrentScreen('home');
              }
              Alert.alert('Success', 'Card removed from wallet');
            } catch (e: any) {
              const message = e.response?.data?.message || e.message || 'Failed to remove card';
              Alert.alert('Error', message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Note: Settings screen handles the confirmation dialog before calling this
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Continue anyway
    }
    setUser(null);
    setCards([]);
    setEmail('');
    setName('');
    setVerificationCode('');
    // Clear P2P state on logout to prevent stale enrollment prompts on re-login
    setP2pEnrolled(false);
    setP2pEnrollment(null);
    setP2pLoading(false);
    setAliases([]);
    setBankAccounts([]);
    setRecentTransfers([]);
    // Reset to cards tab so user doesn't land on P2P tab after re-login
    setActiveHomeTab('cards');
    setCurrentScreen('welcome');
  };

  // Deep logout: deactivates push token and clears all device data
  // Note: Settings screen handles the confirmation dialog before calling this
  const handleDeepLogout = async () => {
    if (!deviceId) {
      // Fall back to normal logout if no deviceId
      handleLogout();
      return;
    }

    try {
      // Deactivate push token BEFORE logout (needs auth)
      await api.deactivatePushToken(deviceId);
      console.log('[DeepLogout] Push token deactivated for device:', deviceId);
    } catch (e) {
      console.log('[DeepLogout] Failed to deactivate push token:', e);
    }

    try {
      await api.logout();
    } catch (e) {
      // Continue anyway
    }

    setUser(null);
    setCards([]);
    setEmail('');
    setName('');
    setVerificationCode('');
    // Clear P2P state on logout to prevent stale enrollment prompts on re-login
    setP2pEnrolled(false);
    setP2pEnrollment(null);
    setP2pLoading(false);
    setAliases([]);
    setBankAccounts([]);
    setRecentTransfers([]);
    // Reset to cards tab so user doesn't land on P2P tab after re-login
    setActiveHomeTab('cards');
    setCurrentScreen('welcome');

    // Show toast to confirm deep logout worked
    Alert.alert('Device Cleared', 'Push notifications deactivated for this device.');
  };

  // QR Scanner functions
  const handleOpenQrScanner = async () => {
    // Request camera permission using expo-camera hook
    const result = await requestCameraPermission();

    if (result.granted) {
      setQrScanned(false);
      setTorchOn(false);
      setCurrentScreen('qrScanner');
    } else {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in Settings to scan QR codes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleOpenP2pQrScanner = async () => {
    // Request camera permission using expo-camera hook
    const result = await requestCameraPermission();

    if (result.granted) {
      // Reset all QR scan state for a fresh flow
      p2pQrScanLockRef.current = false;
      setP2pQrScanned(false);
      setP2pTorchOn(false);
      setResolvedToken(null);
      setResolving(false);
      setP2pSendAmount('');
      setP2pSendNote('');
      setCurrentScreen('p2pQrScan');
    } else {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in Settings to scan QR codes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    // Use ref for synchronous lock (state updates are async and can miss rapid scans)
    if (qrScanLockRef.current || qrScanned) return;
    qrScanLockRef.current = true;
    setQrScanned(true);

    console.log('[QR Scanner] Scanned:', data);

    // Validate the URL format
    // Expected formats:
    // WSIM Payment Requests:
    // - https://wsim.banksim.ca/pay/{requestId} (production)
    // - https://wsim-dev.banksim.ca/pay/{requestId} (development)
    // - mwsim://payment/{requestId}
    // TransferSim P2P/Merchant Tokens:
    // - https://transfer.banksim.ca/pay/{tokenId} (production)
    // - https://transfersim-dev.banksim.ca/pay/{tokenId} (development)
    // - tsim://pay/{tokenId} (legacy deep link)

    let requestId: string | null = null;
    let tokenId: string | null = null;

    // Try WSIM Universal Link format (for web payment requests)
    const wsimLinkMatch = data.match(/https:\/\/wsim(?:-dev)?\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
    if (wsimLinkMatch) {
      requestId = wsimLinkMatch[1];
    }

    // Try TransferSim Universal Link format (for P2P/merchant QR codes)
    if (!requestId) {
      const transferSimLinkMatch = data.match(/https:\/\/transfer(?:sim-dev)?\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
      if (transferSimLinkMatch) {
        tokenId = transferSimLinkMatch[1];
      }
    }

    // Try mwsim deep link format: mwsim://payment/{requestId}
    if (!requestId && !tokenId) {
      const deepLinkMatch = data.match(/mwsim:\/\/payment\/([a-zA-Z0-9_-]+)/);
      if (deepLinkMatch) {
        requestId = deepLinkMatch[1];
      }
    }

    // Try tsim deep link format: tsim://pay/{tokenId} (legacy)
    if (!requestId && !tokenId) {
      const tsimMatch = data.match(/tsim:\/\/pay\/([a-zA-Z0-9_-]+)/);
      if (tsimMatch) {
        tokenId = tsimMatch[1];
      }
    }

    if (requestId) {
      // WSIM payment request flow (existing)
      console.log('[QR Scanner] WSIM payment request ID:', requestId);

      // Store for cold start recovery (same as deep link flow)
      await secureStorage.set('pendingPaymentRequestId', requestId);
      setPendingRequestId(requestId);

      // Source is QR scan (not a browser)
      setSourceBrowser(null);
      await secureStorage.remove('pendingPaymentSourceBrowser');

      // Navigate to payment approval
      await loadPaymentRequest(requestId);
    } else if (tokenId) {
      // TransferSim token flow (P2P/merchant payments)
      console.log('[QR Scanner] TransferSim token ID:', tokenId);
      await handleTransferSimToken(tokenId);
    } else {
      // Not a valid payment QR code - keep scanning locked until user dismisses
      Alert.alert(
        'Invalid QR Code',
        'This doesn\'t appear to be a valid payment QR code. Please scan a QR code from a merchant checkout.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              qrScanLockRef.current = false;
              setQrScanned(false);
            },
          },
          {
            text: 'Cancel',
            onPress: () => {
              qrScanLockRef.current = false;
              setCurrentScreen('home');
            },
            style: 'cancel',
          },
        ]
      );
    }
  };

  // Handle TransferSim tokens from main QR scanner or Universal Links
  const handleTransferSimToken = async (tokenId: string) => {
    try {
      setResolving(true);
      const resolved = await transferSimApi.resolveTokenWithMerchantInfo(tokenId);
      setResolvedToken(resolved);

      // Pre-fill amount if specified in token
      if (resolved.amount) {
        setP2pSendAmount(resolved.amount.toString());
      }
      if (resolved.description) {
        setP2pSendNote(resolved.description);
      }

      // Navigate to P2P send confirmation (skip scanner since we already have the token)
      setP2pQrScanned(true);
      setCurrentScreen('p2pQrScan');
    } catch (e: any) {
      console.error('[QR Scanner] TransferSim token resolve failed:', e);
      Alert.alert(
        'Invalid Token',
        'This QR code has expired or is invalid.',
        [{
          text: 'OK',
          onPress: () => {
            qrScanLockRef.current = false;
            setQrScanned(false);
          },
        }]
      );
    } finally {
      setResolving(false);
    }
  };

  const handleCloseQrScanner = () => {
    qrScanLockRef.current = false;
    setQrScanned(false);
    setTorchOn(false);
    setCurrentScreen('home');
  };

  // P2P Functions
  const checkP2PEnrollment = async () => {
    try {
      setP2pLoading(true);

      // Set up P2P user context for TransferSim auth
      // Use fiUserRef (BSIM internal user ID) instead of userId
      if (user?.id) {
        // For now, use the first enrolled bank
        // In production, user should select which bank to use for P2P
        const enrolledBanks = await api.getEnrolledBanks();
        console.log('[checkP2PEnrollment] getEnrolledBanks response:', JSON.stringify(enrolledBanks, null, 2));
        if (enrolledBanks.enrollments.length > 0) {
          const enrollment = enrolledBanks.enrollments[0] as any;
          const bsimId = enrollment.bsimId;
          // Use fiUserRef if available, otherwise fall back to userId
          const authId = enrollment.fiUserRef || user.id;
          console.log('[checkP2PEnrollment] Setting P2P context:', { userId: authId, bsimId, fiUserRef: enrollment.fiUserRef });
          await secureStorage.setP2PUserContext({ userId: authId, bsimId });
        } else {
          console.log('[checkP2PEnrollment] No enrollments found - P2P context NOT set');
        }
      }

      const result = await transferSimApi.checkEnrollment();
      setP2pEnrolled(result.enrolled);
      if (result.enrollment) {
        setP2pEnrollment(result.enrollment);
        await secureStorage.setP2PEnrollment(result.enrollment);

        // Load aliases and recent transfers
        await loadP2PData();
      }
    } catch (e: any) {
      console.log('[P2P] Enrollment check failed:', e);
      // Don't reset enrollment status on rate limit or network errors
      // Only set to false on definitive "not enrolled" responses
      if (e?.response?.status === 429) {
        console.log('[P2P] Rate limited - trying cached enrollment');
        // Try to use cached enrollment
        const cachedEnrollment = await secureStorage.getP2PEnrollment();
        if (cachedEnrollment) {
          console.log('[P2P] Using cached enrollment');
          setP2pEnrolled(true);
          setP2pEnrollment(cachedEnrollment);
          await loadP2PData();
        }
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        // Auth errors - likely not enrolled or invalid context
        setP2pEnrolled(false);
      } else if (!e?.response) {
        // Network error - try cached enrollment
        console.log('[P2P] Network error - trying cached enrollment');
        const cachedEnrollment = await secureStorage.getP2PEnrollment();
        if (cachedEnrollment) {
          console.log('[P2P] Using cached enrollment');
          setP2pEnrolled(true);
          setP2pEnrollment(cachedEnrollment);
        }
      } else {
        setP2pEnrolled(false);
      }
    } finally {
      setP2pLoading(false);
    }
  };

  const loadP2PData = async () => {
    console.log('[loadP2PData] Starting...');
    try {
      // Load aliases, accounts, and recent transfers in parallel
      const [aliasesResult, accountsResult, transfersResult] = await Promise.all([
        transferSimApi.getAliases().catch((e) => { console.log('[loadP2PData] getAliases error:', e); return []; }),
        transferSimApi.getAccounts().catch((e) => { console.log('[loadP2PData] getAccounts error:', e); return []; }),
        transferSimApi.getTransfers('all', 10).catch((e) => { console.log('[loadP2PData] getTransfers error:', e); return { transfers: [], total: 0 }; }),
      ]);

      console.log('[loadP2PData] Results - aliases:', aliasesResult.length, 'accounts:', accountsResult.length, 'transfers:', transfersResult.transfers?.length || 0);
      setAliases(aliasesResult);
      setBankAccounts(accountsResult);
      setRecentTransfers(transfersResult.transfers || []);

      // Also check if user is a Micro Merchant
      await loadMerchantData();
    } catch (e) {
      console.log('[P2P] Failed to load P2P data:', e);
    }
  };

  // Load Micro Merchant data
  const loadMerchantData = async () => {
    try {
      setMerchantLoading(true);
      const profile = await transferSimApi.getMerchantProfile();
      if (profile) {
        setIsMicroMerchant(true);
        setMerchantProfile(profile);
        console.log('[Merchant] Profile loaded:', profile.merchantName);

        // Load saved p2pMode preference
        const savedMode = await AsyncStorage.getItem('p2pMode');
        if (savedMode === 'business') {
          setP2pMode('business');
          // Load dashboard data for business mode
          loadMerchantDashboard();
        }
      } else {
        setIsMicroMerchant(false);
        setMerchantProfile(null);
        setMerchantStats(null);
      }
    } catch (e) {
      console.log('[Merchant] Failed to load merchant data:', e);
      setIsMicroMerchant(false);
    } finally {
      setMerchantLoading(false);
    }
  };

  // Handle P2P mode toggle
  const handleP2PModeChange = async (mode: P2PMode) => {
    setP2pMode(mode);
    await AsyncStorage.setItem('p2pMode', mode);
    console.log('[P2P] Mode changed to:', mode);

    // Load dashboard data when switching to business mode
    if (mode === 'business' && isMicroMerchant) {
      loadMerchantDashboard();
    }
  };

  // Handle Micro Merchant enrollment
  const handleMerchantEnrollment = async () => {
    if (!merchantBusinessName.trim()) {
      setMerchantEnrollError('Please enter a business name');
      return;
    }
    if (!merchantReceivingAccount) {
      setMerchantEnrollError('Please select a receiving account');
      return;
    }

    try {
      setMerchantEnrollLoading(true);
      setMerchantEnrollError(null);

      const profile = await transferSimApi.enrollMerchant({
        merchantName: merchantBusinessName.trim(),
        merchantCategory: merchantCategory,
        receivingAccountId: merchantReceivingAccount.accountId,
      });

      setMerchantProfile(profile);
      setIsMicroMerchant(true);
      setP2pMode('business');
      await AsyncStorage.setItem('p2pMode', 'business');

      // Clear form
      setMerchantBusinessName('');
      setMerchantCategory('OTHER');
      setMerchantReceivingAccount(null);

      Alert.alert(
        'Welcome, Merchant!',
        `Your business "${profile.merchantName}" is now set up to receive payments.`,
        [{ text: 'Get Started', onPress: () => setCurrentScreen('home') }]
      );
    } catch (e: any) {
      console.log('[Merchant] Enrollment failed:', e);
      setMerchantEnrollError(e.response?.data?.message || 'Failed to enroll as merchant');
    } finally {
      setMerchantEnrollLoading(false);
    }
  };

  // Generate Personal Receive QR code
  const generatePersonalQR = async () => {
    setReceiveLoading(true);
    try {
      const token = await transferSimApi.generateReceiveToken();
      setReceiveToken(token);
    } catch (e: any) {
      console.error('[Receive] Generate token failed:', e);
      Alert.alert('Error', 'Failed to generate receive code');
    } finally {
      setReceiveLoading(false);
    }
  };

  // Generate Merchant QR code
  const generateMerchantQR = async () => {
    try {
      setMerchantQrLoading(true);
      const token = await transferSimApi.generateMerchantToken();
      setMerchantQrToken({
        tokenId: token.tokenId,
        qrPayload: token.qrPayload,
        expiresAt: token.expiresAt,
      });
    } catch (e) {
      console.log('[Merchant] Failed to generate QR:', e);
      Alert.alert('Error', 'Failed to generate payment QR code');
    } finally {
      setMerchantQrLoading(false);
    }
  };

  // Share Merchant QR code
  const handleShareMerchantQR = async () => {
    if (!merchantProfile) {
      Alert.alert('Error', 'Merchant profile not loaded');
      return;
    }
    try {
      await Share.share({
        message: `Pay ${merchantProfile.merchantName} using mwsim! Scan the QR code or use alias: ${aliases.find(a => a.isPrimary)?.value || 'N/A'}`,
      });
    } catch (e) {
      console.log('Share cancelled or failed');
    }
  };

  // Load merchant transfers (business history)
  const loadMerchantTransfers = async () => {
    try {
      setHistoryLoading(true);
      const result = await transferSimApi.getMerchantTransfers(50, 0);
      setMerchantTransfers(result.transfers);
    } catch (e) {
      console.log('[Merchant] Failed to load transfers:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load merchant dashboard data (stats + recent transactions)
  const loadMerchantDashboard = async () => {
    try {
      console.log('[Merchant] Loading dashboard data...');
      // Load stats and transactions in parallel
      const [stats, transactions] = await Promise.all([
        transferSimApi.getMerchantStats(),
        transferSimApi.getMerchantTransfers(5, 0),
      ]);
      setMerchantStats(stats);
      setMerchantTransfers(transactions.transfers);
      console.log('[Merchant] Dashboard loaded:', {
        todayRevenue: stats.todayRevenue,
        transactions: transactions.transfers.length,
      });
    } catch (e) {
      console.log('[Merchant] Failed to load dashboard:', e);
    }
  };

  const handleStartP2PEnrollment = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    try {
      setP2pLoading(true);

      // Get the user's enrolled banks to select which bank to use for P2P
      const enrolledBanks = await api.getEnrolledBanks();
      if (enrolledBanks.enrollments.length === 0) {
        Alert.alert(
          'No Bank Connected',
          'Please connect a bank first before enabling P2P transfers.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Bank',
              onPress: () => {
                handleLoadBanks();
                setCurrentScreen('bankSelection');
              },
            },
          ]
        );
        return;
      }

      // For now, use the first enrolled bank
      // TODO: Let user choose if multiple banks are enrolled
      const bankEnrollment = enrolledBanks.enrollments[0] as any;
      const bsimId = bankEnrollment.bsimId;
      // Use fiUserRef if available, otherwise fall back to userId
      const authId = bankEnrollment.fiUserRef || user.id;

      // Store P2P user context (using fiUserRef as userId for auth)
      await secureStorage.setP2PUserContext({ userId: authId, bsimId });

      // Enroll in P2P network
      const enrollment = await transferSimApi.enrollUser(user.id, bsimId);

      setP2pEnrolled(true);
      setP2pEnrollment(enrollment);
      await secureStorage.setP2PEnrollment(enrollment);

      // Load P2P data (accounts, aliases) after enrollment
      loadP2PData().catch((e) => console.log('[P2P] Failed to load data after enrollment:', e));

      // Now navigate to alias setup
      Alert.alert(
        'P2P Enabled!',
        'You\'re now set up for P2P transfers. Let\'s create your first alias so people can send you money.',
        [
          {
            text: 'Set Up Alias',
            onPress: () => setCurrentScreen('aliasManagement'),
          },
        ]
      );
    } catch (e: any) {
      console.error('[P2P] Enrollment failed:', e);
      const message = e.response?.data?.message || e.message || 'Failed to enable P2P transfers';
      Alert.alert('Enrollment Failed', message);
    } finally {
      setP2pLoading(false);
    }
  };

  const handleResetDevice = async () => {
    Alert.alert(
      'Reset Device',
      'This will clear all local data and generate a new device ID. You will need to create a new account or sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all stored data
              await secureStorage.clearAll();

              // Generate new device ID
              const newDeviceId = uuidv4();
              await secureStorage.setDeviceId(newDeviceId);
              setDeviceId(newDeviceId);

              // Reset state
              setUser(null);
              setCards([]);
              setEmail('');
              setName('');
              setVerificationCode('');
              setError(null);

              // Reset notification state so new token will be registered on next login
              setNotificationsRequested(false);

              Alert.alert('Device Reset', `New device ID generated: ${newDeviceId.slice(0, 8)}...`);
            } catch (e) {
              console.error('Reset failed:', e);
              Alert.alert('Error', 'Failed to reset device');
            }
          },
        },
      ]
    );
  };

  // =====================
  // SCREENS
  // =====================

  // Custom Splash Screen - shown after native splash hides
  if (appIsReady && showCustomSplash) {
    return (
      <>
        <StatusBar style="dark" />
        <SplashScreen onFinish={() => setShowCustomSplash(false)} />
      </>
    );
  }

  // Loading Screen - shown before app is ready
  if (!appIsReady || currentScreen === 'loading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Verify Code Screen
  if (currentScreen === 'verifyCode') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentScreen('login')}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Enter Verification Code</Text>
            <Text style={styles.formSubtitle}>
              We sent a code to {email}. Enter it below to sign in.
            </Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Verification Code</Text>
              <TextInput
                style={styles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="123456"
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleVerifyCode}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Login Screen
  if (currentScreen === 'login') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentScreen('welcome')}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Sign In</Text>
            <Text style={styles.formSubtitle}>
              Enter your email and password to sign in.
            </Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setError(null);
                setCurrentScreen('createAccount');
              }}
            >
              <Text style={styles.linkText}>Don't have an account? Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Create Account Screen
  if (currentScreen === 'createAccount') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentScreen('welcome')}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Create Your Wallet</Text>
            <Text style={styles.formSubtitle}>
              Enter your details to get started with your digital wallet.
            </Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleCreateAccount}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setError(null);
                setCurrentScreen('login');
              }}
            >
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Biometric Setup Screen
  if (currentScreen === 'biometricSetup') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.topSection}>
            <View style={styles.biometricIcon}>
              <Text style={styles.logoEmoji}>👆</Text>
            </View>

            <Text style={styles.title}>Secure Your Wallet</Text>

            <Text style={styles.subtitle}>
              Enable {biometricType} to quickly and securely access your wallet and authorize
              payments.
            </Text>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleBiometricSetup}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Enable {biometricType}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={handleSkipBiometric}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Bank Selection Screen
  if (currentScreen === 'bankSelection') {
    return (
      <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.content}>
            <Text style={styles.formTitle}>Add Your First Card</Text>
            <Text style={styles.formSubtitle}>
              Connect a bank to add your cards to the wallet.
            </Text>

            <ScrollView style={styles.bankList}>
              {banks.length === 0 ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.loadingText}>Loading banks...</Text>
                </View>
              ) : (
                banks.map((bank) => (
                  <TouchableOpacity
                    key={bank.bsimId}
                    style={styles.bankItem}
                    onPress={() => handleStartEnrollment(bank)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bankIcon}>
                      <Text style={styles.bankEmoji}>🏦</Text>
                    </View>
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankName}>{bank.name}</Text>
                      {bank.description && (
                        <Text style={styles.bankDescription}>{bank.description}</Text>
                      )}
                    </View>
                    <Text style={styles.bankArrow}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => setCurrentScreen('home')}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
    );
  }

  // QR Scanner Screen
  if (currentScreen === 'qrScanner') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.qrScannerContainer}>
          {/* Header */}
          <View style={styles.qrScannerHeader}>
            <TouchableOpacity onPress={handleCloseQrScanner} style={styles.qrScannerBackButton}>
              <Text style={styles.qrScannerBackText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.qrScannerTitle}>Scan QR Code</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Camera View */}
          <View style={styles.qrScannerCameraContainer}>
            {cameraPermission?.granted === false ? (
              <View style={styles.qrScannerPermissionDenied}>
                <Text style={styles.qrScannerPermissionIcon}>📷</Text>
                <Text style={styles.qrScannerPermissionTitle}>Camera Access Required</Text>
                <Text style={styles.qrScannerPermissionText}>
                  Please enable camera access in Settings to scan payment QR codes.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryButtonText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <CameraView
                  onBarcodeScanned={qrScanned ? undefined : handleBarCodeScanned}
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  enableTorch={torchOn}
                />

                {/* Scanning Frame Overlay */}
                <View style={styles.qrScannerOverlay}>
                  <View style={styles.qrScannerOverlayTop} />
                  <View style={styles.qrScannerOverlayMiddle}>
                    <View style={styles.qrScannerOverlaySide} />
                    <View style={styles.qrScannerFrame}>
                      {/* Corner markers */}
                      <View style={[styles.qrCorner, styles.qrCornerTopLeft]} />
                      <View style={[styles.qrCorner, styles.qrCornerTopRight]} />
                      <View style={[styles.qrCorner, styles.qrCornerBottomLeft]} />
                      <View style={[styles.qrCorner, styles.qrCornerBottomRight]} />
                    </View>
                    <View style={styles.qrScannerOverlaySide} />
                  </View>
                  <View style={styles.qrScannerOverlayBottom} />
                </View>

                {/* Instructions */}
                <View style={styles.qrScannerInstructions}>
                  <Text style={styles.qrScannerInstructionsText}>
                    Point your camera at a payment QR code
                  </Text>
                </View>

                {/* Torch Toggle */}
                <TouchableOpacity
                  style={styles.qrTorchButton}
                  onPress={() => setTorchOn(!torchOn)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qrTorchIcon}>{torchOn ? '🔦' : '💡'}</Text>
                  <Text style={styles.qrTorchText}>{torchOn ? 'Light On' : 'Light Off'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Home Screen with Tabs
  if (currentScreen === 'home') {
    // Cards Tab Content
    const renderCardsTab = () => (
      <ScrollView
        style={styles.cardList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefreshWallet} />
        }
      >
        <Text style={styles.sectionTitle}>My Cards</Text>

        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySubtitle}>
              Add a bank to get started with your digital wallet.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 20 }]}
              onPress={() => {
                handleLoadBanks();
                setCurrentScreen('bankSelection');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Add a Bank</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.card,
                  { backgroundColor: card.cardType === 'VISA' ? '#1a1f71' : '#eb001b' },
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedCard(card);
                  setCurrentScreen('cardDetails');
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardBank}>{card.bankName}</Text>
                  {card.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardNumber}>•••• •••• •••• {card.lastFour}</Text>
                <Text style={styles.cardType}>{card.cardType}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.outlineButton, { marginTop: 16 }]}
              onPress={() => {
                handleLoadBanks();
                setCurrentScreen('bankSelection');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.outlineButtonText}>+ Add Another Bank</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.qrScanButton, { marginTop: 12 }]}
              onPress={handleOpenQrScanner}
              activeOpacity={0.7}
            >
              <Text style={styles.qrScanButtonIcon}>📷</Text>
              <Text style={styles.qrScanButtonText}>Scan QR Code to Pay</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );

    // P2P Tab Content
    const renderP2PTab = () => {
      // Loading state
      if (p2pLoading) {
        return (
          <View style={styles.p2pLoadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading P2P...</Text>
          </View>
        );
      }

      // Not enrolled state
      if (!p2pEnrolled) {
        return (
          <View style={styles.p2pEnrollContainer}>
            <View style={styles.p2pEnrollIcon}>
              <Text style={{ fontSize: 48 }}>💸</Text>
            </View>
            <Text style={styles.p2pEnrollTitle}>Enable P2P Transfers</Text>
            <Text style={styles.p2pEnrollSubtitle}>
              Send and receive money instantly to anyone with just their email, phone number, or username.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleStartP2PEnrollment}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Get Started with P2P</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // Enrolled state - show P2P home
      // Render Personal mode content (current P2P)
      const renderPersonalMode = () => (
        <>
          {/* Quick Actions */}
          <View style={styles.p2pQuickActions}>
            <TouchableOpacity
              style={styles.p2pQuickAction}
              onPress={() => setCurrentScreen('sendMoney')}
              activeOpacity={0.7}
            >
              <View style={[styles.p2pQuickActionIcon, { backgroundColor: '#eff6ff' }]}>
                <Text style={{ fontSize: 24 }}>↗️</Text>
              </View>
              <Text style={styles.p2pQuickActionText}>Send</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.p2pQuickAction}
              onPress={() => setCurrentScreen('receiveMoney')}
              activeOpacity={0.7}
            >
              <View style={[styles.p2pQuickActionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Text style={{ fontSize: 24 }}>↙️</Text>
              </View>
              <Text style={styles.p2pQuickActionText}>Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.p2pQuickAction}
              onPress={() => setCurrentScreen('aliasManagement')}
              activeOpacity={0.7}
            >
              <View style={[styles.p2pQuickActionIcon, { backgroundColor: '#fef3c7' }]}>
                <Text style={{ fontSize: 24 }}>@</Text>
              </View>
              <Text style={styles.p2pQuickActionText}>Aliases</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.p2pQuickAction}
              onPress={handleOpenP2pQrScanner}
              activeOpacity={0.7}
            >
              <View style={[styles.p2pQuickActionIcon, { backgroundColor: '#fce7f3' }]}>
                <Text style={{ fontSize: 24 }}>📷</Text>
              </View>
              <Text style={styles.p2pQuickActionText}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.p2pQuickAction}
              onPress={() => setCurrentScreen('contractsList')}
              activeOpacity={0.7}
            >
              <View style={[styles.p2pQuickActionIcon, { backgroundColor: '#ede9fe' }]}>
                <Text style={{ fontSize: 24 }}>📝</Text>
              </View>
              <Text style={styles.p2pQuickActionText}>Contracts</Text>
            </TouchableOpacity>
          </View>

          {/* My Aliases */}
          <View style={styles.p2pSection}>
            <Text style={styles.sectionTitle}>My Aliases</Text>
            {aliases.length === 0 ? (
              <TouchableOpacity
                style={styles.p2pAddAliasCard}
                onPress={() => setCurrentScreen('aliasManagement')}
                activeOpacity={0.7}
              >
                <Text style={styles.p2pAddAliasText}>+ Add your first alias to receive money</Text>
              </TouchableOpacity>
            ) : (
              aliases.map((alias) => (
                <View key={alias.id} style={styles.p2pAliasCard}>
                  <View style={styles.p2pAliasInfo}>
                    <Text style={styles.p2pAliasValue}>{alias.value}</Text>
                    <Text style={styles.p2pAliasType}>{alias.type}</Text>
                  </View>
                  {alias.isPrimary && (
                    <View style={styles.p2pPrimaryBadge}>
                      <Text style={styles.p2pPrimaryBadgeText}>Primary</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Recent Transfers */}
          <View style={styles.p2pSection}>
            <View style={styles.p2pSectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transfers</Text>
              {recentTransfers.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setHistoryViewMode('personal');
                  setCurrentScreen('transferHistory');
                }}>
                  <Text style={styles.p2pSeeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            {recentTransfers.length === 0 ? (
              <View style={styles.p2pEmptyTransfers}>
                <Text style={styles.p2pEmptyTransfersText}>No transfers yet</Text>
              </View>
            ) : (
              recentTransfers.slice(0, 5).map((transfer) => {
                // Check if transfer failed
                const isFailed = ['DEBIT_FAILED', 'CREDIT_FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED', 'RECIPIENT_NOT_FOUND'].includes(transfer.status);
                const failedStatusText = isFailed ? (
                  transfer.status === 'RECIPIENT_NOT_FOUND' ? 'Not found' :
                  transfer.status === 'CANCELLED' ? 'Cancelled' :
                  transfer.status === 'EXPIRED' ? 'Expired' :
                  'Failed'
                ) : null;

                // Detect transfer type from description
                const desc = (transfer.description || '').toLowerCase();
                const isWager = desc.includes('wager') || desc.includes('bet');
                const isContract = desc.includes('contract') || desc.includes('settlement') || desc.includes('escrow');
                const transferType = isWager ? { label: 'Wager', icon: '🎲', color: '#8b5cf6' }
                  : isContract ? { label: 'Contract', icon: '📜', color: '#3b82f6' }
                  : null; // null = regular P2P transfer, no badge needed

                return (
                  <TouchableOpacity
                    key={transfer.transferId}
                    style={[styles.p2pTransferItem, isFailed && { opacity: 0.7 }]}
                    onPress={() => {
                      setSelectedTransfer(transfer);
                      setTransferDetailReturnScreen('p2pHome');
                      setIsViewingMerchantPayment(false);
                      setCurrentScreen('transferDetail');
                    }}
                    activeOpacity={0.7}
                  >
                    <ProfileAvatar
                      imageUrl={transfer.direction === 'sent'
                        ? transfer.recipientProfileImageUrl
                        : transfer.senderProfileImageUrl}
                      displayName={transfer.direction === 'sent'
                        ? transfer.recipientDisplayName || transfer.recipientAlias || 'Unknown'
                        : transfer.senderDisplayName || transfer.senderAlias || 'Unknown'}
                      size="small"
                      isVerified={transfer.direction === 'sent'
                        ? transfer.recipientIsVerified
                        : transfer.senderIsVerified}
                      verificationLevel={transfer.direction === 'sent'
                        ? transfer.recipientVerificationLevel
                        : transfer.senderVerificationLevel}
                    />
                    <View style={styles.p2pTransferInfo}>
                      <Text style={styles.p2pTransferName}>
                        {/* Prefer showing @alias in list when available, otherwise show displayName */}
                        {transfer.direction === 'sent'
                          ? (transfer.recipientAlias?.startsWith('@') ? transfer.recipientAlias : transfer.recipientDisplayName || transfer.recipientAlias)
                          : (transfer.senderAlias?.startsWith('@') ? transfer.senderAlias : transfer.senderDisplayName || transfer.senderAlias)}
                      </Text>
                      <View style={styles.p2pTransferMeta}>
                        <Text style={[styles.p2pTransferDate, isFailed && { color: '#ef4444' }]}>
                          {isFailed ? failedStatusText : new Date(transfer.createdAt).toLocaleDateString()}
                        </Text>
                        {transferType && (
                          <View style={[styles.p2pTransferTypeBadge, { backgroundColor: transferType.color + '15' }]}>
                            <Text style={[styles.p2pTransferTypeText, { color: transferType.color }]}>
                              {transferType.icon} {transferType.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.p2pTransferAmount,
                        isFailed
                          ? { color: '#9ca3af', textDecorationLine: 'line-through' }
                          : transfer.direction === 'received' && styles.p2pTransferAmountReceived,
                      ]}
                    >
                      {transfer.direction === 'sent' ? '-' : '+'}${Number(transfer.amount || 0).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Become a Merchant CTA - only show if not already a merchant */}
          {!isMicroMerchant && (
            <View style={styles.p2pSection}>
              <TouchableOpacity
                style={styles.merchantCTACard}
                onPress={() => setCurrentScreen('merchantEnrollment')}
                activeOpacity={0.7}
              >
                <View style={styles.merchantCTAIcon}>
                  <Text style={{ fontSize: 28 }}>🏪</Text>
                </View>
                <View style={styles.merchantCTAContent}>
                  <Text style={styles.merchantCTATitle}>Accept Business Payments</Text>
                  <Text style={styles.merchantCTASubtitle}>
                    Set up as a Micro Merchant to receive payments with a professional profile
                  </Text>
                </View>
                <Text style={styles.merchantCTAArrow}>→</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      );

      // Render Business mode content (Merchant Dashboard)
      const renderBusinessMode = () => (
        <>
          {/* Merchant Header */}
          <View style={styles.merchantDashboardHeader}>
            <View style={styles.merchantHeaderRow}>
              <ProfileAvatar
                imageUrl={merchantProfile?.logoImageUrl}
                displayName={merchantProfile?.merchantName || 'Business'}
                size="medium"
                userId={merchantProfile?.merchantId}
                variant="merchant"
                initialsColor={merchantProfile?.initialsColor}
              />
              <View style={styles.merchantHeaderInfo}>
                <Text style={styles.merchantBusinessName}>
                  {merchantProfile?.merchantName || 'My Business'}
                </Text>
                <Text style={styles.merchantAlias}>
                  {aliases.find(a => a.isPrimary)?.value || '@business'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.merchantEditButton}
                onPress={() => setCurrentScreen('merchantProfileEdit')}
              >
                <Text style={styles.merchantEditButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.merchantBadge}>
              <Text style={styles.merchantBadgeText}>Micro Merchant</Text>
            </View>
          </View>

          {/* Merchant QR Code */}
          <View style={[styles.merchantQRSection, isTablet && { flex: 1 }]}>
            <Text style={styles.merchantQRTitle}>
              {merchantQrToken ? `Scan to pay ${merchantProfile?.merchantName || 'merchant'}` : 'Payment QR Code'}
            </Text>
            <View style={[styles.merchantQRContainer, { width: merchantQRSize, height: merchantQRSize }]}>
              {showMerchantPaymentSuccess ? (
                <View style={{ flex: 1, width: '100%', height: '100%' }}>
                  <MerchantPaymentSuccess
                    onComplete={handleMerchantPaymentSuccessComplete}
                    message={merchantPaymentSuccessMessage}
                    displayDuration={3000}
                    fadeDuration={500}
                    containerSize={merchantQRSize}
                  />
                </View>
              ) : merchantQrLoading ? (
                <ActivityIndicator size="large" color="#10B981" />
              ) : merchantQrToken ? (
                <QRCountdownBorder
                  expiresAt={merchantQrToken.expiresAt}
                  size={merchantQRSize}
                  strokeWidth={merchantQRStrokeWidth}
                  onExpired={generateMerchantQR}
                >
                  <QRCode
                    value={merchantQrToken.qrPayload}
                    size={merchantQRInnerSize}
                    backgroundColor="white"
                    color="#065F46"
                  />
                </QRCountdownBorder>
              ) : (
                <TouchableOpacity
                  style={styles.merchantGenerateQRButton}
                  onPress={generateMerchantQR}
                  activeOpacity={0.7}
                >
                  <Text style={styles.merchantGenerateQRText}>Generate QR Code</Text>
                </TouchableOpacity>
              )}
            </View>
            {merchantQrToken && (
              <View style={styles.merchantQRActions}>
                <TouchableOpacity
                  style={styles.merchantQRAction}
                  onPress={handleShareMerchantQR}
                  activeOpacity={0.7}
                >
                  <Text style={styles.merchantQRActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.merchantQRAction}
                  onPress={generateMerchantQR}
                  activeOpacity={0.7}
                >
                  <Text style={styles.merchantQRActionText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>


          {/* Today's Stats */}
          <View style={styles.merchantStatsSection}>
            <View style={styles.merchantStatCard}>
              <Text style={[styles.merchantStatValue, isTablet && { fontSize: 32 }]}>
                ${merchantStats?.todayRevenue?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.merchantStatLabel, isTablet && { fontSize: 16 }]}>Today</Text>
            </View>
            <View style={styles.merchantStatCard}>
              <Text style={[styles.merchantStatValue, isTablet && { fontSize: 32 }]}>
                ${merchantStats?.weekRevenue?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.merchantStatLabel, isTablet && { fontSize: 16 }]}>This Week</Text>
            </View>
            <View style={styles.merchantStatCard}>
              <Text style={[styles.merchantStatValue, isTablet && { fontSize: 32 }]}>
                {merchantStats?.todayTransactionCount || 0}
              </Text>
              <Text style={[styles.merchantStatLabel, isTablet && { fontSize: 16 }]}>Transactions</Text>
            </View>
          </View>

          {/* Recent Business Payments */}
          <View style={styles.p2pSection}>
            <View style={styles.p2pSectionHeader}>
              <Text style={styles.sectionTitle}>Recent Payments</Text>
              <TouchableOpacity onPress={() => {
                setHistoryViewMode('business');
                loadMerchantTransfers();
                setCurrentScreen('transferHistory');
              }}>
                <Text style={styles.p2pSeeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {merchantTransfers.length === 0 ? (
              <View style={styles.p2pEmptyTransfers}>
                <Text style={styles.p2pEmptyTransfersText}>No payments received yet</Text>
                <Text style={styles.merchantEmptyHint}>
                  Share your QR code to start accepting payments
                </Text>
              </View>
            ) : (
              merchantTransfers.slice(0, 5).map((transfer) => (
                <TouchableOpacity
                  key={transfer.transferId}
                  style={styles.merchantTransferItem}
                  onPress={() => {
                    setSelectedTransfer(transfer);
                    setTransferDetailReturnScreen('home');
                    setIsViewingMerchantPayment(true);
                    setCurrentScreen('transferDetail');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.merchantPaymentIcon}>
                    <Text style={{ fontSize: 20 }}>🏦</Text>
                  </View>
                  <View style={styles.p2pTransferInfo}>
                    <Text style={styles.p2pTransferName}>
                      {transfer.senderBankName || 'Bank Transfer'}
                      {transfer.senderAccountLast4 && ` ****${transfer.senderAccountLast4}`}
                    </Text>
                    <Text style={styles.p2pTransferDate}>
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.merchantTransferAmounts}>
                    <Text style={styles.merchantTransferGross}>
                      +${Number(transfer.grossAmount || transfer.amount || 0).toFixed(2)}
                    </Text>
                    {transfer.feeAmount && (
                      <Text style={styles.merchantTransferFee}>
                        Fee: ${transfer.feeAmount.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      );

      return (
        <ScrollView
          style={styles.p2pContent}
          contentContainerStyle={isTablet ? { flexGrow: 1 } : undefined}
          refreshControl={
            <RefreshControl refreshing={p2pLoading} onRefresh={loadP2PData} />
          }
        >
          {/* Personal/Business Toggle - only show if user is a Micro Merchant */}
          {isMicroMerchant && (
            <View style={styles.p2pModeToggle}>
              <TouchableOpacity
                style={[
                  styles.p2pModeButton,
                  p2pMode === 'personal' && styles.p2pModeButtonActive,
                ]}
                onPress={() => handleP2PModeChange('personal')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.p2pModeButtonText,
                  p2pMode === 'personal' && styles.p2pModeButtonTextActive,
                ]}>
                  Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.p2pModeButton,
                  styles.p2pModeButtonBusiness,
                  p2pMode === 'business' && styles.p2pModeButtonBusinessActive,
                ]}
                onPress={() => handleP2PModeChange('business')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.p2pModeButtonText,
                  p2pMode === 'business' && styles.p2pModeButtonTextActive,
                ]}>
                  Business
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Render content based on mode */}
          {p2pMode === 'personal' ? renderPersonalMode() : renderBusinessMode()}
        </ScrollView>
      );
    };

    // Home screen main return
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />

        {/* Pitch Page Modal - shown on login for eligible users */}
        {activePitchPage && (
          <PitchPageModal
            pitchPage={activePitchPage}
            visible={showPitchPage}
            onDismiss={handlePitchPageDismiss}
            onNavigate={handlePitchPageNavigate}
          />
        )}

        <View style={styles.homeContent}>
          {/* Header */}
          <View style={styles.homeHeader}>
            <View style={styles.homeHeaderLeft}>
              <ProfileAvatar
                imageUrl={user?.profileImageUrl}
                displayName={user?.name || 'User'}
                size="medium"
                userId={user?.id}
                isVerified={user?.isVerified}
                verificationLevel={user?.verificationLevel}
              />
              <View style={styles.homeHeaderText}>
                <Text style={styles.homeGreeting}>Welcome back,</Text>
                <Text style={styles.homeName}>{user?.name || 'User'}</Text>
                {/* Environment indicator - tucked under name */}
                <TouchableOpacity
                  style={[styles.envBadgeInline, isDevelopment() && styles.envBadgeInlineDev]}
                  onLongPress={() => {
                    const debugInfo = getEnvironmentDebugInfo();
                    Alert.alert('Environment Debug Info', debugInfo);
                  }}
                  delayLongPress={500}
                >
                  <Text style={styles.envBadgeInlineText}>{getEnvironmentName()}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setCurrentScreen('settings')}
              style={styles.settingsButton}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeHomeTab === 'cards' ? renderCardsTab() : renderP2PTab()}

          {/* Bottom Tabs */}
          <View style={styles.bottomTabBar}>
            <TouchableOpacity
              style={[styles.bottomTab, activeHomeTab === 'cards' && styles.bottomTabActive]}
              onPress={() => setActiveHomeTab('cards')}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>💳</Text>
              <Text
                style={[
                  styles.bottomTabText,
                  activeHomeTab === 'cards' && styles.bottomTabTextActive,
                ]}
              >
                Cards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomTab, activeHomeTab === 'p2p' && styles.bottomTabActive]}
              onPress={() => {
                setActiveHomeTab('p2p');
                // Check P2P enrollment when switching to tab
                if (!p2pEnrolled && !p2pLoading) {
                  checkP2PEnrollment();
                } else if (p2pEnrolled && !p2pLoading) {
                  // Refresh P2P data when switching to tab (now safe with sanitization)
                  loadP2PData();
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomTabIcon}>💸</Text>
              <Text
                style={[
                  styles.bottomTabText,
                  activeHomeTab === 'p2p' && styles.bottomTabTextActive,
                ]}
              >
                P2P
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Alias Management Screen
  if (currentScreen === 'aliasManagement') {
    const handleCreateAlias = async () => {
      if (!newAliasValue.trim()) {
        setAliasError('Please enter an alias value');
        return;
      }

      setAliasLoading(true);
      setAliasError(null);

      try {
        const newAlias = await transferSimApi.createAlias(newAliasType, newAliasValue.trim());
        setAliases([...aliases, newAlias]);
        setNewAliasValue('');
        Alert.alert('Success', 'Alias created successfully!');
      } catch (e: any) {
        console.error('[Alias] Create failed:', e);
        const message = e.response?.data?.message || e.message || 'Failed to create alias';
        setAliasError(message);
      } finally {
        setAliasLoading(false);
      }
    };

    const handleDeleteAlias = async (aliasId: string) => {
      Alert.alert(
        'Delete Alias',
        'Are you sure you want to delete this alias? People will no longer be able to send you money using it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await transferSimApi.deleteAlias(aliasId);
                setAliases(aliases.filter(a => a.id !== aliasId));
                Alert.alert('Success', 'Alias deleted');
              } catch (e: any) {
                Alert.alert('Error', 'Failed to delete alias');
              }
            },
          },
        ]
      );
    };

    const handleSetPrimary = async (aliasId: string) => {
      try {
        await transferSimApi.setPrimaryAlias(aliasId);
        setAliases(aliases.map(a => ({
          ...a,
          isPrimary: a.id === aliasId,
        })));
        Alert.alert('Success', 'Primary alias updated');
      } catch (e: any) {
        Alert.alert('Error', 'Failed to set primary alias');
      }
    };

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.aliasManagementContent}>
          {/* Header */}
          <View style={styles.aliasManagementHeader}>
            <TouchableOpacity
              onPress={() => {
                setActiveHomeTab('p2p');
                setCurrentScreen('home');
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.aliasManagementTitle}>My Aliases</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.aliasManagementScroll}>
            {/* Add New Alias Section */}
            <View style={styles.aliasAddSection}>
              <Text style={styles.aliasAddTitle}>Add New Alias</Text>
              <Text style={styles.aliasAddSubtitle}>
                People can send you money using your alias instead of your account number.
              </Text>

              {/* Alias Type Selector */}
              <View style={styles.aliasTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.aliasTypeOption,
                    newAliasType === 'USERNAME' && styles.aliasTypeOptionActive,
                  ]}
                  onPress={() => setNewAliasType('USERNAME')}
                >
                  <Text
                    style={[
                      styles.aliasTypeOptionText,
                      newAliasType === 'USERNAME' && styles.aliasTypeOptionTextActive,
                    ]}
                  >
                    Username
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.aliasTypeOption,
                    newAliasType === 'EMAIL' && styles.aliasTypeOptionActive,
                  ]}
                  onPress={() => setNewAliasType('EMAIL')}
                >
                  <Text
                    style={[
                      styles.aliasTypeOptionText,
                      newAliasType === 'EMAIL' && styles.aliasTypeOptionTextActive,
                    ]}
                  >
                    Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.aliasTypeOption,
                    newAliasType === 'PHONE' && styles.aliasTypeOptionActive,
                  ]}
                  onPress={() => setNewAliasType('PHONE')}
                >
                  <Text
                    style={[
                      styles.aliasTypeOptionText,
                      newAliasType === 'PHONE' && styles.aliasTypeOptionTextActive,
                    ]}
                  >
                    Phone
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Alias Input */}
              <View style={styles.aliasInputContainer}>
                {newAliasType === 'USERNAME' && (
                  <Text style={styles.aliasInputPrefix}>@</Text>
                )}
                <TextInput
                  style={[
                    styles.aliasInput,
                    newAliasType === 'USERNAME' && styles.aliasInputWithPrefix,
                  ]}
                  value={newAliasValue}
                  onChangeText={setNewAliasValue}
                  placeholder={
                    newAliasType === 'USERNAME'
                      ? 'johndoe'
                      : newAliasType === 'EMAIL'
                      ? 'you@example.com'
                      : '+1 (555) 123-4567'
                  }
                  keyboardType={
                    newAliasType === 'EMAIL'
                      ? 'email-address'
                      : newAliasType === 'PHONE'
                      ? 'phone-pad'
                      : 'default'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {aliasError && (
                <Text style={styles.aliasErrorText}>{aliasError}</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={handleCreateAlias}
                disabled={aliasLoading}
                activeOpacity={0.7}
              >
                {aliasLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Add Alias</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Existing Aliases */}
            <View style={styles.aliasListSection}>
              <Text style={styles.sectionTitle}>Your Aliases</Text>
              {aliases.length === 0 ? (
                <View style={styles.aliasEmptyState}>
                  <Text style={styles.aliasEmptyText}>
                    No aliases yet. Add one above to receive money!
                  </Text>
                </View>
              ) : (
                aliases.map((alias) => (
                  <View key={alias.id} style={styles.aliasListItem}>
                    <View style={styles.aliasListInfo}>
                      <Text style={styles.aliasListValue}>{alias.value}</Text>
                      <View style={styles.aliasListMeta}>
                        <Text style={styles.aliasListType}>{alias.type}</Text>
                        {alias.isPrimary && (
                          <View style={styles.aliasPrimaryBadge}>
                            <Text style={styles.aliasPrimaryBadgeText}>Primary</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.aliasListActions}>
                      {!alias.isPrimary && (
                        <TouchableOpacity
                          style={styles.aliasActionButton}
                          onPress={() => handleSetPrimary(alias.id)}
                        >
                          <Text style={styles.aliasActionButtonText}>Set Primary</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.aliasDeleteButton}
                        onPress={() => handleDeleteAlias(alias.id)}
                      >
                        <Text style={styles.aliasDeleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Receive Money Screen
  if (currentScreen === 'receiveMoney') {
    const primaryAlias = aliases.find(a => a.isPrimary) || aliases[0];

    const handleShareAlias = async () => {
      if (!primaryAlias) {
        Alert.alert('No Alias', 'Please create an alias first');
        return;
      }

      try {
        await Share.share({
          message: `Send me money on mwsim! My alias is: ${primaryAlias.value}`,
        });
      } catch (e) {
        console.log('Share cancelled or failed');
      }
    };

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.receiveContent}>
          {/* Header */}
          <View style={styles.receiveHeader}>
            <TouchableOpacity
              onPress={async () => {
                // Stop nearby broadcast if active
                if (nearbyBroadcastEnabled) {
                  await stopAdvertising();
                  setNearbyBroadcastEnabled(false);
                  setNearbyBeaconRegistration(null);
                }
                setActiveHomeTab('p2p');
                setCurrentScreen('home');
                setReceiveToken(null);
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.receiveTitle}>Receive Money</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.receiveScroll} contentContainerStyle={styles.receiveScrollContent}>
            {/* QR Code Section */}
            <View style={styles.receiveQRSection}>
              <View style={styles.receiveQRPlaceholder}>
                {receiveLoading ? (
                  <ActivityIndicator size="large" color="#3b82f6" />
                ) : receiveToken ? (
                  <>
                    <View style={styles.receiveQRBox}>
                      <QRCountdownBorder
                        expiresAt={receiveToken.expiresAt}
                        size={200}
                        strokeWidth={4}
                      >
                        <QRCode
                          value={receiveToken.qrPayload}
                          size={180}
                          backgroundColor="white"
                          color="#1e40af"
                        />
                      </QRCountdownBorder>
                      <Text style={styles.receiveQRSubtext}>
                        Expires: {new Date(receiveToken.expiresAt).toLocaleTimeString()}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.receiveQRIcon}>📱</Text>
                    <Text style={styles.receiveQRText}>Generate a QR Code</Text>
                    <Text style={styles.receiveQRSubtext}>
                      Let others scan to send you money instantly
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={generatePersonalQR}
                disabled={receiveLoading}
                activeOpacity={0.7}
              >
                {receiveLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {receiveToken ? 'Refresh QR Code' : 'Generate QR Code'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Or share alias */}
            <View style={styles.receiveOrSection}>
              <View style={styles.receiveOrLine} />
              <Text style={styles.receiveOrText}>OR</Text>
              <View style={styles.receiveOrLine} />
            </View>

            {/* Share Alias Section */}
            <View style={styles.receiveAliasSection}>
              <Text style={styles.receiveAliasTitle}>Share Your Alias</Text>
              {primaryAlias ? (
                <>
                  <View style={styles.receiveAliasCard}>
                    <Text style={styles.receiveAliasValue}>{primaryAlias.value}</Text>
                    <Text style={styles.receiveAliasType}>{primaryAlias.type}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.outlineButton, { marginTop: 16 }]}
                    onPress={handleShareAlias}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.outlineButtonText}>Share Alias</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.receiveNoAliasText}>
                    Create an alias so people can send you money easily
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 16 }]}
                    onPress={() => setCurrentScreen('aliasManagement')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.primaryButtonText}>Create Alias</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Nearby Discovery Section */}
            <View style={styles.receiveOrSection}>
              <View style={styles.receiveOrLine} />
              <Text style={styles.receiveOrText}>OR</Text>
              <View style={styles.receiveOrLine} />
            </View>

            <View style={styles.receiveAliasSection}>
              <Text style={styles.receiveAliasTitle}>Nearby Discovery</Text>
              <Text style={styles.receiveNoAliasText}>
                Let people nearby discover you via Bluetooth
              </Text>
              <TouchableOpacity
                style={[
                  styles.nearbyToggleButton,
                  nearbyBroadcastEnabled && styles.nearbyToggleButtonActive
                ]}
                onPress={async () => {
                  if (nearbyBroadcastEnabled) {
                    // Stop broadcasting
                    await stopAdvertising();
                    setNearbyBroadcastEnabled(false);
                    setNearbyBeaconRegistration(null);
                  } else {
                    // Start broadcasting
                    const registration = await registerForDiscovery('P2P_RECEIVE');
                    if (registration) {
                      const started = await startAdvertising(registration);
                      if (started) {
                        setNearbyBroadcastEnabled(true);
                        setNearbyBeaconRegistration(registration);
                      } else {
                        Alert.alert('Error', 'Failed to start nearby broadcast');
                      }
                    } else {
                      Alert.alert('Error', 'Failed to register for nearby discovery. Please try again.');
                    }
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.nearbyToggleContent}>
                  <Text style={styles.nearbyToggleIcon}>
                    {nearbyBroadcastEnabled ? '\u2713' : '\uD83D\uDCE1'}
                  </Text>
                  <View style={styles.nearbyToggleText}>
                    <Text style={[
                      styles.nearbyToggleTitle,
                      nearbyBroadcastEnabled && styles.nearbyToggleTitleActive
                    ]}>
                      {nearbyBroadcastEnabled ? 'Broadcasting' : 'Enable Nearby'}
                    </Text>
                    <Text style={styles.nearbyToggleSubtitle}>
                      {nearbyBroadcastEnabled
                        ? `Expires: ${nearbyBeaconRegistration ? new Date(nearbyBeaconRegistration.expiresAt).toLocaleTimeString() : ''}`
                        : 'Others can find you via Bluetooth'
                      }
                    </Text>
                  </View>
                  {nearbyBroadcastEnabled && (
                    <View style={styles.nearbyBroadcastIndicator}>
                      <View style={styles.nearbyBroadcastDot} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Send Money Screen
  if (currentScreen === 'sendMoney') {
    const handleLookupRecipient = async () => {
      if (!recipientAlias.trim()) {
        Alert.alert('Error', 'Please enter a recipient alias');
        return;
      }

      setLookupLoading(true);
      try {
        const result = await transferSimApi.lookupAlias(recipientAlias.trim());
        setRecipientInfo(result);
        if (!result.found) {
          Alert.alert('Not Found', 'No user found with that alias. Please check and try again.');
        }
      } catch (e: any) {
        console.error('[Send] Lookup failed:', e);
        Alert.alert('Error', 'Failed to look up recipient');
      } finally {
        setLookupLoading(false);
      }
    };

    const handleProceedToConfirm = () => {
      // In nearby mode, selectedNearbyUser is valid (recipientInfo is set async)
      const hasValidRecipient = sendInputMode === 'nearby'
        ? !!selectedNearbyUser
        : recipientInfo?.found;

      if (!hasValidRecipient) {
        Alert.alert('Error', 'Please look up a valid recipient first');
        return;
      }
      if (!sendAmount || parseFloat(sendAmount) <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }
      if (!selectedAccount) {
        Alert.alert('Error', 'Please select a source account');
        return;
      }
      setSendStep('confirm');
    };

    const handleSendMoney = async () => {
      if (!selectedAccount || !recipientInfo?.found) return;

      // Biometric authentication before sending
      const recipientName = recipientInfo.displayName || recipientAlias.trim();
      const amountFormatted = `$${parseFloat(sendAmount).toFixed(2)}`;
      const authResult = await biometricService.authenticateForTransfer(amountFormatted, recipientName);

      if (!authResult.success) {
        if (authResult.error !== 'Authentication cancelled') {
          Alert.alert('Authentication Failed', authResult.error || 'Please try again');
        }
        return;
      }

      setSendLoading(true);
      try {
        // Get alias type from recipientInfo (set from lookup or nearby user selection)
        const aliasType = recipientInfo?.aliasType;
        const result = await transferSimApi.sendMoney(
          recipientAlias.trim(),
          parseFloat(sendAmount),
          selectedAccount.accountId,
          selectedAccount.bsimId,
          sendNote.trim() || undefined,
          aliasType
        );
        setCompletedTransfer(result);
        setSendStep('success');

        // Poll for final status after 1 second (transfers typically complete in <1s)
        setTimeout(async () => {
          try {
            const updatedTransfer = await transferSimApi.getTransfer(result.transferId);
            setCompletedTransfer({ transferId: updatedTransfer.transferId, status: updatedTransfer.status });
            // Also refresh P2P data in background to update balances and transfer list
            loadP2PData();
          } catch (e) {
            console.log('[Send] Status poll failed:', e);
            // Keep showing initial status if poll fails
          }
        }, 1000);
      } catch (e: any) {
        console.error('[Send] Transfer failed:', e);
        Alert.alert('Transfer Failed', e.response?.data?.message || 'Failed to send money. Please try again.');
      } finally {
        setSendLoading(false);
      }
    };

    const handleDone = () => {
      setActiveHomeTab('p2p');
      setCurrentScreen('home');
      // Reset state
      setSendStep('input');
      setRecipientAlias('');
      setSendAmount('');
      setSendNote('');
      setRecipientInfo(null);
      setCompletedTransfer(null);
    };

    // Success Screen
    if (sendStep === 'success' && completedTransfer) {
      // Determine status category for display
      const status = completedTransfer.status;
      const isProcessing = ['PENDING', 'RESOLVING', 'DEBITING', 'CREDITING'].includes(status);
      const isSuccess = status === 'COMPLETED';
      const isFailed = ['DEBIT_FAILED', 'CREDIT_FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED', 'RECIPIENT_NOT_FOUND'].includes(status);

      // Status display config
      const statusConfig = isSuccess
        ? { icon: '✓', title: 'Transfer Complete!', color: '#22c55e', bgColor: '#dcfce7' }
        : isFailed
        ? { icon: '✕', title: 'Transfer Failed', color: '#ef4444', bgColor: '#fee2e2' }
        : { icon: '⏳', title: 'Processing...', color: '#f59e0b', bgColor: '#fef3c7' };

      // User-friendly status text
      const getStatusText = () => {
        switch (status) {
          case 'COMPLETED': return 'Transfer complete';
          case 'PENDING': return 'Initiating transfer...';
          case 'RESOLVING': return 'Finding recipient...';
          case 'DEBITING': return 'Debiting your account...';
          case 'CREDITING': return 'Crediting recipient...';
          case 'DEBIT_FAILED': return 'Failed to debit account';
          case 'CREDIT_FAILED': return 'Failed to credit recipient';
          case 'CANCELLED': return 'Transfer cancelled';
          case 'EXPIRED': return 'Transfer expired';
          case 'REVERSED': return 'Transfer reversed';
          case 'RECIPIENT_NOT_FOUND': return 'Recipient not found';
          default: return status;
        }
      };

      return (
        <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.sendSuccessContent}>
            <View style={[styles.sendSuccessIcon, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={{ fontSize: 64, color: statusConfig.color }}>{statusConfig.icon}</Text>
            </View>
            <Text style={styles.sendSuccessTitle}>{statusConfig.title}</Text>
            <Text style={styles.sendSuccessAmount}>
              ${parseFloat(sendAmount).toFixed(2)} CAD
            </Text>
            <Text style={styles.sendSuccessRecipient}>
              to {recipientInfo?.displayName || recipientAlias}
            </Text>
            {sendNote ? (
              <Text style={styles.sendSuccessNote}>"{sendNote}"</Text>
            ) : null}
            <Text style={[styles.sendSuccessStatus, { color: statusConfig.color }]}>
              {getStatusText()}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 32, width: '100%' }]}
              onPress={handleDone}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Confirm Screen
    if (sendStep === 'confirm') {
      return (
        <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.sendContent}>
            {/* Header */}
            <View style={styles.sendHeader}>
              <TouchableOpacity onPress={() => setSendStep('input')}>
                <Text style={styles.backButton}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.sendTitle}>Confirm Transfer</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.sendScrollContent} showsVerticalScrollIndicator={false}>
              {/* Transfer Summary */}
              <View style={styles.sendConfirmCard}>
                <View style={styles.sendConfirmRow}>
                  <Text style={styles.sendConfirmLabel}>Amount</Text>
                  <Text style={styles.sendConfirmValueLarge}>
                    ${parseFloat(sendAmount).toFixed(2)} CAD
                  </Text>
                </View>

                <View style={styles.sendConfirmDivider} />

                <View style={styles.sendConfirmRow}>
                  <Text style={styles.sendConfirmLabel}>To</Text>
                  <View>
                    <Text style={styles.sendConfirmValue}>{recipientInfo?.displayName}</Text>
                    <Text style={styles.sendConfirmValueSub}>{recipientAlias}</Text>
                  </View>
                </View>

                <View style={styles.sendConfirmDivider} />

                <View style={styles.sendConfirmRow}>
                  <Text style={styles.sendConfirmLabel}>From</Text>
                  <View>
                    <Text style={styles.sendConfirmValue}>{selectedAccount?.displayName}</Text>
                    <Text style={styles.sendConfirmValueSub}>{selectedAccount?.bankName}</Text>
                  </View>
                </View>

                {sendNote ? (
                  <>
                    <View style={styles.sendConfirmDivider} />
                    <View style={styles.sendConfirmRow}>
                      <Text style={styles.sendConfirmLabel}>Note</Text>
                      <Text style={styles.sendConfirmValue}>{sendNote}</Text>
                    </View>
                  </>
                ) : null}
              </View>

              <Text style={styles.sendConfirmDisclaimer}>
                By confirming, you authorize the transfer of funds from your account.
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={styles.sendActions}>
              <TouchableOpacity
                style={[styles.primaryButton, sendLoading && styles.buttonDisabled]}
                onPress={handleSendMoney}
                disabled={sendLoading}
                activeOpacity={0.7}
              >
                {sendLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirm & Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Input Screen (default)
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.sendContent}>
          {/* Header */}
          <View style={styles.sendHeader}>
            <TouchableOpacity
              onPress={() => {
                setActiveHomeTab('p2p');
                setCurrentScreen('home');
                setSendInputMode('alias');
                setSelectedNearbyUser(null);
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.sendTitle}>Send Money</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Tab Selector: Alias | Nearby */}
          <View style={styles.sendTabContainer}>
            <TouchableOpacity
              style={[
                styles.sendTab,
                sendInputMode === 'alias' && styles.sendTabActive
              ]}
              onPress={() => {
                setSendInputMode('alias');
                setSelectedNearbyUser(null);
              }}
            >
              <Text style={[
                styles.sendTabText,
                sendInputMode === 'alias' && styles.sendTabTextActive
              ]}>Alias</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendTab,
                sendInputMode === 'nearby' && styles.sendTabActive
              ]}
              onPress={() => {
                setSendInputMode('nearby');
                setRecipientInfo(null);
                setRecipientAlias('');
              }}
            >
              <Text style={[
                styles.sendTabText,
                sendInputMode === 'nearby' && styles.sendTabTextActive
              ]}>Nearby</Text>
            </TouchableOpacity>
          </View>

          {/* Nearby Users Panel */}
          {sendInputMode === 'nearby' ? (
            <View style={{ flex: 1 }}>
              {selectedNearbyUser ? (
                <ScrollView style={styles.sendScrollContent} showsVerticalScrollIndicator={false}>
                  {/* Selected Nearby User */}
                  <View style={styles.sendSection}>
                    <Text style={styles.sendSectionLabel}>Send to</Text>
                    <View style={styles.recipientInfoCard}>
                      <View style={{ marginRight: 12 }}>
                        <ProfileAvatar
                          imageUrl={selectedNearbyUser.profileImageUrl}
                          displayName={selectedNearbyUser.displayName}
                          size="small"
                          initialsColor={selectedNearbyUser.initialsColor}
                          variant="user"
                        />
                      </View>
                      <View style={styles.recipientInfoDetails}>
                        <Text style={styles.recipientInfoName}>
                          {selectedNearbyUser.displayName}
                        </Text>
                        <Text style={styles.recipientInfoBank}>{selectedNearbyUser.bankName || 'Nearby'}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedNearbyUser(null)}>
                        <Text style={{ fontSize: 20, color: '#6b7280' }}>x</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Amount Input */}
                  <View style={styles.sendSection}>
                    <Text style={styles.sendSectionLabel}>Amount</Text>
                    <View style={styles.amountInputContainer}>
                      <Text style={styles.amountCurrency}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        value={sendAmount}
                        onChangeText={setSendAmount}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.amountCurrencyCode}>CAD</Text>
                    </View>
                  </View>

                  {/* Source Account */}
                  <View style={styles.sendSection}>
                    <Text style={styles.sendSectionLabel}>From account</Text>
                    {bankAccounts.map((account) => (
                      <TouchableOpacity
                        key={account.accountId}
                        style={[
                          styles.accountOption,
                          selectedAccount?.accountId === account.accountId && styles.accountOptionSelected
                        ]}
                        onPress={() => setSelectedAccount(account)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.accountOptionInfo}>
                          <Text style={styles.accountOptionName}>{account.displayName}</Text>
                          <Text style={styles.accountOptionBank}>{account.bankName}</Text>
                        </View>
                        <View style={styles.accountOptionBalance}>
                          <Text style={styles.accountOptionBalanceAmount}>
                            ${account.balance?.toFixed(2) || '—'}
                          </Text>
                          {selectedAccount?.accountId === account.accountId && (
                            <Text style={styles.accountOptionCheck}>✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Note Input */}
                  <View style={styles.sendSection}>
                    <Text style={styles.sendSectionLabel}>Note (optional)</Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                      placeholder="What's this for?"
                      value={sendNote}
                      onChangeText={setSendNote}
                      multiline
                      maxLength={140}
                    />
                  </View>
                </ScrollView>
              ) : (
                <NearbyUsersPanel
                  isActive={sendInputMode === 'nearby'}
                  onSelectUser={(user) => {
                    setSelectedNearbyUser(user);
                    // If user has a recipientAlias, set it for the transfer
                    if (user.recipientAlias) {
                      setRecipientAlias(user.recipientAlias);
                    }
                    // Pre-fill amount if available from beacon metadata
                    if (user.metadata?.amount) {
                      setSendAmount(user.metadata.amount.toString());
                    }
                  }}
                />
              )}
            </View>
          ) : (
          <ScrollView style={styles.sendScrollContent} showsVerticalScrollIndicator={false}>
            {/* Recipient Input */}
            <View style={styles.sendSection}>
              <Text style={styles.sendSectionLabel}>Send to</Text>
              <View style={styles.sendRecipientRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="@username, email, or phone"
                  value={recipientAlias}
                  onChangeText={(text) => {
                    setRecipientAlias(text);
                    setRecipientInfo(null); // Reset lookup when typing
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.lookupButton, lookupLoading && styles.buttonDisabled]}
                  onPress={handleLookupRecipient}
                  disabled={lookupLoading}
                  activeOpacity={0.7}
                >
                  {lookupLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.lookupButtonText}>Look up</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Recipient Info */}
              {recipientInfo && (
                <View style={[
                  styles.recipientInfoCard,
                  !recipientInfo.found && styles.recipientInfoCardError
                ]}>
                  {recipientInfo.found ? (
                    <>
                      <View style={{ marginRight: 12 }}>
                        <ProfileAvatar
                          imageUrl={recipientInfo.profileImageUrl}
                          displayName={recipientInfo.displayName || recipientAlias}
                          size="small"
                          initialsColor={recipientInfo.initialsColor}
                          variant="user"
                          isVerified={recipientInfo.isVerified}
                          verificationLevel={recipientInfo.verificationLevel}
                        />
                      </View>
                      <View style={styles.recipientInfoDetails}>
                        <Text style={styles.recipientInfoName}>{recipientInfo.displayName}</Text>
                        <Text style={styles.recipientInfoBank}>{recipientInfo.bankName}</Text>
                      </View>
                      <Text style={styles.recipientInfoCheck}>✓</Text>
                    </>
                  ) : (
                    <Text style={styles.recipientInfoError}>
                      No user found with this alias
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Amount Input */}
            <View style={styles.sendSection}>
              <Text style={styles.sendSectionLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.amountCurrency}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.amountCurrencyCode}>CAD</Text>
              </View>
            </View>

            {/* Source Account */}
            <View style={styles.sendSection}>
              <Text style={styles.sendSectionLabel}>From account</Text>
              {bankAccounts.map((account) => (
                <TouchableOpacity
                  key={account.accountId}
                  style={[
                    styles.accountOption,
                    selectedAccount?.accountId === account.accountId && styles.accountOptionSelected
                  ]}
                  onPress={() => setSelectedAccount(account)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountOptionInfo}>
                    <Text style={styles.accountOptionName}>{account.displayName}</Text>
                    <Text style={styles.accountOptionBank}>{account.bankName}</Text>
                  </View>
                  <View style={styles.accountOptionBalance}>
                    <Text style={styles.accountOptionBalanceAmount}>
                      ${account.balance?.toFixed(2) || '—'}
                    </Text>
                    {selectedAccount?.accountId === account.accountId && (
                      <Text style={styles.accountOptionCheck}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note Input */}
            <View style={styles.sendSection}>
              <Text style={styles.sendSectionLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="What's this for?"
                value={sendNote}
                onChangeText={setSendNote}
                multiline
                maxLength={140}
              />
            </View>
          </ScrollView>
          )}

          {/* Continue Button */}
          <View style={styles.sendActions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (sendInputMode === 'nearby'
                  ? (!selectedNearbyUser || !sendAmount || !selectedAccount)
                  : (!recipientInfo?.found || !sendAmount || !selectedAccount)
                ) && styles.buttonDisabled
              ]}
              onPress={() => {
                if (sendInputMode === 'nearby' && selectedNearbyUser) {
                  // For nearby mode, create a mock recipientInfo and proceed
                  // Default to 'ALIAS' type if not provided by discovery API
                  setRecipientInfo({
                    found: true,
                    displayName: selectedNearbyUser.isMerchant && selectedNearbyUser.merchantName
                      ? selectedNearbyUser.merchantName
                      : selectedNearbyUser.displayName,
                    bankName: selectedNearbyUser.bankName,
                    aliasType: selectedNearbyUser.aliasType || 'ALIAS',
                    profileImageUrl: selectedNearbyUser.profileImageUrl,
                    initialsColor: selectedNearbyUser.initialsColor,
                    isMerchant: selectedNearbyUser.isMerchant,
                    merchantLogoUrl: selectedNearbyUser.merchantLogoUrl,
                  });
                  // Use recipientAlias if available (set when user was selected)
                  if (!recipientAlias && selectedNearbyUser.recipientAlias) {
                    setRecipientAlias(selectedNearbyUser.recipientAlias);
                  }
                }
                handleProceedToConfirm();
              }}
              disabled={
                sendInputMode === 'nearby'
                  ? (!selectedNearbyUser || !sendAmount || !selectedAccount)
                  : (!recipientInfo?.found || !sendAmount || !selectedAccount)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Transfer History Screen
  if (currentScreen === 'transferHistory') {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'COMPLETED': return '#22c55e';
        case 'PENDING':
        case 'RESOLVING':
        case 'DEBITING':
        case 'CREDITING': return '#f59e0b';
        case 'CANCELLED':
        case 'EXPIRED': return '#6b7280';
        default: return '#ef4444';
      }
    };

    // Human-readable status text for the list view
    const getStatusDisplay = (status: string) => {
      switch (status) {
        case 'COMPLETED': return 'Completed';
        case 'PENDING': return 'Pending';
        case 'RESOLVING': return 'Processing...';
        case 'DEBITING': return 'Processing...';
        case 'CREDITING': return 'Depositing...';
        case 'CANCELLED': return 'Cancelled';
        case 'EXPIRED': return 'Expired';
        case 'REVERSED': return 'Reversed';
        case 'DEBIT_FAILED': return 'Failed';
        case 'CREDIT_FAILED': return 'Failed';
        case 'RECIPIENT_NOT_FOUND': return 'Recipient not found';
        default: return status;
      }
    };

    // Check if transfer is in a failed state
    const isFailedTransfer = (status: string) => {
      return ['DEBIT_FAILED', 'CREDIT_FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED', 'RECIPIENT_NOT_FOUND'].includes(status);
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } else if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.historyContent}>
          {/* Header */}
          <View style={styles.historyHeader}>
            <TouchableOpacity
              onPress={() => {
                setActiveHomeTab('p2p');
                setCurrentScreen('home');
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>
              {historyViewMode === 'business' ? 'Payment History' : 'Transfer History'}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Filter Tabs - only show for personal mode */}
          {historyViewMode === 'personal' && (
            <View style={styles.historyFilterTabs}>
              {(['all', 'sent', 'received'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.historyFilterTab,
                    historyFilter === filter && styles.historyFilterTabActive
                  ]}
                  onPress={() => setHistoryFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.historyFilterTabText,
                    historyFilter === filter && styles.historyFilterTabTextActive
                  ]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Transfer List */}
          <ScrollView
            style={styles.historyList}
            refreshControl={
              <RefreshControl
                refreshing={historyViewMode === 'business' ? historyLoading : historyRefreshing}
                onRefresh={historyViewMode === 'business' ? loadMerchantTransfers : refreshHistoryTransfers}
              />
            }
          >
            {(historyViewMode === 'business' ? merchantTransfers : historyTransfers).length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyIcon}>📋</Text>
                <Text style={styles.historyEmptyText}>
                  {historyViewMode === 'business' ? 'No payments yet' : 'No transfers yet'}
                </Text>
                <Text style={styles.historyEmptySubtext}>
                  {historyViewMode === 'business'
                    ? 'Payments you receive will appear here'
                    : 'Your transfer history will appear here'}
                </Text>
              </View>
            ) : (
              (historyViewMode === 'business' ? merchantTransfers : historyTransfers).map((transfer) => (
                <TouchableOpacity
                  key={transfer.transferId}
                  style={styles.historyItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedTransfer(transfer);
                    setTransferDetailReturnScreen('transferHistory');
                    setIsViewingMerchantPayment(historyViewMode === 'business');
                    setCurrentScreen('transferDetail');
                  }}
                >
                  {historyViewMode === 'business' ? (
                    <>
                      {/* Bank icon for merchant payments */}
                      <View style={styles.merchantPaymentIcon}>
                        <Text style={{ fontSize: 20 }}>🏦</Text>
                      </View>

                      {/* Details */}
                      <View style={styles.historyItemDetails}>
                        <Text style={styles.historyItemName}>
                          {transfer.senderBankName || 'Bank Transfer'}
                          {transfer.senderAccountLast4 && ` ****${transfer.senderAccountLast4}`}
                        </Text>
                        <View style={styles.historyItemMeta}>
                          <Text style={styles.historyItemDate}>{formatDate(transfer.createdAt)}</Text>
                          <Text style={[styles.historyItemStatus, { color: getStatusColor(transfer.status) }]}>
                            {getStatusDisplay(transfer.status)}
                          </Text>
                        </View>
                      </View>

                      {/* Amount with fee */}
                      <View style={styles.merchantTransferAmounts}>
                        <Text style={[
                          styles.historyItemAmount,
                          { color: isFailedTransfer(transfer.status) ? '#9ca3af' : '#22c55e' },
                          isFailedTransfer(transfer.status) && { textDecorationLine: 'line-through' }
                        ]}>
                          +${Number((transfer as TransferWithRecipientType).grossAmount || transfer.amount || 0).toFixed(2)}
                        </Text>
                        {(transfer as TransferWithRecipientType).feeAmount && (
                          <Text style={styles.merchantTransferFee}>
                            Fee: ${(transfer as TransferWithRecipientType).feeAmount?.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </>
                  ) : (
                    <>
                      {/* Avatar with direction indicator for personal transfers */}
                      <View style={styles.historyItemAvatarContainer}>
                        <ProfileAvatar
                          imageUrl={transfer.direction === 'sent'
                            ? transfer.recipientProfileImageUrl
                            : transfer.senderProfileImageUrl}
                          displayName={transfer.direction === 'sent'
                            ? transfer.recipientDisplayName || transfer.recipientAlias || 'Unknown'
                            : transfer.senderDisplayName || transfer.senderAlias || 'Unknown'}
                          size="small"
                          isVerified={transfer.direction === 'sent'
                            ? transfer.recipientIsVerified
                            : transfer.senderIsVerified}
                          verificationLevel={transfer.direction === 'sent'
                            ? transfer.recipientVerificationLevel
                            : transfer.senderVerificationLevel}
                        />
                        <View style={[
                          styles.historyDirectionBadge,
                          { backgroundColor: transfer.direction === 'sent' ? '#fef2f2' : '#f0fdf4' }
                        ]}>
                          <Text style={{ fontSize: 10 }}>
                            {transfer.direction === 'sent' ? '↗' : '↙'}
                          </Text>
                        </View>
                      </View>

                      {/* Details */}
                      <View style={styles.historyItemDetails}>
                        <Text style={styles.historyItemName}>
                          {transfer.direction === 'sent'
                            ? transfer.recipientDisplayName || transfer.recipientAlias || 'Unknown'
                            : transfer.senderDisplayName || transfer.senderAlias || 'Unknown'}
                        </Text>
                        <View style={styles.historyItemMeta}>
                          <Text style={styles.historyItemDate}>{formatDate(transfer.createdAt)}</Text>
                          <Text style={[styles.historyItemStatus, { color: getStatusColor(transfer.status) }]}>
                            {getStatusDisplay(transfer.status)}
                          </Text>
                          {/* Transfer type badge */}
                          {(() => {
                            const desc = (transfer.description || '').toLowerCase();
                            const isWager = desc.includes('wager') || desc.includes('bet');
                            const isContract = desc.includes('contract') || desc.includes('settlement') || desc.includes('escrow');
                            const typeInfo = isWager ? { label: 'Wager', icon: '🎲', color: '#8b5cf6' }
                              : isContract ? { label: 'Contract', icon: '📜', color: '#3b82f6' }
                              : null;
                            return typeInfo && (
                              <View style={[styles.historyTypeBadge, { backgroundColor: typeInfo.color + '15' }]}>
                                <Text style={[styles.historyTypeText, { color: typeInfo.color }]}>
                                  {typeInfo.icon} {typeInfo.label}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                      </View>

                      {/* Amount - show strikethrough and gray for failed transfers */}
                      <Text style={[
                        styles.historyItemAmount,
                        { color: isFailedTransfer(transfer.status)
                          ? '#9ca3af'  // Gray for failed
                          : transfer.direction === 'sent' ? '#ef4444' : '#22c55e'
                        },
                        isFailedTransfer(transfer.status) && { textDecorationLine: 'line-through' }
                      ]}>
                        {transfer.direction === 'sent' ? '-' : '+'}${Number(transfer.amount || 0).toFixed(2)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Transfer Detail Screen
  if (currentScreen === 'transferDetail' && selectedTransfer) {
    const isSent = selectedTransfer.direction === 'sent';
    // Use the flag set when navigating to this screen
    const merchantTransfer = selectedTransfer as TransferWithRecipientType;

    // For merchant payments, show bank info instead of personal info
    const bankNameWithAccount = selectedTransfer.senderBankName
      ? `${selectedTransfer.senderBankName}${selectedTransfer.senderAccountLast4 ? ` ****${selectedTransfer.senderAccountLast4}` : ''}`
      : 'Bank Transfer';
    // For transfer details: show displayName as primary, alias below if it's a nice @-prefixed alias
    const rawAlias = isSent ? selectedTransfer.recipientAlias : selectedTransfer.senderAlias;
    const rawDisplayName = isSent ? selectedTransfer.recipientDisplayName : selectedTransfer.senderDisplayName;
    const counterpartyName = isViewingMerchantPayment
      ? bankNameWithAccount
      : rawDisplayName || rawAlias || 'Unknown';
    // Only show alias if it's an @-prefixed alias AND we have a separate display name to show
    const counterpartyAlias = isViewingMerchantPayment
      ? undefined  // Don't show alias for merchant payments
      : (rawAlias?.startsWith('@') && rawDisplayName) ? rawAlias : undefined;
    const counterpartyBank = isViewingMerchantPayment
      ? undefined  // Bank is already shown as the name
      : isSent
        ? selectedTransfer.recipientBankName
        : selectedTransfer.senderBankName;

    const formatFullDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'COMPLETED': return '#22c55e';
        case 'PENDING':
        case 'RESOLVING':
        case 'DEBITING':
        case 'CREDITING': return '#f59e0b';
        case 'CANCELLED':
        case 'EXPIRED': return '#6b7280';
        default: return '#ef4444';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'COMPLETED': return 'Completed';
        case 'PENDING': return 'Pending';
        case 'RESOLVING': return 'Finding recipient...';
        case 'DEBITING': return 'Processing...';
        case 'CREDITING': return 'Depositing...';
        case 'CANCELLED': return 'Cancelled';
        case 'EXPIRED': return 'Expired';
        case 'REVERSED': return 'Reversed';
        case 'DEBIT_FAILED': return 'Payment failed';
        case 'CREDIT_FAILED': return 'Deposit failed';
        case 'RECIPIENT_NOT_FOUND': return 'Recipient not found';
        default: return status;
      }
    };

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.transferDetailContent}>
          {/* Header */}
          <View style={styles.transferDetailHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedTransfer(null);
                if (transferDetailReturnScreen === 'p2pHome') {
                  setActiveHomeTab('p2p');
                  setCurrentScreen('home');
                } else {
                  setCurrentScreen(transferDetailReturnScreen);
                }
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.transferDetailTitle}>Transfer Details</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.transferDetailScroll} showsVerticalScrollIndicator={false}>
            {/* Amount and Direction */}
            {(() => {
              const isTransferFailed = ['DEBIT_FAILED', 'CREDIT_FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED', 'RECIPIENT_NOT_FOUND'].includes(selectedTransfer.status);
              return (
                <View style={styles.transferDetailAmountCard}>
                  <View style={[
                    styles.transferDetailDirectionIcon,
                    { backgroundColor: isTransferFailed ? '#fef2f2' : isSent ? '#fef2f2' : '#f0fdf4' }
                  ]}>
                    <Text style={{ fontSize: 32 }}>{isTransferFailed ? '⚠️' : isSent ? '↗️' : '↙️'}</Text>
                  </View>
                  <Text style={[
                    styles.transferDetailAmount,
                    { color: isTransferFailed ? '#9ca3af' : isSent ? '#dc2626' : '#16a34a' },
                    isTransferFailed && { textDecorationLine: 'line-through' }
                  ]}>
                    {isSent ? '-' : '+'}${Number(selectedTransfer.amount || 0).toFixed(2)} {selectedTransfer.currency}
                  </Text>
                  <View style={[
                    styles.transferDetailStatusBadge,
                    { backgroundColor: getStatusColor(selectedTransfer.status) + '20' }
                  ]}>
                    <Text style={[
                      styles.transferDetailStatusText,
                      { color: getStatusColor(selectedTransfer.status) }
                    ]}>
                      {getStatusText(selectedTransfer.status)}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Counterparty Info */}
            <View style={styles.transferDetailSection}>
              <Text style={styles.transferDetailSectionTitle}>
                {isViewingMerchantPayment ? 'Payment from' : isSent ? 'Sent to' : 'Received from'}
              </Text>
              <View style={[
                styles.transferDetailInfoCard,
                { flexDirection: 'row', alignItems: 'center' }
              ]}>
                {isViewingMerchantPayment ? (
                  <View style={[
                    styles.transferDetailPersonIcon,
                    { marginBottom: 0, marginRight: 12, backgroundColor: '#dbeafe' }
                  ]}>
                    <Text style={{ fontSize: 24 }}>🏦</Text>
                  </View>
                ) : (
                  <View style={{ marginRight: 12 }}>
                    <ProfileAvatar
                      imageUrl={isSent
                        ? selectedTransfer.recipientProfileImageUrl
                        : selectedTransfer.senderProfileImageUrl}
                      displayName={counterpartyName}
                      size="medium"
                      isVerified={isSent
                        ? selectedTransfer.recipientIsVerified
                        : selectedTransfer.senderIsVerified}
                      verificationLevel={isSent
                        ? selectedTransfer.recipientVerificationLevel
                        : selectedTransfer.senderVerificationLevel}
                    />
                  </View>
                )}
                <View style={styles.transferDetailPersonInfo}>
                  <Text style={styles.transferDetailPersonName}>{counterpartyName}</Text>
                  {counterpartyAlias && (
                    <Text style={styles.transferDetailPersonAlias}>{counterpartyAlias}</Text>
                  )}
                  {counterpartyBank && (
                    <Text style={styles.transferDetailPersonBank}>{counterpartyBank}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Fee Breakdown for Merchant Payments */}
            {isViewingMerchantPayment && merchantTransfer.feeAmount !== undefined && (
              <View style={styles.transferDetailSection}>
                <Text style={styles.transferDetailSectionTitle}>Payment Breakdown</Text>
                <View style={styles.transferDetailInfoCard}>
                  <View style={styles.transferDetailRow}>
                    <Text style={styles.transferDetailLabel}>Gross Amount</Text>
                    <Text style={styles.transferDetailValue}>
                      ${Number(merchantTransfer.grossAmount || selectedTransfer.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.transferDetailRow}>
                    <Text style={styles.transferDetailLabel}>Processing Fee</Text>
                    <Text style={[styles.transferDetailValue, { color: '#ef4444' }]}>
                      -${merchantTransfer.feeAmount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.transferDetailRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.transferDetailLabel, { fontWeight: '600' }]}>Net Amount</Text>
                    <Text style={[styles.transferDetailValue, { fontWeight: '600', color: '#16a34a' }]}>
                      ${Number(selectedTransfer.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Description/Note */}
            {selectedTransfer.description && (
              <View style={styles.transferDetailSection}>
                <Text style={styles.transferDetailSectionTitle}>Note</Text>
                <View style={styles.transferDetailNoteCard}>
                  <Text style={styles.transferDetailNoteText}>{selectedTransfer.description}</Text>
                </View>
              </View>
            )}

            {/* Transaction Details */}
            <View style={styles.transferDetailSection}>
              <Text style={styles.transferDetailSectionTitle}>Transaction Details</Text>
              <View style={styles.transferDetailInfoCard}>
                <View style={styles.transferDetailRow}>
                  <Text style={styles.transferDetailLabel}>Date</Text>
                  <Text style={styles.transferDetailValue}>
                    {formatFullDate(selectedTransfer.createdAt)}
                  </Text>
                </View>
                {selectedTransfer.completedAt && (
                  <View style={styles.transferDetailRow}>
                    <Text style={styles.transferDetailLabel}>Completed</Text>
                    <Text style={styles.transferDetailValue}>
                      {formatFullDate(selectedTransfer.completedAt)}
                    </Text>
                  </View>
                )}
                <View style={[styles.transferDetailRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.transferDetailLabel}>Reference</Text>
                  <Text style={styles.transferDetailValueMono}>
                    {selectedTransfer.transferId.substring(0, 12)}...
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // P2P QR Scanner Screen
  if (currentScreen === 'p2pQrScan') {
    const handleP2pQrScanned = async ({ data }: { type: string; data: string }) => {
      // Use ref for synchronous lock (state updates are async and can miss rapid scans)
      if (p2pQrScanLockRef.current || p2pQrScanned) return;
      p2pQrScanLockRef.current = true;
      setP2pQrScanned(true);
      setResolving(true);

      console.log('[P2P QR] Scanned:', data);

      try {
        // The QR payload could be a token ID or a full URL
        // Supported formats:
        // - https://transfer.banksim.ca/pay/{tokenId} (Universal Link)
        // - https://transfersim-dev.banksim.ca/pay/{tokenId} (dev Universal Link)
        // - tsim://pay/{tokenId} (legacy deep link)
        // - just the tokenId
        let tokenId = data;

        // Try TransferSim Universal Link format first
        const transferSimMatch = data.match(/https:\/\/transfer(?:sim-dev)?\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
        if (transferSimMatch) {
          tokenId = transferSimMatch[1];
        } else {
          // Try legacy tsim:// deep link format
          const tokenMatch = data.match(/tsim:\/\/pay\/([a-zA-Z0-9_-]+)/);
          if (tokenMatch) {
            tokenId = tokenMatch[1];
          }
        }

        // Use merchant-aware token resolution to get recipientType
        const resolved = await transferSimApi.resolveTokenWithMerchantInfo(tokenId);
        setResolvedToken(resolved);

        // Pre-fill amount if specified in token
        if (resolved.amount) {
          setP2pSendAmount(resolved.amount.toString());
        }
        if (resolved.description) {
          setP2pSendNote(resolved.description);
        }
      } catch (e: any) {
        console.error('[P2P QR] Resolve failed:', e);
        Alert.alert(
          'Invalid QR Code',
          'This QR code is not a valid P2P receive code.',
          [{
            text: 'Try Again',
            onPress: () => {
              p2pQrScanLockRef.current = false;
              setP2pQrScanned(false);
            },
          }]
        );
      } finally {
        setResolving(false);
      }
    };

    const handleP2pQrSend = async () => {
      if (!resolvedToken || !p2pSelectedAccount) return;

      const amount = parseFloat(p2pSendAmount);
      if (!amount || amount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }

      // Biometric authentication before sending
      const amountFormatted = `$${amount.toFixed(2)}`;
      const recipientName = resolvedToken.merchantName || resolvedToken.recipientDisplayName || resolvedToken.recipientAlias || 'recipient';
      const authResult = await biometricService.authenticateForTransfer(
        amountFormatted,
        recipientName
      );

      if (!authResult.success) {
        if (authResult.error !== 'Authentication cancelled') {
          Alert.alert('Authentication Failed', authResult.error || 'Please try again');
        }
        return;
      }

      setP2pSending(true);
      try {
        console.log('[P2P QR] Sending transfer:', {
          recipientAlias: resolvedToken.recipientAlias,
          recipientAliasType: resolvedToken.recipientAliasType,
          amount,
          accountId: p2pSelectedAccount.accountId,
          bsimId: p2pSelectedAccount.bsimId,
          note: p2pSendNote.trim() || undefined,
        });
        await transferSimApi.sendMoney(
          resolvedToken.recipientAlias,
          amount,
          p2pSelectedAccount.accountId,
          p2pSelectedAccount.bsimId,
          p2pSendNote.trim() || undefined,
          resolvedToken.recipientAliasType
        );

        Alert.alert(
          'Money Sent!',
          `$${amount.toFixed(2)} sent to ${recipientName}`,
          [{
            text: 'Done',
            onPress: () => {
              setActiveHomeTab('p2p');
              setCurrentScreen('home');
            }
          }]
        );
      } catch (e: any) {
        console.error('[P2P QR] Send failed:', e);
        Alert.alert('Transfer Failed', e.response?.data?.message || 'Failed to send money');
      } finally {
        setP2pSending(false);
      }
    };

    const handleCancelP2pQr = () => {
      p2pQrScanLockRef.current = false;
      setP2pQrScanned(false);
      setResolvedToken(null);
      setP2pSendAmount('');
      setP2pSendNote('');
      setActiveHomeTab('p2p');
      setCurrentScreen('home');
    };

    // Show confirm screen after resolving
    if (resolvedToken) {
      return (
        <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.p2pQrConfirmContent}>
            {/* Header */}
            <View style={styles.p2pQrConfirmHeader}>
              <TouchableOpacity onPress={handleCancelP2pQr}>
                <Text style={styles.backButton}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.p2pQrConfirmTitle}>Send to QR</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.p2pQrConfirmScroll} showsVerticalScrollIndicator={false}>
              {/* Recipient Card - Visual differentiation based on recipientType */}
              <View style={[
                styles.p2pQrRecipientCard,
                resolvedToken.recipientType === 'merchant' && styles.p2pQrRecipientCardMerchant
              ]}>
                {resolvedToken.recipientType === 'merchant' ? (
                  resolvedToken.merchantLogoUrl || resolvedToken.logoImageUrl ? (
                    <View style={{ marginBottom: 12 }}>
                      <Image
                        source={{ uri: resolvedToken.merchantLogoUrl || resolvedToken.logoImageUrl }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 16,
                          backgroundColor: '#f3f4f6',
                        }}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <View style={[
                      styles.p2pQrRecipientIcon,
                      styles.p2pQrRecipientIconMerchant
                    ]}>
                      <Text style={{ fontSize: 32 }}>
                        {resolvedToken.merchantCategory && MERCHANT_CATEGORIES[resolvedToken.merchantCategory]
                          ? MERCHANT_CATEGORIES[resolvedToken.merchantCategory].icon
                          : '🏪'}
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={{ marginBottom: 16, transform: [{ scale: 1.2 }] }}>
                    <ProfileAvatar
                      imageUrl={resolvedToken.profileImageUrl}
                      displayName={resolvedToken.recipientDisplayName || resolvedToken.recipientAlias || 'Unknown'}
                      size="medium"
                      isVerified={resolvedToken.isVerified}
                      verificationLevel={resolvedToken.verificationLevel}
                    />
                  </View>
                )}
                {/* Show merchant badge if applicable */}
                {resolvedToken.recipientType === 'merchant' && (
                  <View style={styles.p2pMerchantBadge}>
                    <Text style={styles.p2pMerchantBadgeText}>Micro Merchant</Text>
                  </View>
                )}
                <Text style={styles.p2pQrRecipientName}>
                  {resolvedToken.merchantName || resolvedToken.recipientDisplayName || resolvedToken.recipientAlias || 'Unknown'}
                </Text>
                <Text style={styles.p2pQrRecipientAlias}>{resolvedToken.recipientAlias}</Text>
                <Text style={styles.p2pQrRecipientBank}>{resolvedToken.recipientBankName || 'Unknown Bank'}</Text>
                {/* Fee notice for merchant payments */}
                {resolvedToken.recipientType === 'merchant' && (
                  <Text style={styles.p2pMerchantFeeNote}>
                    Merchant pays a small fee • You pay the full amount
                  </Text>
                )}
              </View>

              {/* Amount Input */}
              <View style={styles.sendSection}>
                <Text style={styles.sendSectionLabel}>Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountCurrency}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    value={p2pSendAmount}
                    onChangeText={setP2pSendAmount}
                    keyboardType="decimal-pad"
                    editable={!resolvedToken.amount} // Disable if amount is fixed
                  />
                  <Text style={styles.amountCurrencyCode}>CAD</Text>
                </View>
                {resolvedToken.amount && (
                  <Text style={styles.p2pQrFixedAmountNote}>
                    Amount set by recipient
                  </Text>
                )}
              </View>

              {/* Source Account */}
              <View style={styles.sendSection}>
                <Text style={styles.sendSectionLabel}>From account</Text>
                {bankAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.accountId}
                    style={[
                      styles.accountOption,
                      p2pSelectedAccount?.accountId === account.accountId && styles.accountOptionSelected
                    ]}
                    onPress={() => setP2pSelectedAccount(account)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accountOptionInfo}>
                      <Text style={styles.accountOptionName}>{account.displayName}</Text>
                      <Text style={styles.accountOptionBank}>{account.bankName}</Text>
                    </View>
                    <View style={styles.accountOptionBalance}>
                      <Text style={styles.accountOptionBalanceAmount}>
                        ${account.balance?.toFixed(2) || '—'}
                      </Text>
                      {p2pSelectedAccount?.accountId === account.accountId && (
                        <Text style={styles.accountOptionCheck}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note Input */}
              <View style={styles.sendSection}>
                <Text style={styles.sendSectionLabel}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="What's this for?"
                  value={p2pSendNote}
                  onChangeText={setP2pSendNote}
                  multiline
                  maxLength={140}
                  editable={!resolvedToken.description}
                />
                {resolvedToken.description && (
                  <Text style={styles.p2pQrFixedAmountNote}>
                    Note set by recipient
                  </Text>
                )}
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.sendActions}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!p2pSendAmount || !p2pSelectedAccount || p2pSending) && styles.buttonDisabled
                ]}
                onPress={handleP2pQrSend}
                disabled={!p2pSendAmount || !p2pSelectedAccount || p2pSending}
                activeOpacity={0.7}
              >
                {p2pSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Money</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Camera View
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.qrScannerContainer}>
          {/* Header */}
          <View style={styles.qrScannerHeader}>
            <TouchableOpacity onPress={handleCancelP2pQr} style={styles.qrScannerBackButton}>
              <Text style={styles.qrScannerBackText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.qrScannerTitle}>Scan to Send</Text>
            <View style={{ width: 70 }} />
          </View>

          {/* Camera View */}
          <View style={styles.qrScannerCameraContainer}>
            {cameraPermission?.granted === false ? (
              <View style={styles.qrScannerPermissionDenied}>
                <Text style={styles.qrScannerPermissionIcon}>📷</Text>
                <Text style={styles.qrScannerPermissionTitle}>Camera Access Required</Text>
                <Text style={styles.qrScannerPermissionText}>
                  Please enable camera access in Settings to scan P2P QR codes.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryButtonText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            ) : resolving ? (
              <View style={styles.qrScannerPermissionDenied}>
                <ActivityIndicator size="large" color="#1d4ed8" />
                <Text style={[styles.qrScannerPermissionTitle, { marginTop: 16 }]}>
                  Looking up recipient...
                </Text>
              </View>
            ) : (
              <>
                <CameraView
                  onBarcodeScanned={p2pQrScanned ? undefined : handleP2pQrScanned}
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  enableTorch={p2pTorchOn}
                />

                {/* Scanning Frame Overlay */}
                <View style={styles.qrScannerOverlay}>
                  <View style={styles.qrScannerOverlayTop} />
                  <View style={styles.qrScannerOverlayMiddle}>
                    <View style={styles.qrScannerOverlaySide} />
                    <View style={styles.qrScannerFrame}>
                      <View style={[styles.qrCorner, styles.qrCornerTopLeft]} />
                      <View style={[styles.qrCorner, styles.qrCornerTopRight]} />
                      <View style={[styles.qrCorner, styles.qrCornerBottomLeft]} />
                      <View style={[styles.qrCorner, styles.qrCornerBottomRight]} />
                    </View>
                    <View style={styles.qrScannerOverlaySide} />
                  </View>
                  <View style={styles.qrScannerOverlayBottom} />
                </View>

                {/* Instructions */}
                <View style={styles.qrScannerInstructions}>
                  <Text style={styles.qrScannerInstructionsText}>
                    Scan a recipient's P2P receive code
                  </Text>
                </View>

                {/* Torch Toggle */}
                <TouchableOpacity
                  style={styles.qrTorchButton}
                  onPress={() => setP2pTorchOn(!p2pTorchOn)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.qrTorchIcon}>{p2pTorchOn ? '🔦' : '💡'}</Text>
                  <Text style={styles.qrTorchText}>{p2pTorchOn ? 'Light On' : 'Light Off'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Merchant Enrollment Screen
  if (currentScreen === 'merchantEnrollment') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.merchantEnrollContent}>
          {/* Header */}
          <View style={styles.merchantEnrollHeader}>
            <TouchableOpacity
              onPress={() => {
                setCurrentScreen('home');
                setActiveHomeTab('p2p');
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.merchantEnrollTitle}>Become a Merchant</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.merchantEnrollScroll} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={styles.merchantEnrollHero}>
              <Text style={{ fontSize: 48 }}>🏪</Text>
              <Text style={styles.merchantEnrollHeroTitle}>Accept Business Payments</Text>
              <Text style={styles.merchantEnrollHeroSubtitle}>
                Set up a Micro Merchant profile to receive payments with a professional identity
              </Text>
            </View>

            {/* Fee Info */}
            <View style={styles.merchantEnrollFeeCard}>
              <Text style={styles.merchantEnrollFeeTitle}>Simple, Transparent Fees</Text>
              <View style={styles.merchantEnrollFeeRow}>
                <Text style={styles.merchantEnrollFeeLabel}>Under $200</Text>
                <Text style={styles.merchantEnrollFeeValue}>$0.25/transaction</Text>
              </View>
              <View style={styles.merchantEnrollFeeRow}>
                <Text style={styles.merchantEnrollFeeLabel}>$200 or more</Text>
                <Text style={styles.merchantEnrollFeeValue}>$0.50/transaction</Text>
              </View>
              <Text style={styles.merchantEnrollFeeNote}>
                Fees are deducted automatically. No monthly fees or minimums.
              </Text>
            </View>

            {/* Business Name */}
            <View style={styles.merchantEnrollSection}>
              <Text style={styles.merchantEnrollLabel}>Business Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Java Joe's Coffee"
                value={merchantBusinessName}
                onChangeText={setMerchantBusinessName}
                maxLength={50}
              />
            </View>

            {/* Category */}
            <View style={styles.merchantEnrollSection}>
              <Text style={styles.merchantEnrollLabel}>Business Category</Text>
              <View style={styles.merchantCategoryGrid}>
                {(Object.entries(MERCHANT_CATEGORIES) as [MerchantCategory, { label: string; icon: string }][]).map(
                  ([key, { label, icon }]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.merchantCategoryOption,
                        merchantCategory === key && styles.merchantCategoryOptionActive,
                      ]}
                      onPress={() => setMerchantCategory(key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.merchantCategoryIcon}>{icon}</Text>
                      <Text
                        style={[
                          styles.merchantCategoryLabel,
                          merchantCategory === key && styles.merchantCategoryLabelActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* Receiving Account */}
            <View style={styles.merchantEnrollSection}>
              <Text style={styles.merchantEnrollLabel}>Receiving Account</Text>
              <Text style={styles.merchantEnrollHint}>
                Payments will be deposited to this account
              </Text>
              {bankAccounts.map((account) => (
                <TouchableOpacity
                  key={account.accountId}
                  style={[
                    styles.accountOption,
                    merchantReceivingAccount?.accountId === account.accountId &&
                      styles.accountOptionSelected,
                  ]}
                  onPress={() => setMerchantReceivingAccount(account)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountOptionInfo}>
                    <Text style={styles.accountOptionName}>{account.displayName}</Text>
                    <Text style={styles.accountOptionBank}>{account.bankName}</Text>
                  </View>
                  {merchantReceivingAccount?.accountId === account.accountId && (
                    <Text style={styles.accountOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Error */}
            {merchantEnrollError && (
              <Text style={styles.errorText}>{merchantEnrollError}</Text>
            )}
          </ScrollView>

          {/* Enroll Button */}
          <View style={styles.merchantEnrollActions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.merchantEnrollButton,
                (!merchantBusinessName.trim() || !merchantReceivingAccount) && styles.buttonDisabled,
              ]}
              onPress={handleMerchantEnrollment}
              disabled={!merchantBusinessName.trim() || !merchantReceivingAccount || merchantEnrollLoading}
              activeOpacity={0.7}
            >
              {merchantEnrollLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Start Accepting Payments</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.merchantEnrollDisclaimer}>
              By enrolling, you agree to the Micro Merchant terms and fee structure
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Contracts List Screen
  if (currentScreen === 'contractsList') {
    return (
      <ContractsListScreen
        onBack={() => setCurrentScreen('home')}
        onContractSelect={(contractId) => {
          setSelectedContractId(contractId);
          setCurrentScreen('contractDetail');
        }}
        onCreateContract={() => setCurrentScreen('createContract')}
      />
    );
  }

  // Contract Detail Screen
  if (currentScreen === 'contractDetail' && selectedContractId) {
    return (
      <ContractDetailScreen
        contractId={selectedContractId}
        onBack={() => {
          setSelectedContractId(null);
          setCurrentScreen('contractsList');
        }}
        onRefreshNeeded={() => {
          // Refresh will happen when returning to list
        }}
        refreshTrigger={contractRefreshTrigger}
      />
    );
  }

  // Create Contract Screen
  if (currentScreen === 'createContract') {
    return (
      <CreateContractScreen
        onBack={() => setCurrentScreen('contractsList')}
        onContractCreated={(contractId) => {
          setSelectedContractId(contractId);
          setCurrentScreen('contractDetail');
        }}
      />
    );
  }

  // ID Verification Screen
  if (currentScreen === 'idVerification') {
    return (
      <IDVerificationScreen
        profileDisplayName={user?.name || ''}
        profileImageUrl={user?.profileImageUrl}
        onComplete={async (result: VerificationFlowResult) => {
          console.log('[App] ID verification complete:', result.passportData);
          console.log('[App] Name match:', result.nameMatch);
          console.log('[App] Face match:', result.faceMatch);
          console.log('[App] Liveness:', result.liveness);

          try {
            // Submit verification to WSIM
            console.log('[App] Submitting verification to server...');
            const response = await api.submitVerification(result.signedVerification);
            console.log('[App] Verification submitted:', response);

            // Update user state with verification status
            if (user) {
              setUser({
                ...user,
                isVerified: response.isVerified,
                verifiedAt: response.verifiedAt,
                verificationLevel: response.verificationLevel,
              });
            }

            // Show success message with verification level
            const levelDisplay = response.verificationLevel === 'enhanced' ? 'Enhanced' : 'Basic';
            Alert.alert(
              'Verification Complete',
              `Your identity has been verified (${levelDisplay} level).\n\nYou now have a gold verification badge on your profile.`,
              [{ text: 'OK', onPress: () => setCurrentScreen('settings') }]
            );
          } catch (error: any) {
            console.error('[App] Failed to submit verification:', error);
            // Still show success for the local verification, but note the server issue
            const errorMessage = error.response?.data?.message || error.message || 'Server error';
            Alert.alert(
              'Verification Complete',
              `Identity verified locally, but server submission failed: ${errorMessage}\n\nPlease try again later.`,
              [{ text: 'OK', onPress: () => setCurrentScreen('settings') }]
            );
          }
        }}
        onCancel={() => setCurrentScreen('settings')}
      />
    );
  }

  // Settings Screen
  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        user={user}
        onBack={() => setCurrentScreen('home')}
        onSignOut={handleLogout}
        onDeepSignOut={handleDeepLogout}
        onProfileEdit={async () => {
          // Fetch latest profile data before entering edit screen
          try {
            const result = await api.getProfile();
            console.log('Fetched profile:', result);
            if (user && result.profile) {
              setUser({
                ...user,
                profileImageUrl: result.profile.profileImageUrl,
              });
            }
          } catch (error) {
            console.log('Could not fetch profile, continuing with cached data:', error);
          }
          setCurrentScreen('profileEdit');
        }}
        onVerifyIdentity={() => setCurrentScreen('idVerification')}
        onVerificationRemoved={() => {
          // Update user state to clear verification fields
          if (user) {
            setUser({
              ...user,
              isVerified: false,
              verifiedAt: undefined,
              verificationLevel: 'none',
            });
          }
        }}
        environmentName={getEnvironmentName()}
        isDevelopment={isDevelopment()}
        appVersion="1.5.12"
        buildNumber="80"
      />
    );
  }

  // Profile Edit Screen
  if (currentScreen === 'profileEdit') {
    const handleSaveProfile = async (displayName: string, imageUri?: string | null) => {
      console.log('Saving profile:', { displayName, imageUri });

      try {
        let newProfileImageUrl: string | null | undefined = user?.profileImageUrl;

        // Handle image changes
        if (imageUri === '__REMOVE__') {
          // Delete profile image
          await api.deleteProfileImage();
          newProfileImageUrl = null;
        } else if (imageUri) {
          // Upload new image and capture the returned URL
          const uploadResult = await api.uploadProfileImage(imageUri);
          console.log('Upload result:', uploadResult);
          newProfileImageUrl = uploadResult.profileImageUrl;
        }

        // Update display name if changed
        if (displayName !== user?.name) {
          await api.updateProfile({ displayName });
        }

        // Update user state with new profile data
        // Wallet summary may not include profileImageUrl, so we merge it manually
        const summary = await api.getWalletSummary();
        if (summary.user) {
          setUser({
            ...summary.user,
            name: displayName, // Use the updated name
            profileImageUrl: newProfileImageUrl,
          });
        }
      } catch (error: any) {
        console.error('Profile save error:', error);
        // Re-throw to let ProfileEditScreen handle the error
        throw error;
      }
    };

    const handlePickImage = async (): Promise<string | null> => {
      // Show action sheet to choose between camera and gallery
      return new Promise((resolve) => {
        Alert.alert(
          'Change Profile Photo',
          'Choose how you want to add a photo',
          [
            {
              text: 'Take Photo',
              onPress: async () => {
                try {
                  // Request camera permission
                  const { status } = await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
                    resolve(null);
                    return;
                  }

                  const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    resolve(result.assets[0].uri);
                  } else {
                    resolve(null);
                  }
                } catch (error) {
                  console.error('Camera error:', error);
                  Alert.alert('Error', 'Failed to access camera.');
                  resolve(null);
                }
              },
            },
            {
              text: 'Choose from Library',
              onPress: async () => {
                try {
                  // Request media library permission
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Photo library access is needed to select a photo.');
                    resolve(null);
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    resolve(result.assets[0].uri);
                  } else {
                    resolve(null);
                  }
                } catch (error) {
                  console.error('Image picker error:', error);
                  Alert.alert('Error', 'Failed to access photo library.');
                  resolve(null);
                }
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(null),
            },
          ]
        );
      });
    };

    return (
      <ProfileEditScreen
        user={user}
        onBack={() => setCurrentScreen('settings')}
        onSave={handleSaveProfile}
        onPickImage={handlePickImage}
      />
    );
  }

  // Merchant Profile Edit Screen
  if (currentScreen === 'merchantProfileEdit' && merchantProfile) {
    const handleSaveMerchantProfile = async (
      updates: { merchantName: string; description?: string },
      logoUri?: string | null
    ) => {
      console.log('Saving merchant profile:', { updates, logoUri });

      try {
        let newLogoUrl: string | undefined = merchantProfile.logoImageUrl;

        // Handle logo changes
        if (logoUri === '__REMOVE__') {
          // Delete logo
          await transferSimApi.deleteMerchantLogo();
          newLogoUrl = undefined;
        } else if (logoUri) {
          // Upload new logo
          const uploadResult = await transferSimApi.uploadMerchantLogo(logoUri);
          console.log('Logo upload result:', uploadResult);
          newLogoUrl = uploadResult.logoImageUrl;
        }

        // Update merchant profile
        const updatedProfile = await transferSimApi.updateMerchantProfile({
          merchantName: updates.merchantName,
          description: updates.description,
        });

        console.log('Merchant profile API response:', JSON.stringify(updatedProfile, null, 2));

        // Update local state - preserve description if API doesn't return it
        setMerchantProfile({
          ...updatedProfile,
          description: updatedProfile.description ?? updates.description,
          logoImageUrl: newLogoUrl,
        });
      } catch (error: any) {
        console.error('Merchant profile save error:', error);
        throw error;
      }
    };

    const handlePickMerchantLogo = async (): Promise<string | null> => {
      return new Promise((resolve) => {
        Alert.alert(
          'Change Business Logo',
          'Choose how you want to add a logo',
          [
            {
              text: 'Take Photo',
              onPress: async () => {
                try {
                  const { status } = await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
                    resolve(null);
                    return;
                  }

                  const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: 'images',
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    resolve(result.assets[0].uri);
                  } else {
                    resolve(null);
                  }
                } catch (error) {
                  console.error('Camera error:', error);
                  Alert.alert('Error', 'Failed to take photo.');
                  resolve(null);
                }
              },
            },
            {
              text: 'Choose from Library',
              onPress: async () => {
                try {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Photo library access is needed.');
                    resolve(null);
                    return;
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: 'images',
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });

                  if (!result.canceled && result.assets[0]) {
                    resolve(result.assets[0].uri);
                  } else {
                    resolve(null);
                  }
                } catch (error) {
                  console.error('Image picker error:', error);
                  Alert.alert('Error', 'Failed to access photo library.');
                  resolve(null);
                }
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(null),
            },
          ]
        );
      });
    };

    return (
      <MerchantProfileEditScreen
        merchant={merchantProfile}
        onBack={() => setCurrentScreen('home')}
        onSave={handleSaveMerchantProfile}
        onPickImage={handlePickMerchantLogo}
      />
    );
  }

  // Card Details Screen
  if (currentScreen === 'cardDetails' && selectedCard) {
    const cardColor = selectedCard.cardType === 'VISA' ? '#1a1f71' : '#eb001b';

    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.cardDetailsContent}>
          {/* Header */}
          <View style={styles.cardDetailsHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedCard(null);
                setCurrentScreen('home');
              }}
            >
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.cardDetailsTitle}>Card Details</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Card Preview */}
          <View style={[styles.cardDetailsPreview, { backgroundColor: cardColor }]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardBank}>{selectedCard.bankName}</Text>
              {selectedCard.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Default</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardNumber}>•••• •••• •••• {selectedCard.lastFour}</Text>
            <Text style={styles.cardType}>{selectedCard.cardType}</Text>
          </View>

          {/* Card Info */}
          <View style={styles.cardInfoSection}>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardInfoLabel}>Card Type</Text>
              <Text style={styles.cardInfoValue}>{selectedCard.cardType}</Text>
            </View>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardInfoLabel}>Card Number</Text>
              <Text style={styles.cardInfoValue}>•••• {selectedCard.lastFour}</Text>
            </View>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardInfoLabel}>Bank</Text>
              <Text style={styles.cardInfoValue}>{selectedCard.bankName}</Text>
            </View>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardInfoLabel}>Added</Text>
              <Text style={styles.cardInfoValue}>
                {new Date(selectedCard.addedAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardInfoLabel}>Status</Text>
              <Text style={styles.cardInfoValue}>
                {selectedCard.isDefault ? 'Default Card' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.cardActionsSection}>
            {!selectedCard.isDefault && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleSetDefaultCard(selectedCard)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Set as Default</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => handleRemoveCard(selectedCard)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.dangerButtonText}>Remove Card</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Payment Approval Screen
  if (currentScreen === 'paymentApproval') {
    // Format currency
    const formatAmount = (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    };

    // Calculate time remaining
    const getTimeRemaining = () => {
      if (!paymentRequest) return '';
      const expiresAt = new Date(paymentRequest.expiresAt);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      if (diff <= 0) return 'Expired';
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Loading state
    if (paymentStatus === 'loading') {
      return (
        <View style={[styles.container, styles.centered]}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      );
    }

    // Error state
    if (paymentStatus === 'error') {
      return (
        <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.paymentContent}>
            <View style={styles.paymentErrorContainer}>
              <Text style={styles.paymentErrorIcon}>!</Text>
              <Text style={styles.paymentErrorTitle}>Payment Error</Text>
              <Text style={styles.paymentErrorMessage}>{paymentError}</Text>
            </View>

            <View style={styles.paymentActions}>
              {paymentRequest?.returnUrl && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={async () => {
                    // Append mwsim_return param so SSIM checkout knows the payment context
                    const separator = paymentRequest.returnUrl.includes('?') ? '&' : '?';
                    const returnUrlWithContext = `${paymentRequest.returnUrl}${separator}mwsim_return=${paymentRequest.requestId}`;
                    // Use browser-aware return to open in the same browser user came from
                    await openReturnUrl(returnUrlWithContext, sourceBrowser);
                    handleClosePayment();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.primaryButtonText}>Return to Store</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={handleClosePayment}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineButtonText}>Go to Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Success animation state
    if (showSuccessAnimation) {
      return (
        <SuccessAnimation
          onComplete={handleSuccessAnimationComplete}
          animationDuration={800}
          delayAfterAnimation={2000}
          message="Payment Approved"
        />
      );
    }

    // Ready / Approving state
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.paymentContent}>
          {/* Header */}
          <View style={styles.paymentHeader}>
            <TouchableOpacity onPress={handleCancelPayment}>
              <Text style={styles.paymentCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.paymentHeaderTitle}>Approve Payment</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.paymentScrollContent}>
            {/* Total Amount Card - Standalone at Top */}
            <View style={styles.totalCard}>
              <View style={styles.totalCardContent}>
                <Text style={styles.totalLabel}>Total to Pay</Text>
                <Text style={styles.totalValue}>
                  {paymentRequest ? formatAmount(paymentRequest.amount, paymentRequest.currency) : ''}
                </Text>
                <Text style={styles.timerText}>
                  ⏱ {getTimeRemaining()} remaining
                </Text>
              </View>
            </View>

            {/* Outer Container Card - Contains merchant, order details, and payment method */}
            <View style={styles.outerCard}>
              {/* Merchant Header with Avatar */}
              <View style={styles.orderCardMerchantHeader}>
                <View style={styles.merchantAvatarRow}>
                  <ProfileAvatar
                    imageUrl={paymentRequest?.merchantLogoUrl}
                    displayName={paymentRequest?.merchantName || 'Merchant'}
                    size="medium"
                  />
                  <Text style={styles.orderCardMerchantName}>{paymentRequest?.merchantName}</Text>
                </View>
                {/* Only show orderDescription if no orderDetails (fallback) */}
                {paymentRequest?.orderDescription && !paymentRequest?.orderDetails && (
                  <Text style={styles.orderCardDescription}>{paymentRequest.orderDescription}</Text>
                )}
              </View>

              {/* Inner Content Area with Nested Cards */}
              <View style={styles.outerCardContent}>
                {/* Order Details (Enhanced Purchase Info) - with full card styling */}
                {paymentRequest?.orderDetails && (
                  <OrderSummary
                    orderDetails={paymentRequest.orderDetails}
                    currency={paymentRequest.currency}
                  />
                )}

                {/* Payment Method - Nested Card */}
                <View style={styles.nestedCard}>
                  <View style={styles.paymentMethodHeader}>
                    <Text style={styles.paymentMethodIcon}>💳</Text>
                    <Text style={styles.paymentMethodTitle}>Payment Method</Text>
                  </View>
                  <View style={styles.paymentMethodList}>
                    {paymentRequest?.cards.map((card, index) => {
                      const isSelected = selectedPaymentCard?.id === card.id;
                      const cardColor = card.cardType === 'VISA' ? '#1a1f71' : '#eb001b';
                      const isLast = index === (paymentRequest?.cards.length || 0) - 1;

                      return (
                        <TouchableOpacity
                          key={card.id}
                          style={[
                            styles.paymentCardOption,
                            isSelected && styles.paymentCardOptionSelected,
                            !isLast && styles.paymentCardOptionBorder,
                          ]}
                          onPress={() => setSelectedPaymentCard(card)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.paymentCardBadge, { backgroundColor: cardColor }]}>
                            <Text style={styles.paymentCardBadgeText}>{card.cardType}</Text>
                          </View>
                          <View style={styles.paymentCardInfo}>
                            <Text style={styles.paymentCardNumber}>•••• {card.lastFour}</Text>
                            <Text style={styles.paymentCardBank}>{card.bankName}</Text>
                          </View>
                          <View style={styles.paymentCardCheck}>
                            {isSelected ? (
                              <View style={styles.paymentCardCheckCircle}>
                                <Text style={styles.paymentCardCheckMark}>✓</Text>
                              </View>
                            ) : (
                              <View style={styles.paymentCardCheckEmpty} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Approve Button */}
          <View style={styles.paymentActions}>
            <TouchableOpacity
              style={[
                styles.approveButton,
                (paymentStatus === 'approving' || !selectedPaymentCard) && styles.approveButtonDisabled,
              ]}
              onPress={handleApprovePayment}
              disabled={paymentStatus === 'approving' || !selectedPaymentCard}
              activeOpacity={0.7}
            >
              {paymentStatus === 'approving' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.approveButtonText}>
                  Approve Payment
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.paymentSecurityNote}>
              You'll be asked to authenticate with {biometricType}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Welcome Screen (default)
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>💳</Text>
          </View>

          <Text style={styles.title}>mwsim Wallet</Text>

          <Text style={styles.subtitle}>
            Your digital wallet for secure payments. Add your cards and pay anywhere.
          </Text>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setError(null);
              setCurrentScreen('createAccount');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => {
              setError(null);
              setCurrentScreen('login');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.outlineButtonText}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetDevice}
            activeOpacity={0.7}
          >
            <Text style={styles.resetButtonText}>Reset Device (Dev)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  envBadge: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#22c55e', // Green for production
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 100,
  },
  envBadgeDev: {
    backgroundColor: '#f59e0b', // Orange for development
  },
  envBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Inline environment badge (under user name)
  envBadgeInline: {
    alignSelf: 'flex-start',
    backgroundColor: '#22c55e', // Green for production
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginTop: 4,
  },
  envBadgeInlineDev: {
    backgroundColor: '#f59e0b', // Orange for development
  },
  envBadgeInlineText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  biometricIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  bottomSection: {
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  outlineButtonText: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ghostButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontSize: 16,
    color: '#3b82f6',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  termsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  // Form styles
  formSection: {
    flex: 1,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  // Bank list styles
  bankList: {
    flex: 1,
    marginTop: 16,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bankEmoji: {
    fontSize: 24,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  bankDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  bankArrow: {
    fontSize: 20,
    color: '#9ca3af',
  },
  // Home styles
  homeContent: {
    flex: 1,
    paddingTop: 60,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  homeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeHeaderText: {
    flexDirection: 'column',
  },
  homeGreeting: {
    fontSize: 14,
    color: '#6b7280',
  },
  homeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardList: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardBank: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.9,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  defaultBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  cardNumber: {
    color: '#ffffff',
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  cardType: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  signOutText: {
    fontSize: 14,
    color: '#ef4444',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  resetButton: {
    marginTop: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  // Card Details styles
  cardDetailsContent: {
    flex: 1,
    paddingTop: 60,
  },
  cardDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardDetailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cardDetailsPreview: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginTop: 24,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  cardInfoSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  cardActionsSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 12,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Payment Approval styles
  paymentContent: {
    flex: 1,
    paddingTop: 60,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  paymentHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  paymentCancelText: {
    fontSize: 16,
    color: '#ef4444',
  },
  paymentScrollContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  merchantSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  merchantLogo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  merchantLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  merchantLogoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  merchantName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  orderDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  orderDetailsSection: {
    paddingTop: 20,
  },
  // Total Amount Card
  totalCard: {
    backgroundColor: '#1e40af',
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  totalCardContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  // Outer Container Card - Wraps merchant, order details, and payment method
  outerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  outerCardContent: {
    padding: 12,
    gap: 12,
  },
  orderCardMerchantHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  merchantAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  orderCardMerchantName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  orderCardDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  // Nested Card - for cards inside the outer container
  nestedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  paymentMethodIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  paymentMethodTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  paymentMethodList: {
    paddingHorizontal: 16,
  },
  paymentCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  paymentCardOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  paymentCardOptionSelected: {
    backgroundColor: '#eff6ff',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  paymentCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  paymentCardBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  paymentCardInfo: {
    flex: 1,
  },
  paymentCardNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  paymentCardBank: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  paymentCardCheck: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCardCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCardCheckEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  paymentCardCheckMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentActions: {
    padding: 24,
    paddingBottom: 40,
  },
  approveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentSecurityNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  paymentErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  paymentErrorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    color: '#ef4444',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 16,
    overflow: 'hidden',
  },
  paymentErrorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  paymentErrorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  // QR Scanner styles
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  qrScanButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  qrScanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrScannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  qrScannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  qrScannerBackButton: {
    padding: 8,
  },
  qrScannerBackText: {
    color: '#ffffff',
    fontSize: 16,
  },
  qrScannerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  qrScannerCameraContainer: {
    flex: 1,
    position: 'relative',
  },
  qrScannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrScannerOverlayTop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  qrScannerOverlayMiddle: {
    flexDirection: 'row',
    height: 280,
  },
  qrScannerOverlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  qrScannerOverlayBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  qrScannerFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
  },
  qrCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  qrCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  qrCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  qrScannerInstructions: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  qrScannerInstructionsText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  qrTorchButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  qrTorchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  qrTorchText: {
    color: '#ffffff',
    fontSize: 14,
  },
  qrScannerPermissionDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 32,
  },
  qrScannerPermissionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  qrScannerPermissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  qrScannerPermissionText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  // Tab Content and Bottom Tab Bar
  tabContent: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingBottom: 20, // Safe area for home indicator
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  bottomTabActive: {
    backgroundColor: '#f8fafc',
  },
  bottomTabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  bottomTabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  bottomTabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  // P2P Styles
  p2pLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  p2pEnrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  p2pEnrollIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  p2pEnrollTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  p2pEnrollSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  p2pContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  p2pQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  p2pQuickAction: {
    alignItems: 'center',
  },
  p2pQuickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  p2pQuickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  p2pSection: {
    marginBottom: 24,
  },
  p2pSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  p2pSeeAllText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  p2pAddAliasCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  p2pAddAliasText: {
    fontSize: 14,
    color: '#6b7280',
  },
  p2pAliasCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  p2pAliasInfo: {
    flex: 1,
  },
  p2pAliasValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  p2pAliasType: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  p2pPrimaryBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  p2pPrimaryBadgeText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  p2pEmptyTransfers: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  p2pEmptyTransfersText: {
    fontSize: 14,
    color: '#6b7280',
  },
  p2pTransferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  p2pTransferInfo: {
    flex: 1,
  },
  p2pTransferName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  p2pTransferDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  p2pTransferMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  p2pTransferTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  p2pTransferTypeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  p2pTransferAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  p2pTransferAmountReceived: {
    color: '#22c55e',
  },
  // Alias Management Styles
  aliasManagementContent: {
    flex: 1,
    paddingTop: 60,
  },
  aliasManagementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  aliasManagementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  aliasManagementScroll: {
    flex: 1,
    padding: 24,
  },
  aliasAddSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  aliasAddTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  aliasAddSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  aliasTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  aliasTypeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  aliasTypeOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  aliasTypeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  aliasTypeOptionTextActive: {
    color: '#ffffff',
  },
  aliasInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  aliasInputPrefix: {
    fontSize: 18,
    color: '#6b7280',
    paddingLeft: 16,
    fontWeight: '500',
  },
  aliasInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  aliasInputWithPrefix: {
    paddingLeft: 8,
  },
  aliasErrorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 8,
  },
  aliasListSection: {
    marginBottom: 24,
  },
  aliasEmptyState: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  aliasEmptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  aliasListItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  aliasListInfo: {
    marginBottom: 12,
  },
  aliasListValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  aliasListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aliasListType: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  aliasPrimaryBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aliasPrimaryBadgeText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  aliasListActions: {
    flexDirection: 'row',
    gap: 12,
  },
  aliasActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  aliasActionButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  aliasDeleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  aliasDeleteButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  // Receive Money Styles
  receiveContent: {
    flex: 1,
    paddingTop: 60,
  },
  receiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  receiveTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  receiveScroll: {
    flex: 1,
  },
  receiveScrollContent: {
    padding: 24,
  },
  receiveQRSection: {
    alignItems: 'center',
  },
  receiveQRPlaceholder: {
    width: 248,
    height: 280,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  receiveQRBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveQRIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  receiveQRText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  receiveQRSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  receiveOrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  receiveOrLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  receiveOrText: {
    fontSize: 14,
    color: '#6b7280',
    marginHorizontal: 16,
    fontWeight: '500',
  },
  receiveAliasSection: {
    alignItems: 'center',
  },
  receiveAliasTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  receiveAliasCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  receiveAliasValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  receiveAliasType: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  receiveNoAliasText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  nearbyToggleButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    width: '100%',
  },
  nearbyToggleButtonActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  nearbyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyToggleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  nearbyToggleText: {
    flex: 1,
  },
  nearbyToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nearbyToggleTitleActive: {
    color: '#15803d',
  },
  nearbyToggleSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  nearbyBroadcastIndicator: {
    marginLeft: 8,
  },
  nearbyBroadcastDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  // Send Money styles
  sendContent: {
    flex: 1,
    paddingTop: 60,
  },
  sendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sendTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  sendTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sendTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  sendTabActive: {
    backgroundColor: '#1d4ed8',
  },
  sendTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  sendTabTextActive: {
    color: '#ffffff',
  },
  sendScrollContent: {
    flex: 1,
    padding: 24,
  },
  sendSection: {
    marginBottom: 24,
  },
  sendSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sendRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lookupButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  lookupButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  recipientInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  recipientInfoCardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  recipientInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientInfoDetails: {
    flex: 1,
  },
  recipientInfoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  recipientInfoBank: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  recipientInfoCheck: {
    fontSize: 18,
    color: '#22c55e',
    fontWeight: '600',
  },
  recipientInfoError: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  amountCurrency: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  amountCurrencyCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  accountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountOptionSelected: {
    borderColor: '#1d4ed8',
    backgroundColor: '#eff6ff',
  },
  accountOptionInfo: {
    flex: 1,
  },
  accountOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accountOptionBank: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  accountOptionBalance: {
    alignItems: 'flex-end',
  },
  accountOptionBalanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accountOptionCheck: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: '600',
    marginTop: 4,
  },
  sendActions: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Send Confirm styles
  sendConfirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sendConfirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  sendConfirmLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  sendConfirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  sendConfirmValueLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  sendConfirmValueSub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 2,
  },
  sendConfirmDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sendConfirmDisclaimer: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  // Send Success styles
  sendSuccessContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sendSuccessIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  sendSuccessTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sendSuccessAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 8,
  },
  sendSuccessRecipient: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  sendSuccessNote: {
    fontSize: 16,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  sendSuccessStatus: {
    fontSize: 14,
    color: '#9ca3af',
  },
  // Transfer History styles
  historyContent: {
    flex: 1,
    paddingTop: 60,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  historyFilterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  historyFilterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  historyFilterTabActive: {
    backgroundColor: '#1d4ed8',
  },
  historyFilterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  historyFilterTabTextActive: {
    color: '#fff',
  },
  historyList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  historyEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  historyEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  historyEmptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyItemAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  historyDirectionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  historyItemDetails: {
    flex: 1,
  },
  historyItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  historyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyItemDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  historyItemStatus: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  historyTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  historyTypeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  historyItemAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Transfer Detail styles
  transferDetailContent: {
    flex: 1,
    paddingTop: 60,
  },
  transferDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  transferDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  transferDetailScroll: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
  },
  transferDetailAmountCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transferDetailDirectionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  transferDetailAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 12,
  },
  transferDetailStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  transferDetailStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transferDetailSection: {
    marginBottom: 24,
  },
  transferDetailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transferDetailInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  transferDetailPersonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  transferDetailPersonInfo: {
    flex: 1,
  },
  transferDetailPersonName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  transferDetailPersonAlias: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  transferDetailPersonBank: {
    fontSize: 14,
    color: '#9ca3af',
  },
  transferDetailNoteCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  transferDetailNoteText: {
    fontSize: 15,
    color: '#78350f',
    lineHeight: 22,
  },
  transferDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transferDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  transferDetailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  transferDetailValueMono: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 2,
    textAlign: 'right',
  },
  // P2P QR Confirm styles
  p2pQrConfirmContent: {
    flex: 1,
    paddingTop: 60,
  },
  p2pQrConfirmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  p2pQrConfirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  p2pQrConfirmScroll: {
    flex: 1,
    padding: 24,
  },
  p2pQrRecipientCard: {
    alignItems: 'center',
    backgroundColor: '#EDE9FE',  // Purple tint for individual
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#7C3AED',  // Purple for individual
  },
  p2pQrRecipientCardMerchant: {
    backgroundColor: '#D1FAE5',  // Green tint for merchant
    borderColor: '#10B981',  // Green for merchant
  },
  p2pQrRecipientIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',  // Purple for individual
  },
  p2pQrRecipientIconMerchant: {
    borderColor: '#10B981',  // Green for merchant
  },
  p2pMerchantBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  p2pMerchantBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  p2pQrRecipientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  p2pQrRecipientAlias: {
    fontSize: 14,
    color: '#7C3AED',  // Purple for individual
    fontWeight: '500',
    marginBottom: 4,
  },
  p2pQrRecipientBank: {
    fontSize: 13,
    color: '#6b7280',
  },
  p2pMerchantFeeNote: {
    fontSize: 12,
    color: '#059669',  // Green
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  p2pQrFixedAmountNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // P2P Mode Toggle styles
  p2pModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  p2pModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  p2pModeButtonActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  p2pModeButtonBusiness: {
    // Base styles for business button (inactive)
  },
  p2pModeButtonBusinessActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  p2pModeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  p2pModeButtonTextActive: {
    color: '#ffffff',
  },
  // Merchant CTA Card styles
  merchantCTACard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  merchantCTAIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  merchantCTAContent: {
    flex: 1,
  },
  merchantCTATitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  merchantCTASubtitle: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  merchantCTAArrow: {
    fontSize: 20,
    color: '#10B981',
    fontWeight: '600',
  },
  // Merchant Dashboard styles
  merchantDashboardHeader: {
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  merchantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  merchantHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  merchantEditButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  merchantEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  merchantBusinessName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  merchantAlias: {
    fontSize: 14,
    color: '#047857',
  },
  merchantBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  merchantBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Merchant QR Section styles
  merchantQRSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  merchantQRTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  merchantQRContainer: {
    width: 200,
    height: 200,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  merchantQRCode: {
    alignItems: 'center',
  },
  merchantQRPlaceholder: {
    fontSize: 64,
    marginBottom: 8,
  },
  merchantQRHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  merchantGenerateQRButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  merchantGenerateQRText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  merchantQRActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  merchantQRAction: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
  },
  merchantQRActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  // Merchant Stats styles
  merchantStatsSection: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  merchantStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  merchantStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  merchantStatLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  // Merchant Transfer List styles
  merchantTransferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  merchantPaymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantTransferAmounts: {
    alignItems: 'flex-end',
  },
  merchantTransferGross: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  merchantTransferFee: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  merchantEmptyHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  // Merchant Enrollment Screen styles
  merchantEnrollContent: {
    flex: 1,
    paddingTop: 60,
  },
  merchantEnrollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  merchantEnrollTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  merchantEnrollScroll: {
    flex: 1,
    padding: 24,
  },
  merchantEnrollHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  merchantEnrollHeroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  merchantEnrollHeroSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  merchantEnrollFeeCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  merchantEnrollFeeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  merchantEnrollFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  merchantEnrollFeeLabel: {
    fontSize: 14,
    color: '#78350F',
  },
  merchantEnrollFeeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  merchantEnrollFeeNote: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 8,
    fontStyle: 'italic',
  },
  merchantEnrollSection: {
    marginBottom: 24,
  },
  merchantEnrollLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  merchantEnrollHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  merchantCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  merchantCategoryOption: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  merchantCategoryOptionActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  merchantCategoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  merchantCategoryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  merchantCategoryLabelActive: {
    color: '#065F46',
    fontWeight: '600',
  },
  merchantEnrollActions: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  merchantEnrollButton: {
    backgroundColor: '#10B981',
  },
  merchantEnrollDisclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
