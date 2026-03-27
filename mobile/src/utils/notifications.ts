/**
 * Push Notifications Setup for Expo
 * Handles device token registration and notification listeners
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useEffect } from 'react';

export interface PushNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'system';
  title: string;
  body: string;
  data: {
    postId?: string;
    userId?: string;
    conversationId?: string;
    actionUrl?: string;
  };
  timestamp: string;
}

/**
 * Configure Expo Notifications
 */
export async function configureNotifications() {
  // Configure notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Request permissions
  const permission = await requestNotificationPermissions();
  return permission;
}

/**
 * Request notification permissions with platform-specific handling
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('Notifications require a physical device');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.error('Failed to request notification permissions:', err);
    return false;
  }
}

/**
 * Get device push token
 * Must be called after requesting permissions
 */
export async function getDevicePushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Cannot get device token on simulator/emulator');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || 'railgram',
    });

    return pushTokenData.data;
  } catch (err) {
    console.error('Failed to get device token:', err);
    return null;
  }
}

/**
 * Register device token with backend
 */
export async function registerDeviceToken(
  token: string,
  authToken: string,
  baseUrl = 'https://railgram.in'
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/device-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_token: token,
        platform: Platform.OS,
        device_name: Device.deviceName,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('Failed to register device token:', err);
    return false;
  }
}

/**
 * React hook for notification setup and listeners
 */
export function usePushNotifications(
  authToken: string | null,
  onNotificationReceived?: (notification: PushNotification) => void,
  onNotificationInteraction?: (notification: PushNotification) => void
) {
  useEffect(() => {
    if (!authToken) return;

    let unsubscribeListeners: (() => void)[] = [];

    async function setupNotifications() {
      // Configure notifications
      const hasPermission = await configureNotifications();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return;
      }

      // Get and register device token
      const deviceToken = await getDevicePushToken();
      if (deviceToken && authToken) {
        await registerDeviceToken(deviceToken, authToken);
      }

      // Listen for notifications (app in foreground)
      const notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          const pushNotif = parsePushNotification(notification);
          onNotificationReceived?.(pushNotif);
        }
      );

      // Listen for notification interactions (app in background or tapped)
      const responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const notification = response.notification;
          const pushNotif = parsePushNotification(notification);
          onNotificationInteraction?.(pushNotif);
        }
      );

      unsubscribeListeners.push(
        () => notificationListener.remove(),
        () => responseListener.remove()
      );
    }

    setupNotifications().catch(console.error);

    return () => {
      unsubscribeListeners.forEach((unsub) => unsub());
    };
  }, [authToken, onNotificationReceived, onNotificationInteraction]);
}

/**
 * Parse Expo notification to internal format
 */
function parsePushNotification(notification: Notifications.Notification): PushNotification {
  const request = notification.request;
  const content = request.content;
  const data = content.data || {};

  return {
    id: request.identifier,
    type: (data.type as any) || 'system',
    title: content.title || 'Notification',
    body: content.body || '',
    data: {
      postId: data.postId as string | undefined,
      userId: data.userId as string | undefined,
      conversationId: data.conversationId as string | undefined,
      actionUrl: data.actionUrl as string | undefined,
    },
    timestamp: new Date(notification.date || Date.now()).toISOString(),
  };
}

/**
 * Handle notification navigation (called from app on notification tap)
 * Returns the route and params to navigate to
 */
export function getNavigationFromNotification(
  notification: PushNotification
): { route: string; params: any } | null {
  const { type, data } = notification;

  switch (type) {
    case 'like':
    case 'comment':
    case 'mention':
      if (data.postId) {
        return { route: 'PostDetail', params: { postId: data.postId } };
      }
      break;

    case 'follow':
      if (data.userId) {
        // Navigate to user profile screen when it's added
        // For now, go to leaderboard
        return { route: 'Leaderboard', params: {} };
      }
      break;

    case 'message':
      if (data.conversationId) {
        return { route: 'ChatRoom', params: { conversationId: data.conversationId } };
      }
      break;

    case 'system':
    default:
      if (data.actionUrl) {
        // Deep link handling (future)
        console.log('Deep link:', data.actionUrl);
      }
      break;
  }

  return null;
}

/**
 * Send local test notification (for development)
 */
export async function sendTestNotification(
  type: PushNotification['type'] = 'system',
  title = 'Test Notification',
  body = 'This is a test notification'
) {
  if (!Device.isDevice) {
    console.warn('Test notifications require a physical device');
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type,
          timestamp: new Date().toISOString(),
        },
        sound: true,
        badge: 1,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch (err) {
    console.error('Failed to send test notification:', err);
  }
}
