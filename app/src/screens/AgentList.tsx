/**
 * AgentListScreen - List of user's registered AI agents
 *
 * Shows agents with status, spending summary, and last activity.
 * Entry point for agent management (part of SACP).
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
import { agentApi } from '../services/agent-api';
import type { AgentSummary, AgentStatus } from '../types/agent';

interface AgentListScreenProps {
  onBack: () => void;
  onAgentSelect: (agentId: string) => void;
  onAddAgent: () => void;
  onPendingRequests: () => void;
}

// Status display info
const AGENT_STATUS_INFO: Record<AgentStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: '#059669', bgColor: '#D1FAE5' },
  suspended: { label: 'Suspended', color: '#D97706', bgColor: '#FEF3C7' },
  revoked: { label: 'Revoked', color: '#DC2626', bgColor: '#FEE2E2' },
};

// Format relative time
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const AgentListItem: React.FC<{
  agent: AgentSummary;
  onPress: () => void;
}> = ({ agent, onPress }) => {
  const statusInfo = AGENT_STATUS_INFO[agent.status] || AGENT_STATUS_INFO.active;

  return (
    <TouchableOpacity style={styles.agentItem} onPress={onPress} activeOpacity={0.7}>
      {/* Robot icon */}
      <View style={styles.agentIcon}>
        <Text style={styles.agentIconText}>🤖</Text>
      </View>

      {/* Agent info */}
      <View style={styles.agentInfo}>
        <View style={styles.agentHeader}>
          <Text style={styles.agentName} numberOfLines={1}>
            {agent.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {agent.description && (
          <Text style={styles.agentDescription} numberOfLines={1}>
            {agent.description}
          </Text>
        )}

        <Text style={styles.lastUsed}>
          Last used: {formatRelativeTime(agent.last_used_at)}
        </Text>
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

export const AgentListScreen: React.FC<AgentListScreenProps> = ({
  onBack,
  onAgentSelect,
  onAddAgent,
  onPendingRequests,
}) => {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const loadAgents = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);

    try {
      // Load agents and pending requests in parallel
      const [agentsResponse, pendingResponse] = await Promise.all([
        agentApi.getAgents(),
        agentApi.getPendingAccessRequests().catch(() => ({ access_requests: [] })),
      ]);

      setAgents(agentsResponse.agents || []);
      setPendingRequestCount(pendingResponse.access_requests?.length || 0);
    } catch (err: any) {
      console.error('[AgentList] Error loading agents:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAgents(false);
  };

  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🤖</Text>
        <Text style={styles.emptyTitle}>No AI Agents Yet</Text>
        <Text style={styles.emptySubtitle}>
          Add an AI agent to let it make purchases on your behalf. You control what it can buy and how much it can spend.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onAddAgent}>
          <Text style={styles.primaryButtonText}>Add AI Agent</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPendingRequestsBanner = () => {
    if (pendingRequestCount === 0) return null;

    return (
      <TouchableOpacity style={styles.pendingBanner} onPress={onPendingRequests}>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>{pendingRequestCount}</Text>
        </View>
        <View style={styles.pendingContent}>
          <Text style={styles.pendingTitle}>Pending Access Requests</Text>
          <Text style={styles.pendingSubtitle}>
            {pendingRequestCount === 1
              ? 'An AI agent wants to connect'
              : `${pendingRequestCount} AI agents want to connect`}
          </Text>
        </View>
        <Text style={styles.pendingChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {renderPendingRequestsBanner()}
      {agents.length > 0 && (
        <Text style={styles.sectionHeader}>YOUR AGENTS</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI Agents</Text>
        <TouchableOpacity onPress={onAddAgent} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadAgents()}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading state */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading agents...</Text>
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AgentListItem
              agent={item}
              onPress={() => onAgentSelect(item.id)}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={agents.length === 0 ? styles.emptyListContainer : undefined}
        />
      )}

      {/* Info footer */}
      {agents.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            AI agents can make purchases on your behalf within the limits you set.
          </Text>
          <TouchableOpacity>
            <Text style={styles.learnMoreText}>Learn more about AI Agents</Text>
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
  addButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  addButtonText: {
    fontSize: 17,
    color: '#1976D2',
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 0.5,
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  pendingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  pendingSubtitle: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
  },
  pendingChevron: {
    fontSize: 24,
    color: '#B45309',
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  agentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentIconText: {
    fontSize: 24,
  },
  agentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
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
  agentDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  lastUsed: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  chevron: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 8,
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
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  learnMoreText: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '500',
  },
});

export default AgentListScreen;
