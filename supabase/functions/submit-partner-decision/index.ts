// @ts-nocheck
// deno-lint-ignore-file
/**
 * submit-partner-decision Edge Function
 *
 * Public endpoint for partners to approve/reject promise completion.
 * Rate limited: 3 decisions per minute per IP.
 *
 * POST /submit-partner-decision
 * Body: { token: string, approved: boolean }
 * Returns: { success: true, status: 'completed' | 'failed' }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { hashClientIp } from '../_shared/request-security.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Rate limiting: 3 per minute per IP
const RATE_LIMIT = { max: 3, windowSeconds: 60 };
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT.max) {
    return false;
  }

  entry.count++;
  return true;
}

// SHA256 hash
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface SubmitPartnerDecisionRequest {
  token: string;
  approved: boolean;
}

// Notification messages for partner decisions
const APPROVED_MESSAGES = [
  '✅ Your partner confirmed you did it!',
  "Partner says you're good. Promise complete!",
  'Verified! Your partner approved.',
  'Your partner gave the thumbs up. Nice.',
  'Confirmation received. You actually did it.',
];

const REJECTED_MESSAGES = [
  '❌ Your partner says nope.',
  'Partner rejected your completion.',
  "Denied. Your partner didn't buy it.",
  'Your partner called BS. Promise failed.',
  'Verification denied. Oops.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Send a push notification via Expo Push API
 */
async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!pushToken) {
    console.log('[submit-partner-decision] No push token, skipping notification');
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
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
    console.log('[submit-partner-decision] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[submit-partner-decision] Failed to send push notification:', error);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    // 1. Parse request body
    const body: SubmitPartnerDecisionRequest = await req.json();
    const { token, approved } = body;

    if (!token || typeof approved !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing token or approved field' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();

    // 2. Look up share link by token hash
    const tokenHash = await sha256(token);

    const { data: shareLink, error: linkError } = await supabase
      .from('share_links')
      .select('id, promise_id, type, expires_at, revoked')
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !shareLink) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired link' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 3. Validate link type and status
    if (shareLink.type !== 'partner') {
      return new Response(
        JSON.stringify({ error: 'This is not a partner verification link' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (shareLink.revoked) {
      return new Response(
        JSON.stringify({ error: 'This link has been revoked' }),
        {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Check expiration
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This link has expired' }),
        {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 4. Get client IP and check rate limit
    const ipHash = await hashClientIp(req);
    const rateLimitKey = `partner:${ipHash}`;

    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Get promise and validate state
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('id, status, partner_state, stake, verification_type, user_id')
      .eq('id', shareLink.promise_id)
      .single();

    if (promiseError || !promise) {
      return new Response(
        JSON.stringify({ error: 'Promise not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Check if promise is still awaiting partner decision
    if (promise.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'This promise has already been resolved' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (promise.partner_state !== 'awaiting') {
      return new Response(
        JSON.stringify({ error: 'Partner decision has already been submitted' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Update promise based on partner decision
    const now = new Date().toISOString();
    let newStatus: 'completed' | 'failed';
    let updateData: Record<string, unknown>;

    if (approved) {
      // Partner approved - mark as completed
      newStatus = 'completed';
      updateData = {
        status: 'completed',
        partner_state: 'approved',
        completed_at: now,
        updated_at: now,
      };
    } else {
      // Partner rejected - mark as failed
      newStatus = 'failed';
      updateData = {
        status: 'failed',
        partner_state: 'rejected',
        failed_at: now,
        // Set settle_at to trigger payment processing (1 hour grace period)
        settle_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        updated_at: now,
      };
    }

    const { error: updateError } = await supabase
      .from('promises')
      .update(updateData)
      .eq('id', shareLink.promise_id);

    if (updateError) {
      console.error('[submit-partner-decision] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update promise' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 7. Send push notification to promise owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', promise.user_id)
      .single();

    if (profile?.expo_push_token) {
      const messages = approved ? APPROVED_MESSAGES : REJECTED_MESSAGES;
      const title = approved ? '✅ Partner approved!' : '❌ Partner rejected';
      await sendPushNotification(
        profile.expo_push_token,
        title,
        pickRandom(messages),
        { promiseId: shareLink.promise_id, type: 'partner_decision', approved },
      );
    }

    // 8. Revoke the share link (partner links are one-time use)
    await supabase
      .from('share_links')
      .update({ revoked: true })
      .eq('id', shareLink.id);

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[submit-partner-decision] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
