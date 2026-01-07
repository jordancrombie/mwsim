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
 * Handle notification tap - extract deep link and navigate
 * Per M4: Use GET /transfers/:id for deep linking
 *
 * @param response The notification response from user interaction
 * @returns The deep link URL if present
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): string | null {
  const rawData = response.notification.request.content.data;

  if (!rawData || typeof rawData !== 'object') {
    console.log('[Notifications] No data in notification');
    return null;
  }

  // Cast with type guard
  const data = rawData as Record<string, unknown>;

  console.log('[Notifications] Handling notification tap:', data);

  // Use deep link if provided, otherwise construct from transferId
  if (typeof data.deepLink === 'string') {
    return data.deepLink;
  }

  if (typeof data.transferId === 'string') {
    return `mwsim://transfer/${data.transferId}`;
  }

  return null;
}

/**
 * Check for notification that launched the app (when app was killed)
 * Per M2: Use getLastNotificationResponseAsync on app launch
 *
 * @returns The deep link URL if app was launched from notification
 */
export async function getInitialNotification(): Promise<string | null> {
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

  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const data = rawData as Record<string, unknown>;

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
 * Check if notification is a merchant payment received
 * Handles various type formats from different backends
 */
export function isMerchantPaymentNotification(data: NotificationData): boolean {
  const transferTypes = ['transfer.received', 'transfer.completed', 'TRANSFER_RECEIVED'];
  const isTransfer = transferTypes.includes(data.type);
  return isTransfer && data.recipientType === 'merchant';
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
