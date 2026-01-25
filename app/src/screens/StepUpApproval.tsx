/**
 * StepUpApprovalScreen - Approve or reject agent purchase requests
 *
 * Shows purchase details when an agent attempts a transaction that exceeds
 * the per-transaction limit. User can approve or reject with biometric auth.
 * Part of SACP step-up authorization flow.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { agentApi } from '../services/agent-api';
import type { StepUpDetail, CartItem, PaymentMethod } from '../types/agent';

interface StepUpApprovalScreenProps {
  stepUpId: string;
  onBack: () => void;
  onApproved: () => void;
  onRejected: () => void;
  onBiometricAuth: () => Promise<boolean>; // Returns true if auth succeeded
}

// Format currency
const formatCurrency = (amount: number, currency: string = 'CAD'): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Format time remaining as MM:SS
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get card brand icon
const getCardIcon = (brand: string): string => {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return '💳';
    case 'mastercard':
      return '💳';
    case 'amex':
      return '💳';
    default:
      return '💳';
  }
};

const CartItemRow: React.FC<{ item: CartItem; currency: string }> = ({ item, currency }) => (
  <View style={styles.cartItem}>
    <View style={styles.cartItemInfo}>
      <Text style={styles.cartItemName} numberOfLines={1}>
        {item.name}
      </Text>
      {item.quantity > 1 && (
        <Text style={styles.cartItemQuantity}>× {item.quantity}</Text>
      )}
    </View>
    <Text style={styles.cartItemPrice}>
      {item.price != null ? formatCurrency(item.price * item.quantity, currency) : `×${item.quantity}`}
    </Text>
  </View>
);

export const StepUpApprovalScreen: React.FC<StepUpApprovalScreenProps> = ({
  stepUpId,
  onBack,
  onApproved,
  onRejected,
  onBiometricAuth,
}) => {
  const [stepUp, setStepUp] = useState<StepUpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStepUp = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await agentApi.getStepUp(stepUpId);
      console.log('[StepUpApproval] Raw response:', JSON.stringify(response, null, 2));

      // Handle both spec-compliant (step_up wrapper) and legacy (flat) response formats
      const raw = response.step_up || (response as any);

      if (!raw || !raw.id) {
        console.error('[StepUpApproval] Invalid step-up data:', raw);
        setError('Step-up request not found or has expired');
        return;
      }

      // Payment methods may be at root level (spec) or nested (legacy)
      const paymentMethods = (response as any).available_payment_methods ||
        raw.paymentMethods || raw.available_payment_methods || [];

      // Map to our StepUpDetail type (handles both camelCase legacy and snake_case spec formats)
      const stepUpData: StepUpDetail = {
        id: raw.id,
        status: raw.status,
        agent_id: raw.agent?.id || raw.agent_id,
        agent_name: raw.agent?.name || raw.agent_name,
        merchant_id: raw.purchase?.merchantId || raw.merchant_id || '',
        merchant_name: raw.purchase?.merchantName || raw.merchant_name || 'Unknown',
        amount: parseFloat(raw.purchase?.amount || raw.amount || '0'),
        currency: raw.purchase?.currency || raw.currency || 'CAD',
        items: raw.purchase?.items || raw.items || [],
        reason: raw.reason || '',
        created_at: raw.createdAt || raw.created_at || '',
        expires_at: raw.expiresAt || raw.expires_at || '',
        available_payment_methods: paymentMethods.map((pm: any) => ({
          id: pm.id,
          type: pm.type || 'card',
          brand: pm.type || pm.brand || 'Card',
          last_four: pm.lastFour || pm.last_four || '',
          exp_month: pm.expiryMonth || pm.exp_month,
          exp_year: pm.expiryYear || pm.exp_year,
          is_default: pm.isDefault ?? pm.is_default ?? false,
        })),
      };

      setStepUp(stepUpData);

      // Set requested or default payment method (may be at root level or nested)
      const requestedMethodId = (response as any).requested_payment_method_id ||
        raw.requestedPaymentMethodId || raw.requested_payment_method_id;
      const defaultMethod = stepUpData.available_payment_methods?.find((m) => m.is_default);
      if (requestedMethodId) {
        setSelectedPaymentMethod(requestedMethodId);
      } else if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod.id);
      } else if (stepUpData.available_payment_methods?.length) {
        setSelectedPaymentMethod(stepUpData.available_payment_methods[0].id);
      }

      // Use time_remaining_seconds if provided, otherwise calculate from expires_at
      const timeRemaining = raw.time_remaining_seconds ?? raw.timeRemainingSeconds;
      if (timeRemaining !== undefined) {
        setTimeRemaining(Math.max(0, timeRemaining));
      } else {
        const expiresAt = new Date(stepUpData.expires_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeRemaining(remaining);
      }
    } catch (err: any) {
      console.error('[StepUpApproval] Error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  }, [stepUpId]);

  useEffect(() => {
    loadStepUp();
  }, [loadStepUp]);

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
  }, [stepUp]); // Reset timer when step-up is loaded

  const handleApprove = async () => {
    if (!stepUp) return;

    // Require biometric authentication
    const authSuccess = await onBiometricAuth();
    if (!authSuccess) {
      return;
    }

    setApproving(true);

    try {
      await agentApi.approveStepUp(stepUpId, {
        consent: true,
        payment_method_id: selectedPaymentMethod || undefined,
      });
      onApproved();
    } catch (err: any) {
      console.error('[StepUpApproval] Approve error:', err);
      Alert.alert(
        'Approval Failed',
        err.response?.data?.error?.message || err.message || 'Failed to approve purchase'
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Purchase',
      'Are you sure you want to reject this purchase request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await agentApi.rejectStepUp(stepUpId);
              onRejected();
            } catch (err: any) {
              console.error('[StepUpApproval] Reject error:', err);
              Alert.alert(
                'Rejection Failed',
                err.response?.data?.error?.message || err.message || 'Failed to reject purchase'
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const isExpired = stepUp?.status === 'expired' || timeRemaining === 0;
  const isAlreadyProcessed = stepUp?.status === 'approved' || stepUp?.status === 'rejected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Purchase Approval</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadStepUp}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step-up details */}
      {stepUp && !loading && !error && (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Status banner for expired/processed */}
            {(isExpired || isAlreadyProcessed) && (
              <View style={[
                styles.statusBanner,
                isExpired ? styles.statusBannerExpired : styles.statusBannerProcessed,
              ]}>
                <Text style={styles.statusBannerText}>
                  {isExpired ? 'This request has expired' :
                    stepUp.status === 'approved' ? 'This purchase was approved' :
                      'This purchase was rejected'}
                </Text>
              </View>
            )}

            {/* Timer (when not expired) */}
            {!isExpired && !isAlreadyProcessed && (
              <View style={styles.timerContainer}>
                <Text style={styles.timerIcon}>⏱️</Text>
                <Text style={styles.timerText}>
                  Expires in {formatTimeRemaining(timeRemaining)}
                </Text>
              </View>
            )}

            {/* Purchase summary card */}
            <View style={styles.purchaseCard}>
              <View style={styles.agentBadge}>
                <Text style={styles.agentBadgeIcon}>🤖</Text>
                <Text style={styles.agentBadgeName}>{stepUp.agent_name}</Text>
              </View>

              <Text style={styles.wantsToSpend}>wants to spend</Text>

              <Text style={styles.amount}>
                {formatCurrency(stepUp.amount, stepUp.currency)}
              </Text>

              <Text style={styles.atMerchant}>at</Text>

              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{stepUp.merchant_name}</Text>
              </View>
            </View>

            {/* Reason badge */}
            <View style={styles.reasonBadge}>
              <Text style={styles.reasonIcon}>ℹ️</Text>
              <Text style={styles.reasonText}>{stepUp.reason}</Text>
            </View>

            {/* Cart items (if available) */}
            {stepUp.items && stepUp.items.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Items</Text>
                <View style={styles.cartContainer}>
                  {stepUp.items.map((item, index) => (
                    <CartItemRow key={index} item={item} currency={stepUp.currency} />
                  ))}
                  <View style={styles.cartTotal}>
                    <Text style={styles.cartTotalLabel}>Total</Text>
                    <Text style={styles.cartTotalValue}>
                      {formatCurrency(stepUp.amount, stepUp.currency)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Payment method selection */}
            {stepUp.available_payment_methods && stepUp.available_payment_methods.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Method</Text>
                <View style={styles.paymentMethodsContainer}>
                  {stepUp.available_payment_methods.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.paymentMethodRow,
                        selectedPaymentMethod === method.id && styles.paymentMethodRowSelected,
                      ]}
                      onPress={() => setSelectedPaymentMethod(method.id)}
                      disabled={isExpired || isAlreadyProcessed}
                    >
                      <Text style={styles.paymentMethodIcon}>{getCardIcon(method.brand)}</Text>
                      <View style={styles.paymentMethodInfo}>
                        <Text style={styles.paymentMethodBrand}>
                          {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)}
                        </Text>
                        <Text style={styles.paymentMethodLast4}>•••• {method.last_four}</Text>
                      </View>
                      {method.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      {selectedPaymentMethod === method.id && (
                        <Text style={styles.selectedCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          {!isExpired && !isAlreadyProcessed && (
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

          {/* Dismiss button for expired/processed */}
          {(isExpired || isAlreadyProcessed) && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.dismissButton} onPress={onBack}>
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Biometric hint */}
          {!isExpired && !isAlreadyProcessed && (
            <Text style={styles.biometricHint}>
              Approval requires Face ID
            </Text>
          )}
        </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusBannerExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusBannerProcessed: {
    backgroundColor: '#D1FAE5',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  timerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  purchaseCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  agentBadgeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  agentBadgeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3730A3',
  },
  wantsToSpend: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  atMerchant: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  merchantInfo: {
    alignItems: 'center',
  },
  merchantName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
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
    marginBottom: 12,
  },
  cartContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cartItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemName: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  cartItemQuantity: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
  },
  cartTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cartTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  paymentMethodsContainer: {
    gap: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodRowSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#EFF6FF',
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodBrand: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  paymentMethodLast4: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3730A3',
  },
  selectedCheckmark: {
    fontSize: 18,
    color: '#1976D2',
    fontWeight: '600',
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
  biometricHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
});

export default StepUpApprovalScreen;
