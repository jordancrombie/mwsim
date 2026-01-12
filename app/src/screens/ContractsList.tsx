/**
 * ContractsListScreen - List of user's contracts
 *
 * Shows contracts where user is either creator or counterparty.
 * Displays status badge, counterparty info, stakes, and condition summary.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { api } from '../services/api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import type { ContractListItem, ContractStatus, ContractType } from '../types';
import { CONTRACT_STATUS_INFO, CONTRACT_TYPE_INFO } from '../types';

interface ContractsListScreenProps {
  onBack: () => void;
  onContractSelect: (contractId: string) => void;
  onCreateContract: () => void;
}

// Status filter tabs
const STATUS_FILTERS: { label: string; value: ContractStatus | 'all' | 'active' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'proposed' },
  { label: 'Active', value: 'active' },
  { label: 'Settled', value: 'settled' },
];

// Format currency amount
const formatAmount = (amount: number, currency: string = 'CAD'): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const pastDays = Math.abs(diffDays);
    if (pastDays === 0) return 'Today';
    if (pastDays === 1) return 'Yesterday';
    return `${pastDays} days ago`;
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

// Fallback values for unknown status/type
const DEFAULT_STATUS_INFO = { label: 'Unknown', color: '#9CA3AF', icon: '❓' };
const DEFAULT_TYPE_INFO = { label: 'Contract', icon: '📄', description: 'Contract' };

const ContractListItemComponent: React.FC<{
  contract: ContractListItem;
  onPress: () => void;
}> = ({ contract, onPress }) => {
  // Normalize to lowercase to handle both 'PROPOSED' and 'proposed' from API
  const normalizedStatus = contract.status?.toLowerCase() as ContractStatus;
  const normalizedType = contract.type?.toLowerCase() as ContractType;
  const statusInfo = CONTRACT_STATUS_INFO[normalizedStatus] || DEFAULT_STATUS_INFO;
  const typeInfo = CONTRACT_TYPE_INFO[normalizedType] || DEFAULT_TYPE_INFO;

  return (
    <TouchableOpacity style={styles.contractItem} onPress={onPress} activeOpacity={0.7}>
      {/* Left: Counterparty avatar */}
      <ProfileAvatar
        imageUrl={contract.counterpartyProfileImageUrl}
        displayName={contract.counterpartyName}
        initialsColor={contract.counterpartyInitialsColor}
        size="medium"
      />

      {/* Middle: Contract info */}
      <View style={styles.contractInfo}>
        <View style={styles.contractHeader}>
          <Text style={styles.contractTitle} numberOfLines={1}>
            {contract.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.icon} {statusInfo.label}
            </Text>
          </View>
        </View>

        <Text style={styles.counterpartyName} numberOfLines={1}>
          {contract.myRole === 'creator' ? 'vs' : 'from'} {contract.counterpartyName}
        </Text>

        {contract.conditionsSummary && (
          <Text style={styles.conditionsSummary} numberOfLines={1}>
            {contract.conditionsSummary}
          </Text>
        )}

        <View style={styles.contractFooter}>
          <Text style={styles.typeLabel}>
            {typeInfo.icon} {typeInfo.label}
          </Text>
          <Text style={styles.expiryLabel}>
            {formatRelativeTime(contract.expiresAt)}
          </Text>
        </View>
      </View>

      {/* Right: Stakes */}
      <View style={styles.stakesContainer}>
        <Text style={styles.potAmount}>{formatAmount(contract.totalPot, contract.currency)}</Text>
        <Text style={styles.potLabel}>Total Pot</Text>
      </View>
    </TouchableOpacity>
  );
};

export const ContractsListScreen: React.FC<ContractsListScreenProps> = ({
  onBack,
  onContractSelect,
  onCreateContract,
}) => {
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ContractStatus | 'all' | 'active'>('all');

  const loadContracts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);

    try {
      const statusParam = activeFilter === 'all' ? undefined : activeFilter;
      const { contracts: data } = await api.getContracts(statusParam);
      setContracts(data);
    } catch (err: any) {
      console.error('[ContractsList] Error loading contracts:', err);
      setError(err.message || 'Failed to load contracts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadContracts(false);
  };

  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>No Contracts Yet</Text>
        <Text style={styles.emptySubtitle}>
          Create a contract with someone to get started with conditional payments.
        </Text>
        <TouchableOpacity style={styles.createButton} onPress={onCreateContract}>
          <Text style={styles.createButtonText}>Create Contract</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.filterContainer}>
      {STATUS_FILTERS.map((filter) => (
        <TouchableOpacity
          key={filter.value}
          style={[
            styles.filterTab,
            activeFilter === filter.value && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter(filter.value)}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === filter.value && styles.filterTabTextActive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contracts</Text>
        <TouchableOpacity onPress={onCreateContract} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadContracts()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading contracts...</Text>
        </View>
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContractListItemComponent
              contract={item}
              onPress={() => onContractSelect(item.id)}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={contracts.length === 0 ? styles.emptyListContainer : undefined}
        />
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
  addButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  addButtonText: {
    fontSize: 17,
    color: '#1976D2',
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#1976D2',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
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
    margin: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryText: {
    marginTop: 8,
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  contractItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  contractInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contractTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  counterpartyName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  conditionsSummary: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  contractFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  typeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 12,
  },
  expiryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  stakesContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  potAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  potLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ContractsListScreen;
