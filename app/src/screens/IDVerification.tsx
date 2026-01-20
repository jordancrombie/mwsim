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
import {
  matchNames,
  type NameMatchResult,
  type FaceMatchResult,
  type LivenessResult,
  type SignedVerification,
  createVerificationResult,
  createSignedVerification,
  getVerificationLevel,
} from '../services/verification';
import {
  detectFace,
  detectFaceForLiveness,
  detectFaceFromBase64,
  compareFaces,
  validateFaceQuality,
  generateLivenessChallenges,
  checkLivenessChallenge,
  getChallengeInstruction,
  type FaceData,
  type LivenessChallenge,
} from '../services/faceDetection';

// Re-export for consumers
export type { NameMatchResult, FaceMatchResult, LivenessResult } from '../services/verification';
export type { SignedVerification, VerificationResult } from '../services/verification';

type Step = 'intro' | 'mrz-scan' | 'mrz-input' | 'nfc-read' | 'name-verify' | 'photo-compare' | 'liveness' | 'success' | 'error';

/** Result of the complete verification flow */
export interface VerificationFlowResult {
  passportData: PassportData;
  nameMatch: NameMatchResult;
  faceMatch?: FaceMatchResult;
  liveness?: LivenessResult;
  /** Signed verification payload ready for API submission */
  signedVerification: SignedVerification;
}

interface IDVerificationScreenProps {
  /** User's profile display name (for name matching) */
  profileDisplayName: string;
  /** User's profile image URL (for face comparison) */
  profileImageUrl?: string | null;
  /** Called when verification completes successfully with all results */
  onComplete?: (result: VerificationFlowResult) => void;
  /** Called when user cancels verification */
  onCancel?: () => void;
}

// Inner component that uses the safe area hook (must be inside SafeAreaProvider)
function IDVerificationScreenInner({ profileDisplayName, profileImageUrl, onComplete, onCancel }: IDVerificationScreenProps) {
  const [step, setStep] = useState<Step>('intro');
  const [mrzData, setMrzData] = useState<MRZData | null>(null);
  const [passportData, setPassportData] = useState<PassportData | null>(null);
  const [nameMatchResult, setNameMatchResult] = useState<NameMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Position passport in view');

  // Face comparison state
  const [faceCompareStatus, setFaceCompareStatus] = useState<string>('');
  const [passportFace, setPassportFace] = useState<FaceData | null>(null);
  const [profileFace, setProfileFace] = useState<FaceData | null>(null);
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [faceMatchPassed, setFaceMatchPassed] = useState<boolean | null>(null);

  // Liveness state
  const [livenessChallenges, setLivenessChallenges] = useState<LivenessChallenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<LivenessChallenge[]>([]);
  const [livenessStartTime, setLivenessStartTime] = useState<number | null>(null);
  const [currentFace, setCurrentFace] = useState<FaceData | null>(null);
  const [previousFace, setPreviousFace] = useState<FaceData | null>(null);
  const livenessCameraRef = useRef<CameraView>(null);
  const livenessIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Perform name matching
      const matchResult = matchNames(
        data.firstName,
        data.lastName,
        profileDisplayName
      );
      setNameMatchResult(matchResult);

      // Go to name verification step
      setStep('name-verify');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to read passport';
      if (errorMessage !== 'Scan cancelled') {
        setError(errorMessage);
        setStep('error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [mrzData, profileDisplayName]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setError(null);
    setMrzData(null);
    setPassportData(null);
    setNameMatchResult(null);
    // Reset face comparison state
    setFaceCompareStatus('');
    setPassportFace(null);
    setProfileFace(null);
    setFaceMatchScore(null);
    setFaceMatchPassed(null);
    // Reset liveness state
    setLivenessChallenges([]);
    setCurrentChallengeIndex(0);
    setCompletedChallenges([]);
    setLivenessStartTime(null);
    setCurrentFace(null);
    setPreviousFace(null);
    setStep('intro');
  }, []);

  // Handle complete - creates signed verification and calls onComplete
  const handleComplete = useCallback(async () => {
    if (!passportData || !nameMatchResult || !onComplete) return;

    setIsProcessing(true);

    try {
      // Build face match result if face comparison was done
      let faceMatch: FaceMatchResult | undefined;
      if (faceMatchScore !== null && faceMatchPassed !== null) {
        console.log('[Verification] Building face match result:', {
          score: faceMatchScore,
          passed: faceMatchPassed,
          passportFaceDetected: passportFace !== null,
          profileFaceDetected: profileFace !== null,
        });
        faceMatch = {
          score: faceMatchScore,
          passed: faceMatchPassed,
          passportFaceDetected: passportFace !== null,
          profileFaceDetected: profileFace !== null,
          selfieFaceDetected: false, // Not using selfie yet
        };
      }

      // Build liveness result if liveness check was done
      // IMPORTANT: Use refs for liveness data to avoid stale closure issues
      // The setTimeout in processLivenessFrame can capture old state values
      let liveness: LivenessResult | undefined;
      const completedFromRef = completedChallengesRef.current;
      if (completedFromRef.length > 0 && livenessStartTime) {
        const duration = (Date.now() - livenessStartTime) / 1000;
        const passed = completedFromRef.length >= livenessChallenges.length;
        console.log('[Verification] Building liveness result:', {
          completedChallenges: completedFromRef.length,
          totalChallenges: livenessChallenges.length,
          passed,
        });
        liveness = {
          passed,
          challenges: completedFromRef,
          duration,
        };
      }

      // Create verification result
      const documentType = 'PASSPORT';
      const issuingCountry = passportData.nationality || 'UNK';
      const verificationResult = createVerificationResult(
        nameMatchResult,
        documentType,
        issuingCountry,
        faceMatch,
        liveness
      );

      // Log the verification result for debugging
      console.log('[Verification] Created verification result:', {
        nameMatch: {
          score: verificationResult.nameMatch.score,
          passed: verificationResult.nameMatch.passed,
        },
        faceMatch: verificationResult.faceMatch ? {
          score: verificationResult.faceMatch.score,
          passed: verificationResult.faceMatch.passed,
        } : 'none',
        livenessCheck: verificationResult.livenessCheck ? {
          passed: verificationResult.livenessCheck.passed,
          challengesCompleted: verificationResult.livenessCheck.challenges.length,
        } : 'none',
        expectedLevel: getVerificationLevel(verificationResult),
      });

      // Sign the verification result
      const signedVerification = await createSignedVerification(verificationResult);

      // Call onComplete with full result
      onComplete({
        passportData,
        nameMatch: nameMatchResult,
        faceMatch,
        liveness,
        signedVerification,
      });
    } catch (error) {
      console.error('[IDVerification] Error creating signed verification:', error);
      setError('Failed to complete verification. Please try again.');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  }, [
    passportData,
    nameMatchResult,
    onComplete,
    faceMatchScore,
    faceMatchPassed,
    passportFace,
    profileFace,
    completedChallenges,
    livenessStartTime,
    livenessChallenges.length,
  ]);

  // Handle proceeding from name-verify to photo-compare (or success if no profile image)
  const handleNameVerifyProceed = useCallback(() => {
    if (profileImageUrl && passportData?.photo?.base64) {
      // Has profile image and passport photo - do face comparison
      setStep('photo-compare');
    } else {
      // No profile image or passport photo - skip to success (basic verification only)
      handleComplete();
    }
  }, [profileImageUrl, passportData, handleComplete]);

  // Handle face comparison
  const handleFaceCompare = useCallback(async () => {
    if (!passportData?.photo?.base64 || !profileImageUrl) return;

    setIsProcessing(true);
    setFaceCompareStatus('Analyzing passport photo...');

    try {
      // Detect face in passport photo
      const ppFace = await detectFaceFromBase64(passportData.photo.base64);
      if (!ppFace) {
        setFaceCompareStatus('Could not detect face in passport photo');
        setFaceMatchPassed(false);
        setIsProcessing(false);
        return;
      }
      setPassportFace(ppFace);
      setFaceCompareStatus('Analyzing profile photo...');

      // Detect face in profile photo
      const prFace = await detectFace(profileImageUrl);
      if (!prFace) {
        setFaceCompareStatus('Could not detect face in profile photo');
        setFaceMatchPassed(false);
        setIsProcessing(false);
        return;
      }
      setProfileFace(prFace);
      setFaceCompareStatus('Comparing faces...');

      // Compare faces
      const result = compareFaces(ppFace, prFace);
      setFaceMatchScore(result.similarity);
      setFaceMatchPassed(result.passed);
      setFaceCompareStatus(result.passed ? 'Faces match!' : 'Faces do not match');
    } catch (err) {
      console.error('[IDVerification] Face comparison error:', err);
      setFaceCompareStatus('Error comparing faces');
      setFaceMatchPassed(false);
    } finally {
      setIsProcessing(false);
    }
  }, [passportData, profileImageUrl]);

  // Handle proceeding from photo-compare
  const handlePhotoCompareProceed = useCallback(() => {
    if (faceMatchPassed) {
      // Face match passed - proceed to liveness
      setLivenessChallenges(generateLivenessChallenges(3));
      setCurrentChallengeIndex(0);
      setCompletedChallenges([]);
      setStep('liveness');
    } else {
      // Face match failed - show error
      setError('Face comparison failed. Please ensure your profile photo clearly shows your face and matches your passport photo.');
      setStep('error');
    }
  }, [faceMatchPassed]);

  // Handle liveness challenge completion
  const handleLivenessComplete = useCallback(() => {
    // All challenges completed - verification success
    handleComplete();
  }, [handleComplete]);

  // Skip face comparison (for users without profile photo)
  const handleSkipFaceCompare = useCallback(() => {
    // Skip to success - basic verification only
    handleComplete();
  }, [handleComplete]);

  // Handle name mismatch - user can cancel or retry
  const handleNameMismatch = useCallback(() => {
    setError('The name on your passport does not match your profile. Please update your profile name to match your passport, or contact support.');
    setStep('error');
  }, []);

  // Liveness detection state
  const [livenessStatus, setLivenessStatus] = useState<string>('Position your face in the frame');
  const [livenessActive, setLivenessActive] = useState(false);
  const [livenessCameraReady, setLivenessCameraReady] = useState(false);
  const isProcessingLiveness = useRef(false);
  const livenessCompletedRef = useRef(false); // Guard against multiple completion calls

  // Use refs for values that change frequently to avoid callback recreation
  const currentFaceRef = useRef<FaceData | null>(null);
  const previousFaceRef = useRef<FaceData | null>(null);
  const completedChallengesRef = useRef<LivenessChallenge[]>([]);
  const currentChallengeIndexRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    currentFaceRef.current = currentFace;
  }, [currentFace]);
  useEffect(() => {
    previousFaceRef.current = previousFace;
  }, [previousFace]);
  useEffect(() => {
    completedChallengesRef.current = completedChallenges;
  }, [completedChallenges]);
  useEffect(() => {
    currentChallengeIndexRef.current = currentChallengeIndex;
  }, [currentChallengeIndex]);

  // Process a single liveness frame - uses refs to avoid recreation on every state change
  const processLivenessFrame = useCallback(async () => {
    if (isProcessingLiveness.current) {
      return;
    }
    if (!livenessCameraRef.current) {
      console.log('[Liveness] Camera ref not available yet');
      return;
    }

    const challengeIndex = currentChallengeIndexRef.current;
    if (challengeIndex >= livenessChallenges.length) return;

    isProcessingLiveness.current = true;

    try {
      // Capture a frame from the camera
      console.log('[Liveness] Capturing frame...');
      const photo = await livenessCameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
        skipProcessing: false, // Ensure image is rotated correctly
      });

      if (!photo?.uri) {
        console.log('[Liveness] No photo URI returned');
        isProcessingLiveness.current = false;
        return;
      }

      console.log('[Liveness] Photo captured:', photo.uri);
      console.log('[Liveness] Photo dimensions:', photo.width, 'x', photo.height);
      console.log('[Liveness] Photo EXIF:', JSON.stringify(photo.exif, null, 2)?.substring(0, 500));

      // Detect face using liveness-optimized settings (fast mode)
      const face = await detectFaceForLiveness(photo.uri);

      if (!face) {
        setLivenessStatus('No face detected - position your face in the frame');
        setCurrentFace(null);
        isProcessingLiveness.current = false;
        return;
      }

      // Update face state for tracking between frames (using refs for comparison)
      const prevFace = currentFaceRef.current;
      setPreviousFace(prevFace);
      setCurrentFace(face);

      // Get current challenge
      const challenge = livenessChallenges[challengeIndex];

      // Check if challenge is completed (use ref for previous face)
      const passed = checkLivenessChallenge(challenge, face, prevFace || undefined);

      if (passed) {
        // Challenge completed!
        console.log(`[Liveness] Challenge ${challenge} completed!`);
        const currentCompleted = completedChallengesRef.current;
        const newCompleted = [...currentCompleted, challenge];
        // Update ref immediately (state will sync via effect, but ref is used by handleComplete)
        completedChallengesRef.current = newCompleted;
        setCompletedChallenges(newCompleted);

        if (challengeIndex + 1 >= livenessChallenges.length) {
          // All challenges done! Guard against multiple completion triggers
          if (livenessCompletedRef.current) {
            console.log('[Liveness] Already completed, ignoring duplicate');
            return;
          }
          livenessCompletedRef.current = true;

          // Stop the interval immediately to prevent further processing
          if (livenessIntervalRef.current) {
            clearInterval(livenessIntervalRef.current);
            livenessIntervalRef.current = null;
          }

          setLivenessStatus('All challenges completed!');
          setLivenessActive(false);
          // Short delay then complete
          setTimeout(() => {
            handleLivenessComplete();
          }, 500);
        } else {
          // Move to next challenge
          setCurrentChallengeIndex(challengeIndex + 1);
          setLivenessStatus('Great! Next challenge...');
        }
      } else {
        // Still working on current challenge
        setLivenessStatus(getChallengeInstruction(challenge));
      }
    } catch (err) {
      console.error('[Liveness] Frame processing error:', err);
      setLivenessStatus('Processing error - please try again');
    } finally {
      isProcessingLiveness.current = false;
    }
  }, [livenessChallenges, handleLivenessComplete]);

  // Ref to hold the latest processLivenessFrame callback
  const processLivenessFrameRef = useRef(processLivenessFrame);
  useEffect(() => {
    processLivenessFrameRef.current = processLivenessFrame;
  }, [processLivenessFrame]);

  // Start/stop liveness detection when entering/leaving liveness step
  useEffect(() => {
    if (step === 'liveness' && livenessChallenges.length > 0) {
      // Reset completion guard for new liveness session
      livenessCompletedRef.current = false;

      // Start detection after a delay to let camera initialize
      console.log('[Liveness] Starting detection (with 1s camera init delay)...');
      setLivenessActive(true);
      setLivenessStartTime(Date.now());
      setLivenessStatus('Initializing camera...');

      // Wait for camera to initialize before starting capture loop
      const initTimeout = setTimeout(() => {
        console.log('[Liveness] Camera init delay complete, starting capture loop');
        setLivenessStatus(getChallengeInstruction(livenessChallenges[0]));

        // Start capture loop (every 500ms) - use ref to avoid dependency on processLivenessFrame
        livenessIntervalRef.current = setInterval(() => {
          processLivenessFrameRef.current();
        }, 500);
      }, 1000); // 1 second delay for camera initialization

      return () => {
        console.log('[Liveness] Stopping detection...');
        clearTimeout(initTimeout);
        if (livenessIntervalRef.current) {
          clearInterval(livenessIntervalRef.current);
          livenessIntervalRef.current = null;
        }
        setLivenessActive(false);
        setLivenessCameraReady(false);
      };
    }
  }, [step, livenessChallenges]); // Removed processLivenessFrame - using ref instead

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

  // Render name verification step
  const renderNameVerify = () => {
    if (!passportData || !nameMatchResult) return null;

    const { firstName, lastName, passed, score } = nameMatchResult;

    return (
      <View style={styles.flex}>
        <View style={styles.screenHeader}>
          {onCancel && (
            <TouchableOpacity style={styles.screenHeaderBack} onPress={onCancel}>
              <Text style={styles.screenHeaderBackText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.screenHeaderTitle}>Name Verification</Text>
        </View>
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
          {/* Status icon */}
          <View style={[styles.nameVerifyIconContainer, passed ? styles.nameVerifyIconSuccess : styles.nameVerifyIconFail]}>
            <Text style={styles.nameVerifyIcon}>{passed ? '\u2713' : '!'}</Text>
          </View>

          <Text style={styles.title}>
            {passed ? 'Name Matches' : 'Name Mismatch'}
          </Text>

          <Text style={styles.description}>
            {passed
              ? 'Your passport name matches your profile.'
              : 'The name on your passport does not match your profile name.'}
          </Text>

          {/* Comparison card */}
          <View style={styles.nameCompareCard}>
            {/* First Name Row */}
            <View style={styles.nameCompareRow}>
              <View style={styles.nameCompareLabel}>
                <Text style={styles.nameCompareLabelText}>First Name</Text>
              </View>
              <View style={styles.nameCompareValues}>
                <View style={styles.nameCompareValue}>
                  <Text style={styles.nameCompareSource}>Passport</Text>
                  <Text style={styles.nameCompareText}>{firstName.passport}</Text>
                </View>
                <View style={[styles.nameCompareStatus, firstName.match ? styles.nameCompareMatch : styles.nameCompareMismatch]}>
                  <Text style={styles.nameCompareStatusText}>{firstName.match ? '\u2713' : '\u2717'}</Text>
                </View>
                <View style={styles.nameCompareValue}>
                  <Text style={styles.nameCompareSource}>Profile</Text>
                  <Text style={styles.nameCompareText}>{firstName.profile || '(empty)'}</Text>
                </View>
              </View>
              <Text style={styles.nameCompareScore}>
                {Math.round(firstName.score * 100)}% match
              </Text>
            </View>

            <View style={styles.nameCompareDivider} />

            {/* Last Name Row */}
            <View style={styles.nameCompareRow}>
              <View style={styles.nameCompareLabel}>
                <Text style={styles.nameCompareLabelText}>Last Name</Text>
              </View>
              <View style={styles.nameCompareValues}>
                <View style={styles.nameCompareValue}>
                  <Text style={styles.nameCompareSource}>Passport</Text>
                  <Text style={styles.nameCompareText}>{lastName.passport}</Text>
                </View>
                <View style={[styles.nameCompareStatus, lastName.match ? styles.nameCompareMatch : styles.nameCompareMismatch]}>
                  <Text style={styles.nameCompareStatusText}>{lastName.match ? '\u2713' : '\u2717'}</Text>
                </View>
                <View style={styles.nameCompareValue}>
                  <Text style={styles.nameCompareSource}>Profile</Text>
                  <Text style={styles.nameCompareText}>{lastName.profile || '(empty)'}</Text>
                </View>
              </View>
              <Text style={styles.nameCompareScore}>
                {Math.round(lastName.score * 100)}% match
              </Text>
            </View>
          </View>

          {/* Overall score */}
          <View style={styles.overallScoreContainer}>
            <Text style={styles.overallScoreLabel}>Overall Match Score</Text>
            <Text style={[styles.overallScoreValue, passed ? styles.overallScorePass : styles.overallScoreFail]}>
              {Math.round(score * 100)}%
            </Text>
            <Text style={styles.overallScoreThreshold}>
              (85% required to pass)
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.bottomButtons}>
            {passed ? (
              <Button title="Continue" onPress={handleNameVerifyProceed} size="lg" />
            ) : (
              <>
                <TouchableOpacity style={styles.cancelVerificationButton} onPress={handleNameMismatch}>
                  <Text style={styles.cancelVerificationButtonText}>Cancel Verification</Text>
                </TouchableOpacity>
                <Button title="Try Again" onPress={handleRetry} variant="ghost" size="lg" style={styles.cancelButton} />
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render photo comparison step
  const renderPhotoCompare = () => {
    if (!passportData?.photo?.base64) return null;

    return (
      <View style={styles.flex}>
        <View style={styles.screenHeader}>
          {onCancel && (
            <TouchableOpacity style={styles.screenHeaderBack} onPress={onCancel}>
              <Text style={styles.screenHeaderBackText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.screenHeaderTitle}>Face Comparison</Text>
        </View>
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
          <Text style={styles.title}>Comparing Photos</Text>
          <Text style={styles.description}>
            We're comparing your passport photo with your profile photo to verify your identity.
          </Text>

          {/* Photo comparison display */}
          <View style={styles.photoCompareContainer}>
            <View style={styles.photoCompareItem}>
              <Text style={styles.photoCompareLabel}>Passport</Text>
              <Image
                source={{ uri: passportData.photo.base64 }}
                style={styles.photoCompareImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.photoCompareArrow}>
              <Text style={styles.photoCompareArrowText}>vs</Text>
            </View>
            <View style={styles.photoCompareItem}>
              <Text style={styles.photoCompareLabel}>Profile</Text>
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={styles.photoCompareImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.photoCompareImage, styles.photoComparePlaceholder]}>
                  <Text style={styles.photoComparePlaceholderText}>No Photo</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status display */}
          {faceCompareStatus && (
            <View style={styles.faceCompareStatusContainer}>
              <Text style={styles.faceCompareStatusText}>{faceCompareStatus}</Text>
            </View>
          )}

          {/* Match score display (when complete) */}
          {faceMatchScore !== null && (
            <View style={styles.overallScoreContainer}>
              <Text style={styles.overallScoreLabel}>Face Match Score</Text>
              <Text style={[styles.overallScoreValue, faceMatchPassed ? styles.overallScorePass : styles.overallScoreFail]}>
                {Math.round(faceMatchScore * 100)}%
              </Text>
              <Text style={styles.overallScoreThreshold}>
                (70% required to pass)
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.bottomButtons}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#1976D2" />
                <Text style={styles.processingText}>{faceCompareStatus || 'Processing...'}</Text>
              </View>
            ) : faceMatchScore === null ? (
              <>
                <Button title="Compare Faces" onPress={handleFaceCompare} size="lg" />
                <Button
                  title="Skip (Basic Verification Only)"
                  onPress={handleSkipFaceCompare}
                  variant="ghost"
                  size="lg"
                  style={styles.cancelButton}
                />
              </>
            ) : (
              <>
                <Button
                  title={faceMatchPassed ? "Continue to Liveness Check" : "Try Again"}
                  onPress={faceMatchPassed ? handlePhotoCompareProceed : handleFaceCompare}
                  size="lg"
                />
                {!faceMatchPassed && (
                  <Button
                    title="Skip Face Check"
                    onPress={handleSkipFaceCompare}
                    variant="ghost"
                    size="lg"
                    style={styles.cancelButton}
                  />
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render liveness check step
  const renderLiveness = () => {
    const progress = completedChallenges.length;
    const total = livenessChallenges.length;

    return (
      <View style={StyleSheet.absoluteFill}>
        {/* Front-facing camera for selfie */}
        <CameraView
          ref={livenessCameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mirror={true}
          onCameraReady={() => {
            console.log('[Liveness] Camera ready');
            setLivenessCameraReady(true);
          }}
        />

        {/* Overlay */}
        <View style={styles.livenessOverlay}>
          {/* Header */}
          <View style={[styles.livenessHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.scanBackButton}
            >
              <Text style={styles.scanBackText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.livenessHeaderTitle}>Liveness Check</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Progress indicator at top */}
          <View style={styles.livenessProgressOverlay}>
            <Text style={styles.livenessProgressTextWhite}>
              Challenge {progress + 1} of {total}
            </Text>
            <View style={styles.livenessProgressBarOverlay}>
              <View style={[styles.livenessProgressFillOverlay, { width: `${(progress / total) * 100}%` }]} />
            </View>
          </View>

          {/* Face guide oval */}
          <View style={styles.livenessFaceGuide}>
            <View style={styles.livenessFaceOval} />
          </View>

          {/* Bottom section with challenge instruction */}
          <View style={[styles.livenessBottom, { paddingBottom: insets.bottom + 20 }]}>
            {/* Challenge instruction */}
            <View style={styles.livenessChallengeOverlay}>
              <Text style={styles.livenessChallengeTextOverlay}>
                {livenessStatus}
              </Text>
            </View>

            {/* Status indicator */}
            {livenessActive && (
              <View style={styles.livenessActiveIndicator}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.livenessActiveText}>Detecting...</Text>
              </View>
            )}

            {/* Skip button */}
            <TouchableOpacity
              style={styles.livenessSkipButton}
              onPress={handleSkipFaceCompare}
            >
              <Text style={styles.livenessSkipText}>Skip (Basic Verification Only)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
      case 'name-verify':
        return renderNameVerify();
      case 'photo-compare':
        return renderPhotoCompare();
      case 'liveness':
        return renderLiveness();
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

  // Name verification styles
  nameVerifyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  nameVerifyIconSuccess: {
    backgroundColor: '#10B981',
  },
  nameVerifyIconFail: {
    backgroundColor: '#FEE2E2',
  },
  nameVerifyIcon: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: '700',
  },
  nameCompareCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  nameCompareRow: {
    marginBottom: 8,
  },
  nameCompareLabel: {
    marginBottom: 8,
  },
  nameCompareLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  nameCompareValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameCompareValue: {
    flex: 1,
    alignItems: 'center',
  },
  nameCompareSource: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  nameCompareText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  nameCompareStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  nameCompareMatch: {
    backgroundColor: '#10B981',
  },
  nameCompareMismatch: {
    backgroundColor: '#EF4444',
  },
  nameCompareStatusText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
  nameCompareScore: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  nameCompareDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  overallScoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  overallScoreLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  overallScoreValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  overallScorePass: {
    color: '#10B981',
  },
  overallScoreFail: {
    color: '#EF4444',
  },
  overallScoreThreshold: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  cancelVerificationButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelVerificationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Photo comparison styles
  photoCompareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  photoCompareItem: {
    alignItems: 'center',
  },
  photoCompareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  photoCompareImage: {
    width: 100,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  photoComparePlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoComparePlaceholderText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  photoCompareArrow: {
    marginHorizontal: 16,
  },
  photoCompareArrowText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  faceCompareStatusContainer: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  faceCompareStatusText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },

  // Liveness check styles
  livenessProgressContainer: {
    marginBottom: 24,
  },
  livenessProgressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  livenessProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  livenessProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  livenessChallengeContainer: {
    backgroundColor: '#EFF6FF',
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  livenessChallengeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976D2',
    textAlign: 'center',
  },
  livenessCameraPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  livenessCameraPlaceholderText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  livenessCameraPlaceholderSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Liveness camera overlay styles
  livenessOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  livenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  livenessHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  livenessProgressOverlay: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  livenessProgressTextWhite: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  livenessProgressBarOverlay: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  livenessProgressFillOverlay: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  livenessFaceGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livenessFaceOval: {
    width: 250,
    height: 320,
    borderRadius: 125,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderStyle: 'dashed',
  },
  livenessBottom: {
    paddingHorizontal: 24,
  },
  livenessChallengeOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  livenessChallengeTextOverlay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  livenessActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  livenessActiveText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  livenessSkipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  livenessSkipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
});
