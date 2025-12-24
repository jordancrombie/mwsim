/**
 * SuccessAnimation component for displaying an animated checkmark
 * after successful payment approval.
 *
 * Shows an animated circle with a checkmark that draws in,
 * followed by a delay before calling onComplete.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface SuccessAnimationProps {
  /** Callback when animation sequence completes */
  onComplete: () => void;
  /** Duration of the checkmark animation in ms (default: 800) */
  animationDuration?: number;
  /** Delay after animation before calling onComplete in ms (default: 2000) */
  delayAfterAnimation?: number;
  /** Optional message to display below the animation */
  message?: string;
}

export function SuccessAnimation({
  onComplete,
  animationDuration = 800,
  delayAfterAnimation = 2000,
  message = 'Payment Approved',
}: SuccessAnimationProps) {
  // Animation values
  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  const checkmarkProgress = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence of animations
    Animated.sequence([
      // 1. Circle appears with scale and fade
      Animated.parallel([
        Animated.timing(circleScale, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(circleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // 2. Checkmark draws in
      Animated.parallel([
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkProgress, {
          toValue: 1,
          duration: animationDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // 3. Text fades in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // 4. Delay before completing
      Animated.delay(delayAfterAnimation),
    ]).start(() => {
      onComplete();
    });
  }, [
    circleScale,
    circleOpacity,
    checkmarkProgress,
    checkmarkOpacity,
    textOpacity,
    animationDuration,
    delayAfterAnimation,
    onComplete,
  ]);

  // Calculate checkmark line positions based on progress
  // The checkmark is made of two lines forming a check shape
  const checkmarkTranslateX = checkmarkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <View style={styles.container}>
      <View style={styles.animationContainer}>
        {/* Animated Circle */}
        <Animated.View
          style={[
            styles.circle,
            {
              opacity: circleOpacity,
              transform: [{ scale: circleScale }],
            },
          ]}
        >
          {/* Checkmark using Unicode with animation */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                opacity: checkmarkOpacity,
                transform: [
                  { translateX: checkmarkTranslateX },
                  {
                    scale: checkmarkProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.5, 1.1, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
        </Animated.View>

        {/* Success Message */}
        <Animated.Text
          style={[
            styles.message,
            { opacity: textOpacity },
          ]}
        >
          {message}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  animationContainer: {
    alignItems: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  checkmarkContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 60,
    color: '#ffffff',
    fontWeight: '300',
  },
  message: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
});

export default SuccessAnimation;
