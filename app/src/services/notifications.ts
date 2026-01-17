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
  type: 'transfer.received' | 'transfer.completed' | 'transfer.failed' | 'auth.challenge' | 'TRANSFER_RECEIVED';
  transferId?: string;
  deepLink?: string;
  // Extended payment fields (from WSIM push notifications)
  // Aligned with TransferSim webhook spec: transfer.completed
  amount?: number;
  senderName?: string;              // senderDisplayName from webhook
  recipientType?: 'individual' | 'merchant';  // lowercase per spec
  merchantName?: string;            // Only populated when recipientType is "merchant"
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
  | 'contract.disputed';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
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
  const validTypes = ['transfer.received', 'transfer.completed', 'transfer.failed', 'auth.challenge', 'TRANSFER_RECEIVED'];
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
