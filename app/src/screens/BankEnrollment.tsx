import React, { useRef, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Button } from '../components';
import { api } from '../services/api';
import { useWalletStore } from '../store/walletStore';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BankEnrollment'>;

export function BankEnrollmentScreen({ navigation, route }: Props) {
  const { bsimId, bankName } = route.params;
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentUrl, setEnrollmentUrl] = useState<string | null>(null);

  const { refreshWallet } = useWalletStore();

  // Start enrollment and get the OAuth URL
  useEffect(() => {
    const startEnrollment = async () => {
      try {
        const { authUrl } = await api.startEnrollment(bsimId);
        setEnrollmentUrl(authUrl);
      } catch (e: any) {
        setError(e.message || 'Failed to start enrollment');
      }
    };
    startEnrollment();
  }, [bsimId]);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    // Check for successful enrollment callback
    if (url.includes('/enrollment/callback') || url.includes('/enrollment/success')) {
      if (url.includes('success=true') || url.includes('/success')) {
        handleEnrollmentSuccess();
        return;
      }
    }

    // Check for error or cancellation
    if (url.includes('error=') || url.includes('cancelled=true')) {
      const errorMatch = url.match(/error=([^&]+)/);
      const errorMessage = errorMatch
        ? decodeURIComponent(errorMatch[1])
        : 'Enrollment was cancelled';
      handleEnrollmentError(errorMessage);
      return;
    }

    // Check if we're back at the wallet (enrollment complete)
    if (url.includes('/wallet') || url.includes('/home')) {
      handleEnrollmentSuccess();
    }
  };

  const handleEnrollmentSuccess = async () => {
    // Refresh wallet to get new cards
    await refreshWallet();

    Alert.alert(
      'Success!',
      `Your cards from ${bankName} have been added to your wallet.`,
      [
        {
          text: 'View Wallet',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'WalletHome' }],
            });
          },
        },
      ]
    );
  };

  const handleEnrollmentError = (message: string) => {
    setError(message);
    Alert.alert(
      'Enrollment Failed',
      message,
      [
        {
          text: 'Try Again',
          onPress: () => {
            setError(null);
            webViewRef.current?.reload();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleClose = () => {
    Alert.alert(
      'Cancel Enrollment?',
      'Are you sure you want to cancel adding this bank?',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <Button
          title="Cancel"
          onPress={handleClose}
          variant="ghost"
          size="sm"
        />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
          {bankName}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* WebView */}
      <View style={{ flex: 1 }}>
        {isLoading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              zIndex: 1,
            }}
          >
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>
              Connecting to {bankName}...
            </Text>
          </View>
        )}

        {enrollmentUrl && (
          <WebView
            ref={webViewRef}
            source={{ uri: enrollmentUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              handleEnrollmentError(nativeEvent.description || 'Failed to load page');
            }}
            // Important settings for OAuth flow
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            // Security
            incognito={false}
            cacheEnabled={true}
            // Styling
            style={{ flex: 1, backgroundColor: '#ffffff' }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
