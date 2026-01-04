/**
 * useNotifications Hook
 *
 * React hook for managing push notifications in the app.
 * Handles permission requests, token registration, and notification events.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  handleNotificationResponse,
  getInitialNotification,
  isPushNotificationsSupported,
  getNotificationPermissionStatus,
  PushTokenRegistration,
} from '../services/notifications';

interface UseNotificationsOptions {
  deviceId: string;
  isAuthenticated: boolean;
  onDeepLink?: (url: string) => void;
  onTokenRegistered?: (registration: PushTokenRegistration) => void;
}

interface UseNotificationsResult {
  permissionStatus: Notifications.PermissionStatus | null;
  isSupported: boolean;
  requestPermissions: () => Promise<PushTokenRegistration | null>;
}

/**
 * Hook for managing push notifications
 *
 * @param options Configuration options
 * @returns Notification state and methods
 */
export function useNotifications(options: UseNotificationsOptions): UseNotificationsResult {
  const { deviceId, isAuthenticated, onDeepLink, onTokenRegistered } = options;

  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(
    null
  );
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const initialNotificationHandled = useRef(false);

  const isSupported = isPushNotificationsSupported();

  // Request permissions and register token
  const requestPermissions = useCallback(async (): Promise<PushTokenRegistration | null> => {
    if (!isSupported) {
      console.log('[useNotifications] Push not supported on this device');
      return null;
    }

    const registration = await registerForPushNotifications(deviceId);

    if (registration) {
      console.log('[useNotifications] Token registered:', registration.pushToken);
      onTokenRegistered?.(registration);
    }

    // Update permission status
    const status = await getNotificationPermissionStatus();
    setPermissionStatus(status);

    return registration;
  }, [deviceId, isSupported, onTokenRegistered]);

  // Check initial permission status
  useEffect(() => {
    if (isSupported) {
      getNotificationPermissionStatus().then(setPermissionStatus);
    }
  }, [isSupported]);

  // Handle notification that launched the app (when killed)
  useEffect(() => {
    if (!isAuthenticated || initialNotificationHandled.current) {
      return;
    }

    const checkInitialNotification = async () => {
      const deepLink = await getInitialNotification();
      if (deepLink) {
        console.log('[useNotifications] Initial notification deep link:', deepLink);
        initialNotificationHandled.current = true;
        onDeepLink?.(deepLink);
      }
    };

    checkInitialNotification();
  }, [isAuthenticated, onDeepLink]);

  // Set up notification listeners
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Foreground notification received
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('[useNotifications] Foreground notification:', notification.request.content);
    });

    // Notification tapped
    responseListener.current = addNotificationResponseListener((response) => {
      const deepLink = handleNotificationResponse(response);
      if (deepLink) {
        console.log('[useNotifications] Notification tap deep link:', deepLink);
        onDeepLink?.(deepLink);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, onDeepLink]);

  // Re-register token when app comes to foreground (token refresh)
  useEffect(() => {
    if (!isAuthenticated || !isSupported) {
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Refresh token on app foreground
        const status = await getNotificationPermissionStatus();
        setPermissionStatus(status);

        if (status === 'granted') {
          const registration = await registerForPushNotifications(deviceId);
          if (registration) {
            onTokenRegistered?.(registration);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isSupported, deviceId, onTokenRegistered]);

  return {
    permissionStatus,
    isSupported,
    requestPermissions,
  };
}
