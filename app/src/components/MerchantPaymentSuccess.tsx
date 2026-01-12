/**
 * MerchantPaymentSuccess component for displaying payment received animation.
 *
 * Shows an animated checkmark that fades in smoothly, displays for a duration,
 * then fades out smoothly before calling onComplete.
 *
 * Responsive sizing based on containerSize prop to fit in QR code containers
 * on both phones (200px) and tablets (380px).
 */

import React, { useEffect, useRef } from 'react';
import {
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
  /** Container size for responsive scaling (default: 380 for tablet) */
  containerSize?: number;
}

export function MerchantPaymentSuccess({
  onComplete,
  message,
  displayDuration = 3000,
  fadeDuration = 500,
  containerSize = 380,
}: MerchantPaymentSuccessProps) {
  // Single opacity value for the entire component
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  // Calculate responsive sizes based on container
  // Base sizes designed for 380px container (tablet)
  const scaleFactor = containerSize / 380;
  const circleSize = Math.round(140 * scaleFactor);
  const checkmarkFontSize = Math.round(70 * scaleFactor);
  const titleFontSize = Math.round(24 * scaleFactor);
  const messageFontSize = Math.round(18 * scaleFactor);
  const circleMarginBottom = Math.round(16 * scaleFactor);
  const titleMarginBottom = Math.round(6 * scaleFactor);

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
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            marginBottom: circleMarginBottom,
            transform: [{ scale: checkmarkScale }],
          },
        ]}
      >
        <Text style={[styles.checkmark, { fontSize: checkmarkFontSize }]}>✓</Text>
      </Animated.View>
      <Text style={[styles.title, { fontSize: titleFontSize, marginBottom: titleMarginBottom }]}>
        Payment Received
      </Text>
      <Text style={[styles.message, { fontSize: messageFontSize }]}>{message}</Text>
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
    // Size set dynamically via inline style
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  checkmark: {
    // Font size set dynamically via inline style
    color: '#ffffff',
    fontWeight: '300',
  },
  title: {
    // Font size set dynamically via inline style
    fontWeight: '600',
    color: '#1e293b',
  },
  message: {
    // Font size set dynamically via inline style
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

export default MerchantPaymentSuccess;
