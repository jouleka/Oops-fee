/**
 * Leaderboard API
 *
 * Client-side functions for leaderboard operations.
 */

import { supabase } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

// Glory metrics (higher = better)
export type GloryMetric =
  | 'success_rate'
  | 'current_streak'
  | 'longest_streak'
  | 'money_saved'
  | 'completed';

// Shame metrics (higher = worse = higher rank on wall of shame)
export type ShameMetric = 'money_lost' | 'failed' | 'worst_success_rate' | 'current_losing_streak';

// Global leaderboard only supports a subset of metrics
export type GlobalMetric = 'success_rate' | 'money_saved' | 'completed' | 'money_lost' | 'failed';

export type Period = 'week' | 'month' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  value: number;
  change: number | null;
  is_current_user: boolean;
}

// ─────────────────────────────────────────────────────────────
// FRIENDS LEADERBOARD
// ─────────────────────────────────────────────────────────────

export interface FriendsLeaderboardRequest {
  metric: GloryMetric | ShameMetric;
  period: Period;
  shame_mode?: boolean;
}

export interface FriendsLeaderboardResponse {
  rankings: LeaderboardEntry[];
  current_user_rank: number;
  total_friends: number;
}

/**
 * Fetch leaderboard rankings among the user's friends.
 * Includes the current user in the rankings.
 */
export async function fetchFriendsLeaderboard(
  options: FriendsLeaderboardRequest
): Promise<FriendsLeaderboardResponse> {
  const response = await supabase.functions.invoke('get-friends-leaderboard', {
    body: {
      metric: options.metric,
      period: options.period,
      shame_mode: options.shame_mode ?? false,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch friends leaderboard');
  }

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL LEADERBOARD
// ─────────────────────────────────────────────────────────────

export interface GlobalLeaderboardRequest {
  metric: GlobalMetric;
  period: Period;
  limit?: number;
  offset?: number;
}

export interface GlobalLeaderboardResponse {
  rankings: LeaderboardEntry[];
  current_user_rank: number;
  total_users: number;
}

/**
 * Fetch global leaderboard rankings.
 * Uses materialized view for all-time stats (optimized).
 * Supports pagination via limit/offset.
 */
export async function fetchGlobalLeaderboard(
  options: GlobalLeaderboardRequest
): Promise<GlobalLeaderboardResponse> {
  const response = await supabase.functions.invoke('get-global-leaderboard', {
    body: {
      metric: options.metric,
      period: options.period,
      limit: options.limit,
      offset: options.offset,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch global leaderboard');
  }

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Format metric value for display.
 */
export function formatMetricValue(value: number, metric: GloryMetric | ShameMetric | GlobalMetric): string {
  switch (metric) {
    case 'success_rate':
    case 'worst_success_rate':
      return `${value}%`;
    case 'money_saved':
    case 'money_lost':
      // Values are stored in dollars (stake column is in dollars)
      return `$${value.toLocaleString()}`;
    case 'current_streak':
    case 'longest_streak':
    case 'current_losing_streak':
    case 'completed':
    case 'failed':
      return value.toLocaleString();
    default:
      return String(value);
  }
}

/**
 * Get display label for metric.
 */
export function getMetricLabel(metric: GloryMetric | ShameMetric | GlobalMetric): string {
  switch (metric) {
    case 'success_rate':
      return 'Success Rate';
    case 'current_streak':
      return 'Current Streak';
    case 'longest_streak':
      return 'Longest Streak';
    case 'money_saved':
      return 'Money Saved';
    case 'completed':
      return 'Promises Kept';
    case 'money_lost':
      return 'Money Lost';
    case 'failed':
      return 'Promises Broken';
    case 'worst_success_rate':
      return 'Lowest Success Rate';
    case 'current_losing_streak':
      return 'Losing Streak';
    default:
      return 'Score';
  }
}

/**
 * Get the available metrics for a leaderboard scope.
 */
export function getAvailableMetrics(scope: 'friends' | 'global', shameMode: boolean): string[] {
  if (scope === 'global') {
    return shameMode
      ? ['money_lost', 'failed']
      : ['success_rate', 'money_saved', 'completed'];
  }

  // Friends leaderboard supports all metrics including streaks
  return shameMode
    ? ['money_lost', 'failed', 'worst_success_rate', 'current_losing_streak']
    : ['success_rate', 'current_streak', 'longest_streak', 'money_saved', 'completed'];
}

/**
 * Get display label for period.
 */
export function getPeriodLabel(period: Period): string {
  switch (period) {
    case 'week':
      return 'This Week';
    case 'month':
      return 'This Month';
    case 'all_time':
      return 'All Time';
    default:
      return period;
  }
}

/**
 * Format rank change for display.
 */
export function formatRankChange(change: number | null): { text: string; color: 'green' | 'red' | 'gray' } {
  if (change === null || change === 0) {
    return { text: '—', color: 'gray' };
  }
  if (change > 0) {
    return { text: `▲${change}`, color: 'green' };
  }
  return { text: `▼${Math.abs(change)}`, color: 'red' };
}

