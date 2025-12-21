// @ts-nocheck
// deno-lint-ignore-file
/**
 * submit-roast Edge Function
 *
 * Public endpoint to submit an "I Told You So" roast message for a promise.
 * Rate limited: 3 per minute per IP per promise.
 * Only one roast message is kept per promise (last one wins).
 *
 * POST /submit-roast
 * Body: { token: string, message: string, fromName: string }
 * Returns: { success: true }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Rate limiting: 3 per minute per IP per promise
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

interface SubmitRoastRequest {
  token: string;
  message: string;
  fromName: string;
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
    const body: SubmitRoastRequest = await req.json();
    const { token, message, fromName } = body;

    if (!token || !message || !fromName) {
      return new Response(
        JSON.stringify({ error: 'Missing token, message, or fromName' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate message (max 280 chars like a tweet)
    const sanitizedMessage = message.trim().slice(0, 280);
    if (sanitizedMessage.length < 1) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
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

    // 3. Validate link type and status
    if (shareLink.type !== 'roast') {
      return new Response(
        JSON.stringify({ error: 'This is not a roast link' }),
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
    const rateLimitKey = `roast:${ipHash}:${shareLink.promise_id}`;

    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Too many messages. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Check promise is still active
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('id, status')
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

    // 6. Delete any existing roast messages for this promise (only keep latest)
    await supabase
      .from('roast_messages')
      .delete()
      .eq('promise_id', shareLink.promise_id);

    // 7. Insert new roast message (trigger will set has_roast flag)
    const { error: insertError } = await supabase
      .from('roast_messages')
      .insert({
        promise_id: shareLink.promise_id,
        message: sanitizedMessage,
        from_name: sanitizedName,
        from_ip_hash: ipHash,
      });

    if (insertError) {
      console.error('[submit-roast] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit message' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[submit-roast] Error:', error);
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

