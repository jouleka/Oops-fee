// @ts-nocheck
// deno-lint-ignore-file
/**
 * send-friend-request Edge Function
 *
 * Create a pending friendship request between the authenticated user
 * and another user by their user ID.
 *
 * POST /send-friend-request
 * Body: { addressee_id: string }
 * Returns: { success: true, friendship_id: string } or { error: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

interface SendRequestBody {
  addressee_id: string;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
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
    console.log('[send-friend-request] No push token, skipping notification');
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
    console.log('[send-friend-request] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[send-friend-request] Failed to send push notification:', error);
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
    const body: SendRequestBody = await req.json();
    const { addressee_id } = body;

    // 3. Validate addressee_id
    if (!addressee_id || typeof addressee_id !== 'string') {
      return new Response(JSON.stringify({ error: 'addressee_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Prevent self-friend request
    if (addressee_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot send friend request to yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();

    // 5. Verify addressee exists
    const { data: addresseeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, expo_push_token')
      .eq('id', addressee_id)
      .single();

    if (profileError || !addresseeProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Check for existing friendship in any direction
    const { data: existingFriendships, error: checkError } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${addressee_id}),and(requester_id.eq.${addressee_id},addressee_id.eq.${user.id})`,
      );

    if (checkError) {
      console.error('[send-friend-request] Check existing error:', checkError);
      return new Response(JSON.stringify({ error: 'Failed to check existing friendships' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingFriendships && existingFriendships.length > 0) {
      const existing = existingFriendships[0] as FriendshipRow;

      if (existing.status === 'accepted') {
        return new Response(JSON.stringify({ error: 'You are already friends with this user' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existing.status === 'pending') {
        // Check who sent the request
        if (existing.requester_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'Friend request already sent' }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        } else {
          // The other user already sent a request - auto-accept it instead
          const { data: accepted, error: acceptError } = await supabase
            .from('friendships')
            .update({
              status: 'accepted',
              responded_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select('id')
            .single();

          if (acceptError) {
            console.error('[send-friend-request] Auto-accept error:', acceptError);
            return new Response(
              JSON.stringify({ error: 'Failed to accept pending request' }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            );
          }

          // Notify the original requester that their request was accepted
          await sendPushNotification(
            addresseeProfile.expo_push_token,
            'Friend request accepted! 🎉',
            `You're now accountability partners!`,
            { type: 'friend_request_accepted', friendship_id: accepted.id },
          );

          return new Response(
            JSON.stringify({
              success: true,
              friendship_id: accepted.id,
              auto_accepted: true,
              message: 'Pending request from this user was accepted',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          );
        }
      }

      if (existing.status === 'blocked') {
        // Don't reveal that the user is blocked
        return new Response(JSON.stringify({ error: 'Unable to send friend request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (existing.status === 'rejected') {
        // Allow re-sending after rejection - update existing row to pending
        const { data: updated, error: updateError } = await supabase
          .from('friendships')
          .update({
            status: 'pending',
            requester_id: user.id,
            addressee_id: addressee_id,
            responded_at: null,
            created_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (updateError) {
          console.error('[send-friend-request] Re-send update error:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to resend friend request' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Send notification to addressee
        const { data: requesterProfile } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user.id)
          .single();

        const requesterName =
          requesterProfile?.username || requesterProfile?.display_name || 'Someone';

        await sendPushNotification(
          addresseeProfile.expo_push_token,
          'New friend request! 👋',
          `@${requesterName} wants to be your accountability partner`,
          { type: 'friend_request_received', friendship_id: updated.id },
        );

        return new Response(
          JSON.stringify({ success: true, friendship_id: updated.id }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // 7. Create new friendship request
    const { data: friendship, error: insertError } = await supabase
      .from('friendships')
      .insert({
        requester_id: user.id,
        addressee_id: addressee_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[send-friend-request] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to send friend request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Send push notification to addressee
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .single();

    const requesterName = requesterProfile?.username || requesterProfile?.display_name || 'Someone';

    await sendPushNotification(
      addresseeProfile.expo_push_token,
      'New friend request! 👋',
      `@${requesterName} wants to be your accountability partner`,
      { type: 'friend_request_received', friendship_id: friendship.id },
    );

    console.log(
      `[send-friend-request] Friend request sent: ${user.id} -> ${addressee_id}, friendship_id: ${friendship.id}`,
    );

    return new Response(JSON.stringify({ success: true, friendship_id: friendship.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-friend-request] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

