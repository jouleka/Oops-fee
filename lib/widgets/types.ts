/**
 * Widget Data Types
 * These types are shared between the React Native app and the iOS widget.
 * The widget reads JSON data from App Groups UserDefaults.
 */

export type WidgetUrgency = 'low' | 'medium' | 'high' | 'critical';

/**
 * Lightweight promise data for widget display.
 * Only includes fields the widget needs to render.
 */
export interface WidgetPromise {
  id: string;
  text: string;
  stake: number;
  deadlineAt: number; // ms since epoch
  urgency: WidgetUrgency;
}

/**
 * Complete widget data payload stored in App Groups.
 * This is what the Swift widget reads from UserDefaults.
 */
export interface WidgetData {
  /** Active promises sorted by deadline (most urgent first) */
  promises: WidgetPromise[];
  /** Total $ at stake across all active promises */
  totalAtStake: number;
  /** Last update timestamp */
  updatedAt: number;
}

/** App Group identifier - must match iOS entitlements */
export const APP_GROUP_ID = 'group.com.oopsfee.app';

/** UserDefaults key for widget data */
export const WIDGET_DATA_KEY = 'widget_data';

