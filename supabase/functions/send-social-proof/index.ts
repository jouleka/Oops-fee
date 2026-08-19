// @ts-nocheck
// deno-lint-ignore-file
/**
 * send-social-proof Edge Function
 *
 * Cron job that sends social proof notifications to create FOMO.
 * Runs once daily (e.g., evening) targeting users without active promises.
 *
 * Psychology:
 * - Bandwagon effect: "X people kept promises today"
 * - FOMO: "Y people have skin in the game right now"
 * - Social pressure: Seeing real numbers motivates action
 *
 * POST /send-social-proof
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCronAuthorization } from '../_shared/request-security.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─────────────────────────────────────────────────────────────
// NOTIFICATION COPY
// ─────────────────────────────────────────────────────────────

const SOCIAL_PROOF_MESSAGES = {
  titles: [
    'Meanwhile...',
    "Today's wins",
    'Happening now',
    'The scoreboard',
    'Community update',
  ],
  bodies: [
    '{count} promises were kept today. You could add to that.',
    'Right now, {activeUsers} people have skin in the game. Join them?',
    '${totalStaked} is on the line across all users today.',
    '{count} people made promises today. Starting yours?',
    "Today's success rate: {successRate}%. You could be next.",
  ],
};

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatMessage(
  template: string,
  vars: Record<string, string | number>
): string {
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
      console.log(`[send-social-proof] Sent batch of ${batch.length} notifications:`, JSON.stringify(result));
    } catch (error) {
      console.error('[send-social-proof] Failed to send batch:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const authError = requireCronAuthorization(req, [
    'SOCIAL_PROOF_CRON_SECRET',
    'SETTLEMENT_CRON_SECRET',
  ]);
  if (authError) return authError;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = {
    stats: {
      completedToday: 0,
      activeUsers: 0,
      totalStakedToday: 0,
      successRate: 0,
    },
    targeted: 0,
    sent: 0,
    errors: [] as string[],
  };

  try {
    // Get start of today (UTC)
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    // ─────────────────────────────────────────────────────────
    // 1. Gather today's aggregate stats
    // ─────────────────────────────────────────────────────────

    // Count completed promises today
    const { count: completedToday } = await supabase
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', startOfToday.toISOString());

    results.stats.completedToday = completedToday ?? 0;

    // Count active promises and their total stake
    const { data: activePromises, error: activeError } = await supabase
      .from('promises')
      .select('user_id, stake')
      .eq('status', 'active');

    if (activeError) {
      console.error('[send-social-proof] Error querying active promises:', activeError);
      results.errors.push(activeError.message);
    }

    if (activePromises) {
      const uniqueUsers = new Set(activePromises.map((p) => p.user_id));
      results.stats.activeUsers = uniqueUsers.size;
      results.stats.totalStakedToday = activePromises.reduce((sum, p) => sum + (p.stake || 0), 0);
    }

    // Calculate today's success rate
    const { count: totalResolved } = await supabase
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .in('status', ['completed', 'failed'])
      .gte('updated_at', startOfToday.toISOString());

    if ((totalResolved ?? 0) > 0 && (completedToday ?? 0) > 0) {
      results.stats.successRate = Math.round(((completedToday ?? 0) / (totalResolved ?? 1)) * 100);
    }

    // Skip if no interesting stats to share
    if (results.stats.completedToday === 0 && results.stats.activeUsers === 0) {
      console.log('[send-social-proof] No activity to report, skipping');
      return new Response(JSON.stringify({ success: true, results, skipped: 'no_activity' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // 2. Find target users (have push token, no active promises today)
    // ─────────────────────────────────────────────────────────

    // Get users with active promises (to exclude)
    const usersWithActivePromises = new Set(
      (activePromises ?? []).map((p) => p.user_id)
    );

    // Get all users with push tokens who haven't received social proof notification recently
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, expo_push_token, notification_preferences')
      .not('expo_push_token', 'is', null);

    if (usersError) {
      console.error('[send-social-proof] Error querying users:', usersError);
      results.errors.push(usersError.message);
      return new Response(JSON.stringify({ error: usersError.message, results }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter:
    // 1. Users without active promises (target audience)
    // 2. Users who have social proof notifications enabled (default true)
    const targetUsers = (eligibleUsers ?? []).filter((u) => {
      // Skip users who already have active promises
      if (usersWithActivePromises.has(u.id)) return false;

      // Check notification preferences
      const prefs = u.notification_preferences as { socialProof?: boolean } | null;
      return prefs?.socialProof !== false; // Default to true if not set
    });

    results.targeted = targetUsers.length;
    console.log(`[send-social-proof] Found ${targetUsers.length} target users`);

    if (targetUsers.length === 0) {
      console.log('[send-social-proof] No users to notify');
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ─────────────────────────────────────────────────────────
    // 3. Build and send notifications
    // ─────────────────────────────────────────────────────────

    const messageVars = {
      count: results.stats.completedToday,
      activeUsers: results.stats.activeUsers,
      totalStaked: results.stats.totalStakedToday,
      successRate: results.stats.successRate,
    };

    const messages: PushMessage[] = targetUsers.map((user) => ({
      to: user.expo_push_token!,
      title: pickRandom(SOCIAL_PROOF_MESSAGES.titles),
      body: formatMessage(pickRandom(SOCIAL_PROOF_MESSAGES.bodies), messageVars),
      sound: 'default',
      data: { type: 'social_proof', stats: messageVars },
    }));

    await sendPushNotifications(messages);
    results.sent = messages.length;

    console.log('[send-social-proof] Complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-social-proof] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, results }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
