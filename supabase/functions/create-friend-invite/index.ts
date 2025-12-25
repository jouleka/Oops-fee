// @ts-nocheck
// deno-lint-ignore-file
/**
 * create-friend-invite Edge Function
 *
 * Generate a unique invite token that can be shared with non-users.
 * When the recipient signs up and claims the invite, they become friends.
 *
 * POST /create-friend-invite
 * Body: {} (empty, just needs auth)
 * Returns: { success: true, invite_token: string, invite_url: string, expires_at: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

/**
 * Generate a URL-safe random token
 */
function generateInviteToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();

    // 2. Check if user has a username set (required for friend system)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[create-friend-invite] Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile?.username) {
      return new Response(
        JSON.stringify({ error: 'You must set a username before inviting friends' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 3. Generate unique invite token
    const inviteToken = generateInviteToken();

    // 4. Calculate expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 5. Insert invite record
    const { data: invite, error: insertError } = await supabase
      .from('friend_invites')
      .insert({
        inviter_id: user.id,
        invite_token: inviteToken,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, invite_token, expires_at')
      .single();

    if (insertError) {
      console.error('[create-friend-invite] Insert error:', insertError);
      // Handle unique constraint violation (very unlikely with crypto random)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Failed to generate invite, please try again' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Build the invite URL
    const baseUrl = Deno.env.get('APP_URL') || 'https://oopsfee.app';
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

    console.log(
      `[create-friend-invite] Invite created by ${user.id}: ${invite.id}, token: ${inviteToken}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        invite_token: inviteToken,
        invite_url: inviteUrl,
        expires_at: invite.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[create-friend-invite] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

