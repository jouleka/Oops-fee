/**
 * Widget Bridge
 * Syncs promise data to platform-specific storage for widget consumption.
 * - iOS: App Groups UserDefaults via react-native-shared-group-preferences
 * - Android: SharedPreferences via custom native module
 */

import { getTimeRemaining } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';
import { NativeModules, Platform } from 'react-native';
import type { WidgetData, WidgetPromise, WidgetUrgency } from './types';
import { APP_GROUP_ID, WIDGET_DATA_KEY } from './types';

// ============================================================================
// iOS: SharedGroupPreferences for App Groups
// ============================================================================

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
      const prefs = module.default || module;
      // Validate native methods are actually available (not in Expo Go)
      if (typeof prefs?.setItem !== 'function') {
        console.log('[WidgetBridge] SharedGroupPreferences not available (Expo Go?)');
        return null;
      }
      SharedGroupPreferences = prefs;
    } catch (e) {
      console.warn('[WidgetBridge] SharedGroupPreferences not available:', e);
      return null;
    }
  }
  return SharedGroupPreferences;
}

// ============================================================================
// Android: Native WidgetModule
// ============================================================================

interface AndroidWidgetModule {
  setWidgetData: (jsonData: string) => Promise<boolean>;
  reloadAllTimelines: () => void;
  clearWidgetData: () => Promise<boolean>;
}

function getAndroidWidgetModule(): AndroidWidgetModule | null {
  if (Platform.OS !== 'android') return null;

  try {
    const { WidgetModule } = NativeModules;
    if (WidgetModule?.setWidgetData) {
      return WidgetModule as AndroidWidgetModule;
    }
    console.warn('[WidgetBridge] WidgetModule not available');
    return null;
  } catch (e) {
    console.warn('[WidgetBridge] Failed to get WidgetModule:', e);
    return null;
  }
}

// ============================================================================
// Shared Logic
// ============================================================================

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
 * Build widget data from active promises
 */
function buildWidgetData(promises: UserPromise[]): WidgetData {
  const now = Date.now();

  // Filter to active promises only and sort by deadline (most urgent first)
  const activePromises = promises
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.deadlineAt - b.deadlineAt);

  return {
    promises: activePromises.map((p) => toWidgetPromise(p, now)),
    totalAtStake: activePromises.reduce((sum, p) => sum + p.stake, 0),
    updatedAt: now,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Sync active promises to the home screen widget.
 * Call this whenever promises change (create, update, delete, status change).
 */
export async function syncToWidget(promises: UserPromise[]): Promise<void> {
  // Skip on web/unsupported platforms - native modules not available
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  const widgetData = buildWidgetData(promises);
  const jsonString = JSON.stringify(widgetData);

  console.log(
    '[WidgetBridge] Syncing',
    widgetData.promises.length,
    'promises, total:',
    widgetData.totalAtStake
  );

  if (Platform.OS === 'ios') {
    await syncToiOSWidget(jsonString);
  } else if (Platform.OS === 'android') {
    await syncToAndroidWidget(jsonString);
  }
}

/**
 * iOS-specific sync via App Groups
 */
async function syncToiOSWidget(jsonString: string): Promise<void> {
  const prefs = await getSharedGroupPreferences();
  if (!prefs || typeof prefs.setItem !== 'function') return;

  try {
    await prefs.setItem(WIDGET_DATA_KEY, jsonString, APP_GROUP_ID);
    console.log('[WidgetBridge] iOS data written successfully');
    reloadWidget();
  } catch {
    // Silently ignore in Expo Go - native module not available
    if (__DEV__) {
      console.log('[WidgetBridge] Widget sync skipped (dev build required)');
    }
  }
}

/**
 * Android-specific sync via native module
 */
async function syncToAndroidWidget(jsonString: string): Promise<void> {
  const widgetModule = getAndroidWidgetModule();
  if (!widgetModule) return;

  try {
    await widgetModule.setWidgetData(jsonString);
    console.log('[WidgetBridge] Android data written successfully');
  } catch (e) {
    console.error('[WidgetBridge] Failed to sync Android widget data:', e);
  }
}

/**
 * Clear widget data (e.g., when all promises are cleared)
 */
export async function clearWidgetData(): Promise<void> {
  // Skip on web - native modules not available
  if (Platform.OS === 'web') return;

  const emptyData: WidgetData = {
    promises: [],
    totalAtStake: 0,
    updatedAt: Date.now(),
  };
  const jsonString = JSON.stringify(emptyData);

  if (Platform.OS === 'ios') {
    const prefs = await getSharedGroupPreferences();
    if (!prefs || typeof prefs.setItem !== 'function') return;

    try {
      await prefs.setItem(WIDGET_DATA_KEY, jsonString, APP_GROUP_ID);
      reloadWidget();
    } catch {
      // Silently ignore in Expo Go
    }
  } else if (Platform.OS === 'android') {
    const widgetModule = getAndroidWidgetModule();
    if (!widgetModule) return;

    try {
      await widgetModule.clearWidgetData();
    } catch (e) {
      console.error('[WidgetBridge] Failed to clear Android widget data:', e);
    }
  }
}

/**
 * Request widget refresh.
 * This forces the widget to refresh immediately.
 */
function reloadWidget(): void {
  if (Platform.OS === 'ios') {
    try {
      const { WidgetKitModule } = NativeModules;
      if (WidgetKitModule?.reloadAllTimelines) {
        console.log('[WidgetBridge] Calling WidgetKitModule.reloadAllTimelines()');
        WidgetKitModule.reloadAllTimelines();
      } else {
        console.log(
          '[WidgetBridge] WidgetKitModule not available, available modules:',
          Object.keys(NativeModules).filter((k) => k.toLowerCase().includes('widget'))
        );
      }
    } catch (e) {
      console.warn('[WidgetBridge] WidgetKit reload error:', e);
    }
  } else if (Platform.OS === 'android') {
    const widgetModule = getAndroidWidgetModule();
    if (widgetModule?.reloadAllTimelines) {
      widgetModule.reloadAllTimelines();
    }
  }
}

