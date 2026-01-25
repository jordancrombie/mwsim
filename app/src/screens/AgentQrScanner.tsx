/**
 * AgentQrScannerScreen - QR scanner for agent binding
 *
 * Alternative to manually sharing pairing codes.
 * Scans QR codes displayed by AI agents to initiate binding.
 * Part of SACP Phase 1 agent binding flow.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface AgentQrScannerScreenProps {
  onBack: () => void;
  onQrScanned: (data: AgentQrPayload) => void;
}

// Supported QR payload types for agent binding
export interface AgentQrPayload {
  type: 'pairing_code' | 'access_request' | 'agent_url';
  code?: string;        // For pairing_code type
  requestId?: string;   // For access_request type
  agentUrl?: string;    // For agent_url type (future)
  raw: string;          // Original scanned data
}

/**
 * Parse QR code data to determine payload type
 * Supports multiple formats:
 * - Plain pairing code (alphanumeric, typically 6-8 chars)
 * - JSON payload: { type: "pairing_code", code: "ABC123" }
 * - URL format: mwsim://pair/{code}
 * - Access request URL: mwsim://access-request/{requestId}
 */
function parseAgentQrData(data: string): AgentQrPayload | null {
  const trimmed = data.trim();

  // Try JSON format first
  try {
    const json = JSON.parse(trimmed);
    if (json.type === 'pairing_code' && json.code) {
      return { type: 'pairing_code', code: json.code, raw: data };
    }
    if (json.type === 'access_request' && json.requestId) {
      return { type: 'access_request', requestId: json.requestId, raw: data };
    }
  } catch {
    // Not JSON, continue to other formats
  }

  // Try URL format: mwsim://pair/{code}
  const pairMatch = trimmed.match(/^mwsim:\/\/pair\/([A-Za-z0-9]+)$/);
  if (pairMatch) {
    return { type: 'pairing_code', code: pairMatch[1], raw: data };
  }

  // Try URL format: mwsim://access-request/{requestId}
  const accessMatch = trimmed.match(/^mwsim:\/\/access-request\/([A-Za-z0-9_-]+)$/);
  if (accessMatch) {
    return { type: 'access_request', requestId: accessMatch[1], raw: data };
  }

  // Plain pairing code (alphanumeric, 4-12 characters)
  if (/^[A-Za-z0-9]{4,12}$/.test(trimmed)) {
    return { type: 'pairing_code', code: trimmed.toUpperCase(), raw: data };
  }

  // Unknown format
  return null;
}

export const AgentQrScannerScreen: React.FC<AgentQrScannerScreenProps> = ({
  onBack,
  onQrScanned,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scanLockRef = useRef(false);

  // Request permission on mount if not determined
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    // Prevent duplicate scans
    if (scanLockRef.current || scanned) return;
    scanLockRef.current = true;
    setScanned(true);

    console.log('[AgentQrScanner] Scanned:', data);

    const payload = parseAgentQrData(data);

    if (!payload) {
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not recognized as an agent binding code. Please make sure you are scanning the correct QR code from your AI agent.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanned(false);
              scanLockRef.current = false;
            },
          },
          { text: 'Cancel', onPress: onBack },
        ]
      );
      return;
    }

    console.log('[AgentQrScanner] Parsed payload:', payload);
    onQrScanned(payload);
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan Agent QR</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.statusText}>Checking camera permission...</Text>
        </View>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan Agent QR</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            To scan agent QR codes, please allow camera access in your device settings.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan Agent QR</Text>
        <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={styles.torchButton}>
          <Text style={styles.torchButtonText}>{torchOn ? '🔦' : '💡'}</Text>
        </TouchableOpacity>
      </View>

      {/* Camera view */}
      <View style={styles.cameraContainer}>
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          enableTorch={torchOn}
        />

        {/* Scanning frame overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              Point your camera at the QR code displayed by your AI agent
            </Text>
          </View>
        </View>

        {/* Scanning indicator */}
        {scanned && (
          <View style={styles.scanningIndicator}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.scanningText}>Processing...</Text>
          </View>
        )}
      </View>

      {/* Info footer */}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>How it works</Text>
        <Text style={styles.footerText}>
          1. Share your pairing code with the AI agent{'\n'}
          2. The agent will display a QR code{'\n'}
          3. Scan it here to confirm the connection
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#000',
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 17,
    color: '#fff',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  torchButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  torchButtonText: {
    fontSize: 24,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F7FA',
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 280,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderWidth: 0,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#1976D2',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  overlayBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingTop: 24,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scanningIndicator: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
  },
  footer: {
    padding: 20,
    backgroundColor: '#111',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
  },
});

export default AgentQrScannerScreen;
