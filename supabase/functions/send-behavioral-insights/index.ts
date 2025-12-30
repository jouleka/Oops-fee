// @ts-nocheck
// deno-lint-ignore-file
/**
 * send-behavioral-insights Edge Function
 *
 * Cron job (weekly) that analyzes user promise history and sends
 * personalized behavioral insights via push notification.
 *
 * Psychology:
 * - Self-awareness: "You're 80% successful on Mondays"
 * - Personalization: Makes users feel understood
 * - Optimization: Helps users improve their success rate
 *
 * POST /send-behavioral-insights
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cronSecret = Deno.env.get('INSIGHTS_CRON_SECRET') || Deno.env.get('SETTLEMENT_CRON_SECRET');

// If no cron secret is configured, allow unauthenticated access (for pg_cron internal calls)
const SKIP_AUTH = !cronSecret;

// Minimum promises required to generate meaningful insights
const MIN_PROMISES_FOR_INSIGHTS = 5;

// Days between insight notifications (avoid spam)
const INSIGHTS_COOLDOWN_DAYS = 7;

// Batch size for processing
const BATCH_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// INSIGHT NOTIFICATION COPY (matches constants/notification-copy.ts)
// ─────────────────────────────────────────────────────────────

const INSIGHT_NOTIFICATIONS = {
  /** Best day pattern */
  bestDay: [
    "Fun fact: You're most successful on {day}s. Plan accordingly.",
    "Your best day is {day}. Consider frontloading your promises.",
    "{day} is your power day. {successRate}% success rate.",
  ],

  /** Worst day pattern */
  worstDay: [
    "Heads up: {day}s are your weak spot. Only {successRate}% success.",
    "You struggle on {day}s. Maybe go easier on yourself that day?",
    "{day} trips you up. Smaller stakes on those days?",
  ],

  /** Optimal stake range */
  optimalStake: [
    "Sweet spot: You're {successRate}% successful with ${min}-${max} stakes.",
    "Data says ${min}-${max} is your goldilocks zone.",
    "Stakes between ${min}-${max} hit different for you.",
  ],

  /** Time of day pattern */
  timePattern: [
    "Morning promises: {morningRate}%. Evening: {eveningRate}%. Interesting.",
    "You're a {preference} person. {rate}% success rate.",
    "Pro tip: Your {time} commitments have the best track record.",
  ],

  /** Streak insight */
  streakPattern: [
    "Your longest streak was {longest} days. Current: {current}. Go beat it.",
    "Fun fact: You've kept {total} promises. That's {successRate}% of all attempts.",
    "You've saved ${saved} by keeping promises. That's real money.",
  ],

  /** Category insight (based on promise text analysis) */
  categoryPattern: [
    "You're {successRate}% successful with {category} goals. Keep it up.",
    "{category} promises are your forte. {successRate}% success rate.",
    "Interesting: {category} goals work better for you than others.",
  ],
} as const;

type InsightType = keyof typeof INSIGHT_NOTIFICATIONS;

interface Insight {
  type: InsightType;
  title: string;
  body: string;
  score: number; // Higher score = more interesting/actionable
  data: Record<string, unknown>;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatMessage(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), `$${value}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// EXPO PUSH
// ─────────────────────────────────────────────────────────────

interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: string;
  data: Record<string, unknown>;
}

async function sendPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo recommends batching in groups of 100
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
      console.log(`[send-insights] Sent batch of ${batch.length} notifications:`, JSON.stringify(result));
    } catch (error) {
      console.error('[send-insights] Failed to send batch:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// INSIGHT ANALYSIS
// ─────────────────────────────────────────────────────────────

interface Promise {
  id: string;
  status: string;
  stake: number;
  deadline_at: string;
  created_at: string;
  completed_at: string | null;
  text: string;
}

interface DayStats {
  day: number;
  dayName: string;
  total: number;
  completed: number;
  successRate: number;
}

interface StakeStats {
  min: number;
  max: number;
  total: number;
  completed: number;
  successRate: number;
}

interface TimeStats {
  morning: { total: number; completed: number; rate: number };
  evening: { total: number; completed: number; rate: number };
}

/**
 * Analyze user's promise history and generate insights
 */
function analyzePromises(promises: Promise[]): Insight[] {
  const insights: Insight[] = [];

  if (promises.length < MIN_PROMISES_FOR_INSIGHTS) {
    return insights;
  }

  // Calculate overall stats
  const completed = promises.filter((p) => p.status === 'completed');
  const failed = promises.filter((p) => p.status === 'failed');
  const totalSettled = completed.length + failed.length;
  const overallSuccessRate = totalSettled > 0 ? Math.round((completed.length / totalSettled) * 100) : 0;

  // 1. Day of week analysis
  const dayStats = analyzeDayOfWeek(promises);
  const bestDay = dayStats.reduce((a, b) => (a.successRate > b.successRate ? a : b));
  const worstDay = dayStats.reduce((a, b) => (a.successRate < b.successRate ? a : b));

  if (bestDay.total >= 2 && bestDay.successRate > overallSuccessRate + 10) {
    const diff = bestDay.successRate - overallSuccessRate;
    insights.push({
      type: 'bestDay',
      title: '📊 Behavioral Insight',
      body: formatMessage(pickRandom(INSIGHT_NOTIFICATIONS.bestDay), {
        day: bestDay.dayName,
        successRate: bestDay.successRate,
      }),
      score: diff * 2 + bestDay.total, // Higher diff and more data = better insight
      data: { day: bestDay.dayName, successRate: bestDay.successRate },
    });
  }

  if (worstDay.total >= 2 && worstDay.successRate < overallSuccessRate - 10 && worstDay.successRate < 70) {
    const diff = overallSuccessRate - worstDay.successRate;
    insights.push({
      type: 'worstDay',
      title: '⚠️ Watch Out',
      body: formatMessage(pickRandom(INSIGHT_NOTIFICATIONS.worstDay), {
        day: worstDay.dayName,
        successRate: worstDay.successRate,
      }),
      score: diff * 2 + worstDay.total,
      data: { day: worstDay.dayName, successRate: worstDay.successRate },
    });
  }

  // 2. Stake range analysis
  const stakeRanges = analyzeStakeRanges(promises);
  const bestStakeRange = stakeRanges.find((r) => r.successRate > overallSuccessRate + 5 && r.total >= 3);

  if (bestStakeRange) {
    insights.push({
      type: 'optimalStake',
      title: '💰 Sweet Spot Found',
      body: formatMessage(pickRandom(INSIGHT_NOTIFICATIONS.optimalStake), {
        successRate: bestStakeRange.successRate,
        min: bestStakeRange.min,
        max: bestStakeRange.max,
      }),
      score: (bestStakeRange.successRate - overallSuccessRate) * 1.5 + bestStakeRange.total,
      data: { min: bestStakeRange.min, max: bestStakeRange.max, successRate: bestStakeRange.successRate },
    });
  }

  // 3. Time of day analysis
  const timeStats = analyzeTimeOfDay(promises);
  const morningRate = timeStats.morning.total > 0 ? timeStats.morning.rate : 0;
  const eveningRate = timeStats.evening.total > 0 ? timeStats.evening.rate : 0;
  const timeDiff = Math.abs(morningRate - eveningRate);

  if (timeDiff >= 15 && timeStats.morning.total >= 2 && timeStats.evening.total >= 2) {
    const preference = morningRate > eveningRate ? 'morning' : 'evening';
    const rate = morningRate > eveningRate ? morningRate : eveningRate;

    insights.push({
      type: 'timePattern',
      title: '🕐 Timing Insight',
      body: formatMessage(pickRandom(INSIGHT_NOTIFICATIONS.timePattern), {
        morningRate,
        eveningRate,
        preference,
        rate,
        time: preference,
      }),
      score: timeDiff + (timeStats.morning.total + timeStats.evening.total) / 2,
      data: { morningRate, eveningRate, preference },
    });
  }

  // 4. Overall stats insight (if no other insights or as supplementary)
  const totalSaved = completed.reduce((sum, p) => sum + p.stake, 0);
  if (completed.length >= 5) {
    insights.push({
      type: 'streakPattern',
      title: '📈 Your Stats',
      body: formatMessage(pickRandom(INSIGHT_NOTIFICATIONS.streakPattern), {
        longest: 0, // Would need to calculate from streak data
        current: 0,
        total: completed.length,
        successRate: overallSuccessRate,
        saved: totalSaved,
      }),
      score: completed.length + overallSuccessRate / 10,
      data: { total: completed.length, successRate: overallSuccessRate, saved: totalSaved },
    });
  }

  return insights;
}

/**
 * Analyze success rate by day of week
 */
function analyzeDayOfWeek(promises: Promise[]): DayStats[] {
  const byDay: Record<number, { total: number; completed: number }> = {};

  for (let i = 0; i < 7; i++) {
    byDay[i] = { total: 0, completed: 0 };
  }

  for (const promise of promises) {
    if (promise.status !== 'completed' && promise.status !== 'failed') continue;

    const deadlineDate = new Date(promise.deadline_at);
    const day = deadlineDate.getDay();

    byDay[day].total++;
    if (promise.status === 'completed') {
      byDay[day].completed++;
    }
  }

  return Object.entries(byDay).map(([day, stats]) => ({
    day: parseInt(day),
    dayName: DAYS_OF_WEEK[parseInt(day)],
    total: stats.total,
    completed: stats.completed,
    successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
  }));
}

/**
 * Analyze success rate by stake ranges
 */
function analyzeStakeRanges(promises: Promise[]): StakeStats[] {
  const ranges = [
    { min: 0, max: 5 },
    { min: 5, max: 10 },
    { min: 10, max: 25 },
    { min: 25, max: 50 },
    { min: 50, max: 100 },
    { min: 100, max: 1000 },
  ];

  return ranges.map((range) => {
    const inRange = promises.filter((p) => p.stake >= range.min && p.stake < range.max && (p.status === 'completed' || p.status === 'failed'));

    const completed = inRange.filter((p) => p.status === 'completed').length;

    return {
      min: range.min,
      max: range.max,
      total: inRange.length,
      completed,
      successRate: inRange.length > 0 ? Math.round((completed / inRange.length) * 100) : 0,
    };
  });
}

/**
 * Analyze success rate by time of day (based on deadline)
 */
function analyzeTimeOfDay(promises: Promise[]): TimeStats {
  const stats: TimeStats = {
    morning: { total: 0, completed: 0, rate: 0 },
    evening: { total: 0, completed: 0, rate: 0 },
  };

  for (const promise of promises) {
    if (promise.status !== 'completed' && promise.status !== 'failed') continue;

    const deadlineDate = new Date(promise.deadline_at);
    const hour = deadlineDate.getHours();

    // Morning: 5am - 12pm, Evening: 5pm - 11pm
    const isMorning = hour >= 5 && hour < 12;
    const isEvening = hour >= 17 && hour < 23;

    if (isMorning) {
      stats.morning.total++;
      if (promise.status === 'completed') stats.morning.completed++;
    } else if (isEvening) {
      stats.evening.total++;
      if (promise.status === 'completed') stats.evening.completed++;
    }
  }

  stats.morning.rate = stats.morning.total > 0 ? Math.round((stats.morning.completed / stats.morning.total) * 100) : 0;
  stats.evening.rate = stats.evening.total > 0 ? Math.round((stats.evening.completed / stats.evening.total) * 100) : 0;

  return stats;
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Verify cron secret (skip if no secret configured - for pg_cron internal calls)
  if (!SKIP_AUTH) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[send-insights] Unauthorized request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const cooldownDate = new Date(now.getTime() - INSIGHTS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const results = {
    usersProcessed: 0,
    insightsSent: 0,
    skippedNoData: 0,
    skippedNoInsights: 0,
    errors: [] as string[],
  };

  try {
    // Find users who:
    // 1. Have a push token
    // 2. Haven't received insights recently (or never)
    // 3. Have insights notifications enabled (default true)
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, expo_push_token, notification_preferences')
      .not('expo_push_token', 'is', null)
      .or(`last_insights_at.is.null,last_insights_at.lt.${cooldownDate.toISOString()}`)
      .limit(BATCH_SIZE);

    if (usersError) {
      console.error('[send-insights] Error fetching users:', usersError);
      throw usersError;
    }

    if (!eligibleUsers || eligibleUsers.length === 0) {
      console.log('[send-insights] No eligible users found');
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-insights] Found ${eligibleUsers.length} eligible users`);

    // Filter users who have insights enabled (default true)
    const usersWithInsightsEnabled = eligibleUsers.filter((u) => {
      const prefs = u.notification_preferences as { insights?: boolean } | null;
      return prefs?.insights !== false;
    });

    console.log(`[send-insights] ${usersWithInsightsEnabled.length} users have insights enabled`);

    const messages: PushMessage[] = [];
    const userIdsToUpdate: string[] = [];

    for (const user of usersWithInsightsEnabled) {
      results.usersProcessed++;

      // Fetch user's promise history
      const { data: promises, error: promisesError } = await supabase
        .from('promises')
        .select('id, status, stake, deadline_at, created_at, completed_at, text')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .order('deadline_at', { ascending: false })
        .limit(100); // Last 100 settled promises

      if (promisesError) {
        console.error(`[send-insights] Error fetching promises for user ${user.id}:`, promisesError);
        results.errors.push(`${user.id}: ${promisesError.message}`);
        continue;
      }

      if (!promises || promises.length < MIN_PROMISES_FOR_INSIGHTS) {
        console.log(`[send-insights] User ${user.id} has insufficient data (${promises?.length ?? 0} promises)`);
        results.skippedNoData++;
        continue;
      }

      // Generate insights
      const insights = analyzePromises(promises as Promise[]);

      if (insights.length === 0) {
        console.log(`[send-insights] No actionable insights for user ${user.id}`);
        results.skippedNoInsights++;
        continue;
      }

      // Pick the best insight (highest score)
      const bestInsight = insights.reduce((a, b) => (a.score > b.score ? a : b));

      console.log(`[send-insights] Sending ${bestInsight.type} insight to user ${user.id} (score: ${bestInsight.score})`);

      messages.push({
        to: user.expo_push_token!,
        title: bestInsight.title,
        body: bestInsight.body,
        sound: 'default',
        data: { type: 'insight', insightType: bestInsight.type, ...bestInsight.data },
      });

      userIdsToUpdate.push(user.id);
      results.insightsSent++;
    }

    // Send all notifications
    await sendPushNotifications(messages);

    // Update last_insights_at for all notified users
    if (userIdsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ last_insights_at: now.toISOString() })
        .in('id', userIdsToUpdate);

      if (updateError) {
        console.error('[send-insights] Error updating timestamps:', updateError);
        results.errors.push(`Update timestamps: ${updateError.message}`);
      }
    }

    console.log('[send-insights] Complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-insights] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, results }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});








