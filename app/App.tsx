import 'react-native-get-random-values';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { CameraView } from 'expo-camera';
import { v4 as uuidv4 } from 'uuid';

import { api } from './src/services/api';
import { secureStorage } from './src/services/secureStorage';
import { biometricService } from './src/services/biometric';
import { openReturnUrl, parseSourceBrowser } from './src/services/browserReturn';
import { getEnvironmentName, isDevelopment } from './src/config/env';
import { SplashScreen } from './src/components/SplashScreen';
import type { User, Card, Bank, PaymentRequest, PaymentCard } from './src/types';

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
  | 'qrScanner';

export default function App() {
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

  // Splash screen state
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  // QR Scanner state
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Track if we've handled the initial URL
  const initialUrlHandled = useRef(false);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  // Load banks when entering bank selection screen
  useEffect(() => {
    if (currentScreen === 'bankSelection') {
      handleLoadBanks();
    }
  }, [currentScreen]);

  // Handle deep link for payment requests
  const handleDeepLink = useCallback(async (url: string) => {
    console.log('[DeepLink] Received URL:', url);

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

      setPaymentStatus('success');

      // Show success with option to return to store
      Alert.alert(
        'Payment Approved',
        'Your payment has been approved successfully.',
        [
          {
            text: 'Return to Store',
            onPress: async () => {
              if (result.returnUrl) {
                // Append mwsim_return param so SSIM checkout knows the payment context
                const separator = result.returnUrl.includes('?') ? '&' : '?';
                const returnUrlWithContext = `${result.returnUrl}${separator}mwsim_return=${paymentRequest.requestId}`;
                console.log('[Payment] Opening returnUrl:', returnUrlWithContext);
                console.log('[Payment] Original returnUrl:', result.returnUrl);
                console.log('[Payment] requestId:', paymentRequest.requestId);
                console.log('[Payment] sourceBrowser:', sourceBrowser);
                // Use browser-aware return to open in the same browser user came from
                await openReturnUrl(returnUrlWithContext, sourceBrowser);
              } else {
                console.log('[Payment] No returnUrl in result:', result);
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
    setCurrentScreen('home');
  };

  const initializeApp = async () => {
    try {
      // Get or create device ID
      let storedDeviceId = await secureStorage.getDeviceId();
      if (!storedDeviceId) {
        storedDeviceId = uuidv4();
        await secureStorage.setDeviceId(storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      // Check biometric capabilities
      const capabilities = await biometricService.getCapabilities();
      setBiometricType(biometricService.getBiometricName(capabilities.biometricType));

      // Check for existing session
      const accessToken = await secureStorage.getAccessToken();
      if (accessToken) {
        try {
          const summary = await api.getWalletSummary();
          setUser(summary.user);
          setCards(summary.cards || []);
          setCurrentScreen('home');
        } catch (e) {
          // Token invalid, clear and show welcome
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
      setAppIsReady(true);
      await ExpoSplashScreen.hideAsync();
    }
  };

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
      const result = await api.createAccount(
        email.trim(),
        name.trim(),
        deviceId,
        deviceName || `${Platform.OS} device`,
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
      const result = await api.loginWithPassword(
        email.trim(),
        password,
        deviceId,
        deviceName,
        Platform.OS as 'ios' | 'android'
      );

      // Store tokens
      await secureStorage.setAccessToken(result.tokens.accessToken);
      await secureStorage.setRefreshToken(result.tokens.refreshToken);

      setUser(result.user);
      setPassword(''); // Clear password from memory

      // Load wallet data
      try {
        const walletData = await api.getWalletSummary();
        setCards(walletData.cards || []);
      } catch (e) {
        console.log('[Login] Failed to load wallet, continuing anyway');
      }

      // Go to home or handle pending payment
      setCurrentScreen('home');
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

      // Load wallet data
      try {
        const summary = await api.getWalletSummary();
        setCards(summary.cards || []);
      } catch (e) {
        // Continue anyway
      }

      setCurrentScreen('home');
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
            setCurrentScreen('home');
          } else if (success === 'false' || errorParam) {
            const errorMsg = urlObj.searchParams.get('message') || errorParam;
            Alert.alert('Enrollment Failed', errorMsg || 'Could not complete bank enrollment');
          } else {
            // No explicit success/error param - assume success if we got here
            Alert.alert('Success', 'Bank enrolled successfully! Your cards have been added.');
            await handleRefreshWallet();
            setCurrentScreen('home');
          }
        } catch (parseError) {
          console.error('[Enrollment] URL parse error:', parseError);
          // If URL parsing fails, assume success since we got a redirect
          await handleRefreshWallet();
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
      setUser(summary.user);
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

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
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
          setCurrentScreen('welcome');
        },
      },
    ]);
  };

  // QR Scanner functions
  const handleOpenQrScanner = async () => {
    // Request camera permission using expo-camera
    const { status } = await CameraView.requestCameraPermissionsAsync();
    setHasCameraPermission(status === 'granted');

    if (status === 'granted') {
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

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (qrScanned) return; // Prevent multiple scans

    console.log('[QR Scanner] Scanned:', data);

    // Validate the URL format
    // Expected formats:
    // - https://wsim.banksim.ca/pay/{requestId}
    // - mwsim://payment/{requestId}

    let requestId: string | null = null;

    // Try Universal Link format: https://wsim.banksim.ca/pay/{requestId}
    const universalLinkMatch = data.match(/https:\/\/wsim\.banksim\.ca\/pay\/([a-zA-Z0-9_-]+)/);
    if (universalLinkMatch) {
      requestId = universalLinkMatch[1];
    }

    // Try deep link format: mwsim://payment/{requestId}
    if (!requestId) {
      const deepLinkMatch = data.match(/mwsim:\/\/payment\/([a-zA-Z0-9_-]+)/);
      if (deepLinkMatch) {
        requestId = deepLinkMatch[1];
      }
    }

    if (!requestId) {
      // Not a valid payment QR code
      Alert.alert(
        'Invalid QR Code',
        'This doesn\'t appear to be a valid payment QR code. Please scan a QR code from a merchant checkout.',
        [
          { text: 'Try Again', onPress: () => setQrScanned(false) },
          { text: 'Cancel', onPress: () => setCurrentScreen('home'), style: 'cancel' },
        ]
      );
      setQrScanned(true);
      return;
    }

    // Valid payment QR code found
    setQrScanned(true);
    console.log('[QR Scanner] Payment request ID:', requestId);

    // Store for cold start recovery (same as deep link flow)
    await secureStorage.set('pendingPaymentRequestId', requestId);
    setPendingRequestId(requestId);

    // Source is QR scan (not a browser)
    setSourceBrowser(null);
    await secureStorage.remove('pendingPaymentSourceBrowser');

    // Navigate to payment approval
    await loadPaymentRequest(requestId);
  };

  const handleCloseQrScanner = () => {
    setQrScanned(false);
    setTorchOn(false);
    setCurrentScreen('home');
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
            {hasCameraPermission === false ? (
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

  // Home Screen
  if (currentScreen === 'home') {
    return (
      <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.homeContent}>
            {/* Environment indicator */}
            {isDevelopment() && (
              <View style={styles.envBadge}>
                <Text style={styles.envBadgeText}>{getEnvironmentName()}</Text>
              </View>
            )}
            <View style={styles.homeHeader}>
              <View>
                <Text style={styles.homeGreeting}>Welcome back,</Text>
                <Text style={styles.homeName}>{user?.name || 'User'}</Text>
              </View>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

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
          </View>
        </View>
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
            {/* Merchant Info */}
            <View style={styles.merchantSection}>
              {paymentRequest?.merchantLogoUrl ? (
                <Image
                  source={{ uri: paymentRequest.merchantLogoUrl }}
                  style={styles.merchantLogo}
                />
              ) : (
                <View style={styles.merchantLogoPlaceholder}>
                  <Text style={styles.merchantLogoText}>
                    {paymentRequest?.merchantName?.charAt(0) || 'M'}
                  </Text>
                </View>
              )}
              <Text style={styles.merchantName}>{paymentRequest?.merchantName}</Text>
              {paymentRequest?.orderDescription && (
                <Text style={styles.orderDescription}>{paymentRequest.orderDescription}</Text>
              )}
            </View>

            {/* Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amountValue}>
                {paymentRequest ? formatAmount(paymentRequest.amount, paymentRequest.currency) : ''}
              </Text>
            </View>

            {/* Time remaining */}
            <View style={styles.timerSection}>
              <Text style={styles.timerLabel}>Time remaining: {getTimeRemaining()}</Text>
            </View>

            {/* Card Selection */}
            <View style={styles.cardSelectionSection}>
              <Text style={styles.cardSelectionTitle}>Pay with</Text>
              {paymentRequest?.cards.map((card) => {
                const isSelected = selectedPaymentCard?.id === card.id;
                const cardColor = card.cardType === 'VISA' ? '#1a1f71' : '#eb001b';

                return (
                  <TouchableOpacity
                    key={card.id}
                    style={[
                      styles.paymentCardOption,
                      isSelected && styles.paymentCardOptionSelected,
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
                      {isSelected && <Text style={styles.paymentCardCheckMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
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
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 100,
  },
  envBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
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
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  amountSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  amountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#111827',
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  timerLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  cardSelectionSection: {
    paddingVertical: 16,
  },
  cardSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  paymentCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  paymentCardOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  paymentCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  paymentCardBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentCardInfo: {
    flex: 1,
  },
  paymentCardNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paymentCardBank: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  paymentCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCardCheckMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
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
});
