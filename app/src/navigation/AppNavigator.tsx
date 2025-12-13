import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../types';

// Screens
import { WelcomeScreen } from '../screens/Welcome';
import { CreateAccountScreen } from '../screens/CreateAccount';
import { BiometricSetupScreen } from '../screens/BiometricSetup';
import { BankSelectionScreen } from '../screens/BankSelection';
import { BankEnrollmentScreen } from '../screens/BankEnrollment';
import { WalletHomeScreen } from '../screens/WalletHome';
import { LoadingScreen } from '../screens/Loading';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { isLoading, isAuthenticated, user } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          // Auth flow
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
            <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
            <Stack.Screen name="BankSelection" component={BankSelectionScreen} />
            <Stack.Screen
              name="BankEnrollment"
              component={BankEnrollmentScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        ) : (
          // Main app flow
          <>
            <Stack.Screen name="WalletHome" component={WalletHomeScreen} />
            <Stack.Screen name="BankSelection" component={BankSelectionScreen} />
            <Stack.Screen
              name="BankEnrollment"
              component={BankEnrollmentScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
