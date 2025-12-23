// @ts-nocheck
// deno-lint-ignore-file
/**
 * send-reengagement Edge Function
 *
 * Cron job that sends re-engagement notifications to inactive users.
 * Runs daily and targets users based on inactivity period.
 *
 * Psychology:
 * - 3 days: Gentle nudge (habit is breaking)
 * - 7 days: Loss framing (what they're missing)
 * - 14 days: Identity challenge (who they used to be)
 * - 30 days: Fresh start framing (new beginning)
 *
 * POST /send-reengagement
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cronSecret = Deno.env.get('REENGAGEMENT_CRON_SECRET') || Deno.env.get('SETTLEMENT_CRON_SECRET');

// If no cron secret is configured, allow unauthenticated access (for pg_cron internal calls)
const SKIP_AUTH = !cronSecret;

// ─────────────────────────────────────────────────────────────
// NOTIFICATION COPY
// ─────────────────────────────────────────────────────────────

const REENGAGEMENT_MESSAGES = {
  day3: {
    titles: [
      'Miss us?',
      'Hey stranger',
      '3 days...',
      'Quick check-in',
    ],
    bodies: [
      'Your accountability partner is waiting.',
      '3 days without a promise. What are you working on?',
      'Your streak reset. Ready to start a new one?',
      "Promises kept this week: 0. That's unlike you.",
    ],
  },
  day7: {
    titles: [
      "It's been a week",
      'Playing it safe?',
      'A week off',
      'Miss the pressure?',
    ],
    bodies: [
      'A week without commitments. Playing it safe?',
      '7 days off. Sometimes we all need a break. Ready to come back?',
      'Your future self is wondering where you went.',
      'No stakes, no skin in the game. Miss the pressure?',
    ],
  },
  day14: {
    titles: [
      'Two weeks',
      'Remember when...',
      'Still there?',
      'Getting rusty',
    ],
    bodies: [
      'Remember when you were someone who kept promises?',
      'Two weeks. The app misses your ambition.',
      'Still there? One small promise can restart everything.',
      'Your accountability muscle is getting weak.',
    ],
  },
  day30: {
    titles: [
      'New month energy',
      'Clean slate',
      'Comeback time?',
      'We saved your spot',
    ],
    bodies: [
      'New month, clean slate. What will you commit to?',
      "30 days is a long time. Ready for a comeback?",
      "One promise. That's all it takes to restart.",
      'We saved your spot. Welcome back anytime.',
    ],
  },
} as const;

type ReengagementTier = keyof typeof REENGAGEMENT_MESSAGES;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      const result = await response.json();
      console.log(`[send-reengagement] Sent batch of ${batch.length} notifications:`, JSON.stringify(result));
    } catch (error) {
      console.error('[send-reengagement] Failed to send batch:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Verify cron secret (skip if no secret configured - for pg_cron internal calls)
  if (!SKIP_AUTH) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[send-reengagement] Unauthorized request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const results = {
    day3: { targeted: 0, sent: 0 },
    day7: { targeted: 0, sent: 0 },
    day14: { targeted: 0, sent: 0 },
    day30: { targeted: 0, sent: 0 },
    errors: [] as string[],
  };

  try {
    // Define inactivity windows (in days)
    // We target users who haven't been active for X days, but not more than Y days
    // This prevents sending multiple tier notifications to the same user
    const tiers: { tier: ReengagementTier; minDays: number; maxDays: number }[] = [
      { tier: 'day3', minDays: 3, maxDays: 6 },
      { tier: 'day7', minDays: 7, maxDays: 13 },
      { tier: 'day14', minDays: 14, maxDays: 29 },
      { tier: 'day30', minDays: 30, maxDays: 60 },
    ];

    for (const { tier, minDays, maxDays } of tiers) {
      const minDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() - minDays * 24 * 60 * 60 * 1000);
      
      // Find users who:
      // 1. Have a push token
      // 2. Haven't been active for minDays-maxDays
      // 3. Haven't received a re-engagement notification in the last 3 days
      // 4. Have re-engagement notifications enabled
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, expo_push_token, notification_preferences')
        .not('expo_push_token', 'is', null)
        .gte('last_active_at', minDate.toISOString())
        .lte('last_active_at', maxDate.toISOString())
        .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${threeDaysAgo.toISOString()}`);

      if (error) {
        console.error(`[send-reengagement] Error querying ${tier} users:`, error);
        results.errors.push(`${tier}: ${error.message}`);
        continue;
      }

      if (!users || users.length === 0) {
        console.log(`[send-reengagement] No ${tier} users to notify`);
        continue;
      }

      // Filter users who have re-engagement enabled (default true)
      const eligibleUsers = users.filter((u) => {
        const prefs = u.notification_preferences as { reengagement?: boolean } | null;
        return prefs?.reengagement !== false; // Default to true if not set
      });

      results[tier].targeted = eligibleUsers.length;
      console.log(`[send-reengagement] Found ${eligibleUsers.length} ${tier} users`);

      // Build push messages
      const messages: PushMessage[] = eligibleUsers.map((user) => ({
        to: user.expo_push_token!,
        title: pickRandom(REENGAGEMENT_MESSAGES[tier].titles),
        body: pickRandom(REENGAGEMENT_MESSAGES[tier].bodies),
        sound: 'default',
        data: { type: 'reengagement', tier },
      }));

      // Send notifications
      await sendPushNotifications(messages);
      results[tier].sent = messages.length;

      // Update last_reengagement_at for all notified users
      const userIds = eligibleUsers.map((u) => u.id);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ last_reengagement_at: now.toISOString() })
        .in('id', userIds);

      if (updateError) {
        console.error(`[send-reengagement] Error updating ${tier} timestamps:`, updateError);
        results.errors.push(`${tier} update: ${updateError.message}`);
      }
    }

    console.log('[send-reengagement] Complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-reengagement] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, results }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

