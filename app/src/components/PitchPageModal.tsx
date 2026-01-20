/**
 * Pitch Page Modal Component
 *
 * Full-screen modal for displaying promotional/educational pitch pages.
 * Shows benefits, instructions, and CTA buttons with dismiss functionality.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { PitchPage, dismissPitchPage } from '../services/pitchPages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PitchPageModalProps {
  pitchPage: PitchPage;
  visible: boolean;
  onDismiss: () => void;
  onNavigate?: (screen: string) => void;
}

export const PitchPageModal: React.FC<PitchPageModalProps> = ({
  pitchPage,
  visible,
  onDismiss,
  onNavigate,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { content } = pitchPage;

  const handleDismiss = async () => {
    if (dontShowAgain) {
      await dismissPitchPage(pitchPage.id);
    }
    onDismiss();
  };

  const handleCTA = async () => {
    if (content.ctaButton?.action === 'navigate' && content.ctaButton.screen) {
      // If "don't show again" is checked, dismiss permanently before navigating
      if (dontShowAgain) {
        await dismissPitchPage(pitchPage.id);
      }
      onNavigate?.(content.ctaButton.screen);
      onDismiss();
    } else {
      handleDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleDismiss}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{content.title}</Text>
            {content.subtitle && (
              <Text style={styles.subtitle}>{content.subtitle}</Text>
            )}
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            {content.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>
                    {benefit.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Instructions */}
          {content.instructions && content.instructions.length > 0 && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>How to Get Started</Text>
              {content.instructions.map((instruction, index) => (
                <View key={index} style={styles.instructionRow}>
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer with buttons */}
        <View style={styles.footer}>
          {/* Don't show again checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain(!dontShowAgain)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Don't show this again</Text>
          </TouchableOpacity>

          {/* CTA Button */}
          {content.ctaButton && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleCTA}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>{content.ctaButton.label}</Text>
            </TouchableOpacity>
          )}

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>
              {content.dismissButtonLabel || 'Not Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  benefitsContainer: {
    marginBottom: 32,
  },
  benefitCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    fontSize: 32,
    marginRight: 16,
    marginTop: 4,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  instructionsContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    backgroundColor: '#ffffff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666666',
  },
  ctaButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  dismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    color: '#666666',
  },
});

export default PitchPageModal;
