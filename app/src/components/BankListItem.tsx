import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { Bank } from '../types';

interface BankListItemProps {
  bank: Bank;
  onPress: () => void;
}

export function BankListItem({ bank, onPress }: BankListItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      {/* Bank icon/logo */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: '#eff6ff',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        {bank.logo ? (
          <Image
            source={{ uri: bank.logo }}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 24 }}>🏦</Text>
        )}
      </View>

      {/* Bank info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#111827',
            marginBottom: 2,
          }}
        >
          {bank.name}
        </Text>
        {bank.description && (
          <Text
            style={{
              fontSize: 14,
              color: '#6b7280',
            }}
            numberOfLines={1}
          >
            {bank.description}
          </Text>
        )}
      </View>

      {/* Arrow */}
      <Text style={{ fontSize: 20, color: '#9ca3af' }}>›</Text>
    </TouchableOpacity>
  );
}
