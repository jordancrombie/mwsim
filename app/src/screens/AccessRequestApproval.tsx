/**
 * AccessRequestApprovalScreen - Review and approve/reject agent access requests
 *
 * Shows agent details, requested permissions, and spending limits.
 * User can modify limits (decrease only) before approving.
 * Requires biometric authentication for approval.
 * Part of SACP agent binding flow.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import type {
  AccessRequestDetail,
  AgentPermission,
  SpendingLimits,
  SpendingLimitsInput,
} from '../types/agent';

interface AccessRequestApprovalScreenProps {
  requestId: string;
  onBack: () => void;
  onApproved: (agentId: string) => void;
  onRejected: () => void;
  onBiometricAuth: () => Promise<boolean>; // Returns true if auth succeeded
}

// Permission display info
const PERMISSION_INFO: Record<AgentPermission, { label: string; description: string; icon: string }> = {
  browse: {
    label: 'Browse Products',
    description: 'View products and search stores',
    icon: '🔍',
  },
  cart: {
    label: 'Manage Cart',
    description: 'Add and remove items from shopping cart',
    icon: '🛒',
  },
  purchase: {
    label: 'Make Purchases',
    description: 'Complete transactions within limits',
    icon: '💳',
  },
  history: {
    label: 'View History',
    description: 'Access past orders and transactions',
    icon: '📋',
  },
};

// Format currency
const formatCurrency = (amount: number, currency: string = 'CAD'): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Format time remaining
const formatTimeRemaining = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const AccessRequestApprovalScreen: React.FC<AccessRequestApprovalScreenProps> = ({
  requestId,
  onBack,
  onApproved,
  onRejected,
  onBiometricAuth,
}) => {
  const [request, setRequest] = useState<AccessRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Editable limits (user can decrease these)
  const [editedLimits, setEditedLimits] = useState<SpendingLimitsInput>({});
  const [showLimitEdit, setShowLimitEdit] = useState(false);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await agentApi.getAccessRequest(requestId);
      setRequest(response.access_request);
      // Initialize edited limits with requested values
      setEditedLimits({
        per_transaction: response.access_request.requested_limits.per_transaction,
        daily: response.access_request.requested_limits.daily,
        monthly: response.access_request.requested_limits.monthly,
      });
    } catch (err: any) {
      console.error('[AccessRequestApproval] Error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const handleApprove = async () => {
    if (!request) return;

    // Validate edited limits don't exceed requested limits
    const limits = request.requested_limits;
    if (
      (editedLimits.per_transaction && editedLimits.per_transaction > limits.per_transaction) ||
      (editedLimits.daily && editedLimits.daily > limits.daily) ||
      (editedLimits.monthly && editedLimits.monthly > limits.monthly)
    ) {
      Alert.alert('Invalid Limits', 'You can only decrease spending limits, not increase them.');
      return;
    }

    // Require biometric authentication
    const authSuccess = await onBiometricAuth();
    if (!authSuccess) {
      return;
    }

    setApproving(true);

    try {
      const response = await agentApi.approveAccessRequest(requestId, {
        consent: true,
        permissions: request.requested_permissions,
        spending_limits: editedLimits,
      });
      onApproved(response.agent_id);
    } catch (err: any) {
      console.error('[AccessRequestApproval] Approve error:', err);
      Alert.alert(
        'Approval Failed',
        err.response?.data?.error?.message || err.message || 'Failed to approve request'
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this access request? The AI agent will not be able to make purchases on your behalf.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await agentApi.rejectAccessRequest(requestId);
              onRejected();
            } catch (err: any) {
              console.error('[AccessRequestApproval] Reject error:', err);
              Alert.alert(
                'Rejection Failed',
                err.response?.data?.error?.message || err.message || 'Failed to reject request'
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const updateLimit = (key: keyof SpendingLimitsInput, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditedLimits((prev) => ({ ...prev, [key]: numValue }));
  };

  const isExpired = request?.status === 'expired' || (request?.time_remaining_seconds || 0) <= 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Access Request</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading state */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading request...</Text>
        </View>
      )}

      {/* Error state */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRequest}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Request details */}
      {request && !loading && !error && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Expired banner */}
            {isExpired && (
              <View style={styles.expiredBanner}>
                <Text style={styles.expiredText}>This request has expired</Text>
              </View>
            )}

            {/* Agent info */}
            <View style={styles.agentCard}>
              <View style={styles.agentIcon}>
                <Text style={styles.agentIconText}>🤖</Text>
              </View>
              <Text style={styles.agentName}>{request.agent_name}</Text>
              {request.agent_description && (
                <Text style={styles.agentDescription}>{request.agent_description}</Text>
              )}
              <Text style={styles.requestText}>wants to connect to your wallet</Text>
              {!isExpired && request.time_remaining_seconds && (
                <View style={styles.timerBadge}>
                  <Text style={styles.timerText}>
                    ⏱️ Expires in {formatTimeRemaining(request.time_remaining_seconds)}
                  </Text>
                </View>
              )}
            </View>

            {/* Permissions section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requested Permissions</Text>
              {request.requested_permissions.map((permission) => {
                const info = PERMISSION_INFO[permission];
                return (
                  <View key={permission} style={styles.permissionRow}>
                    <Text style={styles.permissionIcon}>{info.icon}</Text>
                    <View style={styles.permissionContent}>
                      <Text style={styles.permissionLabel}>{info.label}</Text>
                      <Text style={styles.permissionDescription}>{info.description}</Text>
                    </View>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                );
              })}
            </View>

            {/* Spending limits section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Spending Limits</Text>
                {!isExpired && !showLimitEdit && (
                  <TouchableOpacity onPress={() => setShowLimitEdit(true)}>
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.limitsCard}>
                {/* Per transaction */}
                <View style={styles.limitRow}>
                  <Text style={styles.limitLabel}>Per transaction</Text>
                  {showLimitEdit ? (
                    <View style={styles.limitInputContainer}>
                      <Text style={styles.limitCurrency}>$</Text>
                      <TextInput
                        style={styles.limitInput}
                        value={editedLimits.per_transaction?.toString() || ''}
                        onChangeText={(v) => updateLimit('per_transaction', v)}
                        keyboardType="decimal-pad"
                        maxLength={10}
                      />
                    </View>
                  ) : (
                    <Text style={styles.limitValue}>
                      {formatCurrency(editedLimits.per_transaction || 0, request.requested_limits.currency)}
                    </Text>
                  )}
                </View>

                {/* Daily */}
                <View style={styles.limitRow}>
                  <Text style={styles.limitLabel}>Daily limit</Text>
                  {showLimitEdit ? (
                    <View style={styles.limitInputContainer}>
                      <Text style={styles.limitCurrency}>$</Text>
                      <TextInput
                        style={styles.limitInput}
                        value={editedLimits.daily?.toString() || ''}
                        onChangeText={(v) => updateLimit('daily', v)}
                        keyboardType="decimal-pad"
                        maxLength={10}
                      />
                    </View>
                  ) : (
                    <Text style={styles.limitValue}>
                      {formatCurrency(editedLimits.daily || 0, request.requested_limits.currency)}
                    </Text>
                  )}
                </View>

                {/* Monthly */}
                <View style={styles.limitRow}>
                  <Text style={styles.limitLabel}>Monthly limit</Text>
                  {showLimitEdit ? (
                    <View style={styles.limitInputContainer}>
                      <Text style={styles.limitCurrency}>$</Text>
                      <TextInput
                        style={styles.limitInput}
                        value={editedLimits.monthly?.toString() || ''}
                        onChangeText={(v) => updateLimit('monthly', v)}
                        keyboardType="decimal-pad"
                        maxLength={10}
                      />
                    </View>
                  ) : (
                    <Text style={styles.limitValue}>
                      {formatCurrency(editedLimits.monthly || 0, request.requested_limits.currency)}
                    </Text>
                  )}
                </View>
              </View>

              {showLimitEdit && (
                <Text style={styles.limitHint}>
                  You can only decrease limits. Purchases exceeding the per-transaction limit will require your approval.
                </Text>
              )}
            </View>

            {/* Warning */}
            <View style={styles.warningCard}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                Once approved, this AI agent can make purchases up to your specified limits without additional approval.
              </Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          {!isExpired && (
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

          {/* Expired action */}
          {isExpired && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.dismissButton} onPress={onBack}>
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  agentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  agentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  agentIconText: {
    fontSize: 40,
  },
  agentName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  agentDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  requestText: {
    fontSize: 16,
    color: '#4B5563',
  },
  timerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  timerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  permissionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  permissionContent: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  permissionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#059669',
    fontWeight: '600',
  },
  limitsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  limitLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  limitValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  limitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  limitCurrency: {
    fontSize: 16,
    color: '#6B7280',
  },
  limitInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 80,
    textAlign: 'right',
  },
  limitHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
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

export default AccessRequestApprovalScreen;
