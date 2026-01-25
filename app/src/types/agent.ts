/**
 * Agent Commerce Types
 *
 * TypeScript types for the SACP (SimToolBox Agent Commerce Protocol)
 * Based on WSIM OpenAPI spec: docs/sacp/openapi-agent.yaml
 */

// =============================================================================
// Permissions & Limits
// =============================================================================

export type AgentPermission = 'browse' | 'cart' | 'purchase' | 'history';

export interface SpendingLimits {
  per_transaction: number;
  daily: number;
  monthly: number;
  currency: string;
}

export interface SpendingLimitsInput {
  per_transaction?: number;
  daily?: number;
  monthly?: number;
  currency?: string;
}

export interface SpendingUsage {
  today: number;
  this_month: number;
  last_transaction?: string;
}

// =============================================================================
// Agent Management
// =============================================================================

export type AgentStatus = 'active' | 'suspended' | 'revoked';

export interface AgentSummary {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  created_at: string;
  last_used_at?: string;
}

export interface AgentDetail extends AgentSummary {
  permissions: AgentPermission[];
  spending_limits: SpendingLimits;
  spending_usage: SpendingUsage;
}

export interface AgentListResponse {
  agents: AgentSummary[];
}

export interface AgentDetailResponse {
  agent: AgentDetail;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  permissions?: AgentPermission[];
  spending_limits?: SpendingLimitsInput;
  status?: 'active' | 'suspended';
}

export interface RotateSecretResponse {
  client_id: string;
  client_secret: string;
  rotated_at: string;
}

// =============================================================================
// Pairing Codes
// =============================================================================

export interface PairingCodeResponse {
  code: string;
  expires_at: string;
  created_at?: string;
}

// =============================================================================
// Access Requests
// =============================================================================

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AccessRequestSummary {
  id: string;
  agent_name: string;
  status: AccessRequestStatus;
  requested_permissions: AgentPermission[];
  created_at: string;
  expires_at: string;
  time_remaining_seconds?: number;
}

export interface AccessRequestDetail {
  id: string;
  agent_name: string;
  agent_description?: string;
  status: AccessRequestStatus;
  requested_permissions: AgentPermission[];
  requested_limits: SpendingLimits;
  created_at: string;
  expires_at: string;
  time_remaining_seconds?: number;
}

export interface AccessRequestListResponse {
  access_requests: AccessRequestSummary[];
}

export interface AccessRequestDetailResponse {
  access_request: AccessRequestDetail;
}

export interface ApproveAccessRequestInput {
  consent: true;
  permissions?: AgentPermission[];
  spending_limits?: SpendingLimitsInput;
}

export interface RejectAccessRequestInput {
  reason?: string;
}

export interface AccessRequestApprovalResponse {
  status: 'approved';
  agent_id: string;
  agent_name: string;
  permissions: AgentPermission[];
  spending_limits: SpendingLimits;
  approved_at: string;
}

export interface AccessRequestRejectionResponse {
  status: 'rejected';
  rejected_at: string;
}

// =============================================================================
// Step-Up Authorization
// =============================================================================

export type StepUpStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface CartItem {
  name: string;
  quantity: number;
  price: number;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand: string;
  last_four: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

export interface StepUpDetail {
  id: string;
  agent_id: string;
  agent_name: string;
  merchant_id: string;
  merchant_name: string;
  amount: number;
  currency: string;
  items?: CartItem[];
  reason: string;
  status: StepUpStatus;
  created_at: string;
  expires_at: string;
  available_payment_methods?: PaymentMethod[];
}

export interface StepUpDetailResponse {
  step_up: StepUpDetail;
}

export interface ApproveStepUpRequest {
  consent: true;
  payment_method_id?: string;
}

export interface RejectStepUpRequest {
  reason?: string;
}

export interface StepUpApprovalResponse {
  status: 'approved';
  payment_id: string;
  approved_at: string;
}

export interface StepUpRejectionResponse {
  status: 'rejected';
  payment_id: string;
  rejected_at: string;
}

// =============================================================================
// Transactions
// =============================================================================

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type ApprovalType = 'auto' | 'step_up';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  merchant_id: string;
  merchant_name: string;
  status: TransactionStatus;
  approval_type: ApprovalType;
  payment_method_last_four?: string;
  created_at: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface TransactionQueryParams {
  from?: string;
  to?: string;
  status?: TransactionStatus;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Push Notifications
// =============================================================================

export type AgentNotificationType =
  | 'agent.step_up'
  | 'agent.access_request'
  | 'agent.transaction'
  | 'agent.limit_warning'
  | 'agent.suspended';

export interface StepUpNotificationData {
  type: 'agent.step_up';
  step_up_id: string;
  agent_id: string;
  agent_name: string;
  merchant_name: string;
  amount: number;
  currency: string;
  reason: string;
  expires_at: string;
}

export interface AccessRequestNotificationData {
  type: 'agent.access_request';
  request_id: string;
  agent_name: string;
  agent_description?: string;
  requested_permissions: AgentPermission[];
  requested_limits: SpendingLimits;
  expires_at: string;
}

export interface TransactionNotificationData {
  type: 'agent.transaction';
  agent_id: string;
  agent_name: string;
  transaction_id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  status: 'completed' | 'failed';
  approval_type: ApprovalType;
}

export interface LimitWarningNotificationData {
  type: 'agent.limit_warning';
  agent_id: string;
  agent_name: string;
  limit_type: 'daily' | 'monthly';
  current_usage: number;
  limit: number;
  currency: string;
}

export interface SuspendedNotificationData {
  type: 'agent.suspended';
  agent_id: string;
  agent_name: string;
  reason: string;
}

export type AgentNotificationData =
  | StepUpNotificationData
  | AccessRequestNotificationData
  | TransactionNotificationData
  | LimitWarningNotificationData
  | SuspendedNotificationData;

// =============================================================================
// OAuth Authorization
// =============================================================================

export type OAuthAuthorizationStatus =
  | 'pending_identification'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'used';

export interface OAuthScope {
  name: string;
  description: string;
}

export interface OAuthAuthorizationDetail {
  id: string;
  client_id: string;
  client_name: string;
  status: OAuthAuthorizationStatus;
  scope: string;                    // Space-separated scope string
  scopes: OAuthScope[];             // Parsed scopes with descriptions
  created_at: string;
  expires_at: string;
  time_remaining_seconds?: number;
}

export interface OAuthApprovalResponse {
  status: 'approved';
  message: string;
}

export interface OAuthRejectionResponse {
  status: 'rejected';
  message: string;
}

// =============================================================================
// Device Authorization (RFC 8628)
// =============================================================================

/**
 * Request body for claiming a device code.
 * User enters the code shown by the AI assistant.
 */
export interface DeviceCodeClaimRequest {
  user_code: string;  // e.g., "WSIM-A3J2K9" or just "A3J2K9"
}

/**
 * Response from claiming a device code.
 * Returns the same access_request format used for agent pairing.
 * After claiming, use the existing access request approve/reject endpoints.
 */
export interface DeviceCodeClaimResponse {
  access_request: AccessRequestDetail;
}

// =============================================================================
// Error Response
// =============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  fields: Array<{
    field: string;
    message: string;
  }>;
}

export interface ValidationErrorResponse {
  error: ValidationError;
}
