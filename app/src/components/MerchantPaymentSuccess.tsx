/**
 * MerchantPaymentSuccess component for displaying payment received animation.
 *
 * Shows an animated checkmark that fades in smoothly, displays for a duration,
 * then fades out smoothly before calling onComplete.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface MerchantPaymentSuccessProps {
  /** Callback when animation sequence completes */
  onComplete: () => void;
  /** Message to display (e.g., "$25.00 from John") */
  message: string;
  /** Duration to show the success message in ms (default: 3000) */
  displayDuration?: number;
  /** Duration of fade in/out animations in ms (default: 500) */
  fadeDuration?: number;
}

export function MerchantPaymentSuccess({
  onComplete,
  message,
  displayDuration = 3000,
  fadeDuration = 500,
}: MerchantPaymentSuccessProps) {
  // Single opacity value for the entire component
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation sequence: fade in -> display -> fade out
    Animated.sequence([
      // 1. Fade in with slight scale
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: fadeDuration,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
      ]),
      // 2. Checkmark pop in
      Animated.timing(checkmarkScale, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      // 3. Hold for display duration
      Animated.delay(displayDuration),
      // 4. Fade out smoothly
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: fadeDuration,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  }, [opacity, scale, checkmarkScale, displayDuration, fadeDuration, onComplete]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{ scale: checkmarkScale }],
          },
        ]}
      >
        <Text style={styles.checkmark}>✓</Text>
      </Animated.View>
      <Text style={styles.title}>Payment Received</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  circle: {
    width: 204,
    height: 204,
    borderRadius: 102,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 34,
  },
  checkmark: {
    fontSize: 102,
    color: '#ffffff',
    fontWeight: '300',
  },
  title: {
    fontSize: 44,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 10,
  },
  message: {
    fontSize: 34,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default MerchantPaymentSuccess;
