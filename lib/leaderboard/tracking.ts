/**
 * Leaderboard Position Tracking
 *
 * Stores last known leaderboard positions to detect rank changes.
 * Used to show ▲/▼ indicators and trigger notifications.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GloryMetric, Period, ShameMetric } from './api';

const STORAGE_KEY = 'oopsfee.leaderboard.positions.v1';
const MAX_ENTRIES = 50; // Limit stored positions to prevent unbounded growth

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type LeaderboardScope = 'friends' | 'global';

export interface LeaderboardPosition {
  metric: GloryMetric | ShameMetric;
  scope: LeaderboardScope;
  period: Period;
  rank: number;
  value: number;
  timestamp: number;
}

interface PositionStore {
  positions: LeaderboardPosition[];
}

export interface RankChange {
  previousRank: number | null;
  currentRank: number;
  change: number | null;
  isImproved: boolean;
  isDeclined: boolean;
  isNew: boolean;
}

// ─────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readPositions(): Promise<LeaderboardPosition[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = safeParseJson<PositionStore>(raw);
  return parsed?.positions ?? [];
}

async function writePositions(positions: LeaderboardPosition[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ positions }));
}

// ─────────────────────────────────────────────────────────────
// POSITION KEY
// ─────────────────────────────────────────────────────────────

/**
 * Creates a unique key for a leaderboard position lookup.
 */
function positionKey(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period
): string {
  return `${scope}:${metric}:${period}`;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Get the last known position for a specific leaderboard view.
 */
export async function getLastPosition(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period
): Promise<LeaderboardPosition | null> {
  const positions = await readPositions();
  const key = positionKey(scope, metric, period);

  return (
    positions.find(
      (p) => positionKey(p.scope, p.metric, p.period) === key
    ) ?? null
  );
}

/**
 * Save the current position after viewing a leaderboard.
 * Updates existing entry or adds new one.
 */
export async function savePosition(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period,
  rank: number,
  value: number
): Promise<void> {
  const positions = await readPositions();
  const key = positionKey(scope, metric, period);

  // Remove existing entry for this key
  const filtered = positions.filter(
    (p) => positionKey(p.scope, p.metric, p.period) !== key
  );

  const newPosition: LeaderboardPosition = {
    scope,
    metric,
    period,
    rank,
    value,
    timestamp: Date.now(),
  };

  // Add new position at the beginning, trim to max entries
  const updated = [newPosition, ...filtered].slice(0, MAX_ENTRIES);

  await writePositions(updated);
}

/**
 * Calculate the rank change between last known position and current rank.
 * Returns change info for display (positive = improved, negative = declined).
 */
export async function calculateRankChange(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period,
  currentRank: number
): Promise<RankChange> {
  const lastPosition = await getLastPosition(scope, metric, period);

  if (!lastPosition) {
    return {
      previousRank: null,
      currentRank,
      change: null,
      isImproved: false,
      isDeclined: false,
      isNew: true,
    };
  }

  // For ranks: lower number = better, so positive change means improvement
  // Previous rank 5, current rank 3 = improved by 2 positions
  const change = lastPosition.rank - currentRank;

  return {
    previousRank: lastPosition.rank,
    currentRank,
    change,
    isImproved: change > 0,
    isDeclined: change < 0,
    isNew: false,
  };
}

/**
 * Calculate and save position in one operation.
 * Useful when viewing a leaderboard - get the change and save new position atomically.
 */
export async function trackPosition(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period,
  rank: number,
  value: number
): Promise<RankChange> {
  const change = await calculateRankChange(scope, metric, period, rank);
  await savePosition(scope, metric, period, rank, value);
  return change;
}

/**
 * Get all stored positions, sorted by most recent.
 */
export async function getAllPositions(): Promise<LeaderboardPosition[]> {
  const positions = await readPositions();
  return positions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get positions for a specific scope (friends or global).
 */
export async function getPositionsByScope(
  scope: LeaderboardScope
): Promise<LeaderboardPosition[]> {
  const positions = await readPositions();
  return positions
    .filter((p) => p.scope === scope)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Check if user has improved to a top-3 position since last check.
 * Useful for triggering celebration/notification.
 */
export async function checkTopThreeAchievement(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period,
  currentRank: number
): Promise<{ achieved: boolean; isNewToTopThree: boolean }> {
  const isTopThree = currentRank >= 1 && currentRank <= 3;

  if (!isTopThree) {
    return { achieved: false, isNewToTopThree: false };
  }

  const lastPosition = await getLastPosition(scope, metric, period);

  // New to leaderboard and in top 3
  if (!lastPosition) {
    return { achieved: true, isNewToTopThree: true };
  }

  // Was not in top 3 before, now is
  const wasTopThree = lastPosition.rank >= 1 && lastPosition.rank <= 3;
  return {
    achieved: true,
    isNewToTopThree: !wasTopThree,
  };
}

/**
 * Check if user just hit #1.
 */
export async function checkFirstPlaceAchievement(
  scope: LeaderboardScope,
  metric: GloryMetric | ShameMetric,
  period: Period,
  currentRank: number
): Promise<{ achieved: boolean; isNewFirstPlace: boolean }> {
  if (currentRank !== 1) {
    return { achieved: false, isNewFirstPlace: false };
  }

  const lastPosition = await getLastPosition(scope, metric, period);

  if (!lastPosition || lastPosition.rank !== 1) {
    return { achieved: true, isNewFirstPlace: true };
  }

  return { achieved: true, isNewFirstPlace: false };
}

/**
 * Clear all stored positions (for testing/debug).
 */
export async function clearPositions(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the timestamp of when positions were last updated.
 */
export async function getLastUpdateTime(): Promise<number | null> {
  const positions = await readPositions();
  if (positions.length === 0) return null;

  return Math.max(...positions.map((p) => p.timestamp));
}


