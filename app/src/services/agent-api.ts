/**
 * Agent Commerce API Service
 *
 * API client for SACP (SimToolBox Agent Commerce Protocol) endpoints.
 * Handles agent management, pairing codes, access requests, step-up authorization,
 * and transaction history.
 *
 * Based on WSIM OpenAPI spec: docs/sacp/openapi-agent.yaml
 */

import { apiClient } from './api';
import type {
  // Agent Management
  AgentListResponse,
  AgentDetailResponse,
  UpdateAgentRequest,
  RotateSecretResponse,
  // Pairing Codes
  PairingCodeResponse,
  // Access Requests
  AccessRequestListResponse,
  AccessRequestDetailResponse,
  ApproveAccessRequestInput,
  RejectAccessRequestInput,
  AccessRequestApprovalResponse,
  AccessRequestRejectionResponse,
  // Step-Up
  StepUpDetailResponse,
  ApproveStepUpRequest,
  RejectStepUpRequest,
  StepUpApprovalResponse,
  StepUpRejectionResponse,
  // OAuth Authorization
  OAuthAuthorizationDetail,
  OAuthApprovalResponse,
  OAuthRejectionResponse,
  // Device Authorization (RFC 8628)
  DeviceCodeClaimRequest,
  DeviceCodeClaimResponse,
  // Transactions
  TransactionListResponse,
  TransactionQueryParams,
} from '../types/agent';

export const agentApi = {
  // =============================================================================
  // Pairing Codes
  // =============================================================================

  /**
   * Generate a pairing code for agent binding.
   * User shares this code with the AI agent to initiate binding.
   * Code expires in 15 minutes.
   */
  async generatePairingCode(): Promise<PairingCodeResponse> {
    console.log('[AgentAPI] generatePairingCode - generating...');
    const { data } = await apiClient.post<PairingCodeResponse>('/mobile/access-requests/pairing-codes');
    console.log('[AgentAPI] generatePairingCode - code generated, expires:', data.expires_at);
    return data;
  },

  // =============================================================================
  // Access Requests
  // =============================================================================

  /**
   * Get list of pending access requests.
   * Called when user opens the access request approval screen.
   */
  async getPendingAccessRequests(): Promise<AccessRequestListResponse> {
    console.log('[AgentAPI] getPendingAccessRequests - fetching...');
    const { data } = await apiClient.get<AccessRequestListResponse>(
      '/mobile/access-requests/pending'
    );
    console.log('[AgentAPI] getPendingAccessRequests - found:', data.access_requests?.length || 0);
    return data;
  },

  /**
   * Get details of a specific access request.
   * Called when user taps on an access request notification or list item.
   *
   * @param requestId The access request ID
   */
  async getAccessRequest(requestId: string): Promise<AccessRequestDetailResponse> {
    console.log('[AgentAPI] getAccessRequest - fetching:', requestId);
    const { data } = await apiClient.get<AccessRequestDetailResponse>(
      `/mobile/access-requests/${requestId}`
    );
    console.log('[AgentAPI] getAccessRequest - received:', data.access_request?.agent_name);
    return data;
  },

  /**
   * Approve an access request.
   * User can optionally modify permissions and spending limits (can only decrease).
   * Requires biometric authentication before calling.
   *
   * @param requestId The access request ID
   * @param input Approval details with optional limit modifications
   */
  async approveAccessRequest(
    requestId: string,
    input: ApproveAccessRequestInput
  ): Promise<AccessRequestApprovalResponse> {
    console.log('[AgentAPI] approveAccessRequest - approving:', requestId);
    const { data } = await apiClient.post<AccessRequestApprovalResponse>(
      `/mobile/access-requests/${requestId}/approve`,
      input
    );
    console.log('[AgentAPI] approveAccessRequest - approved, agent_id:', data.agent_id);
    return data;
  },

  /**
   * Reject an access request.
   * User can optionally provide a reason (not sent to agent).
   *
   * @param requestId The access request ID
   * @param input Optional rejection reason
   */
  async rejectAccessRequest(
    requestId: string,
    input?: RejectAccessRequestInput
  ): Promise<AccessRequestRejectionResponse> {
    console.log('[AgentAPI] rejectAccessRequest - rejecting:', requestId);
    const { data } = await apiClient.post<AccessRequestRejectionResponse>(
      `/mobile/access-requests/${requestId}/reject`,
      input || {}
    );
    console.log('[AgentAPI] rejectAccessRequest - rejected');
    return data;
  },

  // =============================================================================
  // Agent Management
  // =============================================================================

  /**
   * Get list of user's registered agents.
   * Shows agent name, status, and spending summary.
   */
  async getAgents(): Promise<AgentListResponse> {
    console.log('[AgentAPI] getAgents - fetching...');
    const { data } = await apiClient.get<AgentListResponse>('/mobile/agents');
    console.log('[AgentAPI] getAgents - found:', data.agents?.length || 0);
    return data;
  },

  /**
   * Get details of a specific agent.
   * Includes permissions, spending limits, and usage.
   *
   * @param agentId The agent ID
   */
  async getAgent(agentId: string): Promise<AgentDetailResponse> {
    console.log('[AgentAPI] getAgent - fetching:', agentId);
    const { data } = await apiClient.get<AgentDetailResponse>(`/mobile/agents/${agentId}`);
    console.log('[AgentAPI] getAgent - received:', data.agent?.name);
    return data;
  },

  /**
   * Update agent settings.
   * User can change name, description, permissions, spending limits, or status.
   * Note: Spending limits can only be decreased, not increased.
   *
   * @param agentId The agent ID
   * @param updates Fields to update
   */
  async updateAgent(agentId: string, updates: UpdateAgentRequest): Promise<AgentDetailResponse> {
    console.log('[AgentAPI] updateAgent - updating:', agentId, updates);
    const { data } = await apiClient.patch<AgentDetailResponse>(
      `/mobile/agents/${agentId}`,
      updates
    );
    console.log('[AgentAPI] updateAgent - updated');
    return data;
  },

  /**
   * Revoke (delete) an agent.
   * Immediately invalidates all tokens and prevents future purchases.
   * This action cannot be undone.
   *
   * @param agentId The agent ID to revoke
   */
  async revokeAgent(agentId: string): Promise<void> {
    console.log('[AgentAPI] revokeAgent - revoking:', agentId);
    await apiClient.delete(`/mobile/agents/${agentId}`);
    console.log('[AgentAPI] revokeAgent - revoked');
  },

  /**
   * Rotate agent client secret.
   * Generates a new secret and immediately invalidates the old one.
   * User must update the agent configuration with the new secret.
   *
   * @param agentId The agent ID
   */
  async rotateAgentSecret(agentId: string): Promise<RotateSecretResponse> {
    console.log('[AgentAPI] rotateAgentSecret - rotating:', agentId);
    const { data } = await apiClient.post<RotateSecretResponse>(
      `/mobile/agents/${agentId}/rotate-secret`
    );
    console.log('[AgentAPI] rotateAgentSecret - rotated');
    return data;
  },

  /**
   * Suspend an agent.
   * Temporarily disables the agent without revoking it.
   * Convenience method that calls updateAgent with status: 'suspended'.
   *
   * @param agentId The agent ID
   */
  async suspendAgent(agentId: string): Promise<AgentDetailResponse> {
    console.log('[AgentAPI] suspendAgent - suspending:', agentId);
    return this.updateAgent(agentId, { status: 'suspended' });
  },

  /**
   * Resume a suspended agent.
   * Re-enables the agent for purchases.
   * Convenience method that calls updateAgent with status: 'active'.
   *
   * @param agentId The agent ID
   */
  async resumeAgent(agentId: string): Promise<AgentDetailResponse> {
    console.log('[AgentAPI] resumeAgent - resuming:', agentId);
    return this.updateAgent(agentId, { status: 'active' });
  },

  // =============================================================================
  // Step-Up Authorization
  // =============================================================================

  /**
   * Get details of a step-up authorization request.
   * Called when user taps on a step-up notification.
   *
   * @param stepUpId The step-up request ID
   */
  async getStepUp(stepUpId: string): Promise<StepUpDetailResponse> {
    console.log('[AgentAPI] getStepUp - fetching:', stepUpId);
    const { data } = await apiClient.get<StepUpDetailResponse>(`/mobile/step-up/${stepUpId}`);
    console.log('[AgentAPI] getStepUp - received:', data.step_up?.agent_name, data.step_up?.amount);
    return data;
  },

  /**
   * Approve a step-up authorization request.
   * Requires biometric authentication before calling.
   * User can optionally select a different payment method.
   *
   * @param stepUpId The step-up request ID
   * @param input Approval details with optional payment method
   */
  async approveStepUp(
    stepUpId: string,
    input: ApproveStepUpRequest = { consent: true }
  ): Promise<StepUpApprovalResponse> {
    console.log('[AgentAPI] approveStepUp - approving:', stepUpId);
    const { data } = await apiClient.post<StepUpApprovalResponse>(
      `/mobile/step-up/${stepUpId}/approve`,
      input
    );
    console.log('[AgentAPI] approveStepUp - approved, payment_id:', data.payment_id);
    return data;
  },

  /**
   * Reject a step-up authorization request.
   * User can optionally provide a reason.
   *
   * @param stepUpId The step-up request ID
   * @param input Optional rejection reason
   */
  async rejectStepUp(
    stepUpId: string,
    input?: RejectStepUpRequest
  ): Promise<StepUpRejectionResponse> {
    console.log('[AgentAPI] rejectStepUp - rejecting:', stepUpId);
    const { data } = await apiClient.post<StepUpRejectionResponse>(
      `/mobile/step-up/${stepUpId}/reject`,
      input || {}
    );
    console.log('[AgentAPI] rejectStepUp - rejected');
    return data;
  },

  // =============================================================================
  // OAuth Authorization
  // =============================================================================

  /**
   * Get details of an OAuth authorization request.
   * Called when user taps on an OAuth authorization notification.
   *
   * @param authorizationId The OAuth authorization request ID
   */
  async getOAuthAuthorization(authorizationId: string): Promise<OAuthAuthorizationDetail> {
    console.log('[AgentAPI] getOAuthAuthorization - fetching:', authorizationId);
    const { data } = await apiClient.get<OAuthAuthorizationDetail>(
      `/mobile/access-requests/oauth-authorizations/${authorizationId}`
    );
    console.log('[AgentAPI] getOAuthAuthorization - received:', data.client_name);
    return data;
  },

  /**
   * Approve an OAuth authorization request.
   * Requires biometric authentication before calling.
   * No request body needed.
   *
   * @param authorizationId The OAuth authorization request ID
   */
  async approveOAuthAuthorization(authorizationId: string): Promise<OAuthApprovalResponse> {
    console.log('[AgentAPI] approveOAuthAuthorization - approving:', authorizationId);
    const { data } = await apiClient.post<OAuthApprovalResponse>(
      `/mobile/access-requests/oauth-authorizations/${authorizationId}/approve`
    );
    console.log('[AgentAPI] approveOAuthAuthorization - approved');
    return data;
  },

  /**
   * Reject an OAuth authorization request.
   * No request body needed.
   *
   * @param authorizationId The OAuth authorization request ID
   */
  async rejectOAuthAuthorization(authorizationId: string): Promise<OAuthRejectionResponse> {
    console.log('[AgentAPI] rejectOAuthAuthorization - rejecting:', authorizationId);
    const { data } = await apiClient.post<OAuthRejectionResponse>(
      `/mobile/access-requests/oauth-authorizations/${authorizationId}/reject`
    );
    console.log('[AgentAPI] rejectOAuthAuthorization - rejected');
    return data;
  },

  // =============================================================================
  // Device Authorization (RFC 8628)
  // =============================================================================

  /**
   * Claim a device authorization code.
   * Called when user enters a code like "WSIM-A3J2K9" in the app.
   * Returns an access request that can be approved/rejected using the
   * existing access request endpoints.
   *
   * @param userCode The user code (e.g., "WSIM-A3J2K9" or "A3J2K9")
   */
  async claimDeviceCode(userCode: string): Promise<DeviceCodeClaimResponse> {
    // Normalize the code - uppercase, keep WSIM- prefix if present
    const normalizedCode = userCode.toUpperCase().trim();
    console.log('[AgentAPI] claimDeviceCode - claiming:', normalizedCode);
    const request: DeviceCodeClaimRequest = { user_code: normalizedCode };
    const { data } = await apiClient.post<DeviceCodeClaimResponse>(
      '/mobile/device-codes/claim',
      request
    );
    console.log('[AgentAPI] claimDeviceCode - claimed:', data.access_request?.agent_name);
    return data;
  },

  // Note: After claiming, use the existing access request approve/reject methods:
  // - approveAccessRequest(requestId, { consent: true })
  // - rejectAccessRequest(requestId, { reason?: "..." })

  // =============================================================================
  // Transactions
  // =============================================================================

  /**
   * Get transaction history for an agent.
   * Supports filtering by date range and status.
   *
   * @param agentId The agent ID
   * @param params Query parameters for filtering and pagination
   */
  async getAgentTransactions(
    agentId: string,
    params?: TransactionQueryParams
  ): Promise<TransactionListResponse> {
    console.log('[AgentAPI] getAgentTransactions - fetching for:', agentId, params);
    const { data } = await apiClient.get<TransactionListResponse>(
      `/mobile/agents/${agentId}/transactions`,
      { params }
    );
    console.log(
      '[AgentAPI] getAgentTransactions - found:',
      data.transactions?.length || 0,
      'of',
      data.pagination?.total || 0
    );
    return data;
  },
};
