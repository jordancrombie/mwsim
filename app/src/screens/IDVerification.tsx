import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Button } from '../components';
import {
  checkNFCSupport,
  readPassport,
  formatPassportDate,
  type PassportData,
  type MRZData,
} from '../services/nfcPassport';
import {
  parseMRZFromOCR,
  extractMRZData,
  getCountryName,
  getGenderDisplay,
  isPassportExpired,
  createMRZDataFromFields,
} from '../services/mrzScanner';

type Step = 'intro' | 'mrz-scan' | 'mrz-input' | 'nfc-read' | 'success' | 'error';

interface IDVerificationScreenProps {
  onComplete?: (passportData: PassportData) => void;
  onCancel?: () => void;
}

// Inner component that uses the safe area hook (must be inside SafeAreaProvider)
function IDVerificationScreenInner({ onComplete, onCancel }: IDVerificationScreenProps) {
  const [step, setStep] = useState<Step>('intro');
  const [mrzData, setMrzData] = useState<MRZData | null>(null);
  const [passportData, setPassportData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Position passport in view');

  // Safe area insets for camera view
  const insets = useSafeAreaInsets();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Form fields for manual MRZ entry
  const [documentNumber, setDocumentNumber] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [expiryDay, setExpiryDay] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');

  // Camera ref for taking pictures
  const cameraRef = useRef<CameraView>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isScanning = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation for NFC step
  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Check NFC support
  const checkSupport = useCallback(() => {
    const support = checkNFCSupport();
    setNfcSupported(support.isSupported);
    if (!support.isSupported) {
      setError(support.reason || 'NFC not supported on this device');
    }
    return support.isSupported;
  }, []);

  // Handle intro continue
  const handleIntroContinue = useCallback(async () => {
    const supported = checkSupport();
    if (!supported) {
      setStep('error');
      return;
    }

    // Check camera permission
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        // Fall back to manual input
        setStep('mrz-input');
        return;
      }
    }

    setStep('mrz-scan');
  }, [checkSupport, permission, requestPermission]);

  // Scan image for MRZ
  const scanForMRZ = useCallback(async () => {
    if (isScanning.current || !cameraRef.current) return;

    isScanning.current = true;
    try {
      // Take a picture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        isScanning.current = false;
        return;
      }

      setScanStatus('Analyzing...');

      // Run text recognition
      const result = await TextRecognition.recognize(photo.uri);
      const text = result.text;

      console.log('[IDVerification] OCR result:', text.substring(0, 300));

      // Check if we're seeing the wrong part of the passport
      const lowerText = text.toLowerCase();
      const hasHumanReadableText =
        lowerText.includes('passport') ||
        lowerText.includes('passeport') ||
        lowerText.includes('surname') ||
        lowerText.includes('given name') ||
        lowerText.includes('nationality') ||
        lowerText.includes('date of birth') ||
        lowerText.includes('issuing') ||
        lowerText.includes('type');

      // Try to parse MRZ from the text
      const parsed = parseMRZFromOCR(text);

      if (parsed && parsed.isValid) {
        console.log('[IDVerification] Found valid MRZ:', parsed);

        const extracted = extractMRZData(parsed);
        if (extracted) {
          // Check expiry
          if (isPassportExpired(extracted.dateOfExpiry)) {
            setScanStatus('Passport appears expired');
            isScanning.current = false;
            return;
          }

          // Success! Stop scanning and proceed
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }

          setMrzData(extracted);
          setStep('nfc-read');
          startPulseAnimation();
          return;
        }
      }

      // Give helpful feedback based on what we're seeing
      if (hasHumanReadableText) {
        // User is pointing at the wrong part - the human readable section
        setScanStatus('Move camera DOWN to the MRZ code');
      } else if (text.length < 50) {
        setScanStatus('Move passport closer to camera');
      } else {
        setScanStatus('Scanning... align the 2-line MRZ code');
      }
    } catch (err) {
      console.log('[IDVerification] Scan error:', err);
      setScanStatus('Scanning...');
    }

    isScanning.current = false;
  }, [startPulseAnimation]);

  // Start continuous scanning when in mrz-scan step
  useEffect(() => {
    if (step === 'mrz-scan') {
      // Start scanning every 1.5 seconds
      scanIntervalRef.current = setInterval(() => {
        scanForMRZ();
      }, 1500);

      return () => {
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
      };
    }
  }, [step, scanForMRZ]);

  // Format date to YYMMDD
  const formatDateToMRZ = (day: string, month: string, year: string): string | null => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;

    const yy = y > 99 ? String(y).slice(-2) : String(y).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');

    return `${yy}${mm}${dd}`;
  };

  // Handle MRZ form submit
  const handleMRZSubmit = useCallback(() => {
    const dob = formatDateToMRZ(birthDay, birthMonth, birthYear);
    const expiry = formatDateToMRZ(expiryDay, expiryMonth, expiryYear);

    if (!dob || !expiry) {
      setError('Please enter valid dates');
      return;
    }

    const mrzDataResult = createMRZDataFromFields(documentNumber, dob, expiry);

    if (!mrzDataResult) {
      setError('Invalid passport information. Please check and try again.');
      return;
    }

    if (isPassportExpired(mrzDataResult.dateOfExpiry)) {
      setError('This passport appears to be expired.');
      return;
    }

    setMrzData(mrzDataResult);
    setError(null);
    setStep('nfc-read');
    startPulseAnimation();
  }, [documentNumber, birthDay, birthMonth, birthYear, expiryDay, expiryMonth, expiryYear, startPulseAnimation]);

  // Handle NFC read
  const handleNFCRead = useCallback(async () => {
    if (!mrzData) return;

    setIsProcessing(true);
    try {
      const data = await readPassport(mrzData);
      setPassportData(data);
      setStep('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read passport';
      if (errorMessage !== 'Scan cancelled') {
        setError(errorMessage);
        setStep('error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [mrzData]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setError(null);
    setMrzData(null);
    setPassportData(null);
    setStep('intro');
  }, []);

  // Handle complete
  const handleComplete = useCallback(() => {
    if (passportData && onComplete) {
      onComplete(passportData);
    }
  }, [passportData, onComplete]);

  // Render intro step
  const renderIntro = () => (
    <View style={styles.flex}>
      <View style={styles.screenHeader}>
        {onCancel && (
          <TouchableOpacity style={styles.screenHeaderBack} onPress={onCancel}>
            <Text style={styles.screenHeaderBackText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.screenHeaderTitle}>Identity Verification</Text>
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.iconContainer}>
        <Text style={styles.icon}>🛂</Text>
      </View>

      <Text style={styles.title}>Verify Your Identity</Text>

      <Text style={styles.description}>
        We'll scan your passport to verify your identity. This takes just a moment.
      </Text>

      <View style={styles.stepsList}>
        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepTitle}>Scan the MRZ Code</Text>
            <Text style={styles.stepDescription}>
              The MRZ is the two lines of text with {'<'} symbols at the very bottom of your passport's photo page
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepTitle}>Read the NFC Chip</Text>
            <Text style={styles.stepDescription}>
              Hold your phone flat against the passport to read the embedded chip
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>🔒</Text>
        <Text style={styles.infoText}>
          Your passport data is processed securely and never stored on our servers.
        </Text>
      </View>

        <View style={styles.bottomButtons}>
          <Button title="Start Verification" onPress={handleIntroContinue} size="lg" />
        </View>
      </ScrollView>
    </View>
  );

  // Render MRZ camera scan step
  const renderMRZScan = () => (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Overlay */}
      <View style={styles.scanOverlay}>
        {/* Header with safe area */}
        <View style={[styles.scanHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => setStep('intro')}
            style={styles.scanBackButton}
          >
            <Text style={styles.scanBackText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* MRZ Example at top */}
        <View style={styles.mrzExampleContainer}>
          <Text style={styles.mrzExampleLabel}>Look for these two lines at the BOTTOM of your passport:</Text>
          <View style={styles.mrzExampleBox}>
            <Text style={styles.mrzExampleText}>P&lt;CANSMITH&lt;&lt;JANE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
            <Text style={styles.mrzExampleText}>AB123456&lt;7CAN900101M&lt;&lt;&lt;&lt;&lt;&lt;&lt;</Text>
          </View>
        </View>

        {/* Center guide - positioned lower for MRZ zone */}
        <View style={styles.scanGuideContainer}>
          <View style={styles.scanGuide}>
            <View style={[styles.scanCorner, styles.scanCornerTL]} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
          </View>
          <Text style={styles.scanGuideText}>
            Point camera at BOTTOM of passport page only
          </Text>
        </View>

        {/* Bottom with safe area */}
        <View style={[styles.scanBottom, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.scanStatusContainer}>
            <Text style={styles.scanStatusText}>{scanStatus}</Text>
          </View>
          <TouchableOpacity
            style={styles.manualEntryButton}
            onPress={() => setStep('mrz-input')}
          >
            <Text style={styles.manualEntryText}>Enter manually instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render MRZ manual input step
  const renderMRZInput = () => (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.screenHeader}>
        <TouchableOpacity style={styles.screenHeaderBack} onPress={() => setStep('mrz-scan')}>
          <Text style={styles.screenHeaderBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>Manual Entry</Text>
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <Text style={styles.subtitle}>Enter Passport Details</Text>

        <Text style={styles.description}>
          Enter the information from the bottom of your passport's data page.
        </Text>

        {/* Document Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Passport Number</Text>
          <TextInput
            style={styles.textInput}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="e.g., AB1234567"
            autoCapitalize="characters"
            maxLength={9}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Date of Birth</Text>
          <View style={styles.dateInputRow}>
            <TextInput
              style={[styles.textInput, styles.dateInput]}
              value={birthDay}
              onChangeText={setBirthDay}
              placeholder="DD"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={[styles.textInput, styles.dateInput]}
              value={birthMonth}
              onChangeText={setBirthMonth}
              placeholder="MM"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={[styles.textInput, styles.dateInputYear]}
              value={birthYear}
              onChangeText={setBirthYear}
              placeholder="YY"
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        {/* Expiry Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Passport Expiry Date</Text>
          <View style={styles.dateInputRow}>
            <TextInput
              style={[styles.textInput, styles.dateInput]}
              value={expiryDay}
              onChangeText={setExpiryDay}
              placeholder="DD"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={[styles.textInput, styles.dateInput]}
              value={expiryMonth}
              onChangeText={setExpiryMonth}
              placeholder="MM"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>/</Text>
            <TextInput
              style={[styles.textInput, styles.dateInputYear]}
              value={expiryYear}
              onChangeText={setExpiryYear}
              placeholder="YY"
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        <View style={styles.bottomButtons}>
          <Button
            title="Continue to NFC Scan"
            onPress={handleMRZSubmit}
            size="lg"
            disabled={!documentNumber || !birthDay || !birthMonth || !birthYear || !expiryDay || !expiryMonth || !expiryYear}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render NFC read step
  const renderNFCRead = () => (
    <View style={styles.flex}>
      <View style={styles.screenHeader}>
        <TouchableOpacity style={styles.screenHeaderBack} onPress={() => setStep('mrz-scan')}>
          <Text style={styles.screenHeaderBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenHeaderTitle}>NFC Scan</Text>
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <Animated.View style={[styles.nfcIconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.nfcIcon}>📱</Text>
        </Animated.View>

        <Text style={styles.title}>Read Passport Chip</Text>

      <Text style={styles.description}>
        Hold your phone flat against the back cover of your passport until the reading is complete.
      </Text>

      <View style={styles.nfcDiagram}>
        <View style={styles.phoneIcon}>
          <Text style={styles.phoneEmoji}>📱</Text>
        </View>
        <Text style={styles.nfcArrow}>↓</Text>
        <View style={styles.passportIcon}>
          <Text style={styles.passportEmoji}>🛂</Text>
        </View>
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Tips:</Text>
        <Text style={styles.tipText}>• Remove passport from any cover</Text>
        <Text style={styles.tipText}>• Chip is usually near the photo page</Text>
        <Text style={styles.tipText}>• Keep phone still while reading</Text>
      </View>

        <View style={styles.bottomButtons}>
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.processingText}>Reading passport...</Text>
            </View>
          ) : (
            <Button title="Start NFC Scan" onPress={handleNFCRead} size="lg" />
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Render success step
  const renderSuccess = () => {
    if (!passportData) return null;

    return (
      <View style={styles.flex}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenHeaderTitle}>Verification Complete</Text>
        </View>
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
          <View style={styles.successIconContainer}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.title}>Identity Verified</Text>

        {passportData.photo.base64 && (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: passportData.photo.base64 }}
              style={styles.passportPhoto}
              resizeMode="cover"
            />
          </View>
        )}

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Name</Text>
            <Text style={styles.detailValue}>
              {passportData.firstName} {passportData.lastName}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of Birth</Text>
            <Text style={styles.detailValue}>{formatPassportDate(passportData.dateOfBirth)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nationality</Text>
            <Text style={styles.detailValue}>{getCountryName(passportData.nationality)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gender</Text>
            <Text style={styles.detailValue}>{getGenderDisplay(passportData.gender)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={styles.detailValue}>{formatPassportDate(passportData.dateOfExpiry)}</Text>
          </View>
        </View>

          <View style={styles.bottomButtons}>
            <Button title="Continue" onPress={handleComplete} size="lg" />
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render error step
  const renderError = () => (
    <View style={styles.flex}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Verification Failed</Text>
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.errorIconContainer}>
          <Text style={styles.errorIconText}>!</Text>
        </View>

        <Text style={styles.title}>Something Went Wrong</Text>

        <Text style={styles.errorMessage}>{error || 'An unexpected error occurred.'}</Text>

        <View style={styles.bottomButtons}>
          <Button title="Try Again" onPress={handleRetry} size="lg" />
          {onCancel && (
            <Button title="Cancel" onPress={onCancel} variant="ghost" size="lg" style={styles.cancelButton} />
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'intro':
        return renderIntro();
      case 'mrz-scan':
        return renderMRZScan();
      case 'mrz-input':
        return renderMRZInput();
      case 'nfc-read':
        return renderNFCRead();
      case 'success':
        return renderSuccess();
      case 'error':
        return renderError();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={step === 'mrz-scan' ? [] : ['top', 'bottom']}>
      {renderStep()}
    </SafeAreaView>
  );
}

// Exported wrapper that provides SafeAreaProvider context
export function IDVerificationScreen(props: IDVerificationScreenProps) {
  return (
    <SafeAreaProvider>
      <IDVerificationScreenInner {...props} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#ffffff',
  },
  screenHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  screenHeaderBack: {
    position: 'absolute',
    left: 16,
    padding: 8,
  },
  screenHeaderBackText: {
    fontSize: 16,
    color: '#1976D2',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  stepsList: {
    marginBottom: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  bottomButtons: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  cancelButton: {
    marginTop: 12,
  },

  // Camera scan styles
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  scanHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  mrzExampleContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mrzExampleLabel: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mrzExampleBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  mrzExampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#000000',
    letterSpacing: 0.5,
  },
  scanBackButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  scanBackText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanGuideContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  scanGuide: {
    width: 320,
    height: 120,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanGuideText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanBottom: {
    alignItems: 'center',
  },
  scanStatusContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 16,
  },
  scanStatusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  manualEntryButton: {
    padding: 12,
  },
  manualEntryText: {
    color: '#ffffff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  // MRZ Input styles
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    textAlign: 'center',
  },
  dateInputYear: {
    flex: 1.5,
    textAlign: 'center',
  },
  dateSeparator: {
    fontSize: 20,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    fontSize: 14,
    color: '#DC2626',
  },

  // NFC Read styles
  nfcIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  nfcIcon: {
    fontSize: 56,
  },
  nfcDiagram: {
    alignItems: 'center',
    marginVertical: 24,
  },
  phoneIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneEmoji: {
    fontSize: 32,
  },
  nfcArrow: {
    fontSize: 32,
    color: '#1976D2',
    marginVertical: 8,
  },
  passportIcon: {
    width: 80,
    height: 60,
    backgroundColor: '#1E3A5F',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passportEmoji: {
    fontSize: 32,
  },
  tipBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 22,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },

  // Success styles
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 40,
    color: '#ffffff',
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  passportPhoto: {
    width: 120,
    height: 150,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Error styles
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  errorIconText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
