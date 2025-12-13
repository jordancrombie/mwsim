import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, CardComponent } from '../components';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList, Card } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletHome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

export function WalletHomeScreen({ navigation }: Props) {
  const { cards, isLoading, isOffline, refreshWallet, setDefaultCard, removeCard } = useWalletStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    refreshWallet();
  }, []);

  const onRefresh = useCallback(() => {
    refreshWallet();
  }, []);

  const handleCardPress = (card: Card) => {
    Alert.alert(
      card.cardType + ' •••• ' + card.lastFour,
      `${card.bankName}${card.isDefault ? '\n\nThis is your default card.' : ''}`,
      [
        ...(card.isDefault
          ? []
          : [
              {
                text: 'Set as Default',
                onPress: () => handleSetDefault(card.id),
              },
            ]),
        {
          text: 'Remove Card',
          style: 'destructive',
          onPress: () => handleRemoveCard(card),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSetDefault = async (cardId: string) => {
    try {
      await setDefaultCard(cardId);
    } catch (error) {
      Alert.alert('Error', 'Failed to set default card. Please try again.');
    }
  };

  const handleRemoveCard = (card: Card) => {
    Alert.alert(
      'Remove Card?',
      `Are you sure you want to remove ${card.cardType} •••• ${card.lastFour} from your wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCard(card.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove card. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleAddBank = () => {
    navigation.navigate('BankSelection');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 20,
            backgroundColor: '#ffffff',
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                Welcome back,
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>
                {user?.name || 'User'}
              </Text>
            </View>
            <Button
              title="Sign Out"
              onPress={handleLogout}
              variant="ghost"
              size="sm"
            />
          </View>

          {isOffline && (
            <View
              style={{
                marginTop: 12,
                padding: 10,
                backgroundColor: '#fef3c7',
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14 }}>📡</Text>
              <Text style={{ marginLeft: 8, fontSize: 14, color: '#92400e' }}>
                You're offline. Showing cached cards.
              </Text>
            </View>
          )}
        </View>

        {/* Cards Section */}
        <View style={{ padding: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#111827',
              marginBottom: 16,
            }}
          >
            My Cards
          </Text>

          {cards.length === 0 ? (
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: 32,
                alignItems: 'center',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#e5e7eb',
              }}
            >
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💳</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                No cards yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#6b7280',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                Add a bank to get started with your digital wallet.
              </Text>
              <Button
                title="Add a Bank"
                onPress={handleAddBank}
                size="md"
              />
            </View>
          ) : (
            <>
              {cards.map((card, index) => (
                <CardComponent
                  key={card.id}
                  card={card}
                  onPress={() => handleCardPress(card)}
                  style={{
                    width: CARD_WIDTH,
                    marginBottom: 16,
                  }}
                />
              ))}

              <Button
                title="+ Add Another Bank"
                onPress={handleAddBank}
                variant="outline"
                size="lg"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
