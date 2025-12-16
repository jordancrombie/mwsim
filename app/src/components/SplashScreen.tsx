import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const handleLinkPress = () => {
    Linking.openURL('https://github.com/jordancrombie/SimToolBox');
  };

  // Auto-advance after 2.5 seconds, or tap to continue
  React.useEffect(() => {
    const timer = setTimeout(onFinish, 2500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={1}
      onPress={onFinish}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Mobile Wallet Simulator</Text>

        <TouchableOpacity onPress={handleLinkPress} style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Part of</Text>
          <Text style={styles.link}>SimToolBox</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tapHint}>Tap anywhere to continue</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: width * 0.45,
    height: width * 0.45,
    marginBottom: 24,
    borderRadius: 24,
    // Add shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 16,
    textAlign: 'center',
  },
  linkContainer: {
    alignItems: 'center',
    padding: 12,
  },
  linkLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  link: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  tapHint: {
    position: 'absolute',
    bottom: 60,
    fontSize: 14,
    color: '#90A4AE',
  },
});
