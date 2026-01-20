/**
 * Pitch Page Modal Component
 *
 * Full-screen modal for displaying promotional/educational pitch pages.
 * Supports both single-page and multi-page (swipeable) pitch pages.
 * Shows benefits, instructions, and CTA buttons with dismiss functionality.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { PitchPage, PitchPageSlide, PitchPageContent, dismissPitchPage } from '../services/pitchPages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PitchPageModalProps {
  pitchPage: PitchPage;
  visible: boolean;
  onDismiss: () => void;
  onNavigate?: (screen: string) => void;
}

/**
 * Renders a single page/slide of content (benefits + optional instructions)
 */
const PageContent: React.FC<{
  content: PitchPageSlide | PitchPageContent;
  isMultiPage?: boolean;
}> = ({ content, isMultiPage }) => (
  <ScrollView
    style={styles.pageScrollView}
    contentContainerStyle={[
      styles.pageScrollContent,
      isMultiPage && styles.multiPageScrollContent,
    ]}
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
);

export const PitchPageModal: React.FC<PitchPageModalProps> = ({
  pitchPage,
  visible,
  onDismiss,
  onNavigate,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Determine if this is a multi-page pitch
  const isMultiPage = Boolean(pitchPage.pages && pitchPage.pages.length > 0);
  const pages = pitchPage.pages || [];
  const totalPages = isMultiPage ? pages.length : 1;
  const isLastPage = currentPage === totalPages - 1;

  // Get content for single-page mode
  const singleContent = pitchPage.content;

  // Get CTA and dismiss labels
  const ctaButton = isMultiPage ? pitchPage.finalPageCTA : singleContent?.ctaButton;
  const dismissLabel = isMultiPage
    ? pitchPage.finalPageDismissLabel || 'Maybe Later'
    : singleContent?.dismissButtonLabel || 'Not Now';

  const handleDismiss = async () => {
    if (dontShowAgain) {
      await dismissPitchPage(pitchPage.id);
    }
    // Reset state for next time
    setCurrentPage(0);
    setDontShowAgain(false);
    onDismiss();
  };

  const handleCTA = async () => {
    if (ctaButton?.action === 'navigate' && ctaButton.screen) {
      if (dontShowAgain) {
        await dismissPitchPage(pitchPage.id);
      }
      onNavigate?.(ctaButton.screen);
      setCurrentPage(0);
      setDontShowAgain(false);
      onDismiss();
    } else {
      // dismiss action
      handleDismiss();
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < totalPages) {
      setCurrentPage(pageIndex);
    }
  };

  const goToPage = (pageIndex: number) => {
    horizontalScrollRef.current?.scrollTo({
      x: pageIndex * SCREEN_WIDTH,
      animated: true,
    });
    setCurrentPage(pageIndex);
  };

  // Render single-page pitch
  if (!isMultiPage && singleContent) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleDismiss}
      >
        <SafeAreaView style={styles.container}>
          <PageContent content={singleContent} />

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
            {ctaButton && (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleCTA}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaButtonText}>{ctaButton.label}</Text>
              </TouchableOpacity>
            )}

            {/* Dismiss Button */}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissButtonText}>{dismissLabel}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Render multi-page pitch
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleDismiss}
    >
      <SafeAreaView style={styles.container}>
        {/* Horizontal page scroller */}
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.horizontalScroller}
        >
          {pages.map((page, index) => (
            <View key={index} style={styles.pageContainer}>
              <PageContent content={page} isMultiPage />
            </View>
          ))}
        </ScrollView>

        {/* Page indicator dots */}
        <View style={styles.pageIndicator}>
          {pages.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => goToPage(index)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dot,
                  index === currentPage && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer - changes based on current page */}
        <View style={styles.footer}>
          {isLastPage ? (
            <>
              {/* Don't show again checkbox - only on last page */}
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
              {ctaButton && (
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={handleCTA}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ctaButtonText}>{ctaButton.label}</Text>
                </TouchableOpacity>
              )}

              {/* Dismiss Button */}
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>{dismissLabel}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Navigation hints for non-last pages */}
              <View style={styles.swipeHintContainer}>
                <Text style={styles.swipeHint}>
                  Swipe to continue • {currentPage + 1} of {totalPages}
                </Text>
              </View>

              {/* Next button */}
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => goToPage(currentPage + 1)}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaButtonText}>Next</Text>
              </TouchableOpacity>

              {/* Skip button */}
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => goToPage(totalPages - 1)}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissButtonText}>Skip to End</Text>
              </TouchableOpacity>
            </>
          )}
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
  horizontalScroller: {
    flex: 1,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  pageScrollView: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  multiPageScrollContent: {
    paddingBottom: 8,
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
    marginBottom: 24,
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
    marginBottom: 16,
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
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cccccc',
  },
  dotActive: {
    backgroundColor: '#1976D2',
    width: 24,
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
  swipeHintContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  swipeHint: {
    fontSize: 14,
    color: '#999999',
  },
});

export default PitchPageModal;
