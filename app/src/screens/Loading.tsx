import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LoadingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text
          style={{
            marginTop: 16,
            fontSize: 16,
            color: '#6b7280',
          }}
        >
          Loading...
        </Text>
      </View>
    </SafeAreaView>
  );
}
