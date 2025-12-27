// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-global-leaderboard Edge Function
 *
 * Retrieves global leaderboard rankings using the materialized view.
 * Supports various metrics and time periods with pagination.
 *
 * POST /get-global-leaderboard
 * Body: {
 *   metric: 'success_rate' | 'money_saved' | 'completed' | 'money_lost' | 'failed',
 *   period: 'week' | 'month' | 'all_time',
 *   limit?: number,    // Default 50
 *   offset?: number    // For pagination
 * }
 * Returns: {
 *   rankings: Array<LeaderboardEntry>,
 *   current_user_rank: number,
 *   total_users: number
 * }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Types
type Metric = 'success_rate' | 'money_saved' | 'completed' | 'money_lost' | 'failed';
type Period = 'week' | 'month' | 'all_time';

interface LeaderboardRequest {
  metric: Metric;
  period: Period;
  limit?: number;
  offset?: number;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  value: number;
  change: number | null;
  is_current_user: boolean;
}

interface LeaderboardResponse {
  rankings: LeaderboardEntry[];
  current_user_rank: number;
  total_users: number;
}

interface LeaderboardStats {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  show_on_global_leaderboard: boolean;
  total_decided: number;
  completed: number;
  failed: number;
  money_saved: number;
  money_lost: number;
  success_rate: number | null;
  last_activity: string | null;
}

interface PromiseRecord {
  id: string;
  user_id: string;
  status: string;
  stake: number;
  updated_at: string;
}

// Glory metrics (higher = better)
const GLORY_METRICS: Metric[] = ['success_rate', 'money_saved', 'completed'];
// Shame metrics (higher = worse = higher rank)
const SHAME_METRICS: Metric[] = ['money_lost', 'failed'];
const VALID_METRICS: Metric[] = [...GLORY_METRICS, ...SHAME_METRICS];
const VALID_PERIODS: Period[] = ['week', 'month', 'all_time'];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Get the start of the current week (Monday 00:00 UTC)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust so Monday is start
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get the start of the current month (1st 00:00 UTC)
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get the column name for ordering based on metric
 */
function getOrderColumn(metric: Metric): string {
  switch (metric) {
    case 'success_rate':
      return 'success_rate';
    case 'money_saved':
      return 'money_saved';
    case 'completed':
      return 'completed';
    case 'money_lost':
      return 'money_lost';
    case 'failed':
      return 'failed';
    default:
      return 'success_rate';
  }
}

/**
 * Get metric value from stats record
 */
function getMetricValue(stats: LeaderboardStats, metric: Metric): number {
  switch (metric) {
    case 'success_rate':
      return stats.success_rate ?? 0;
    case 'money_saved':
      return stats.money_saved ?? 0;
    case 'completed':
      return stats.completed ?? 0;
    case 'money_lost':
      return stats.money_lost ?? 0;
    case 'failed':
      return stats.failed ?? 0;
    default:
      return 0;
  }
}

/**
 * Compute user stats from promise records (for period-filtered queries)
 */
function computeStatsFromPromises(
  userId: string,
  profile: { username: string; display_name: string | null; avatar_url: string | null },
  promises: PromiseRecord[],
): {
  completed: number;
  failed: number;
  money_saved: number;
  money_lost: number;
  success_rate: number | null;
} {
  const completed = promises.filter((p) => p.status === 'completed').length;
  const failed = promises.filter((p) => p.status === 'failed' || p.status === 'expired').length;
  const totalDecided = completed + failed;

  const moneySaved = promises
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.stake, 0);

  const moneyLost = promises
    .filter((p) => p.status === 'failed' || p.status === 'expired')
    .reduce((sum, p) => sum + p.stake, 0);

  // Success rate only for users with 5+ decided promises
  const successRate = totalDecided >= 5 ? Math.round((100 * completed) / totalDecided) : null;

  return {
    completed,
    failed,
    money_saved: moneySaved,
    money_lost: moneyLost,
    success_rate: successRate,
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // 1. Authenticate user (optional for global leaderboard, but needed to identify current user)
    const user = await getUserFromRequest(req);

    // 2. Parse request body
    let body: LeaderboardRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { metric, period, limit: rawLimit, offset: rawOffset } = body;

    // Validate metric
    if (!VALID_METRICS.includes(metric)) {
      return new Response(
        JSON.stringify({
          error: `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate period
    if (!VALID_PERIODS.includes(period)) {
      return new Response(
        JSON.stringify({ error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Normalize limit and offset
    const limit = Math.min(Math.max(rawLimit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(rawOffset ?? 0, 0);

    const supabase = createAdminClient();

    // 3. Handle based on period
    if (period === 'all_time') {
      // Use the materialized view for all-time stats (optimized)
      return await handleAllTimeLeaderboard(supabase, user?.id, metric, limit, offset);
    } else {
      // For week/month periods, we need to query promises directly
      return await handlePeriodLeaderboard(supabase, user?.id, metric, period, limit, offset);
    }
  } catch (error: unknown) {
    console.error('[get-global-leaderboard] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Handle all-time leaderboard using materialized view
 */
async function handleAllTimeLeaderboard(
  supabase: ReturnType<typeof createAdminClient>,
  currentUserId: string | undefined,
  metric: Metric,
  limit: number,
  offset: number,
): Promise<Response> {
  const orderColumn = getOrderColumn(metric);

  // Query materialized view with proper ordering
  const { data: stats, error: statsError } = await supabase
    .from('leaderboard_stats')
    .select('*')
    .eq('show_on_global_leaderboard', true)
    .not('username', 'is', null)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (statsError) {
    console.error('[get-global-leaderboard] Stats query error:', statsError);
    return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard stats' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get total count for pagination
  const { count, error: countError } = await supabase
    .from('leaderboard_stats')
    .select('*', { count: 'exact', head: true })
    .eq('show_on_global_leaderboard', true)
    .not('username', 'is', null);

  if (countError) {
    console.error('[get-global-leaderboard] Count query error:', countError);
  }

  const totalUsers = count ?? 0;

  // Build rankings
  const rankings: LeaderboardEntry[] = (stats ?? []).map((s, index) => ({
    rank: offset + index + 1,
    user_id: s.user_id,
    username: s.username,
    display_name: s.display_name,
    avatar_url: s.avatar_url,
    value: getMetricValue(s as LeaderboardStats, metric),
    change: null, // Computed client-side
    is_current_user: s.user_id === currentUserId,
  }));

  // Find current user's rank if not in current page
  let currentUserRank = rankings.find((r) => r.is_current_user)?.rank ?? 0;

  if (currentUserId && currentUserRank === 0) {
    // User not in current page, find their actual rank
    currentUserRank = await findUserRank(supabase, currentUserId, metric, 'all_time');
  }

  const response: LeaderboardResponse = {
    rankings,
    current_user_rank: currentUserRank,
    total_users: totalUsers,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle week/month period leaderboard using promises table
 */
async function handlePeriodLeaderboard(
  supabase: ReturnType<typeof createAdminClient>,
  currentUserId: string | undefined,
  metric: Metric,
  period: 'week' | 'month',
  limit: number,
  offset: number,
): Promise<Response> {
  // Get period start date
  const periodStart = period === 'week' ? getWeekStart() : getMonthStart();

  // Get all profiles that are visible on global leaderboard
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, show_on_global_leaderboard')
    .eq('show_on_global_leaderboard', true)
    .not('username', 'is', null);

  if (profilesError) {
    console.error('[get-global-leaderboard] Profiles query error:', profilesError);
    return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validProfiles = profiles ?? [];
  const userIds = validProfiles.map((p) => p.id);

  if (userIds.length === 0) {
    return new Response(
      JSON.stringify({
        rankings: [],
        current_user_rank: 0,
        total_users: 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Query promises for the period
  const { data: promises, error: promisesError } = await supabase
    .from('promises')
    .select('id, user_id, status, stake, updated_at')
    .in('user_id', userIds)
    .in('status', ['completed', 'failed', 'expired'])
    .gte('updated_at', periodStart.toISOString());

  if (promisesError) {
    console.error('[get-global-leaderboard] Promises query error:', promisesError);
    return new Response(JSON.stringify({ error: 'Failed to fetch promises' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build profiles map
  const profilesMap: Record<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  > = {};
  for (const p of validProfiles) {
    profilesMap[p.id] = {
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    };
  }

  // Group promises by user
  const promisesByUser: Record<string, PromiseRecord[]> = {};
  for (const uid of userIds) {
    promisesByUser[uid] = [];
  }
  for (const p of promises ?? []) {
    if (promisesByUser[p.user_id]) {
      promisesByUser[p.user_id].push(p);
    }
  }

  // Compute stats for each user
  interface ComputedStats {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    completed: number;
    failed: number;
    money_saved: number;
    money_lost: number;
    success_rate: number | null;
  }

  const userStats: ComputedStats[] = userIds.map((uid) => {
    const stats = computeStatsFromPromises(uid, profilesMap[uid], promisesByUser[uid]);
    return {
      user_id: uid,
      username: profilesMap[uid].username,
      display_name: profilesMap[uid].display_name,
      avatar_url: profilesMap[uid].avatar_url,
      ...stats,
    };
  });

  // Sort by metric (descending - higher is better/worse depending on metric type)
  userStats.sort((a, b) => {
    const aVal = getComputedMetricValue(a, metric);
    const bVal = getComputedMetricValue(b, metric);

    // Handle nulls: nulls go to bottom
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    return bVal - aVal;
  });

  const totalUsers = userStats.length;

  // Apply pagination
  const paginatedStats = userStats.slice(offset, offset + limit);

  // Build rankings
  const rankings: LeaderboardEntry[] = paginatedStats.map((s, index) => ({
    rank: offset + index + 1,
    user_id: s.user_id,
    username: s.username,
    display_name: s.display_name,
    avatar_url: s.avatar_url,
    value: getComputedMetricValue(s, metric) ?? 0,
    change: null,
    is_current_user: s.user_id === currentUserId,
  }));

  // Find current user's rank
  let currentUserRank = rankings.find((r) => r.is_current_user)?.rank ?? 0;

  if (currentUserId && currentUserRank === 0) {
    // Find rank in full sorted list
    const userIndex = userStats.findIndex((s) => s.user_id === currentUserId);
    if (userIndex !== -1) {
      currentUserRank = userIndex + 1;
    }
  }

  const response: LeaderboardResponse = {
    rankings,
    current_user_rank: currentUserRank,
    total_users: totalUsers,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Get metric value from computed stats
 */
function getComputedMetricValue(
  stats: {
    completed: number;
    failed: number;
    money_saved: number;
    money_lost: number;
    success_rate: number | null;
  },
  metric: Metric,
): number | null {
  switch (metric) {
    case 'success_rate':
      return stats.success_rate;
    case 'money_saved':
      return stats.money_saved;
    case 'completed':
      return stats.completed;
    case 'money_lost':
      return stats.money_lost;
    case 'failed':
      return stats.failed;
    default:
      return null;
  }
}

/**
 * Find user's rank in the global leaderboard
 */
async function findUserRank(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  metric: Metric,
  period: Period,
): Promise<number> {
  try {
    if (period === 'all_time') {
      // Use materialized view to find rank
      const orderColumn = getOrderColumn(metric);

      // Get the user's value
      const { data: userStats, error: userError } = await supabase
        .from('leaderboard_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('show_on_global_leaderboard', true)
        .single();

      if (userError || !userStats) {
        return 0;
      }

      const userValue = getMetricValue(userStats as LeaderboardStats, metric);

      // Count how many users are ranked higher
      const { count, error: countError } = await supabase
        .from('leaderboard_stats')
        .select('*', { count: 'exact', head: true })
        .eq('show_on_global_leaderboard', true)
        .not('username', 'is', null)
        .gt(orderColumn, userValue);

      if (countError) {
        console.error('[get-global-leaderboard] Rank count error:', countError);
        return 0;
      }

      return (count ?? 0) + 1;
    }

    // For period-based, would need to compute similarly
    // This is a fallback; the main function already handles this
    return 0;
  } catch (error) {
    console.error('[get-global-leaderboard] Find rank error:', error);
    return 0;
  }
}

