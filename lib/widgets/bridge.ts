/**
 * Widget Bridge
 * Syncs promise data to App Groups UserDefaults for iOS widget consumption.
 */

import { getTimeRemaining } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';
import { NativeModules, Platform } from 'react-native';
import type { WidgetData, WidgetPromise, WidgetUrgency } from './types';
import { APP_GROUP_ID, WIDGET_DATA_KEY } from './types';

// Dynamic import to avoid crashes on web/Android
let SharedGroupPreferences: {
  setItem: (key: string, value: string, groupId: string) => Promise<void>;
  getItem: (key: string, groupId: string) => Promise<string | null>;
} | null = null;

async function getSharedGroupPreferences() {
  if (Platform.OS !== 'ios') return null;
  
  if (!SharedGroupPreferences) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require('react-native-shared-group-preferences');
      SharedGroupPreferences = module.default || module;
    } catch (e) {
      console.warn('[WidgetBridge] SharedGroupPreferences not available:', e);
      return null;
    }
  }
  return SharedGroupPreferences;
}

/**
 * Convert a UserPromise to lightweight WidgetPromise format
 */
function toWidgetPromise(promise: UserPromise, now: number): WidgetPromise {
  const { urgency } = getTimeRemaining(promise.deadlineAt, now);
  
  return {
    id: promise.id,
    text: promise.text,
    stake: promise.stake,
    deadlineAt: promise.deadlineAt,
    urgency: urgency as WidgetUrgency,
  };
}

/**
 * Sync active promises to the iOS widget via App Groups.
 * Call this whenever promises change (create, update, delete, status change).
 */
export async function syncToWidget(promises: UserPromise[]): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const prefs = await getSharedGroupPreferences();
  if (!prefs) return;

  const now = Date.now();

  // Filter to active promises only and sort by deadline (most urgent first)
  const activePromises = promises
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.deadlineAt - b.deadlineAt);

  // Build widget data
  const widgetData: WidgetData = {
    promises: activePromises.map((p) => toWidgetPromise(p, now)),
    totalAtStake: activePromises.reduce((sum, p) => sum + p.stake, 0),
    updatedAt: now,
  };

  try {
    // The library accepts any JSON-able value, but we stringify for Swift compatibility
    console.log('[WidgetBridge] Syncing', activePromises.length, 'promises, total:', widgetData.totalAtStake);
    await prefs.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData), APP_GROUP_ID);
    console.log('[WidgetBridge] Data written successfully');
    
    // Trigger widget refresh via WidgetKit
    reloadWidget();
  } catch (e) {
    console.error('[WidgetBridge] Failed to sync widget data:', e);
  }
}

/**
 * Clear widget data (e.g., when all promises are cleared)
 */
export async function clearWidgetData(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const prefs = await getSharedGroupPreferences();
  if (!prefs) return;

  const emptyData: WidgetData = {
    promises: [],
    totalAtStake: 0,
    updatedAt: Date.now(),
  };

  try {
    await prefs.setItem(WIDGET_DATA_KEY, JSON.stringify(emptyData), APP_GROUP_ID);
    reloadWidget();
  } catch (e) {
    console.error('[WidgetBridge] Failed to clear widget data:', e);
  }
}

/**
 * Request iOS WidgetKit to reload all timelines.
 * This forces the widget to refresh immediately.
 */
function reloadWidget(): void {
  if (Platform.OS !== 'ios') return;

  try {
    // WidgetKit reload is exposed via native module
    const { WidgetKitModule } = NativeModules;
    if (WidgetKitModule?.reloadAllTimelines) {
      console.log('[WidgetBridge] Calling WidgetKitModule.reloadAllTimelines()');
      WidgetKitModule.reloadAllTimelines();
    } else {
      console.log('[WidgetBridge] WidgetKitModule not available, available modules:', Object.keys(NativeModules).filter(k => k.toLowerCase().includes('widget')));
    }
  } catch (e) {
    // Widget module might not be available yet - that's OK
    console.warn('[WidgetBridge] WidgetKit reload error:', e);
  }
}

