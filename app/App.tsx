import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import { v4 as uuidv4 } from 'uuid';

import { api } from './src/services/api';
import { secureStorage } from './src/services/secureStorage';
import { biometricService } from './src/services/biometric';
import type { User, Card, Bank } from './src/types';

type Screen =
  | 'loading'
  | 'welcome'
  | 'createAccount'
  | 'login'
  | 'verifyCode'
  | 'biometricSetup'
  | 'bankSelection'
  | 'home';

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
          return;
        } catch (e) {
          // Token invalid, clear and show welcome
          await secureStorage.clearAll();
        }
      }

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
    } catch (e) {
      console.error('Init error:', e);
      setCurrentScreen('welcome');
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
    if (!deviceId) {
      setError('Device not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.login(email.trim(), deviceId);
      setCurrentScreen('verifyCode');
    } catch (e: any) {
      const message = e.response?.data?.message || e.message || 'Failed to send verification code';
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

  // Loading Screen
  if (currentScreen === 'loading') {
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
              Enter your email to receive a verification code.
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

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 24 }]}
              onPress={handleLogin}
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

  // Home Screen
  if (currentScreen === 'home') {
    return (
      <View style={styles.container}>
          <StatusBar style="dark" />
          <View style={styles.homeContent}>
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
                        Alert.alert(
                          `${card.cardType} •••• ${card.lastFour}`,
                          `${card.bankName}${card.isDefault ? '\n\nThis is your default card.' : ''}`
                        );
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
                </>
              )}
            </ScrollView>
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
});
