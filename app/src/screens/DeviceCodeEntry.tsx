/**
 * DeviceCodeEntryScreen - Enter device authorization codes (RFC 8628)
 *
 * Allows users to manually enter device authorization codes (e.g., "WSIM-A3J2K9")
 * to authorize connections from AI platforms like ChatGPT, Claude, etc.
 * This is used for the Device Authorization Grant flow where the client
 * cannot receive push notifications.
 *
 * After claiming a code, the flow uses the same access request approval
 * endpoints as agent pairing.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { agentApi } from '../services/agent-api';
import type { AccessRequestDetail, AgentPermission } from '../types/agent';

interface DeviceCodeEntryScreenProps {
  onBack: () => void;
  onApproved: () => void;
  onRejected: () => void;
  onBiometricAuth: () => Promise<boolean>;
}

// Format time remaining as MM:SS
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format currency amount
const formatCurrency = (amount: number | string, currency: string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(numAmount);
};

// Permission descriptions
const permissionDescriptions: Record<AgentPermission, string> = {
  browse: 'View products and search the catalog',
  cart: 'Add items to cart and manage shopping sessions',
  purchase: 'Make purchases on your behalf',
  history: 'View your transaction history',
};

export const DeviceCodeEntryScreen: React.FC<DeviceCodeEntryScreenProps> = ({
  onBack,
  onApproved,
  onRejected,
  onBiometricAuth,
}) => {
  // Code entry state
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Access request state (after claim)
  const [accessRequest, setAccessRequest] = useState<AccessRequestDetail | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<TextInput>(null);

  // Claim device code
  const handleClaim = useCallback(async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setClaimError('Please enter a code');
      return;
    }

    setClaiming(true);
    setClaimError(null);

    try {
      const response = await agentApi.claimDeviceCode(trimmedCode);
      setAccessRequest(response.access_request);
      setTimeRemaining(response.access_request.time_remaining_seconds || 0);
    } catch (err: any) {
      console.error('[DeviceCodeEntry] Claim error:', err);
      const message = err.response?.data?.error?.message || err.message || 'Code not found or expired';
      setClaimError(message);
    } finally {
      setClaiming(false);
    }
  }, [code]);

  // Countdown timer
  useEffect(() => {
    if (accessRequest && timeRemaining > 0) {
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
  }, [accessRequest]);

  const handleApprove = async () => {
    if (!accessRequest) return;

    // Require biometric authentication
    const authSuccess = await onBiometricAuth();
    if (!authSuccess) {
      return;
    }

    setApproving(true);

    try {
      await agentApi.approveAccessRequest(accessRequest.id, { consent: true });
      Alert.alert(
        'Connection Approved',
        `${accessRequest.agent_name} has been connected to your wallet.`,
        [{ text: 'OK', onPress: onApproved }]
      );
    } catch (err: any) {
      console.error('[DeviceCodeEntry] Approve error:', err);
      Alert.alert(
        'Approval Failed',
        err.response?.data?.error?.message || err.message || 'Failed to approve connection'
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    if (!accessRequest) return;

    Alert.alert(
      'Reject Connection',
      `Are you sure you want to reject this connection request from ${accessRequest.agent_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await agentApi.rejectAccessRequest(accessRequest.id);
              onRejected();
            } catch (err: any) {
              console.error('[DeviceCodeEntry] Reject error:', err);
              Alert.alert(
                'Rejection Failed',
                err.response?.data?.error?.message || err.message || 'Failed to reject connection'
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    setAccessRequest(null);
    setCode('');
    setClaimError(null);
    setTimeRemaining(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const isExpired = accessRequest?.status === 'expired' || (accessRequest && timeRemaining <= 0);
  const isProcessed = accessRequest?.status === 'approved' || accessRequest?.status === 'rejected';

  // Code entry view
  if (!accessRequest) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Link Device</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.entryContent}>
          {/* Instructions */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionIcon}>🔗</Text>
            <Text style={styles.instructionTitle}>Connect an AI Assistant</Text>
            <Text style={styles.instructionText}>
              Enter the code shown by your AI assistant (like ChatGPT, Claude, or Gemini) to connect it to your wallet.
            </Text>
          </View>

          {/* Code input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Enter Code</Text>
            <TextInput
              ref={inputRef}
              style={[styles.codeInput, claimError && styles.codeInputError]}
              value={code}
              onChangeText={(text) => {
                // Auto-format: uppercase, allow letters, numbers, and dash
                const formatted = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                setCode(formatted);
                setClaimError(null);
              }}
              placeholder="WSIM-A3J2K9"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={18}
              onSubmitEditing={handleClaim}
              returnKeyType="done"
            />
            {claimError && (
              <Text style={styles.errorText}>{claimError}</Text>
            )}
          </View>

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.continueButton, (!code.trim() || claiming) && styles.continueButtonDisabled]}
            onPress={handleClaim}
            disabled={!code.trim() || claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {/* Help text */}
          <View style={styles.helpCard}>
            <Text style={styles.helpIcon}>💡</Text>
            <Text style={styles.helpText}>
              The code is typically shown when an AI assistant wants to make a purchase or access your wallet. It expires after 15 minutes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Authorization details view
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleReset} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Authorize Connection</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Expired banner */}
        {isExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>This request has expired</Text>
          </View>
        )}

        {/* Processed banner */}
        {isProcessed && !isExpired && (
          <View style={styles.processedBanner}>
            <Text style={styles.processedText}>
              This request has already been {accessRequest.status}
            </Text>
          </View>
        )}

        {/* Timer */}
        {!isExpired && !isProcessed && timeRemaining > 0 && (
          <View style={styles.timerContainer}>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>Expires in {formatTimeRemaining(timeRemaining)}</Text>
            </View>
          </View>
        )}

        {/* Client info */}
        <View style={styles.clientCard}>
          <View style={styles.clientIcon}>
            <Text style={styles.clientIconText}>🔗</Text>
          </View>
          <Text style={styles.clientName}>{accessRequest.agent_name}</Text>
          <Text style={styles.requestText}>wants to connect to your wallet</Text>
          {accessRequest.agent_description && (
            <Text style={styles.clientDescription}>{accessRequest.agent_description}</Text>
          )}
        </View>

        {/* Permissions section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            This will allow {accessRequest.agent_name} to:
          </Text>
          {accessRequest.requested_permissions.map((permission, index) => (
            <View key={permission} style={[
              styles.scopeRow,
              index === accessRequest.requested_permissions.length - 1 && styles.scopeRowLast
            ]}>
              <Text style={styles.checkmark}>✓</Text>
              <View style={styles.scopeContent}>
                <Text style={styles.scopeDescription}>
                  {permissionDescriptions[permission] || permission}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Spending limits section */}
        {accessRequest.requested_limits && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending Limits</Text>
            <View style={styles.limitsGrid}>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Per Transaction</Text>
                <Text style={styles.limitValue}>
                  {formatCurrency(accessRequest.requested_limits.per_transaction, accessRequest.requested_limits.currency)}
                </Text>
              </View>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Daily</Text>
                <Text style={styles.limitValue}>
                  {formatCurrency(accessRequest.requested_limits.daily, accessRequest.requested_limits.currency)}
                </Text>
              </View>
              <View style={[styles.limitRow, styles.limitRowLast]}>
                <Text style={styles.limitLabel}>Monthly</Text>
                <Text style={styles.limitValue}>
                  {formatCurrency(accessRequest.requested_limits.monthly, accessRequest.requested_limits.currency)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            You can revoke this connection at any time from Settings → AI Agents.
          </Text>
        </View>
      </ScrollView>

      {/* Action buttons */}
      {!isExpired && !isProcessed && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleReject}
            disabled={rejecting || approving}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.rejectButtonText}>Reject</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.approveButton}
            onPress={handleApprove}
            disabled={approving || rejecting}
          >
            {approving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.approveButtonText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Biometric hint */}
      {!isExpired && !isProcessed && (
        <Text style={styles.biometricHint}>Approval requires Face ID</Text>
      )}

      {/* Expired/processed action */}
      {(isExpired || isProcessed) && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.dismissButton} onPress={onBack}>
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  entryContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  instructionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 2,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  codeInputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginTop: 8,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  helpCard: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  helpIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  expiredBanner: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  expiredText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  processedBanner: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  processedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
  },
  clientCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  clientIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientIconText: {
    fontSize: 40,
  },
  clientName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  requestText: {
    fontSize: 16,
    color: '#4B5563',
  },
  clientDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scopeRowLast: {
    borderBottomWidth: 0,
  },
  checkmark: {
    fontSize: 18,
    color: '#059669',
    fontWeight: '600',
    marginRight: 12,
    marginTop: 1,
  },
  scopeContent: {
    flex: 1,
  },
  scopeDescription: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  limitsGrid: {
    gap: 0,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  limitRowLast: {
    borderBottomWidth: 0,
  },
  limitLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  limitValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  biometricHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6B7280',
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
});

export default DeviceCodeEntryScreen;
