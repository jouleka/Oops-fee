// @ts-nocheck
// deno-lint-ignore-file
/**
 * claim-friend-invite Edge Function
 *
 * Called after signup with an invite token.
 * Auto-creates an accepted friendship between the inviter and the new user.
 *
 * POST /claim-friend-invite
 * Body: { invite_token: string }
 * Returns: { success: true, inviter: { id, username, display_name } } or { error: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

interface ClaimInviteBody {
  invite_token: string;
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
    console.log('[claim-friend-invite] No push token, skipping notification');
    return;
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
    console.log('[claim-friend-invite] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[claim-friend-invite] Failed to send push notification:', error);
  }
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

    // 2. Parse request body
    const body: ClaimInviteBody = await req.json();
    const { invite_token } = body;

    if (!invite_token || typeof invite_token !== 'string') {
      return new Response(JSON.stringify({ error: 'invite_token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();

    // 3. Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('friend_invites')
      .select('id, inviter_id, claimed_by, expires_at')
      .eq('invite_token', invite_token)
      .single();

    if (inviteError || !invite) {
      console.log('[claim-friend-invite] Invite not found:', invite_token);
      return new Response(JSON.stringify({ error: 'Invalid or expired invite link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Check if invite has expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This invite link has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Check if invite was already claimed
    if (invite.claimed_by) {
      // If claimed by the same user, treat as success (idempotent)
      if (invite.claimed_by === user.id) {
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', invite.inviter_id)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            already_claimed: true,
            inviter: inviterProfile,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: 'This invite has already been claimed' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Prevent self-claiming
    if (invite.inviter_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot claim your own invite' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 7. Check if already friends
    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${invite.inviter_id},addressee_id.eq.${user.id}),and(requester_id.eq.${user.id},addressee_id.eq.${invite.inviter_id})`,
      )
      .single();

    if (existingFriendship?.status === 'accepted') {
      // Already friends, just mark invite as claimed and return success
      await supabase
        .from('friend_invites')
        .update({ claimed_by: user.id })
        .eq('id', invite.id);

      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', invite.inviter_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          already_friends: true,
          inviter: inviterProfile,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 8. Create accepted friendship (or update pending to accepted)
    if (existingFriendship) {
      // Update existing to accepted
      const { error: updateError } = await supabase
        .from('friendships')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', existingFriendship.id);

      if (updateError) {
        console.error('[claim-friend-invite] Friendship update error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to establish friendship' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Create new accepted friendship
      const { error: insertError } = await supabase.from('friendships').insert({
        requester_id: invite.inviter_id,
        addressee_id: user.id,
        status: 'accepted',
        responded_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('[claim-friend-invite] Friendship insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create friendship' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 9. Mark invite as claimed
    const { error: claimError } = await supabase
      .from('friend_invites')
      .update({ claimed_by: user.id })
      .eq('id', invite.id);

    if (claimError) {
      console.error('[claim-friend-invite] Claim update error:', claimError);
      // Don't fail - friendship was already created
    }

    // 10. Get inviter profile for response
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('id, username, display_name, expo_push_token')
      .eq('id', invite.inviter_id)
      .single();

    // 11. Get claimer profile for notification
    const { data: claimerProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .single();

    const claimerName = claimerProfile?.username || claimerProfile?.display_name || 'Someone';

    // 12. Notify the inviter
    await sendPushNotification(
      inviterProfile?.expo_push_token ?? null,
      'Your invite was accepted! 🎉',
      `@${claimerName} joined and is now your accountability partner!`,
      { type: 'friend_invite_claimed', new_friend_id: user.id },
    );

    console.log(
      `[claim-friend-invite] Invite claimed: ${invite.id}, inviter: ${invite.inviter_id}, claimer: ${user.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        inviter: {
          id: inviterProfile?.id,
          username: inviterProfile?.username,
          display_name: inviterProfile?.display_name,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[claim-friend-invite] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

