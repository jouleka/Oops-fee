// @ts-nocheck
// deno-lint-ignore-file
/**
 * submit-sponsor Edge Function
 *
 * Public endpoint to submit a sponsor pledge for a promise.
 * Rate limited: 5 pledges per minute per IP per promise.
 *
 * POST /submit-sponsor
 * Body: { token: string, amount: number, fromName: string }
 * Returns: { success: true, newTotal: number, sponsorCount: number }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Rate limiting: 5 per minute per IP per promise
const RATE_LIMIT = { max: 5, windowSeconds: 60 };
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

interface SubmitSponsorRequest {
  token: string;
  amount: number;
  fromName: string;
}

// Notification messages for when someone sponsors
const SPONSOR_MESSAGES = [
  '💰 {fromName} added ${amount} to your stake!',
  '+${amount} from {fromName}. No pressure.',
  '{fromName} just made your promise more expensive.',
  'Your stake just grew by ${amount}. Thanks, {fromName}.',
  '{fromName} is betting against you. +${amount}.',
];

function pickRandom<T>(arr: T[]): T {
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
    console.log('[submit-sponsor] No push token, skipping notification');
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
    console.log('[submit-sponsor] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[submit-sponsor] Failed to send push notification:', error);
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
    const body: SubmitSponsorRequest = await req.json();
    const { token, amount, fromName } = body;

    if (!token || !amount || !fromName) {
      return new Response(
        JSON.stringify({ error: 'Missing token, amount, or fromName' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate amount (1-1000 dollars, stored in cents)
    const amountCents = Math.round(amount * 100);
    if (amountCents < 100 || amountCents > 100000) {
      return new Response(
        JSON.stringify({ error: 'Amount must be between $1 and $1000' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate name
    const sanitizedName = fromName.trim().slice(0, 50);
    if (sanitizedName.length < 1) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
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

    // 3. Validate link type - only 'friend' type supports sponsoring
    if (shareLink.type !== 'friend') {
      return new Response(
        JSON.stringify({ error: 'This link does not support sponsoring' }),
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

    // 4. Get client IP and check rate limit
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = await sha256(clientIP + (Deno.env.get('IP_SALT') ?? 'oopsfee-salt'));
    const rateLimitKey = `sponsor:${ipHash}:${shareLink.promise_id}`;

    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Too many pledges. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Check promise is still active
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('id, status, deadline_at, user_id')
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

    if (promise.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'This promise has already been resolved' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Check if this IP has already pledged on this promise
    const { data: existingPledge } = await supabase
      .from('sponsor_pledges')
      .select('id')
      .eq('promise_id', shareLink.promise_id)
      .eq('from_ip_hash', ipHash)
      .limit(1)
      .single();

    if (existingPledge) {
      return new Response(
        JSON.stringify({ error: 'You have already sponsored this promise' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 8. Insert sponsor pledge (trigger will update denormalized totals)
    const { error: insertError } = await supabase
      .from('sponsor_pledges')
      .insert({
        promise_id: shareLink.promise_id,
        amount: amountCents,
        from_name: sanitizedName,
        from_ip_hash: ipHash,
      });

    if (insertError) {
      console.error('[submit-sponsor] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit pledge' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 9. Get updated totals
    const { data: updatedPromise } = await supabase
      .from('promises')
      .select('sponsor_total, sponsor_count')
      .eq('id', shareLink.promise_id)
      .single();

    // 10. Send push notification to promise owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', promise.user_id)
      .single();

    if (profile?.expo_push_token) {
      const amountDollars = (amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2);
      const message = formatMessage(pickRandom(SPONSOR_MESSAGES), {
        fromName: sanitizedName,
        amount: amountDollars,
      });
      await sendPushNotification(
        profile.expo_push_token,
        '💰 New sponsor!',
        message,
        { promiseId: shareLink.promise_id, type: 'sponsor' },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        newTotal: (updatedPromise?.sponsor_total || 0) / 100, // Convert cents to dollars
        sponsorCount: updatedPromise?.sponsor_count || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[submit-sponsor] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

