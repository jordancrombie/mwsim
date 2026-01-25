/**
 * Push Notification Service
 *
 * Handles push notification registration, permissions, and event handling.
 * Phase 3 of Push Notification Project.
 *
 * @see LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_PROPOSAL.md
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';

// Types
export interface PushTokenRegistration {
  deviceId: string;
  pushToken: string;
  platform: 'ios' | 'android';
  tokenType: 'apns' | 'fcm'; // Native token types (no Expo dependency)
}

export interface NotificationData {
  type: 'transfer.received' | 'transfer.completed' | 'transfer.failed' | 'auth.challenge' | 'TRANSFER_RECEIVED'
    // Agent notification types (SACP)
    | 'agent.step_up' | 'agent.access_request' | 'agent.transaction' | 'agent.limit_warning' | 'agent.suspended'
    // OAuth authorization
    | 'oauth.authorization';
  transferId?: string;
  deepLink?: string;
  // Extended payment fields (from WSIM push notifications)
  // Aligned with TransferSim webhook spec: transfer.completed
  amount?: number;
  senderName?: string;              // senderDisplayName from webhook
  recipientType?: 'individual' | 'merchant';  // lowercase per spec
  merchantName?: string;            // Only populated when recipientType is "merchant"
  // Agent notification fields (SACP)
  step_up_id?: string;              // For agent.step_up
  request_id?: string;              // For agent.access_request
  agent_id?: string;                // For agent notifications
  agent_name?: string;              // Agent display name
}

/**
 * Screen names for deep link navigation
 * @see LOCAL_DEPLOYMENT_PLANS/PUSH_NOTIFICATION_DEEP_LINKING_PROPOSAL.md
 */
export type DeepLinkScreenName =
  // P2P Screens
  | 'TransferDetail'      // View completed transfer
  | 'RequestApproval'     // Approve/decline payment request
  | 'TransferHistory'     // All transfers
  // Contract Screens
  | 'ContractDetail'      // View/accept/fund contract
  | 'ContractsList'       // All contracts
  // Agent Screens (SACP) - mwsim names
  | 'StepUpApproval'      // Approve agent purchase
  | 'AccessRequestApproval' // Approve agent access request
  | 'AgentList'           // Manage registered agents
  | 'AgentDetail'         // View/edit specific agent
  // Agent Screens (SACP) - WSIM names (mapped to mwsim screens in App.tsx)
  | 'AgentStepUp'         // WSIM name for StepUpApproval
  | 'AgentAccessRequest'  // WSIM name for AccessRequestApproval
  // OAuth Screens
  | 'OAuthAuthorization'  // Approve OAuth app connection
  // Future
  | 'MerchantPayment'     // Merchant transaction detail
  | 'Notification';       // Notification inbox

/**
 * Deep link destination from push notification
 * Custom fields are at root level of APNs payload (sibling to aps)
 */
export interface DeepLinkDestination {
  screen: DeepLinkScreenName;
  params: Record<string, any>;
}

/**
 * Notification types sent by WSIM
 */
export type WsimNotificationType =
  // P2P Transfers
  | 'payment_received'
  | 'payment_request'
  | 'request_approved'
  | 'request_declined'
  // Contracts (matches ContractSim webhook event_type)
  | 'contract.proposed'
  | 'contract.accepted'
  | 'contract.funded'
  | 'contract.cancelled'
  | 'contract.expired'
  | 'contract.outcome'
  | 'contract.settled'
  | 'contract.disputed'
  // Agent Commerce (SACP)
  | 'agent.step_up'           // Purchase needs approval
  | 'agent.access_request'    // Agent wants to connect
  | 'agent.transaction'       // Transaction completed
  | 'agent.limit_warning'     // Approaching spending limit
  | 'agent.suspended'         // Agent auto-suspended
  // OAuth
  | 'oauth.authorization';    // OAuth app wants to connect

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  // Show banner notification when app is in foreground
    shouldShowList: true,    // Show in notification center/list
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Check if push notifications are supported on this device
 */
export function isPushNotificationsSupported(): boolean {
  return Device.isDevice;
}

/**
 * Get current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Request notification permissions from the user
 * Per M3: Request after first successful login, not on app install
 *
 * @returns true if permission granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications not supported on simulator');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    console.log('[Notifications] Permission already granted');
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === 'granted') {
    console.log('[Notifications] Permission granted');
    return true;
  }

  console.log('[Notifications] Permission denied');
  return false;
}

/**
 * Get the native device push token (APNs for iOS, FCM for Android)
 *
 * This returns the raw device token that can be used directly with APNs/FCM,
 * bypassing Expo's push notification service for a fully self-hosted solution.
 *
 * @returns The native push token string, or null if unavailable
 */
export async function getNativeDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Push tokens not available on simulator');
    return null;
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();

    console.log('[Notifications] Got native device token:', tokenData.data);
    console.log('[Notifications] Token type:', tokenData.type); // 'ios' or 'android'

    return tokenData.data;
  } catch (error) {
    console.error('[Notifications] Error getting native device token:', error);
    return null;
  }
}

/**
 * Register for push notifications
 * Requests permission and gets the native device push token
 *
 * Uses native APNs/FCM tokens for direct communication without Expo's service.
 * This enables a fully self-hosted push notification infrastructure.
 *
 * @returns PushTokenRegistration or null if failed
 */
export async function registerForPushNotifications(
  deviceId: string
): Promise<PushTokenRegistration | null> {
  const hasPermission = await requestNotificationPermissions();

  if (!hasPermission) {
    return null;
  }

  const pushToken = await getNativeDevicePushToken();

  if (!pushToken) {
    return null;
  }

  // Determine token type based on platform
  const tokenType: 'apns' | 'fcm' = Platform.OS === 'ios' ? 'apns' : 'fcm';

  return {
    deviceId,
    pushToken,
    platform: Platform.OS as 'ios' | 'android',
    tokenType,
  };
}

/**
 * Extract notification data from APNs payload
 * Handles both direct data format and nested body format from WSIM
 *
 * WSIM sends: { aps: {...}, experienceId: "...", body: { type, screen, params } }
 * Expo may expose this as:
 *   - notification.request.content.data = { type, screen, params } (body extracted)
 *   - notification.request.content.data = { experienceId, body: {...} } (raw payload)
 */
function extractNotificationData(rawData: unknown): Record<string, unknown> | null {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const data = rawData as Record<string, unknown>;

  // Check if Expo passed the raw payload with body nested
  if ('body' in data && typeof data.body === 'object' && data.body !== null) {
    console.log('[Notifications] Extracting data from nested body object');
    return data.body as Record<string, unknown>;
  }

  // Data is at root level (normal case)
  return data;
}

/**
 * Handle notification tap - extract deep link destination
 * Supports both new screen-based format and legacy URL format
 *
 * @param response The notification response from user interaction
 * @returns DeepLinkDestination for screen navigation, or null if no deep link
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): DeepLinkDestination | null {
  const rawData = response.notification.request.content.data;
  const data = extractNotificationData(rawData);

  if (!data) {
    console.log('[Notifications] No data in notification');
    return null;
  }

  console.log('[Notifications] Handling notification tap:', data);

  // NEW FORMAT: screen + params at root level (from WSIM deep linking)
  if (typeof data.screen === 'string') {
    const screen = data.screen as DeepLinkScreenName;
    const params = (data.params as Record<string, any>) || {};
    console.log('[Notifications] Using screen-based deep link:', screen, params);
    return { screen, params };
  }

  // LEGACY FORMAT: deepLink URL string
  if (typeof data.deepLink === 'string') {
    const destination = parseDeepLinkUrl(data.deepLink);
    if (destination) {
      console.log('[Notifications] Parsed legacy deepLink URL:', destination);
      return destination;
    }
  }

  // LEGACY FORMAT: transferId only
  if (typeof data.transferId === 'string') {
    console.log('[Notifications] Using legacy transferId:', data.transferId);
    return {
      screen: 'TransferDetail',
      params: { transferId: data.transferId }
    };
  }

  // CONTRACT NOTIFICATION: type starts with "contract." + contract_id
  // Fallback if WSIM sends type without screen/params
  if (typeof data.type === 'string' && data.type.startsWith('contract.')) {
    const contractId = data.contract_id as string;
    if (contractId) {
      console.log('[Notifications] Contract notification type:', data.type, 'contractId:', contractId);
      return {
        screen: 'ContractDetail',
        params: { contractId }
      };
    }
  }

  // AGENT NOTIFICATION: type starts with "agent."
  // Handles step-up approvals, access requests, etc.
  if (typeof data.type === 'string' && data.type.startsWith('agent.')) {
    console.log('[Notifications] Agent notification type:', data.type);

    // Step-up authorization needed
    if (data.type === 'agent.step_up') {
      // Support both snake_case (step_up_id) and camelCase (stepUpId)
      const stepUpId = (data.step_up_id || data.stepUpId) as string;
      if (stepUpId) {
        console.log('[Notifications] Step-up notification, stepUpId:', stepUpId);
        return {
          screen: 'StepUpApproval',
          params: { stepUpId }
        };
      }
      console.warn('[Notifications] agent.step_up notification missing step_up_id/stepUpId');
    }

    // Agent access request
    if (data.type === 'agent.access_request') {
      // Support both snake_case (request_id) and camelCase (requestId)
      const requestId = (data.request_id || data.requestId) as string;
      if (requestId) {
        console.log('[Notifications] Access request notification, requestId:', requestId);
        return {
          screen: 'AccessRequestApproval',
          params: { requestId }
        };
      }
      console.warn('[Notifications] agent.access_request notification missing request_id/requestId');
    }

    // Transaction completed, limit warning, or suspended - go to agent detail
    if (data.type === 'agent.transaction' || data.type === 'agent.limit_warning' || data.type === 'agent.suspended') {
      // Support both snake_case (agent_id) and camelCase (agentId)
      const agentId = (data.agent_id || data.agentId) as string;
      if (agentId) {
        console.log('[Notifications] Agent event notification, agentId:', agentId);
        return {
          screen: 'AgentDetail',
          params: { agentId }
        };
      }
      // If no agent ID, go to agent list
      return {
        screen: 'AgentList',
        params: {}
      };
    }
  }

  // OAUTH NOTIFICATION: type is "oauth.authorization"
  if (typeof data.type === 'string' && data.type === 'oauth.authorization') {
    // Support both oauthAuthorizationId and oauth_authorization_id
    const oauthAuthorizationId = (data.oauthAuthorizationId || data.oauth_authorization_id) as string;
    if (oauthAuthorizationId) {
      console.log('[Notifications] OAuth authorization notification, id:', oauthAuthorizationId);
      return {
        screen: 'OAuthAuthorization',
        params: { oauthAuthorizationId }
      };
    }
    console.warn('[Notifications] oauth.authorization notification missing oauthAuthorizationId');
  }

  return null;
}

/**
 * Parse legacy deep link URL into DeepLinkDestination
 * Handles URLs like mwsim://transfer/{id}
 */
function parseDeepLinkUrl(url: string): DeepLinkDestination | null {
  // Parse mwsim://transfer/{transferId}
  const transferMatch = url.match(/mwsim:\/\/transfer\/(.+)/);
  if (transferMatch) {
    return {
      screen: 'TransferDetail',
      params: { transferId: transferMatch[1] }
    };
  }

  // Parse mwsim://contract/{contractId}
  const contractMatch = url.match(/mwsim:\/\/contract\/(.+)/);
  if (contractMatch) {
    return {
      screen: 'ContractDetail',
      params: { contractId: contractMatch[1] }
    };
  }

  // Parse mwsim://request/{requestId}
  const requestMatch = url.match(/mwsim:\/\/request\/(.+)/);
  if (requestMatch) {
    return {
      screen: 'RequestApproval',
      params: { requestId: requestMatch[1] }
    };
  }

  // Parse mwsim://step-up/{stepUpId} (agent step-up approval)
  const stepUpMatch = url.match(/mwsim:\/\/step-up\/(.+)/);
  if (stepUpMatch) {
    return {
      screen: 'StepUpApproval',
      params: { stepUpId: stepUpMatch[1] }
    };
  }

  // Parse mwsim://access-request/{requestId} (agent access request)
  const accessRequestMatch = url.match(/mwsim:\/\/access-request\/(.+)/);
  if (accessRequestMatch) {
    return {
      screen: 'AccessRequestApproval',
      params: { requestId: accessRequestMatch[1] }
    };
  }

  // Parse mwsim://agents (agent list)
  if (url === 'mwsim://agents' || url === 'mwsim://agents/') {
    return {
      screen: 'AgentList',
      params: {}
    };
  }

  // Parse mwsim://agent/{agentId} (agent detail)
  const agentMatch = url.match(/mwsim:\/\/agent\/(.+)/);
  if (agentMatch) {
    return {
      screen: 'AgentDetail',
      params: { agentId: agentMatch[1] }
    };
  }

  console.log('[Notifications] Unknown deep link URL format:', url);
  return null;
}

/**
 * Check for notification that launched the app (when app was killed)
 * Per M2: Use getLastNotificationResponseAsync on app launch
 *
 * @returns DeepLinkDestination if app was launched from notification
 */
export async function getInitialNotification(): Promise<DeepLinkDestination | null> {
  const response = await Notifications.getLastNotificationResponseAsync();

  if (!response) {
    return null;
  }

  console.log('[Notifications] App launched from notification');
  return handleNotificationResponse(response);
}

/**
 * Parse notification data from a notification
 * Returns typed NotificationData or null if invalid
 */
export function parseNotificationData(notification: Notifications.Notification): NotificationData | null {
  const rawData = notification.request.content.data;
  const data = extractNotificationData(rawData);

  if (!data) {
    return null;
  }

  // Check for valid notification type
  const validTypes = [
    'transfer.received', 'transfer.completed', 'transfer.failed', 'auth.challenge', 'TRANSFER_RECEIVED',
    // Agent notification types (SACP)
    'agent.step_up', 'agent.access_request', 'agent.transaction', 'agent.limit_warning', 'agent.suspended',
    // OAuth
    'oauth.authorization'
  ];
  if (!data.type || !validTypes.includes(data.type as string)) {
    return null;
  }

  // Parse amount - handle both number and string formats
  let amount: number | undefined;
  if (typeof data.amount === 'number') {
    amount = data.amount;
  } else if (typeof data.amount === 'string') {
    const parsed = parseFloat(data.amount);
    amount = isNaN(parsed) ? undefined : parsed;
  }

  // Parse sender name - handle both senderName and senderDisplayName
  const senderName = typeof data.senderName === 'string'
    ? data.senderName
    : typeof data.senderDisplayName === 'string'
      ? data.senderDisplayName
      : undefined;

  return {
    type: data.type as NotificationData['type'],
    transferId: typeof data.transferId === 'string' ? data.transferId : undefined,
    deepLink: typeof data.deepLink === 'string' ? data.deepLink : undefined,
    amount,
    senderName,
    recipientType: data.recipientType === 'individual' || data.recipientType === 'merchant'
      ? data.recipientType
      : undefined,
    merchantName: typeof data.merchantName === 'string' ? data.merchantName : undefined,
    // Agent notification fields
    step_up_id: typeof data.step_up_id === 'string' ? data.step_up_id : undefined,
    request_id: typeof data.request_id === 'string' ? data.request_id : undefined,
    agent_id: typeof data.agent_id === 'string' ? data.agent_id : undefined,
    agent_name: typeof data.agent_name === 'string' ? data.agent_name : undefined,
  };
}

/**
 * Check if notification is any transfer notification (regardless of recipientType)
 * Useful for refreshing dashboards when we receive money
 */
export function isTransferNotification(data: NotificationData): boolean {
  const transferTypes = ['transfer.received', 'transfer.completed', 'TRANSFER_RECEIVED'];
  return transferTypes.includes(data.type);
}

/**
 * Check if notification is a merchant payment received
 * Handles various type formats from different backends
 */
export function isMerchantPaymentNotification(data: NotificationData): boolean {
  return isTransferNotification(data) && data.recipientType === 'merchant';
}

/**
 * Check if notification is an agent notification (SACP)
 */
export function isAgentNotification(data: NotificationData): boolean {
  const agentTypes = ['agent.step_up', 'agent.access_request', 'agent.transaction', 'agent.limit_warning', 'agent.suspended'];
  return agentTypes.includes(data.type);
}

/**
 * Check if notification is a step-up approval request
 */
export function isStepUpNotification(data: NotificationData): boolean {
  return data.type === 'agent.step_up';
}

/**
 * Check if notification is an agent access request
 */
export function isAccessRequestNotification(data: NotificationData): boolean {
  return data.type === 'agent.access_request';
}

/**
 * Add listener for notification received while app is in foreground
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification tap/interaction
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Clear all delivered notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Set the app badge count (iOS only)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get the current badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Open system settings for notification permissions
 * Useful when user previously denied and wants to enable
 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
  } else {
    await Linking.openSettings();
  }
}

/**
 * Schedule a local notification for testing
 * Only use during development
 */
export async function scheduleTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Money Received!',
      body: 'Test User sent you $50.00 CAD',
      data: {
        type: 'transfer.received',
        transferId: 'test_123',
        deepLink: 'mwsim://transfer/test_123',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}
