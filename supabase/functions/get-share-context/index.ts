// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-share-context Edge Function
 *
 * Public endpoint to get minimal promise info for rendering share pages.
 * Rate limited by IP address.
 *
 * GET /get-share-context?token=xxx
 * Returns: ShareContext (minimal data for rendering)
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Rate limiting: 30 requests per minute per IP
const RATE_LIMIT = { max: 30, windowSeconds: 60 };
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ipHash, { count: 1, resetAt: now + RATE_LIMIT.windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT.max) {
    return false;
  }

  entry.count++;
  return true;
}

// SHA256 hash for IP addresses
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + Deno.env.get('IP_SALT') ?? 'oopsfee-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA256 hash for token lookup
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface ShareContext {
  type: 'friend' | 'partner';
  promiseText: string; // First 100 chars only
  deadlinePassed: boolean; // Not the actual deadline
  ownerFirstName?: string; // Not full name
  status: 'active' | 'resolved'; // Simplified
  // For friend (combined sponsor + roast)
  currentSponsorTotal?: number;
  sponsorCount?: number;
  roastCount?: number; // Number of roast messages
  hasSponsor?: boolean;
  // For partner
  partnerState?: 'awaiting' | 'resolved';
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    // 1. Rate limit by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = await hashIP(clientIP);

    if (!checkRateLimit(ipHash)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 2. Get token from query params
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();

    // 3. Look up share link by token hash
    const tokenHash = await hashToken(token);

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

    // 4. Check if link is revoked or expired
    if (shareLink.revoked) {
      return new Response(
        JSON.stringify({ error: 'This link has been revoked' }),
        {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This link has expired' }),
        {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Get promise data
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select(`
        id,
        text,
        deadline_at,
        status,
        sponsor_total,
        sponsor_count,
        has_roast,
        partner_state,
        user_id
      `)
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

    // 6. Get owner's first name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', promise.user_id)
      .single();

    const ownerFirstName = profile?.display_name?.split(' ')[0] || 'Someone';

    // 7. Build minimal context response
    const context: ShareContext = {
      type: shareLink.type as ShareContext['type'],
      promiseText: promise.text.slice(0, 100) + (promise.text.length > 100 ? '...' : ''),
      deadlinePassed: new Date(promise.deadline_at) < new Date(),
      ownerFirstName,
      status: promise.status === 'active' ? 'active' : 'resolved',
    };

    // Add type-specific fields
    if (shareLink.type === 'friend') {
      // Friend links can see sponsor info and roast count
      context.currentSponsorTotal = (promise.sponsor_total || 0) / 100; // Convert cents to dollars
      context.sponsorCount = promise.sponsor_count || 0;
      context.hasSponsor = (promise.sponsor_count || 0) > 0;

      // Get roast message count
      const { count: roastCount } = await supabase
        .from('roast_messages')
        .select('*', { count: 'exact', head: true })
        .eq('promise_id', shareLink.promise_id);

      context.roastCount = roastCount || 0;
    }

    if (shareLink.type === 'partner') {
      context.partnerState = promise.partner_state === 'awaiting' ? 'awaiting' : 'resolved';
    }

    return new Response(JSON.stringify(context), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[get-share-context] Error:', error);
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

