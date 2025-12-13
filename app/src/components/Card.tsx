import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import type { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onPress?: () => void;
  onLongPress?: () => void;
  showDefault?: boolean;
  style?: ViewStyle;
}

const CARD_COLORS: Record<string, { bg: string; text: string }> = {
  VISA: { bg: '#1a1f71', text: '#ffffff' },
  MASTERCARD: { bg: '#eb001b', text: '#ffffff' },
  AMEX: { bg: '#006fcf', text: '#ffffff' },
  DISCOVER: { bg: '#ff6600', text: '#ffffff' },
  DEBIT: { bg: '#374151', text: '#ffffff' },
};

const CARD_ICONS: Record<string, string> = {
  VISA: 'VISA',
  MASTERCARD: 'MC',
  AMEX: 'AMEX',
  DISCOVER: 'DISC',
  DEBIT: 'DEBIT',
};

export function CardComponent({ card, onPress, onLongPress, showDefault = true, style }: CardProps) {
  const colors = CARD_COLORS[card.cardType] || CARD_COLORS.DEBIT;

  const content = (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: 16,
          padding: 20,
          minHeight: 180,
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
    >
      {/* Top row: Bank name + Default badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ color: colors.text, fontSize: 14, opacity: 0.9 }}>
          {card.bankName}
        </Text>
        {showDefault && card.isDefault && (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '500' }}>
              Default
            </Text>
          </View>
        )}
      </View>

      {/* Middle: Card number */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontFamily: 'monospace',
            letterSpacing: 4,
          }}
        >
          •••• •••• •••• {card.lastFour}
        </Text>
      </View>

      {/* Bottom row: Card type */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 18,
            fontWeight: '700',
            fontStyle: 'italic',
          }}
        >
          {CARD_ICONS[card.cardType] || card.cardType}
        </Text>
      </View>
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.9}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
