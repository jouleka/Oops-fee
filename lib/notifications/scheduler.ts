/**
 * Notification Scheduler
 * Schedules and cancels notifications for promises.
 * Uses progressive "mean" messaging based on deadline proximity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import {
  CHECKIN_REMINDERS,
  DEADLINE_REMINDERS,
  formatMessage,
  MOMENTUM_NOTIFICATIONS,
  pickRandom,
  STAKE_REMINDERS,
  STREAK_NOTIFICATIONS,
} from '@/constants/notification-copy';
import type { UserPromise } from '@/lib/promises/types';
import { areNotificationsEnabled, getChannelId } from './setup';

const SCHEDULED_KEY = 'oopsfee.scheduled-notifications.v1';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ScheduledNotification {
  identifier: string;
  promiseId: string;
  type: 'reminder' | 'checkin' | 'expired';
  triggerAt: number;
}

interface ScheduledState {
  notifications: ScheduledNotification[];
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────

async function readScheduled(): Promise<ScheduledNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (!raw) return [];
    const state = JSON.parse(raw) as ScheduledState;
    return state.notifications ?? [];
  } catch {
    return [];
  }
}

async function writeScheduled(notifications: ScheduledNotification[]): Promise<void> {
  await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify({ notifications }));
}

async function addScheduledRecord(record: ScheduledNotification): Promise<void> {
  const existing = await readScheduled();
  await writeScheduled([...existing, record]);
}

async function removeScheduledRecords(promiseId: string): Promise<void> {
  const existing = await readScheduled();
  await writeScheduled(existing.filter((n) => n.promiseId !== promiseId));
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION CONTENT
// ─────────────────────────────────────────────────────────────

function getDeadlineMessage(
  tier: keyof typeof DEADLINE_REMINDERS,
  promise: UserPromise
): { title: string; body: string } {
  const messages = DEADLINE_REMINDERS[tier];
  const body = formatMessage(pickRandom(messages), {
    stake: promise.stake,
    promise: promise.text,
  });

  // Title based on urgency
  const titles: Record<keyof typeof DEADLINE_REMINDERS, string> = {
    day7: 'Promise Reminder',
    day3: 'Getting Closer...',
    day1: 'Tomorrow\'s the Day',
    hour6: 'Hours Left',
    hour1: 'Final Hour',
    expired: 'Time\'s Up',
  };

  return {
    title: titles[tier],
    body,
  };
}

// ─────────────────────────────────────────────────────────────
// SCHEDULING LOGIC
// ─────────────────────────────────────────────────────────────

/**
 * Calculate which reminder tiers apply based on deadline.
 */
function calculateReminderTimes(deadline: number, now: number = Date.now()): {
  tier: keyof typeof DEADLINE_REMINDERS;
  triggerAt: number;
}[] {
  const msRemaining = deadline - now;
  if (msRemaining <= 0) return [];

  const reminders: { tier: keyof typeof DEADLINE_REMINDERS; triggerAt: number }[] = [];

  // 7 days before (if deadline is more than 7 days away)
  const day7Before = deadline - 7 * 24 * 60 * 60 * 1000;
  if (day7Before > now) {
    reminders.push({ tier: 'day7', triggerAt: day7Before });
  }

  // 3 days before
  const day3Before = deadline - 3 * 24 * 60 * 60 * 1000;
  if (day3Before > now) {
    reminders.push({ tier: 'day3', triggerAt: day3Before });
  }

  // 1 day before
  const day1Before = deadline - 24 * 60 * 60 * 1000;
  if (day1Before > now) {
    reminders.push({ tier: 'day1', triggerAt: day1Before });
  }

  // 6 hours before
  const hour6Before = deadline - 6 * 60 * 60 * 1000;
  if (hour6Before > now) {
    reminders.push({ tier: 'hour6', triggerAt: hour6Before });
  }

  // 1 hour before
  const hour1Before = deadline - 60 * 60 * 1000;
  if (hour1Before > now) {
    reminders.push({ tier: 'hour1', triggerAt: hour1Before });
  }

  // At deadline (expired)
  if (deadline > now) {
    reminders.push({ tier: 'expired', triggerAt: deadline });
  }

  return reminders;
}

/**
 * Schedule all reminder notifications for a promise.
 * Cancels existing notifications first to prevent duplicates.
 */
export async function schedulePromiseReminders(promise: UserPromise): Promise<void> {
  // Cancel existing notifications first to prevent duplicates
  await cancelPromiseReminders(promise.id);

  const hasPermission = await areNotificationsEnabled();
  if (!hasPermission) return;

  const now = Date.now();
  const reminders = calculateReminderTimes(promise.deadlineAt, now);

  for (const { tier, triggerAt } of reminders) {
    const { title, body } = getDeadlineMessage(tier, promise);
    const secondsFromNow = Math.max(1, Math.floor((triggerAt - now) / 1000));

    let identifier: string | null = null;
    try {
      identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            promiseId: promise.id,
            type: 'reminder',
            tier,
          },
          sound: tier === 'hour1' || tier === 'expired' ? 'default' : false,
          categoryIdentifier: 'promise-reminder',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
          channelId: tier === 'hour1' || tier === 'expired'
            ? getChannelId('urgent')
            : getChannelId('reminders'),
        },
      });

      await addScheduledRecord({
        identifier,
        promiseId: promise.id,
        type: 'reminder',
        triggerAt,
      });
    } catch (error) {
      console.error(`Failed to schedule ${tier} reminder:`, error);
      // If notification was scheduled but record failed, try to cancel it
      if (identifier) {
        Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
      }
    }
  }
}

/**
 * Cancel all scheduled notifications for a promise.
 */
export async function cancelPromiseReminders(promiseId: string): Promise<void> {
  const scheduled = await readScheduled();
  const toCancel = scheduled.filter((n) => n.promiseId === promiseId);

  await Promise.all(
    toCancel.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {
        // Ignore errors - notification might have already fired
      })
    )
  );

  await removeScheduledRecords(promiseId);
}

/**
 * Reschedule notifications for a promise (e.g., after deadline change).
 */
export async function reschedulePromiseReminders(promise: UserPromise): Promise<void> {
  await cancelPromiseReminders(promise.id);
  if (promise.status === 'active') {
    await schedulePromiseReminders(promise);
  }
}

// ─────────────────────────────────────────────────────────────
// DAILY CHECK-IN
// ─────────────────────────────────────────────────────────────

const DAILY_CHECKIN_ID = 'oopsfee-daily-checkin';

/**
 * Schedule daily check-in notification.
 * Fires at 9 AM local time.
 */
export async function scheduleDailyCheckIn(): Promise<void> {
  const hasPermission = await areNotificationsEnabled();
  if (!hasPermission) return;

  // Cancel existing first
  await cancelDailyCheckIn();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_CHECKIN_ID,
      content: {
        title: 'Daily Check-in',
        body: pickRandom(CHECKIN_REMINDERS.morning),
        data: { type: 'checkin' },
        categoryIdentifier: 'daily-checkin',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
        channelId: getChannelId('checkins'),
      },
    });
  } catch (error) {
    console.error('Failed to schedule daily check-in:', error);
  }
}

/**
 * Cancel the daily check-in notification.
 */
export async function cancelDailyCheckIn(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_CHECKIN_ID);
  } catch {
    // Ignore if not scheduled
  }
}

// ─────────────────────────────────────────────────────────────
// STAKE SUMMARY
// ─────────────────────────────────────────────────────────────

const STAKE_SUMMARY_ID = 'oopsfee-stake-summary';

/**
 * Schedule a weekly stake summary notification.
 * Fires on Sunday at 8 PM.
 */
export async function scheduleWeeklyStakeSummary(totalAtStake: number): Promise<void> {
  if (totalAtStake <= 0) return;

  const hasPermission = await areNotificationsEnabled();
  if (!hasPermission) return;

  // Cancel existing first
  await cancelWeeklyStakeSummary();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STAKE_SUMMARY_ID,
      content: {
        title: 'Weekly Summary',
        body: formatMessage(pickRandom(STAKE_REMINDERS), { total: totalAtStake }),
        data: { type: 'summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday (expo-notifications: 1=Sunday...7=Saturday)
        hour: 20,
        minute: 0,
        channelId: getChannelId('reminders'),
      },
    });
  } catch (error) {
    console.error('Failed to schedule stake summary:', error);
  }
}

/**
 * Cancel the weekly stake summary.
 */
export async function cancelWeeklyStakeSummary(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STAKE_SUMMARY_ID);
  } catch {
    // Ignore if not scheduled
  }
}

// ─────────────────────────────────────────────────────────────
// WEEKLY MOMENTUM
// ─────────────────────────────────────────────────────────────

const WEEKLY_MOMENTUM_ID = 'oopsfee-weekly-momentum';

interface WeeklyMomentumStats {
  completed: number;
  failed: number;
  totalPromises: number;
  totalSaved: number;
}

/**
 * Schedule weekly momentum notification.
 * Fires on Sunday at 7 PM. Celebrates wins and builds positive identity.
 */
export async function scheduleWeeklyMomentum(stats: WeeklyMomentumStats): Promise<void> {
  // Skip if no completions to celebrate
  if (stats.completed === 0) return;

  const hasPermission = await areNotificationsEnabled();
  if (!hasPermission) return;

  // Cancel existing first to reschedule with fresh stats
  await cancelWeeklyMomentum();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_MOMENTUM_ID,
      content: {
        title: '📊 Weekly Wins',
        body: formatMessage(pickRandom(MOMENTUM_NOTIFICATIONS.weeklySummary), {
          kept: stats.completed,
          failed: stats.failed,
          total: stats.totalPromises,
          saved: stats.totalSaved,
        }),
        data: { type: 'momentum' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday (expo-notifications: 1=Sunday...7=Saturday)
        hour: 19,
        minute: 0,
        channelId: getChannelId('reminders'),
      },
    });
  } catch (error) {
    console.error('Failed to schedule weekly momentum:', error);
  }
}

/**
 * Cancel the weekly momentum notification.
 */
export async function cancelWeeklyMomentum(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_MOMENTUM_ID);
  } catch {
    // Ignore if not scheduled
  }
}

// ─────────────────────────────────────────────────────────────
// IMMEDIATE NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Send an immediate notification (for testing or immediate alerts).
 */
export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string | null> {
  const hasPermission = await areNotificationsEnabled();
  if (!hasPermission) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// STREAK MILESTONES
// ─────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [7, 30, 100] as const;

/**
 * Check if the new streak hits a milestone and send celebration notification.
 * Milestones: 7 (Week Warrior), 30 (Monthly Monster), 100 (Promise Royalty)
 */
export async function checkStreakMilestone(newStreak: number): Promise<void> {
  if (!STREAK_MILESTONES.includes(newStreak as 7 | 30 | 100)) return;

  const tier = `milestone${newStreak}` as keyof typeof STREAK_NOTIFICATIONS;
  const messages = STREAK_NOTIFICATIONS[tier];
  
  if (!messages || !Array.isArray(messages)) return;

  await sendImmediateNotification(
    `🔥 ${newStreak}-day streak!`,
    pickRandom(messages),
    { type: 'streak_milestone', streak: newStreak }
  );
}

// ─────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await writeScheduled([]);
}

/**
 * Get count of scheduled notifications.
 */
export async function getScheduledCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}

/**
 * Debug: Get all scheduled notification details.
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

