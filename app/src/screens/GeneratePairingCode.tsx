/**
 * GeneratePairingCodeScreen - Generate pairing code for AI agent binding
 *
 * Generates a short-lived pairing code that users share with their AI agent.
 * The agent uses this code to initiate an access request.
 * Part of SACP Phase 1 agent binding flow.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import { agentApi } from '../services/agent-api';
import type { PairingCodeResponse } from '../types/agent';

interface GeneratePairingCodeScreenProps {
  onBack: () => void;
  onCodeUsed?: () => void; // Called when user confirms agent has used the code
}

// Format remaining time as MM:SS
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const GeneratePairingCodeScreen: React.FC<GeneratePairingCodeScreenProps> = ({
  onBack,
  onCodeUsed,
}) => {
  const [pairingCode, setPairingCode] = useState<PairingCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await agentApi.generatePairingCode();
      setPairingCode(response);

      // Calculate initial time remaining
      const expiresAt = new Date(response.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);
    } catch (err: any) {
      console.error('[GeneratePairingCode] Error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate code on mount
  useEffect(() => {
    generateCode();
  }, [generateCode]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pairingCode]); // Reset timer when new code is generated

  const handleCopyCode = () => {
    if (pairingCode?.code) {
      Clipboard.setString(pairingCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateCode = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    generateCode();
  };

  const isExpired = timeRemaining === 0 && pairingCode !== null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add AI Agent</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Loading state */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.loadingText}>Generating pairing code...</Text>
          </View>
        )}

        {/* Error state */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={generateCode}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Code display */}
        {pairingCode && !loading && !error && (
          <View style={styles.codeContainer}>
            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsIcon}>🤖</Text>
              <Text style={styles.instructionsTitle}>Share this code with your AI agent</Text>
              <Text style={styles.instructionsText}>
                Give this pairing code to the AI agent you want to connect. The agent will use it to request access to your wallet.
              </Text>
            </View>

            {/* Pairing code display */}
            <View style={[styles.codeBox, isExpired && styles.codeBoxExpired]}>
              <Text style={[styles.codeText, isExpired && styles.codeTextExpired]}>
                {isExpired ? 'EXPIRED' : pairingCode.code}
              </Text>
            </View>

            {/* Timer */}
            {!isExpired && (
              <View style={styles.timerContainer}>
                <Text style={styles.timerIcon}>⏱️</Text>
                <Text style={styles.timerText}>
                  Expires in {formatTimeRemaining(timeRemaining)}
                </Text>
              </View>
            )}

            {/* Actions */}
            {!isExpired ? (
              <TouchableOpacity
                style={[styles.copyButton, copied && styles.copyButtonCopied]}
                onPress={handleCopyCode}
              >
                <Text style={[styles.copyButtonText, copied && styles.copyButtonTextCopied]}>
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.regenerateButton} onPress={handleRegenerateCode}>
                <Text style={styles.regenerateButtonText}>Generate New Code</Text>
              </TouchableOpacity>
            )}

            {/* Regenerate link (when not expired) */}
            {!isExpired && (
              <TouchableOpacity style={styles.regenerateLink} onPress={handleRegenerateCode}>
                <Text style={styles.regenerateLinkText}>Generate new code</Text>
              </TouchableOpacity>
            )}

            {/* What happens next */}
            <View style={styles.nextStepsContainer}>
              <Text style={styles.nextStepsTitle}>What happens next?</Text>
              <View style={styles.nextStep}>
                <Text style={styles.nextStepNumber}>1</Text>
                <Text style={styles.nextStepText}>
                  The AI agent uses this code to identify you
                </Text>
              </View>
              <View style={styles.nextStep}>
                <Text style={styles.nextStepNumber}>2</Text>
                <Text style={styles.nextStepText}>
                  You'll receive a notification to approve the request
                </Text>
              </View>
              <View style={styles.nextStep}>
                <Text style={styles.nextStepNumber}>3</Text>
                <Text style={styles.nextStepText}>
                  Set permissions and spending limits before approving
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 17,
    color: '#1976D2',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  codeContainer: {
    flex: 1,
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  instructionsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  codeBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  codeBoxExpired: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  codeText: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'Menlo',
    color: '#1976D2',
    letterSpacing: 4,
  },
  codeTextExpired: {
    color: '#DC2626',
    fontSize: 24,
    letterSpacing: 0,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  timerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  timerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  copyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  copyButtonCopied: {
    backgroundColor: '#059669',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  copyButtonTextCopied: {
    color: '#fff',
  },
  regenerateButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  regenerateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  regenerateLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  regenerateLinkText: {
    fontSize: 14,
    color: '#1976D2',
  },
  nextStepsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 32,
    marginHorizontal: 16,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginRight: 12,
    overflow: 'hidden',
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default GeneratePairingCodeScreen;
