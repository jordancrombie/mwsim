import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: ViewStyle = {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 14, paddingHorizontal: 24 },
    lg: { paddingVertical: 18, paddingHorizontal: 32 },
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled ? '#93c5fd' : '#3b82f6',
    },
    secondary: {
      backgroundColor: isDisabled ? '#d1d5db' : '#6b7280',
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isDisabled ? '#93c5fd' : '#3b82f6',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const textBaseStyle: TextStyle = {
    fontWeight: '600',
  };

  const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: 14 },
    md: { fontSize: 16 },
    lg: { fontSize: 18 },
  };

  const textVariantStyles: Record<string, TextStyle> = {
    primary: { color: '#ffffff' },
    secondary: { color: '#ffffff' },
    outline: { color: isDisabled ? '#93c5fd' : '#3b82f6' },
    ghost: { color: isDisabled ? '#9ca3af' : '#3b82f6' },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        baseStyle,
        sizeStyles[size],
        variantStyles[variant],
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'secondary' ? '#ffffff' : '#3b82f6'}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        style={[
          textBaseStyle,
          textSizeStyles[size],
          textVariantStyles[variant],
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
