/**
 * Notification Setup
 * Handles permissions and channel configuration for expo-notifications.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android notification channels
const CHANNELS = {
  reminders: {
    id: 'oopsfee-reminders',
    name: 'Promise Reminders',
    description: 'Reminders about your upcoming deadlines',
    importance: Notifications.AndroidImportance.HIGH,
  },
  checkins: {
    id: 'oopsfee-checkins',
    name: 'Daily Check-ins',
    description: 'Your daily commitment check-ins',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  urgent: {
    id: 'oopsfee-urgent',
    name: 'Urgent Alerts',
    description: 'Critical deadline warnings',
    importance: Notifications.AndroidImportance.MAX,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// PERMISSION HANDLING
// ─────────────────────────────────────────────────────────────

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Get current notification permission status.
 */
export async function getPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Request notification permissions.
 * Returns true if granted, false otherwise.
 */
export async function requestPermissions(): Promise<boolean> {
  // Check if we're on a physical device
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if notifications are enabled.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const status = await getPermissionStatus();
  return status === 'granted';
}

// ─────────────────────────────────────────────────────────────
// CHANNEL SETUP (Android)
// ─────────────────────────────────────────────────────────────

/**
 * Set up Android notification channels.
 * Call this during app initialization.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.reminders.id, {
      name: CHANNELS.reminders.name,
      description: CHANNELS.reminders.description,
      importance: CHANNELS.reminders.importance,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0B93F6',
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.checkins.id, {
      name: CHANNELS.checkins.name,
      description: CHANNELS.checkins.description,
      importance: CHANNELS.checkins.importance,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.urgent.id, {
      name: CHANNELS.urgent.name,
      description: CHANNELS.urgent.description,
      importance: CHANNELS.urgent.importance,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF453A',
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────

let isInitialized = false;

/**
 * Initialize the notification system.
 * Call this once during app startup.
 */
export async function initializeNotifications(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    // Set up Android channels
    await setupNotificationChannels();

    // Check existing permissions (don't request on startup)
    const hasPermission = await areNotificationsEnabled();

    isInitialized = true;
    return hasPermission;
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    return false;
  }
}

/**
 * Get the channel ID for a specific notification type.
 */
export function getChannelId(type: 'reminders' | 'checkins' | 'urgent'): string {
  return CHANNELS[type].id;
}

// ─────────────────────────────────────────────────────────────
// BADGE MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Set the app badge number.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the app badge.
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION LISTENERS
// ─────────────────────────────────────────────────────────────

export type NotificationReceivedListener = (
  notification: Notifications.Notification
) => void;

export type NotificationResponseListener = (
  response: Notifications.NotificationResponse
) => void;

/**
 * Add a listener for when a notification is received while app is in foreground.
 * Returns a subscription that should be removed on cleanup.
 */
export function addNotificationReceivedListener(
  listener: NotificationReceivedListener
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Add a listener for when user interacts with a notification.
 * Returns a subscription that should be removed on cleanup.
 */
export function addNotificationResponseListener(
  listener: NotificationResponseListener
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Get the last notification response (if app was opened from notification).
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

