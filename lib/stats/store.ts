/**
 * Stats Store
 * Computes and persists user statistics, streaks, and failure escalation.
 * Reads from promises to derive stats, stores check-in history separately.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CheckInRecord, UserPromise, UserStats } from '@/lib/promises/types';

const CHECKIN_STORAGE_KEY = 'oopsfee.checkins.v1';
const MAX_FAILURE_MULTIPLIER = 8;
const COMPLETIONS_TO_RESET_MULTIPLIER = 3;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// CHECK-IN PERSISTENCE
// ─────────────────────────────────────────────────────────────

interface CheckInState {
  records: CheckInRecord[];
}

async function readCheckIns(): Promise<CheckInRecord[]> {
  const raw = await AsyncStorage.getItem(CHECKIN_STORAGE_KEY);
  const parsed = safeParseJson<CheckInState>(raw);
  return parsed?.records ?? [];
}

async function writeCheckIns(records: CheckInRecord[]): Promise<void> {
  await AsyncStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify({ records }));
}

export async function getCheckInRecords(): Promise<CheckInRecord[]> {
  return readCheckIns();
}

export async function recordCheckIn(
  committed: boolean,
  activePromiseIds: string[]
): Promise<CheckInRecord> {
  const records = await readCheckIns();
  const today = getTodayDateString();

  // Remove any existing check-in for today (in case of re-check)
  const filtered = records.filter((r) => r.date !== today);

  const record: CheckInRecord = {
    date: today,
    committed,
    promiseIds: activePromiseIds,
    timestamp: Date.now(),
  };

  // Keep last 90 days of check-ins
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const trimmed = filtered.filter((r) => r.timestamp > cutoff);

  await writeCheckIns([record, ...trimmed]);
  return record;
}

export async function hasCheckedInToday(): Promise<boolean> {
  const records = await readCheckIns();
  const today = getTodayDateString();
  return records.some((r) => r.date === today);
}

export async function getTodaysCheckIn(): Promise<CheckInRecord | null> {
  const records = await readCheckIns();
  const today = getTodayDateString();
  return records.find((r) => r.date === today) ?? null;
}

// ─────────────────────────────────────────────────────────────
// STATS COMPUTATION
// ─────────────────────────────────────────────────────────────

/**
 * Computes current streak by looking at promises sorted by completion time.
 * A streak breaks when there's a failure or expiration.
 */
function computeCurrentStreak(promises: UserPromise[]): number {
  // Sort by updatedAt descending (most recent first)
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  let streak = 0;
  for (const p of sorted) {
    if (p.status === 'completed') {
      streak++;
    } else {
      // Failed or expired breaks the streak
      break;
    }
  }
  return streak;
}

/**
 * Computes longest ever streak from promise history.
 */
function computeLongestStreak(promises: UserPromise[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => a.updatedAt - b.updatedAt); // Oldest first for chronological

  let longest = 0;
  let current = 0;

  for (const p of sorted) {
    if (p.status === 'completed') {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Counts consecutive failures from most recent backwards.
 * Used for failure escalation multiplier.
 */
function countConsecutiveFailures(promises: UserPromise[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  let fails = 0;
  for (const p of sorted) {
    if (p.status === 'failed' || p.status === 'expired') {
      fails++;
    } else {
      break;
    }
  }
  return fails;
}

/**
 * Counts consecutive completions from most recent backwards.
 * Used to determine when to reset failure multiplier.
 */
function countConsecutiveCompletions(promises: UserPromise[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  let completions = 0;
  for (const p of sorted) {
    if (p.status === 'completed') {
      completions++;
    } else {
      break;
    }
  }
  return completions;
}

/**
 * Calculates failure multiplier based on consecutive failures.
 * Resets to 1x after COMPLETIONS_TO_RESET_MULTIPLIER consecutive completions.
 */
function computeFailureMultiplier(promises: UserPromise[]): number {
  const consecutiveCompletions = countConsecutiveCompletions(promises);

  // If user has enough consecutive completions, multiplier resets
  if (consecutiveCompletions >= COMPLETIONS_TO_RESET_MULTIPLIER) {
    return 1;
  }

  const consecutiveFails = countConsecutiveFailures(promises);
  if (consecutiveFails === 0) return 1;

  // Doubles with each failure: 1 fail = 2x, 2 fails = 4x, etc.
  return Math.min(MAX_FAILURE_MULTIPLIER, Math.pow(2, consecutiveFails));
}

/**
 * Computes check-in streak from records.
 */
function computeCheckInStreak(records: CheckInRecord[]): number {
  if (records.length === 0) return 0;

  // Sort by date descending
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  let streak = 0;
  let expectedDate = today;

  for (const record of sorted) {
    if (record.date === expectedDate && record.committed) {
      streak++;
      // Move expected date back one day
      const d = new Date(expectedDate);
      d.setDate(d.getDate() - 1);
      expectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else if (record.date === expectedDate && !record.committed) {
      // Checked in but said not committed - breaks streak
      break;
    } else if (expectedDate === today && record.date === yesterday) {
      // Haven't checked in today yet, but yesterday counts
      expectedDate = yesterday;
      if (record.committed) {
        streak++;
        const d = new Date(expectedDate);
        d.setDate(d.getDate() - 1);
        expectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else {
        break;
      }
    } else {
      // Gap in dates - streak broken
      break;
    }
  }

  return streak;
}

/**
 * Computes missed consecutive check-ins (for auto-fail feature).
 */
function computeMissedCheckIns(records: CheckInRecord[]): number {
  const today = getTodayDateString();
  const todayRecord = records.find((r) => r.date === today);

  // If checked in today, no misses
  if (todayRecord) return 0;

  // Count backwards from yesterday
  let missed = 0;
  let checkDate = new Date();
  checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 7; i++) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const record = records.find((r) => r.date === dateStr);

    if (!record) {
      missed++;
    } else {
      break;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return missed;
}

/**
 * Main stats computation from promises and check-in records.
 */
export async function computeStats(promises: UserPromise[]): Promise<UserStats> {
  const checkInRecords = await readCheckIns();

  const completed = promises.filter((p) => p.status === 'completed').length;
  const failed = promises.filter((p) => p.status === 'failed').length;
  const expired = promises.filter((p) => p.status === 'expired').length;
  const totalDecided = completed + failed + expired;

  const totalAtRisk = promises.reduce((sum, p) => sum + p.stake, 0);
  const totalSaved = promises
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.stake, 0);
  const totalLost = promises
    .filter((p) => p.status === 'failed' || p.status === 'expired')
    .reduce((sum, p) => sum + p.stake, 0);

  const successRate = totalDecided > 0 ? Math.round((completed / totalDecided) * 100) : 0;

  const currentStreak = computeCurrentStreak(promises);
  const longestStreak = computeLongestStreak(promises);
  const failureMultiplier = computeFailureMultiplier(promises);
  const consecutiveCompletions = countConsecutiveCompletions(promises);

  const checkInStreak = computeCheckInStreak(checkInRecords);
  const missedCheckIns = computeMissedCheckIns(checkInRecords);
  const lastCheckIn = checkInRecords.length > 0 ? checkInRecords[0]?.timestamp : undefined;

  return {
    totalPromises: promises.length,
    completed,
    failed,
    expired,
    successRate,
    currentStreak,
    longestStreak,
    totalAtRisk,
    totalSaved,
    totalLost,
    failureMultiplier,
    consecutiveCompletions,
    lastCheckIn,
    checkInStreak,
    missedCheckIns,
  };
}

/**
 * Quick helper to get just the failure multiplier without full stats.
 */
export function getFailureMultiplier(promises: UserPromise[]): number {
  return computeFailureMultiplier(promises);
}

/**
 * Get the stake with failure multiplier applied.
 */
export function getAdjustedStake(baseStake: number, promises: UserPromise[]): number {
  const multiplier = computeFailureMultiplier(promises);
  return baseStake * multiplier;
}

/**
 * Check if user should be warned about failure multiplier.
 */
export function shouldShowMultiplierWarning(promises: UserPromise[]): boolean {
  return computeFailureMultiplier(promises) > 1;
}

/**
 * Get progress towards resetting the multiplier.
 */
export function getMultiplierResetProgress(promises: UserPromise[]): {
  current: number;
  needed: number;
  multiplier: number;
} {
  const consecutiveCompletions = countConsecutiveCompletions(promises);
  const multiplier = computeFailureMultiplier(promises);

  return {
    current: Math.min(consecutiveCompletions, COMPLETIONS_TO_RESET_MULTIPLIER),
    needed: COMPLETIONS_TO_RESET_MULTIPLIER,
    multiplier,
  };
}

/**
 * Clear all check-in records (for testing/debug).
 */
export async function clearCheckIns(): Promise<void> {
  await AsyncStorage.removeItem(CHECKIN_STORAGE_KEY);
}

