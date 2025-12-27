// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-friends-leaderboard Edge Function
 *
 * Computes leaderboard rankings among the user's friends + self.
 * Supports various metrics including streak computation.
 *
 * POST /get-friends-leaderboard
 * Body: {
 *   metric: 'success_rate' | 'current_streak' | 'longest_streak' | 'money_saved' | 'completed',
 *   period: 'week' | 'month' | 'all_time',
 *   shame_mode?: boolean
 * }
 * Returns: {
 *   rankings: Array<LeaderboardEntry>,
 *   current_user_rank: number,
 *   total_friends: number
 * }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Types
type Metric = 'success_rate' | 'current_streak' | 'longest_streak' | 'money_saved' | 'completed';
type ShameMetric = 'money_lost' | 'failed' | 'worst_success_rate' | 'current_losing_streak';
type Period = 'week' | 'month' | 'all_time';

interface LeaderboardRequest {
  metric: Metric | ShameMetric;
  period: Period;
  shame_mode?: boolean;
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
  total_friends: number;
}

interface PromiseRecord {
  id: string;
  user_id: string;
  status: string;
  stake: number;
  completed_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  updated_at: string;
}

interface UserStats {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_decided: number;
  completed: number;
  failed: number;
  money_saved: number;
  money_lost: number;
  success_rate: number | null;
  current_streak: number;
  longest_streak: number;
  current_losing_streak: number;
}

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
 * Compute streaks from sorted promise records
 * Returns { current_streak, longest_streak, current_losing_streak }
 */
function computeStreaks(promises: PromiseRecord[]): {
  current_streak: number;
  longest_streak: number;
  current_losing_streak: number;
} {
  if (promises.length === 0) {
    return { current_streak: 0, longest_streak: 0, current_losing_streak: 0 };
  }

  // Sort by resolution timestamp (most recent first)
  const sorted = [...promises].sort((a, b) => {
    const aTime = a.completed_at || a.failed_at || a.expired_at || a.updated_at;
    const bTime = b.completed_at || b.failed_at || b.expired_at || b.updated_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  let currentStreak = 0;
  let longestStreak = 0;
  let currentLosingStreak = 0;
  let tempStreak = 0;

  // Compute current streak (consecutive completions from most recent)
  for (const p of sorted) {
    if (p.status === 'completed') {
      currentStreak++;
    } else {
      break;
    }
  }

  // Compute current losing streak (consecutive failures from most recent)
  for (const p of sorted) {
    if (p.status === 'failed' || p.status === 'expired') {
      currentLosingStreak++;
    } else {
      break;
    }
  }

  // Compute longest streak (scan all promises)
  for (const p of sorted) {
    if (p.status === 'completed') {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return { current_streak: currentStreak, longest_streak: longestStreak, current_losing_streak: currentLosingStreak };
}

/**
 * Compute user stats from promise records
 */
function computeUserStats(
  userId: string,
  profile: { username: string; display_name: string | null; avatar_url: string | null },
  promises: PromiseRecord[],
): UserStats {
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

  const streaks = computeStreaks(promises);

  return {
    user_id: userId,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    total_decided: totalDecided,
    completed,
    failed,
    money_saved: moneySaved,
    money_lost: moneyLost,
    success_rate: successRate,
    ...streaks,
  };
}

/**
 * Get the metric value from user stats
 */
function getMetricValue(stats: UserStats, metric: Metric | ShameMetric): number | null {
  switch (metric) {
    case 'success_rate':
      return stats.success_rate;
    case 'current_streak':
      return stats.current_streak;
    case 'longest_streak':
      return stats.longest_streak;
    case 'money_saved':
      return stats.money_saved;
    case 'completed':
      return stats.completed;
    case 'money_lost':
      return stats.money_lost;
    case 'failed':
      return stats.failed;
    case 'worst_success_rate':
      // Invert success rate for "worst" ranking (lower is "worse" = higher rank)
      return stats.success_rate !== null ? stats.success_rate : null;
    case 'current_losing_streak':
      return stats.current_losing_streak;
    default:
      return null;
  }
}

/**
 * Sort comparator for rankings
 * For shame metrics, higher value = worse = higher rank
 * For glory metrics, higher value = better = higher rank
 * Exception: worst_success_rate is inverted (lower success = higher rank)
 */
function getRankingComparator(
  metric: Metric | ShameMetric,
  shameMode: boolean,
): (a: UserStats, b: UserStats) => number {
  return (a, b) => {
    const aVal = getMetricValue(a, metric);
    const bVal = getMetricValue(b, metric);

    // Handle nulls: nulls go to bottom
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // For worst_success_rate, lower is "worse" so ascending order
    if (metric === 'worst_success_rate') {
      return aVal - bVal;
    }

    // All other metrics: descending order (higher = higher rank)
    return bVal - aVal;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // 1. Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const { metric, period, shame_mode = false } = body;

    // Validate metric
    const validGloryMetrics: Metric[] = ['success_rate', 'current_streak', 'longest_streak', 'money_saved', 'completed'];
    const validShameMetrics: ShameMetric[] = ['money_lost', 'failed', 'worst_success_rate', 'current_losing_streak'];
    const validMetrics = shame_mode ? validShameMetrics : validGloryMetrics;

    if (!validMetrics.includes(metric as Metric | ShameMetric)) {
      return new Response(
        JSON.stringify({
          error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate period
    const validPeriods: Period[] = ['week', 'month', 'all_time'];
    if (!validPeriods.includes(period)) {
      return new Response(
        JSON.stringify({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();

    // 3. Get all accepted friendships for user
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendshipsError) {
      console.error('[get-friends-leaderboard] Friendships query error:', friendshipsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch friendships' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Collect friend IDs (include self)
    const userIds = new Set<string>([user.id]);
    for (const f of friendships ?? []) {
      if (f.requester_id === user.id) {
        userIds.add(f.addressee_id);
      } else {
        userIds.add(f.requester_id);
      }
    }

    const userIdArray = Array.from(userIds);

    // 5. Fetch profiles for all users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIdArray);

    if (profilesError) {
      console.error('[get-friends-leaderboard] Profiles query error:', profilesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build profiles map (only users with usernames)
    const profilesMap: Record<
      string,
      { username: string; display_name: string | null; avatar_url: string | null }
    > = {};
    for (const p of profiles ?? []) {
      if (p.username) {
        profilesMap[p.id] = {
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        };
      }
    }

    // Filter userIds to only those with usernames
    const validUserIds = userIdArray.filter((id) => profilesMap[id]);

    if (validUserIds.length === 0) {
      // No valid users (even current user has no username)
      return new Response(
        JSON.stringify({
          rankings: [],
          current_user_rank: 0,
          total_friends: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Build promises query with period filter
    let promisesQuery = supabase
      .from('promises')
      .select('id, user_id, status, stake, completed_at, failed_at, expired_at, updated_at')
      .in('user_id', validUserIds)
      .in('status', ['completed', 'failed', 'expired']);

    // Apply period filter
    if (period === 'week') {
      const weekStart = getWeekStart().toISOString();
      promisesQuery = promisesQuery.gte('updated_at', weekStart);
    } else if (period === 'month') {
      const monthStart = getMonthStart().toISOString();
      promisesQuery = promisesQuery.gte('updated_at', monthStart);
    }

    const { data: promises, error: promisesError } = await promisesQuery;

    if (promisesError) {
      console.error('[get-friends-leaderboard] Promises query error:', promisesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch promises' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Group promises by user
    const promisesByUser: Record<string, PromiseRecord[]> = {};
    for (const uid of validUserIds) {
      promisesByUser[uid] = [];
    }
    for (const p of promises ?? []) {
      if (promisesByUser[p.user_id]) {
        promisesByUser[p.user_id].push(p);
      }
    }

    // 8. Compute stats for each user
    const userStats: UserStats[] = validUserIds.map((uid) => {
      return computeUserStats(uid, profilesMap[uid], promisesByUser[uid]);
    });

    // 9. Sort by metric
    const comparator = getRankingComparator(metric as Metric | ShameMetric, shame_mode);
    userStats.sort(comparator);

    // 10. Build rankings with rank numbers
    const rankings: LeaderboardEntry[] = userStats.map((stats, index) => ({
      rank: index + 1,
      user_id: stats.user_id,
      username: stats.username,
      display_name: stats.display_name,
      avatar_url: stats.avatar_url,
      value: getMetricValue(stats, metric as Metric | ShameMetric) ?? 0,
      change: null, // Position change computed client-side with local storage
      is_current_user: stats.user_id === user.id,
    }));

    // 11. Find current user's rank
    const currentUserEntry = rankings.find((r) => r.is_current_user);
    const currentUserRank = currentUserEntry?.rank ?? 0;

    const response: LeaderboardResponse = {
      rankings,
      current_user_rank: currentUserRank,
      total_friends: validUserIds.length - 1, // Exclude self from count
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[get-friends-leaderboard] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

