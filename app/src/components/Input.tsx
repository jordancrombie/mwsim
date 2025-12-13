import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, ViewStyle } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: '#374151',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={{
          borderWidth: 1.5,
          borderColor: error ? '#ef4444' : isFocused ? '#3b82f6' : '#d1d5db',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 16,
          color: '#111827',
          backgroundColor: '#ffffff',
        }}
        placeholderTextColor="#9ca3af"
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: '#ef4444',
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
