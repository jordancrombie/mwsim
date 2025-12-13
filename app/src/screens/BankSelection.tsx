import React, { useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, BankListItem } from '../components';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList, Bank } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BankSelection'>;

export function BankSelectionScreen({ navigation }: Props) {
  const { banks, fetchBanks, isLoading } = useWalletStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleBankPress = (bank: Bank) => {
    navigation.navigate('BankEnrollment', {
      bsimId: bank.bsimId,
      bankName: bank.name,
    });
  };

  const handleSkip = () => {
    if (isAuthenticated) {
      navigation.navigate('WalletHome');
    } else {
      // First-time setup, mark as done and go to wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'WalletHome' }],
      });
    }
  };

  const renderItem = ({ item }: { item: Bank }) => (
    <BankListItem bank={item} onPress={() => handleBankPress(item)} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Header */}
        <View style={{ paddingTop: 20, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#111827',
              marginBottom: 8,
            }}
          >
            Add Your First Card
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: '#6b7280',
              lineHeight: 24,
            }}
          >
            Connect a bank to add your cards to the wallet.
          </Text>
        </View>

        {/* Bank list */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>
              Loading banks...
            </Text>
          </View>
        ) : banks.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🏦</Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
              No banks available at the moment.{'\n'}Please try again later.
            </Text>
          </View>
        ) : (
          <FlatList
            data={banks}
            renderItem={renderItem}
            keyExtractor={(item) => item.bsimId}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        {/* Skip button */}
        <View style={{ paddingBottom: 24 }}>
          <Button
            title="Skip for now"
            onPress={handleSkip}
            variant="ghost"
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
