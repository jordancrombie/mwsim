/**
 * OAuthAuthorizationScreen - Approve/reject OAuth authorization requests
 *
 * Shows OAuth client details and requested scopes.
 * Used for browser-based AI platforms (ChatGPT, Claude MCP, etc.)
 * to connect to user wallets via OAuth Authorization Code flow.
 * Requires biometric authentication for approval.
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
import type { OAuthAuthorizationDetail } from '../types/agent';

interface OAuthAuthorizationScreenProps {
  oauthAuthorizationId: string;
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

export const OAuthAuthorizationScreen: React.FC<OAuthAuthorizationScreenProps> = ({
  oauthAuthorizationId,
  onBack,
  onApproved,
  onRejected,
  onBiometricAuth,
}) => {
  const [authorization, setAuthorization] = useState<OAuthAuthorizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadAuthorization = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await agentApi.getOAuthAuthorization(oauthAuthorizationId);
      setAuthorization(response);
      setTimeRemaining(response.time_remaining_seconds || 0);
    } catch (err: any) {
      console.error('[OAuthAuthorization] Error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load authorization');
    } finally {
      setLoading(false);
    }
  }, [oauthAuthorizationId]);

  useEffect(() => {
    loadAuthorization();
  }, [loadAuthorization]);

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
  }, [authorization]);

  const handleApprove = async () => {
    if (!authorization) return;

    // Require biometric authentication
    const authSuccess = await onBiometricAuth();
    if (!authSuccess) {
      return;
    }

    setApproving(true);

    try {
      await agentApi.approveOAuthAuthorization(oauthAuthorizationId);
      onApproved();
    } catch (err: any) {
      console.error('[OAuthAuthorization] Approve error:', err);
      Alert.alert(
        'Approval Failed',
        err.response?.data?.error?.message || err.message || 'Failed to approve authorization'
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Connection',
      `Are you sure you want to reject this connection request from ${authorization?.client_name || 'this app'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await agentApi.rejectOAuthAuthorization(oauthAuthorizationId);
              onRejected();
            } catch (err: any) {
              console.error('[OAuthAuthorization] Reject error:', err);
              Alert.alert(
                'Rejection Failed',
                err.response?.data?.error?.message || err.message || 'Failed to reject authorization'
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  const isExpired = authorization?.status === 'expired' || timeRemaining <= 0;
  const isProcessed = authorization?.status === 'approved' || authorization?.status === 'rejected' || authorization?.status === 'used';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Connect App</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Loading state */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Error state */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAuthorization}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Authorization details */}
      {authorization && !loading && !error && (
        <>
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
                  This request has already been {authorization.status}
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
              <Text style={styles.clientName}>{authorization.client_name}</Text>
              <Text style={styles.requestText}>wants to connect to your wallet</Text>
            </View>

            {/* Scopes section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                This will allow {authorization.client_name} to:
              </Text>
              {authorization.scopes.map((scope, index) => (
                <View key={scope.name} style={[
                  styles.scopeRow,
                  index === authorization.scopes.length - 1 && styles.scopeRowLast
                ]}>
                  <Text style={styles.checkmark}>✓</Text>
                  <View style={styles.scopeContent}>
                    <Text style={styles.scopeDescription}>{scope.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Info card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                You can revoke this connection at any time from your wallet settings.
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

export default OAuthAuthorizationScreen;
