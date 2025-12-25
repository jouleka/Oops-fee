// @ts-nocheck
// deno-lint-ignore-file
/**
 * notify-friend-named Edge Function
 *
 * Sends a push notification to an in-app friend when they're named as
 * the beneficiary of a promise. Creates anticipation and engagement.
 *
 * POST /notify-friend-named
 * Body: {
 *   promise_id: string,
 *   friend_user_id: string,
 *   stake_amount: number (in dollars),
 *   promise_text: string
 * }
 * Returns: { success: true } or { error: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

interface NotifyFriendNamedBody {
  promise_id: string;
  friend_user_id: string;
  stake_amount: number;
  promise_text: string;
}

// ─────────────────────────────────────────────────────────────
// Friend named notification copy (matches client constants)
// ─────────────────────────────────────────────────────────────
const FRIEND_NAMED_NOTIFICATIONS = [
  '🎯 {userName} just put you on their promise',
  "📍 You're the beneficiary if {userName} fails",
  '💰 {userName} bet {amount} — yours if they break it',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatAmount(dollars: number): string {
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}

/**
 * Send a push notification via Expo Push API
 */
async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  if (!pushToken) {
    console.log('[notify-friend-named] No push token, skipping notification');
    return false;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: 'default',
        data,
      }),
    });

    const result = await response.json();
    console.log('[notify-friend-named] Push notification sent:', JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('[notify-friend-named] Failed to send push notification:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 1. Authenticate user (the promiser)
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request body
    const body: NotifyFriendNamedBody = await req.json();
    const { promise_id, friend_user_id, stake_amount, promise_text } = body;

    // 3. Validate inputs
    if (!promise_id || typeof promise_id !== 'string') {
      return new Response(JSON.stringify({ error: 'promise_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!friend_user_id || typeof friend_user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'friend_user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof stake_amount !== 'number' || stake_amount <= 0) {
      return new Response(JSON.stringify({ error: 'stake_amount must be a positive number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!promise_text || typeof promise_text !== 'string') {
      return new Response(JSON.stringify({ error: 'promise_text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Prevent self-notification
    if (friend_user_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot name yourself as beneficiary' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();

    // 5. Verify friendship exists (must be accepted friends)
    const { data: friendship, error: friendshipError } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${friend_user_id}),` +
        `and(requester_id.eq.${friend_user_id},addressee_id.eq.${user.id})`
      )
      .eq('status', 'accepted')
      .single();

    if (friendshipError || !friendship) {
      console.log('[notify-friend-named] Friendship not found or not accepted:', friendshipError);
      return new Response(
        JSON.stringify({ error: 'Friend not found or friendship not accepted' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Get promiser's display name/username for notification
    const { data: promiserProfile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single();

    const userName = promiserProfile?.username
      ? `@${promiserProfile.username}`
      : promiserProfile?.display_name || 'Someone';

    // 7. Get friend's push token
    const { data: friendProfile, error: friendProfileError } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .eq('id', friend_user_id)
      .single();

    if (friendProfileError || !friendProfile) {
      console.error('[notify-friend-named] Friend profile not found:', friendProfileError);
      return new Response(JSON.stringify({ error: 'Friend profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Build and send the notification
    const amountDisplay = formatAmount(stake_amount);
    const notificationBody = pickRandom(FRIEND_NAMED_NOTIFICATIONS)
      .replace('{userName}', userName)
      .replace('{amount}', amountDisplay);

    const notificationSent = await sendPushNotification(
      friendProfile.expo_push_token,
      "🎯 You're on the hook!",
      notificationBody,
      {
        type: 'friend_named',
        promiseId: promise_id,
        amount: stake_amount,
        fromUserId: user.id,
      },
    );

    console.log(
      `[notify-friend-named] Notification ${notificationSent ? 'sent' : 'skipped'} for promise ${promise_id} to friend ${friend_user_id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        notification_sent: notificationSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[notify-friend-named] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

