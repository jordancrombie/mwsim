import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components';
import { useAuthStore } from '../store/authStore';
import { biometricService } from '../services/biometric';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

export function BiometricSetupScreen({ navigation }: Props) {
  const { biometricType, setupBiometric, isLoading } = useAuthStore();
  const [biometricName, setBiometricName] = useState('Biometric');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const capabilities = await biometricService.getCapabilities();
    setIsAvailable(capabilities.isAvailable);
    setBiometricName(biometricService.getBiometricName(capabilities.biometricType));
  };

  const handleEnable = async () => {
    const success = await setupBiometric();
    if (success) {
      navigation.navigate('BankSelection');
    } else {
      Alert.alert(
        'Setup Failed',
        'Could not enable biometric authentication. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSkip = () => {
    navigation.navigate('BankSelection');
  };

  const getBiometricIcon = () => {
    if (biometricType === 'face') {
      return '👤'; // Face ID
    }
    return '👆'; // Touch ID / Fingerprint
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          justifyContent: 'space-between',
        }}
      >
        {/* Top section */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Icon */}
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: '#eff6ff',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <Text style={{ fontSize: 56 }}>{getBiometricIcon()}</Text>
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            Secure Your Wallet
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: 24,
              paddingHorizontal: 20,
            }}
          >
            {isAvailable
              ? `Enable ${biometricName} to securely access your wallet and authorize payments.`
              : 'Biometric authentication is not available on this device. You can still use your wallet with other authentication methods.'}
          </Text>

          {/* Benefits list */}
          {isAvailable && (
            <View style={{ marginTop: 32, width: '100%' }}>
              {[
                'Quick and secure access',
                'Authorize payments instantly',
                'No passwords to remember',
              ].map((benefit, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                    paddingHorizontal: 20,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#dcfce7',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: '#16a34a' }}>✓</Text>
                  </View>
                  <Text style={{ fontSize: 15, color: '#374151' }}>{benefit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom buttons */}
        <View style={{ paddingBottom: 24 }}>
          {isAvailable ? (
            <>
              <Button
                title={`Enable ${biometricName}`}
                onPress={handleEnable}
                loading={isLoading}
                size="lg"
                style={{ marginBottom: 12 }}
              />
              <Button
                title="Skip for now"
                onPress={handleSkip}
                variant="ghost"
                size="lg"
              />
            </>
          ) : (
            <Button
              title="Continue"
              onPress={handleSkip}
              size="lg"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
