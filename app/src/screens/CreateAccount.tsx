import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Input } from '../components';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAccount'>;

export function CreateAccountScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});

  const { createAccount, isLoading } = useAuthStore();

  const validate = (): boolean => {
    const newErrors: { email?: string; name?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await createAccount(email.trim(), name.trim());
      // Navigate to biometric setup after successful account creation
      navigation.navigate('BiometricSetup');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create account. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
            {/* Header */}
            <View style={{ marginBottom: 32 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                }}
              >
                Create Your Wallet
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: '#6b7280',
                  lineHeight: 24,
                }}
              >
                Enter your details to get started with your digital wallet.
              </Text>
            </View>

            {/* Form */}
            <View>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                containerStyle={{ marginBottom: 20 }}
              />

              <Input
                label="Full Name"
                value={name}
                onChangeText={setName}
                error={errors.name}
                placeholder="John Doe"
                autoCapitalize="words"
                autoComplete="name"
                containerStyle={{ marginBottom: 32 }}
              />

              <Button
                title="Continue"
                onPress={handleSubmit}
                loading={isLoading}
                size="lg"
              />
            </View>

            {/* Back link */}
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Button
                title="Already have an account? Sign in"
                onPress={() => navigation.goBack()}
                variant="ghost"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
