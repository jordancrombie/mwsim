/**
 * ContractDetailScreen - View contract details
 *
 * Shows full contract information including:
 * - Status and type
 * - Both parties with their stakes
 * - Conditions and their status
 * - Outcome if settled
 * - Action buttons based on state
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
  RefreshControl,
  Platform,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../services/api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import type { Contract, ContractParty, ContractCondition, BankAccount } from '../types';
import { CONTRACT_STATUS_INFO, CONTRACT_TYPE_INFO } from '../types';

interface ContractDetailScreenProps {
  contractId: string;
  onBack: () => void;
  onRefreshNeeded?: () => void;
}

// Format currency amount
const formatAmount = (amount: number, currency: string = 'CAD'): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Party card component
const PartyCard: React.FC<{
  party: ContractParty;
  isMe: boolean;
  currency: string;
}> = ({ party, isMe, currency }) => (
  <View style={[styles.partyCard, isMe && styles.partyCardMe]}>
    <View style={styles.partyHeader}>
      <ProfileAvatar
        imageUrl={party.profileImageUrl}
        displayName={party.displayName}
        initialsColor={party.initialsColor}
        size="small"
      />
      <View style={styles.partyInfo}>
        <View style={styles.partyNameRow}>
          <Text style={styles.partyName}>{party.displayName}</Text>
          {isMe && <Text style={styles.meTag}>You</Text>}
        </View>
        <Text style={styles.partyRole}>
          {party.role === 'creator' ? 'Creator' : 'Counterparty'}
        </Text>
      </View>
    </View>

    <View style={styles.partyStake}>
      <Text style={styles.stakeAmount}>{formatAmount(party.stake.amount, currency)}</Text>
      <Text style={styles.stakeLabel}>Stake</Text>
    </View>

    <View style={styles.partyStatus}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Accepted:</Text>
        <Text style={[styles.statusValue, party.accepted ? styles.statusYes : styles.statusNo]}>
          {party.accepted ? 'Yes' : 'No'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Funded:</Text>
        <Text style={[styles.statusValue, party.funded ? styles.statusYes : styles.statusNo]}>
          {party.funded ? 'Yes' : 'No'}
        </Text>
      </View>
    </View>
  </View>
);

// Condition card component
const ConditionCard: React.FC<{ condition: ContractCondition; index: number }> = ({
  condition,
  index,
}) => {
  const statusColor =
    condition.status === 'resolved'
      ? '#10B981'
      : condition.status === 'disputed'
      ? '#DC2626'
      : '#F59E0B';

  return (
    <View style={styles.conditionCard}>
      <View style={styles.conditionHeader}>
        <Text style={styles.conditionIndex}>Condition {index + 1}</Text>
        <View style={[styles.conditionStatusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.conditionStatusText, { color: statusColor }]}>
            {condition.status.charAt(0).toUpperCase() + condition.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.conditionEvent}>Event: {condition.eventId}</Text>
      <Text style={styles.conditionPredicate}>
        {condition.predicate.field} {condition.predicate.operator} {JSON.stringify(condition.predicate.value)}
      </Text>

      {condition.result !== undefined && (
        <Text style={styles.conditionResult}>
          Result: {condition.result ? 'True' : 'False'}
        </Text>
      )}
    </View>
  );
};

export const ContractDetailScreen: React.FC<ContractDetailScreenProps> = ({
  contractId,
  onBack,
  onRefreshNeeded,
}) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const loadContract = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);

    try {
      const data = await api.getContract(contractId);
      setContract(data);

      // Load accounts if we might need to fund
      if (data.status === 'funding') {
        const { accounts: accts } = await api.getAccounts();
        setAccounts(accts as BankAccount[]);
      }
    } catch (err: any) {
      console.error('[ContractDetail] Error loading contract:', err);
      setError(err.message || 'Failed to load contract');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadContract(false);
  };

  const handleAccept = async () => {
    Alert.alert(
      'Accept Contract',
      'Are you sure you want to accept this contract?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.acceptContract(contractId);
              await loadContract(false);
              onRefreshNeeded?.();
              Alert.alert('Success', 'Contract accepted! You can now fund your stake.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to accept contract');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async () => {
    Alert.alert(
      'Decline Contract',
      'Are you sure you want to decline this contract?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.declineContract(contractId);
              onRefreshNeeded?.();
              onBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline contract');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleFund = async () => {
    if (accounts.length === 0) {
      Alert.alert('No Accounts', 'Please link a bank account first.');
      return;
    }

    // For now, use the first account. In a real app, you'd show an account picker.
    const account = accounts[0];
    const myParty = contract?.parties.find(p => p.role === contract.myRole);
    const stakeAmount = myParty?.stake.amount || 0;

    Alert.alert(
      'Fund Contract',
      `This will place a hold of ${formatAmount(stakeAmount)} on your ${account.displayName} account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fund',
          onPress: async () => {
            setActionLoading(true);
            try {
              const idempotencyKey = uuidv4();
              await api.fundContract(contractId, account.accountId, idempotencyKey);
              await loadContract(false);
              onRefreshNeeded?.();
              Alert.alert('Success', 'Contract funded! Waiting for counterparty to fund.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to fund contract');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Contract',
      'Are you sure you want to cancel this contract? This cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Contract',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.cancelContract(contractId);
              onRefreshNeeded?.();
              onBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel contract');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Determine what actions are available
  const getActions = () => {
    if (!contract) return [];
    const actions: { label: string; onPress: () => void; style?: 'primary' | 'secondary' | 'danger' }[] = [];

    const myParty = contract.parties.find(p => p.role === contract.myRole);
    const isCreator = contract.myRole === 'creator';
    const isCounterparty = contract.myRole === 'counterparty';

    switch (contract.status) {
      case 'proposed':
        if (isCounterparty && !myParty?.accepted) {
          actions.push({ label: 'Accept', onPress: handleAccept, style: 'primary' });
          actions.push({ label: 'Decline', onPress: handleDecline, style: 'danger' });
        }
        if (isCreator) {
          actions.push({ label: 'Cancel Contract', onPress: handleCancel, style: 'danger' });
        }
        break;

      case 'funding':
        if (myParty && !myParty.funded) {
          actions.push({ label: 'Fund Your Stake', onPress: handleFund, style: 'primary' });
        }
        if (isCreator) {
          actions.push({ label: 'Cancel Contract', onPress: handleCancel, style: 'danger' });
        }
        break;

      case 'active':
        // No actions during active state - waiting for oracle
        break;

      case 'disputed':
        // Future: Add dispute actions
        break;
    }

    return actions;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>&lt; Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Contract</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading contract...</Text>
        </View>
      </View>
    );
  }

  if (error || !contract) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>&lt; Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Contract</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Contract not found'}</Text>
          <TouchableOpacity onPress={() => loadContract()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Normalize to lowercase to handle both 'PROPOSED' and 'proposed' from API
  const normalizedStatus = contract.status?.toLowerCase() as import('../types').ContractStatus;
  const normalizedType = contract.type?.toLowerCase() as import('../types').ContractType;
  const statusInfo = CONTRACT_STATUS_INFO[normalizedStatus] || { label: 'Unknown', color: '#9CA3AF', icon: '❓' };
  const typeInfo = CONTRACT_TYPE_INFO[normalizedType] || { label: 'Contract', icon: '📄', description: 'Contract' };
  const actions = getActions();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contract</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Status and type banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.color + '15' }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusBannerText, { color: statusInfo.color }]}>
              {statusInfo.icon} {statusInfo.label}
            </Text>
            <Text style={styles.typeBannerText}>
              {typeInfo.icon} {typeInfo.label}
            </Text>
          </View>
        </View>

        {/* Title and description */}
        <View style={styles.section}>
          <Text style={styles.contractTitle}>{contract.title}</Text>
          {contract.description && (
            <Text style={styles.contractDescription}>{contract.description}</Text>
          )}
          <View style={styles.potContainer}>
            <Text style={styles.potLabel}>Total Pot</Text>
            <Text style={styles.potAmount}>{formatAmount(contract.totalPot, contract.currency)}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties</Text>
          {contract.parties.map((party) => (
            <PartyCard
              key={party.id}
              party={party}
              isMe={party.role === contract.myRole}
              currency={contract.currency}
            />
          ))}
        </View>

        {/* Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conditions</Text>
          {contract.conditions.length > 0 ? (
            contract.conditions.map((condition, index) => (
              <ConditionCard key={index} condition={condition} index={index} />
            ))
          ) : (
            <Text style={styles.noConditions}>No conditions defined</Text>
          )}
        </View>

        {/* Outcome (if settled) */}
        {contract.outcome && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Outcome</Text>
            <View style={styles.outcomeCard}>
              <Text style={styles.outcomeResult}>
                {contract.outcome.result.replace(/_/g, ' ').toUpperCase()}
              </Text>
              {contract.outcome.winnerDisplayName && (
                <Text style={styles.outcomeWinner}>Winner: {contract.outcome.winnerDisplayName}</Text>
              )}
              {contract.outcome.settledAmount && (
                <Text style={styles.outcomeAmount}>
                  Settled: {formatAmount(contract.outcome.settledAmount, contract.currency)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Created</Text>
              <Text style={styles.timelineValue}>{formatDate(contract.createdAt)}</Text>
            </View>
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Funding Deadline</Text>
              <Text style={styles.timelineValue}>{formatDate(contract.fundingDeadline)}</Text>
            </View>
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Expires</Text>
              <Text style={styles.timelineValue}>{formatDate(contract.expiresAt)}</Text>
            </View>
            {contract.settledAt && (
              <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>Settled</Text>
                <Text style={styles.timelineValue}>{formatDate(contract.settledAt)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        {actions.length > 0 && (
          <View style={styles.actionsSection}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  action.style === 'primary' && styles.actionButtonPrimary,
                  action.style === 'danger' && styles.actionButtonDanger,
                  action.style === 'secondary' && styles.actionButtonSecondary,
                ]}
                onPress={action.onPress}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      action.style === 'secondary' && styles.actionButtonTextSecondary,
                    ]}
                  >
                    {action.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    minWidth: 60,
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
    minWidth: 60,
  },
  content: {
    flex: 1,
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
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryText: {
    marginTop: 12,
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  statusBanner: {
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  typeBannerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  contractTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  contractDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  potContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  potLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  potAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  partyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partyCardMe: {
    borderColor: '#1976D2',
    backgroundColor: '#EBF5FF',
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  partyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  partyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  meTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  partyRole: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  partyStake: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  stakeAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  stakeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  partyStatus: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 4,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusYes: {
    color: '#10B981',
  },
  statusNo: {
    color: '#F59E0B',
  },
  conditionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conditionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionIndex: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  conditionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  conditionEvent: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  conditionPredicate: {
    fontSize: 13,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  conditionResult: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 8,
  },
  noConditions: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  outcomeCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  outcomeResult: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 8,
  },
  outcomeWinner: {
    fontSize: 16,
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 4,
  },
  outcomeAmount: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  timeline: {
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    paddingLeft: 16,
    marginLeft: 8,
  },
  timelineItem: {
    marginBottom: 16,
    position: 'relative',
  },
  timelineLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  timelineValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  actionsSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#1976D2',
  },
  actionButtonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#374151',
  },
  bottomSpacer: {
    height: 32,
  },
});

export default ContractDetailScreen;
