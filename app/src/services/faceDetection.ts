/**
 * Face Detection Service
 *
 * Uses ML Kit to detect faces in images and compare them.
 * Used for identity verification by comparing passport photo to profile photo.
 */

import FaceDetection, {
  FaceDetectionOptions,
  Face,
} from '@react-native-ml-kit/face-detection';
import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// ============================================================================
// Types
// ============================================================================

export interface FaceData {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    nose?: { x: number; y: number };
    leftMouth?: { x: number; y: number };
    rightMouth?: { x: number; y: number };
    bottomMouth?: { x: number; y: number };
    leftCheek?: { x: number; y: number };
    rightCheek?: { x: number; y: number };
    leftEar?: { x: number; y: number };
    rightEar?: { x: number; y: number };
  };
  smilingProbability: number | null;
  leftEyeOpenProbability: number | null;
  rightEyeOpenProbability: number | null;
  headEulerAngleX: number; // Pitch (up/down)
  headEulerAngleY: number; // Yaw (left/right)
  headEulerAngleZ: number; // Roll (tilt)
}

export interface FaceQualityResult {
  valid: boolean;
  issues: string[];
  score: number; // 0-1 quality score
}

export interface FaceComparisonResult {
  similarity: number; // 0-1 similarity score
  passed: boolean;
  details: {
    eyeDistanceRatio: number;
    noseToMouthRatio: number;
    faceWidthRatio: number;
    overallGeometryScore: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const FACE_MATCH_THRESHOLD = 0.70; // 70% similarity required
const MIN_FACE_SIZE = 50; // Minimum face size in pixels
const MAX_HEAD_ROTATION = 30; // Maximum allowed head rotation in degrees

// ML Kit options for face detection (accurate mode for photo comparison)
const DETECTION_OPTIONS: FaceDetectionOptions = {
  performanceMode: 'accurate',
  landmarkMode: 'all',
  classificationMode: 'all',
  contourMode: 'none', // Contours not needed for comparison
  minFaceSize: 0.15, // Minimum face size as proportion of image
};

// ML Kit options for liveness detection (fast mode for real-time selfie camera)
const LIVENESS_DETECTION_OPTIONS: FaceDetectionOptions = {
  performanceMode: 'fast',
  landmarkMode: 'all',
  classificationMode: 'all',
  contourMode: 'none',
  minFaceSize: 0.1, // Lower threshold for selfie camera where face is larger
};

// ============================================================================
// Face Detection
// ============================================================================

/**
 * Convert ML Kit Face to our FaceData format
 */
function convertToFaceData(face: Face): FaceData {
  return {
    bounds: {
      x: face.frame.left,
      y: face.frame.top,
      width: face.frame.width,
      height: face.frame.height,
    },
    landmarks: {
      leftEye: face.landmarks?.leftEye
        ? { x: face.landmarks.leftEye.position.x, y: face.landmarks.leftEye.position.y }
        : undefined,
      rightEye: face.landmarks?.rightEye
        ? { x: face.landmarks.rightEye.position.x, y: face.landmarks.rightEye.position.y }
        : undefined,
      nose: face.landmarks?.noseBase
        ? { x: face.landmarks.noseBase.position.x, y: face.landmarks.noseBase.position.y }
        : undefined,
      leftMouth: face.landmarks?.mouthLeft
        ? { x: face.landmarks.mouthLeft.position.x, y: face.landmarks.mouthLeft.position.y }
        : undefined,
      rightMouth: face.landmarks?.mouthRight
        ? { x: face.landmarks.mouthRight.position.x, y: face.landmarks.mouthRight.position.y }
        : undefined,
      bottomMouth: face.landmarks?.mouthBottom
        ? { x: face.landmarks.mouthBottom.position.x, y: face.landmarks.mouthBottom.position.y }
        : undefined,
      leftCheek: face.landmarks?.leftCheek
        ? { x: face.landmarks.leftCheek.position.x, y: face.landmarks.leftCheek.position.y }
        : undefined,
      rightCheek: face.landmarks?.rightCheek
        ? { x: face.landmarks.rightCheek.position.x, y: face.landmarks.rightCheek.position.y }
        : undefined,
      leftEar: face.landmarks?.leftEar
        ? { x: face.landmarks.leftEar.position.x, y: face.landmarks.leftEar.position.y }
        : undefined,
      rightEar: face.landmarks?.rightEar
        ? { x: face.landmarks.rightEar.position.x, y: face.landmarks.rightEar.position.y }
        : undefined,
    },
    smilingProbability: face.smilingProbability ?? null,
    leftEyeOpenProbability: face.leftEyeOpenProbability ?? null,
    rightEyeOpenProbability: face.rightEyeOpenProbability ?? null,
    headEulerAngleX: face.rotationX ?? 0,
    headEulerAngleY: face.rotationY ?? 0,
    headEulerAngleZ: face.rotationZ ?? 0,
  };
}

/**
 * Detect faces in an image.
 * Returns the largest face found, or null if no face detected.
 */
export async function detectFace(imageUri: string): Promise<FaceData | null> {
  try {
    console.log('[FaceDetection] Detecting face in:', imageUri.substring(0, 50));

    const faces = await FaceDetection.detect(imageUri, DETECTION_OPTIONS);

    if (!faces || faces.length === 0) {
      console.log('[FaceDetection] No faces detected');
      return null;
    }

    console.log('[FaceDetection] Detected', faces.length, 'face(s)');

    // Return the largest face (most likely the main subject)
    const largestFace = faces.reduce((largest, current) => {
      const largestArea = largest.frame.width * largest.frame.height;
      const currentArea = current.frame.width * current.frame.height;
      return currentArea > largestArea ? current : largest;
    });

    return convertToFaceData(largestFace);
  } catch (error) {
    console.error('[FaceDetection] Error detecting face:', error);
    return null;
  }
}

/**
 * Detect face for liveness detection (uses fast mode optimized for selfie camera).
 * More lenient settings for real-time front camera detection.
 */
export async function detectFaceForLiveness(imageUri: string): Promise<FaceData | null> {
  try {
    console.log('[FaceDetection] Liveness detection in:', imageUri);

    // Normalize image orientation - front camera images often have EXIF rotation
    // that ML Kit doesn't handle correctly. This applies EXIF orientation to pixels.
    console.log('[FaceDetection] Normalizing image orientation...');
    const normalizedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [], // No transforms - just normalize EXIF orientation
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log('[FaceDetection] Normalized image:', normalizedImage.uri, normalizedImage.width, 'x', normalizedImage.height);

    const startTime = Date.now();
    const faces = await FaceDetection.detect(normalizedImage.uri, LIVENESS_DETECTION_OPTIONS);
    const elapsed = Date.now() - startTime;

    console.log('[FaceDetection] Liveness: ML Kit returned in', elapsed, 'ms');
    console.log('[FaceDetection] Liveness: Raw result type:', typeof faces, 'isArray:', Array.isArray(faces));
    console.log('[FaceDetection] Liveness: Raw result:', JSON.stringify(faces, null, 2).substring(0, 500));

    if (!faces || faces.length === 0) {
      console.log('[FaceDetection] Liveness: No faces detected (faces array empty or null)');
      return null;
    }

    console.log('[FaceDetection] Liveness: Detected', faces.length, 'face(s)');

    // Log first face details
    const firstFace = faces[0];
    console.log('[FaceDetection] Liveness: First face frame:', JSON.stringify(firstFace.frame));
    console.log('[FaceDetection] Liveness: First face rotationY (yaw):', firstFace.rotationY);
    console.log('[FaceDetection] Liveness: First face smilingProb:', firstFace.smilingProbability);

    // Return the largest face
    const largestFace = faces.reduce((largest, current) => {
      const largestArea = largest.frame.width * largest.frame.height;
      const currentArea = current.frame.width * current.frame.height;
      return currentArea > largestArea ? current : largest;
    });

    return convertToFaceData(largestFace);
  } catch (error) {
    console.error('[FaceDetection] Liveness detection error:', error);
    console.error('[FaceDetection] Liveness error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return null;
  }
}

/**
 * Detect face in a base64 image (for passport photos).
 * Writes to a temp file first since ML Kit requires file URIs, not data URIs.
 */
export async function detectFaceFromBase64(base64Data: string): Promise<FaceData | null> {
  let tempFile: File | null = null;

  try {
    // Strip data URI prefix if present to get raw base64
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Convert base64 to binary data
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create temp file in cache directory
    tempFile = new File(Paths.cache, `face_detect_${Date.now()}.jpg`);
    await tempFile.write(bytes);

    console.log('[FaceDetection] Wrote temp file:', tempFile.uri);

    // Detect face using the file URI
    const result = await detectFace(tempFile.uri);

    return result;
  } catch (error) {
    console.error('[FaceDetection] Error processing base64 image:', error);
    return null;
  } finally {
    // Clean up temp file
    if (tempFile) {
      try {
        await tempFile.delete();
      } catch {
        // Ignore deletion errors
      }
    }
  }
}

// ============================================================================
// Face Quality Validation
// ============================================================================

/**
 * Validate face quality for comparison.
 * Checks face size, orientation, and landmark detection.
 */
export function validateFaceQuality(face: FaceData): FaceQualityResult {
  const issues: string[] = [];
  let score = 1.0;

  // Check face size
  if (face.bounds.width < MIN_FACE_SIZE || face.bounds.height < MIN_FACE_SIZE) {
    issues.push('Face is too small');
    score -= 0.3;
  }

  // Check head rotation (pitch)
  if (Math.abs(face.headEulerAngleX) > MAX_HEAD_ROTATION) {
    issues.push('Head tilted too far up or down');
    score -= 0.2;
  }

  // Check head rotation (yaw)
  if (Math.abs(face.headEulerAngleY) > MAX_HEAD_ROTATION) {
    issues.push('Head turned too far left or right');
    score -= 0.2;
  }

  // Check head rotation (roll)
  if (Math.abs(face.headEulerAngleZ) > MAX_HEAD_ROTATION) {
    issues.push('Head tilted to the side');
    score -= 0.1;
  }

  // Check essential landmarks
  if (!face.landmarks.leftEye || !face.landmarks.rightEye) {
    issues.push('Eyes not clearly visible');
    score -= 0.3;
  }

  if (!face.landmarks.nose) {
    issues.push('Nose not clearly visible');
    score -= 0.2;
  }

  // Ensure score is between 0 and 1
  score = Math.max(0, Math.min(1, score));

  return {
    valid: issues.length === 0 && score >= 0.6,
    issues,
    score,
  };
}

// ============================================================================
// Face Comparison
// ============================================================================

/**
 * Calculate distance between two points
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate normalized ratio (accounts for face size differences)
 */
function normalizedRatio(value: number, faceWidth: number): number {
  return value / faceWidth;
}

/**
 * Compare two faces using geometric analysis of landmarks.
 *
 * Note: This is a simplified comparison using facial geometry ratios.
 * For production use, consider using a dedicated face recognition model.
 */
export function compareFaces(face1: FaceData, face2: FaceData): FaceComparisonResult {
  // Validate both faces have required landmarks
  const required1 = face1.landmarks.leftEye && face1.landmarks.rightEye && face1.landmarks.nose;
  const required2 = face2.landmarks.leftEye && face2.landmarks.rightEye && face2.landmarks.nose;

  if (!required1 || !required2) {
    return {
      similarity: 0,
      passed: false,
      details: {
        eyeDistanceRatio: 0,
        noseToMouthRatio: 0,
        faceWidthRatio: 0,
        overallGeometryScore: 0,
      },
    };
  }

  // Calculate normalized metrics for both faces
  const metrics1 = calculateFaceMetrics(face1);
  const metrics2 = calculateFaceMetrics(face2);

  // Compare metrics
  const eyeDistanceRatio = 1 - Math.abs(metrics1.eyeDistanceRatio - metrics2.eyeDistanceRatio);
  const nosePositionRatio = 1 - Math.abs(metrics1.nosePositionRatio - metrics2.nosePositionRatio);
  const faceAspectRatio = 1 - Math.abs(metrics1.faceAspectRatio - metrics2.faceAspectRatio);

  // Calculate mouth ratio if available
  let mouthRatio = 0.5; // Default if mouth not detected
  if (metrics1.mouthWidthRatio !== null && metrics2.mouthWidthRatio !== null) {
    mouthRatio = 1 - Math.abs(metrics1.mouthWidthRatio - metrics2.mouthWidthRatio);
  }

  // Weighted average of comparison scores
  const weights = {
    eyeDistance: 0.35,
    nosePosition: 0.25,
    faceAspect: 0.25,
    mouth: 0.15,
  };

  const overallGeometryScore =
    eyeDistanceRatio * weights.eyeDistance +
    nosePositionRatio * weights.nosePosition +
    faceAspectRatio * weights.faceAspect +
    mouthRatio * weights.mouth;

  // The similarity score is the geometry score
  // In a real implementation, this would be enhanced with deep learning
  const similarity = Math.max(0, Math.min(1, overallGeometryScore));

  return {
    similarity,
    passed: similarity >= FACE_MATCH_THRESHOLD,
    details: {
      eyeDistanceRatio,
      noseToMouthRatio: nosePositionRatio,
      faceWidthRatio: faceAspectRatio,
      overallGeometryScore,
    },
  };
}

/**
 * Calculate normalized face metrics for comparison
 */
function calculateFaceMetrics(face: FaceData): {
  eyeDistanceRatio: number;
  nosePositionRatio: number;
  faceAspectRatio: number;
  mouthWidthRatio: number | null;
} {
  const { landmarks, bounds } = face;
  const faceWidth = bounds.width;

  // Eye distance ratio (distance between eyes / face width)
  const eyeDistance = distance(landmarks.leftEye!, landmarks.rightEye!);
  const eyeDistanceRatio = normalizedRatio(eyeDistance, faceWidth);

  // Nose position ratio (vertical position of nose relative to face)
  const eyeCenter = {
    x: (landmarks.leftEye!.x + landmarks.rightEye!.x) / 2,
    y: (landmarks.leftEye!.y + landmarks.rightEye!.y) / 2,
  };
  const eyeToNoseDistance = distance(eyeCenter, landmarks.nose!);
  const nosePositionRatio = normalizedRatio(eyeToNoseDistance, bounds.height);

  // Face aspect ratio
  const faceAspectRatio = bounds.width / bounds.height;

  // Mouth width ratio (if mouth landmarks available)
  let mouthWidthRatio: number | null = null;
  if (landmarks.leftMouth && landmarks.rightMouth) {
    const mouthWidth = distance(landmarks.leftMouth, landmarks.rightMouth);
    mouthWidthRatio = normalizedRatio(mouthWidth, faceWidth);
  }

  return {
    eyeDistanceRatio,
    nosePositionRatio,
    faceAspectRatio,
    mouthWidthRatio,
  };
}

// ============================================================================
// Liveness Detection Helpers
// ============================================================================

export type LivenessChallenge = 'blink' | 'smile' | 'turn-left' | 'turn-right' | 'nod';

/**
 * Check if a specific liveness challenge is completed based on face data.
 */
export function checkLivenessChallenge(
  challenge: LivenessChallenge,
  face: FaceData,
  previousFace?: FaceData
): boolean {
  switch (challenge) {
    case 'blink':
      // Both eyes closed (probability < 0.3)
      return (
        face.leftEyeOpenProbability !== null &&
        face.rightEyeOpenProbability !== null &&
        face.leftEyeOpenProbability < 0.3 &&
        face.rightEyeOpenProbability < 0.3
      );

    case 'smile':
      // High smiling probability (> 0.7)
      return face.smilingProbability !== null && face.smilingProbability > 0.7;

    case 'turn-left':
      // Head turned left (yaw < -15 degrees)
      return face.headEulerAngleY < -15;

    case 'turn-right':
      // Head turned right (yaw > 15 degrees)
      return face.headEulerAngleY > 15;

    case 'nod':
      // Head pitched down (pitch > 10 degrees)
      // Requires previous frame to detect movement
      if (!previousFace) return false;
      const pitchChange = face.headEulerAngleX - previousFace.headEulerAngleX;
      return Math.abs(pitchChange) > 10;

    default:
      return false;
  }
}

/**
 * Get human-readable instruction for a liveness challenge
 */
export function getChallengeInstruction(challenge: LivenessChallenge): string {
  switch (challenge) {
    case 'blink':
      return 'Blink your eyes';
    case 'smile':
      return 'Smile';
    case 'turn-left':
      return 'Turn your head left';
    case 'turn-right':
      return 'Turn your head right';
    case 'nod':
      return 'Nod your head';
    default:
      return 'Follow the instruction';
  }
}

/**
 * Generate a random set of liveness challenges
 */
export function generateLivenessChallenges(count: number = 3): LivenessChallenge[] {
  const allChallenges: LivenessChallenge[] = ['blink', 'smile', 'turn-left', 'turn-right'];
  const shuffled = [...allChallenges].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
