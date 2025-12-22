// @ts-nocheck
// deno-lint-ignore-file
/**
 * create-share-link Edge Function
 *
 * Creates a shareable link for a promise (friend/partner).
 * - friend: Combined sponsor + roast link (friends can pledge and/or leave messages)
 * - partner: Verification link for partner to approve/reject completion
 * 
 * Requires user authentication - only the promise owner can create links.
 *
 * POST /create-share-link
 * Body: { promiseId: string, type: 'friend' | 'partner' }
 * Returns: { token: string, url: string, expiresAt?: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA256 hash for storing token
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

type ShareLinkType = 'friend' | 'partner';

interface CreateShareLinkRequest {
  promiseId: string;
  type: ShareLinkType;
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 2. Parse request body
    const body: CreateShareLinkRequest = await req.json();
    const { promiseId, type } = body;

    if (!promiseId || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing promiseId or type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!['friend', 'partner'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be friend or partner' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();

    // 3. Verify promise exists and belongs to user
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('id, user_id, status, verification_type, partner_state')
      .eq('id', promiseId)
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

    if (promise.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - not your promise' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 4. Validate partner links - only for partner verification type
    if (type === 'partner' && promise.verification_type !== 'partner') {
      return new Response(
        JSON.stringify({ error: 'Partner links only available for partner verification promises' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Check if promise is still active (for partner links)
    if (type === 'partner' && promise.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Cannot create partner link for resolved promise' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Generate token and hash
    const token = generateToken();
    const tokenHash = await hashToken(token);

    // 7. Set expiration (partner links expire in 24h, others don't expire)
    const expiresAt = type === 'partner'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 8. Check for existing non-revoked link of same type
    const { data: existingLink } = await supabase
      .from('share_links')
      .select('id')
      .eq('promise_id', promiseId)
      .eq('type', type)
      .eq('revoked', false)
      .single();

    // For friend, reuse existing link if available
    // For partner, always create new link (each partner gets unique link)
    if (existingLink && type !== 'partner') {
      // Revoke old link before creating new one
      await supabase
        .from('share_links')
        .update({ revoked: true })
        .eq('id', existingLink.id);
    }

    // 9. Insert share link
    const { error: insertError } = await supabase
      .from('share_links')
      .insert({
        promise_id: promiseId,
        type,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('[create-share-link] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create share link' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 9b. For partner links: update promise with awaiting state and partner deadline
    if (type === 'partner') {
      const partnerDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // settle_at should be after partner deadline + 1 hour grace period
      const settleAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
      
      // Only update if not already awaiting (prevent resetting deadline)
      if (promise.partner_state !== 'awaiting') {
        const { error: updateError } = await supabase
          .from('promises')
          .update({
            partner_state: 'awaiting',
            partner_deadline_at: partnerDeadlineAt,
            settle_at: settleAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', promiseId);

        if (updateError) {
          console.error('[create-share-link] Error updating partner state:', updateError);
          // Don't fail the request - link was created successfully
        }
      }
    }

    // 10. Build response
    const url = `https://oopsfee.app/s/${token}`;

    const response: { token: string; url: string; expiresAt?: string } = {
      token,
      url,
    };

    if (expiresAt) {
      response.expiresAt = expiresAt;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[create-share-link] Error:', error);
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

