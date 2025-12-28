import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, Image } from 'react-native';
import type { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onPress?: () => void;
  onLongPress?: () => void;
  showDefault?: boolean;
  style?: ViewStyle;
}

/**
 * Get bank initials for fallback display when logo is unavailable
 */
function getBankInitials(bankName: string): string {
  const words = bankName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
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
  const [logoError, setLogoError] = useState(false);

  // Determine if we should show the logo or fallback
  const showLogo = card.bankLogoUrl && !logoError;

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
      {/* Top row: Bank logo/name + Default badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showLogo ? (
            <Image
              source={{ uri: card.bankLogoUrl }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
              onError={() => setLogoError(true)}
              resizeMode="contain"
            />
          ) : (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 10, fontWeight: '700' }}>
                {getBankInitials(card.bankName)}
              </Text>
            </View>
          )}
          <Text style={{ color: colors.text, fontSize: 14, opacity: 0.9 }}>
            {card.bankName}
          </Text>
        </View>
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
