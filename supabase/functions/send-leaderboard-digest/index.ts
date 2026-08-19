// @ts-nocheck
// deno-lint-ignore-file
/**
 * send-leaderboard-digest Edge Function
 *
 * Cron job (weekly, Sunday evening) that sends users their weekly
 * leaderboard summary via push notification.
 *
 * Summary includes:
 * - User's rank among friends
 * - Top 3 friends
 * - Position changes from previous week
 * - Promises kept/lost count
 *
 * POST /send-leaderboard-digest
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCronAuthorization } from '../_shared/request-security.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Batch size for processing
const BATCH_SIZE = 100;

// Minimum friends to qualify for leaderboard digest
const MIN_FRIENDS = 1;

// ─────────────────────────────────────────────────────────────
// LEADERBOARD NOTIFICATION COPY (matches constants/notification-copy.ts)
// ─────────────────────────────────────────────────────────────

const LEADERBOARD_NOTIFICATIONS = {
  weekly: [
    "Weekly leaderboard: You're #{rank} among friends. {kept} kept, {lost} lost.",
    "This week: #{rank} | {successRate}% success rate",
    "Week in review: #{rank} with ${saved} saved 💰",
    "Weekly recap: {kept}/{total} kept. #{rank} among friends.",
  ],
  weeklyComparison: [
    "You were #{rank} this week! {leader} beat you by {diff} promises.",
    "This week: #{rank}. {leader} took the crown with {leaderKept} kept.",
    "Weekly standings: #{rank}. {leader} is still ahead by {diff}.",
  ],
  weeklyPerfect: [
    '🏆 Perfect week! #1 with 100% success rate.',
    '👑 Flawless victory! You dominated the leaderboard this week.',
    'Week winner: You kept every promise and took #1!',
  ],
  firstPlace: [
    "👑 You're #1 among friends this week!",
    'Top of the leaderboard! 🏆 You owned this week.',
    '#1 this week. Champion status confirmed.',
  ],
  topThree: [
    'Top 3 this week! 🏆 #{rank} among your friends',
    'Podium finish! You ended the week at #{rank} 🥇🥈🥉',
  ],
} as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatMessage(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Handle #{rank} pattern
    result = result.replace(new RegExp(`#\\{${key}\\}`, 'g'), `#${value}`);
    // Handle {variable} pattern
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    // Handle ${amount} pattern
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), `$${value}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

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
  completed: number;
  failed: number;
  total_decided: number;
  money_saved: number;
  money_lost: number;
  success_rate: number | null;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  completed: number;
  failed: number;
  total_decided: number;
  success_rate: number | null;
  money_saved: number;
}

interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: string;
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Get the start of the current week (Monday 00:00 UTC)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

// ─────────────────────────────────────────────────────────────
// EXPO PUSH
// ─────────────────────────────────────────────────────────────

async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      const result = await response.json();
      console.log(`[send-leaderboard-digest] Sent batch of ${batch.length} notifications:`, JSON.stringify(result));
    } catch (error) {
      console.error('[send-leaderboard-digest] Failed to send batch:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// STATS COMPUTATION
// ─────────────────────────────────────────────────────────────

function computeUserStats(
  userId: string,
  profile: { username: string; display_name: string | null },
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

  const successRate = totalDecided >= 5 ? Math.round((100 * completed) / totalDecided) : null;

  return {
    user_id: userId,
    username: profile.username,
    display_name: profile.display_name,
    completed,
    failed,
    total_decided: totalDecided,
    money_saved: moneySaved,
    money_lost: moneyLost,
    success_rate: successRate,
  };
}

/**
 * Compute friends leaderboard for a user
 */
async function computeFriendsLeaderboard(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  friendIds: string[],
  weekStart: Date,
): Promise<LeaderboardEntry[]> {
  const allUserIds = [userId, ...friendIds];

  // Fetch profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', allUserIds);

  if (profilesError || !profiles) {
    console.error('[send-leaderboard-digest] Profiles query error:', profilesError);
    return [];
  }

  // Filter to users with usernames
  const profilesMap: Record<string, { username: string; display_name: string | null }> = {};
  for (const p of profiles) {
    if (p.username) {
      profilesMap[p.id] = { username: p.username, display_name: p.display_name };
    }
  }

  const validUserIds = allUserIds.filter((id) => profilesMap[id]);

  if (validUserIds.length === 0) {
    return [];
  }

  // Fetch promises for the week
  const { data: promises, error: promisesError } = await supabase
    .from('promises')
    .select('id, user_id, status, stake, completed_at, failed_at, expired_at, updated_at')
    .in('user_id', validUserIds)
    .in('status', ['completed', 'failed', 'expired'])
    .gte('updated_at', weekStart.toISOString());

  if (promisesError) {
    console.error('[send-leaderboard-digest] Promises query error:', promisesError);
    return [];
  }

  // Group promises by user
  const promisesByUser: Record<string, PromiseRecord[]> = {};
  for (const uid of validUserIds) {
    promisesByUser[uid] = [];
  }
  for (const p of promises ?? []) {
    if (promisesByUser[p.user_id]) {
      promisesByUser[p.user_id].push(p);
    }
  }

  // Compute stats for each user
  const userStats: UserStats[] = validUserIds.map((uid) => {
    return computeUserStats(uid, profilesMap[uid], promisesByUser[uid]);
  });

  // Sort by completed promises (descending), then by success rate
  userStats.sort((a, b) => {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.success_rate !== null && a.success_rate !== null) {
      return b.success_rate - a.success_rate;
    }
    return 0;
  });

  // Build rankings
  return userStats.map((stats, index) => ({
    rank: index + 1,
    user_id: stats.user_id,
    username: stats.username,
    display_name: stats.display_name,
    completed: stats.completed,
    failed: stats.failed,
    total_decided: stats.total_decided,
    success_rate: stats.success_rate,
    money_saved: stats.money_saved,
  }));
}

/**
 * Generate digest notification for a user
 */
function generateDigestNotification(
  userEntry: LeaderboardEntry,
  rankings: LeaderboardEntry[],
): { title: string; body: string } | null {
  const { rank, completed, failed, success_rate, money_saved, total_decided } = userEntry;
  const leader = rankings[0];

  // Perfect week: #1 with 100% success rate and at least 1 promise
  if (rank === 1 && total_decided > 0 && success_rate === 100) {
    return {
      title: '🏆 Weekly Champion!',
      body: pickRandom(LEADERBOARD_NOTIFICATIONS.weeklyPerfect),
    };
  }

  // First place
  if (rank === 1) {
    return {
      title: '👑 Weekly Leaderboard',
      body: formatMessage(pickRandom(LEADERBOARD_NOTIFICATIONS.firstPlace), {}),
    };
  }

  // Top 3
  if (rank <= 3) {
    return {
      title: '🏆 Weekly Leaderboard',
      body: formatMessage(pickRandom(LEADERBOARD_NOTIFICATIONS.topThree), { rank }),
    };
  }

  // Not first place - show comparison to leader
  if (leader && leader.user_id !== userEntry.user_id) {
    const diff = leader.completed - completed;
    if (diff > 0) {
      return {
        title: '📊 Weekly Leaderboard',
        body: formatMessage(pickRandom(LEADERBOARD_NOTIFICATIONS.weeklyComparison), {
          rank,
          leader: `@${leader.username}`,
          diff,
          leaderKept: leader.completed,
        }),
      };
    }
  }

  // Default weekly summary
  const vars: Record<string, string | number> = {
    rank,
    kept: completed,
    lost: failed,
    total: total_decided,
    saved: money_saved,
  };

  if (success_rate !== null) {
    vars.successRate = success_rate;
  }

  return {
    title: '📊 Weekly Leaderboard',
    body: formatMessage(pickRandom(LEADERBOARD_NOTIFICATIONS.weekly), vars),
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const authError = requireCronAuthorization(req, [
    'LEADERBOARD_CRON_SECRET',
    'SETTLEMENT_CRON_SECRET',
  ]);
  if (authError) return authError;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const weekStart = getWeekStart();

  const results = {
    usersProcessed: 0,
    digestsSent: 0,
    skippedNoFriends: 0,
    skippedNoToken: 0,
    errors: [] as string[],
  };

  try {
    // 1. Find users who:
    //    - Have a push token
    //    - Have leaderboard notifications enabled (default true)
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, expo_push_token, notification_preferences')
      .not('expo_push_token', 'is', null)
      .not('username', 'is', null)
      .limit(BATCH_SIZE);

    if (usersError) {
      console.error('[send-leaderboard-digest] Error fetching users:', usersError);
      throw usersError;
    }

    if (!eligibleUsers || eligibleUsers.length === 0) {
      console.log('[send-leaderboard-digest] No eligible users found');
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-leaderboard-digest] Found ${eligibleUsers.length} eligible users`);

    // Filter users with leaderboard notifications enabled (default true)
    const usersWithLeaderboardEnabled = eligibleUsers.filter((u) => {
      const prefs = u.notification_preferences as { leaderboard?: boolean } | null;
      return prefs?.leaderboard !== false;
    });

    console.log(`[send-leaderboard-digest] ${usersWithLeaderboardEnabled.length} users have leaderboard enabled`);

    const messages: PushMessage[] = [];

    for (const user of usersWithLeaderboardEnabled) {
      results.usersProcessed++;

      if (!user.expo_push_token) {
        results.skippedNoToken++;
        continue;
      }

      // 2. Get user's friends
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (friendshipsError) {
        console.error(`[send-leaderboard-digest] Friendships error for ${user.id}:`, friendshipsError);
        results.errors.push(`${user.id}: ${friendshipsError.message}`);
        continue;
      }

      // Extract friend IDs
      const friendIds: string[] = [];
      for (const f of friendships ?? []) {
        if (f.requester_id === user.id) {
          friendIds.push(f.addressee_id);
        } else {
          friendIds.push(f.requester_id);
        }
      }

      if (friendIds.length < MIN_FRIENDS) {
        console.log(`[send-leaderboard-digest] User ${user.id} has insufficient friends (${friendIds.length})`);
        results.skippedNoFriends++;
        continue;
      }

      // 3. Compute leaderboard
      const rankings = await computeFriendsLeaderboard(supabase, user.id, friendIds, weekStart);

      if (rankings.length === 0) {
        console.log(`[send-leaderboard-digest] No rankings for user ${user.id}`);
        continue;
      }

      // 4. Find user's entry
      const userEntry = rankings.find((r) => r.user_id === user.id);
      if (!userEntry) {
        console.log(`[send-leaderboard-digest] User ${user.id} not in rankings`);
        continue;
      }

      // 5. Generate notification
      const notification = generateDigestNotification(userEntry, rankings);
      if (!notification) {
        continue;
      }

      messages.push({
        to: user.expo_push_token,
        title: notification.title,
        body: notification.body,
        sound: 'default',
        data: {
          type: 'leaderboard_digest',
          rank: userEntry.rank,
          kept: userEntry.completed,
          lost: userEntry.failed,
        },
      });

      results.digestsSent++;
    }

    // 6. Send all notifications
    await sendPushNotifications(messages);

    console.log('[send-leaderboard-digest] Complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-leaderboard-digest] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, results }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
