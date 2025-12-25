// @ts-nocheck
// deno-lint-ignore-file
/**
 * respond-friend-request Edge Function
 *
 * Accept or reject a pending friend request.
 * Only the addressee of the request can respond.
 *
 * POST /respond-friend-request
 * Body: { friendship_id: string, action: 'accept' | 'reject' }
 * Returns: { success: true, status: string } or { error: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

type ResponseAction = 'accept' | 'reject';

interface RespondRequestBody {
  friendship_id: string;
  action: ResponseAction;
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
    console.log('[respond-friend-request] No push token, skipping notification');
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
    console.log('[respond-friend-request] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[respond-friend-request] Failed to send push notification:', error);
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
    const body: RespondRequestBody = await req.json();
    const { friendship_id, action } = body;

    // 3. Validate inputs
    if (!friendship_id || typeof friendship_id !== 'string') {
      return new Response(JSON.stringify({ error: 'friendship_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'accept' or 'reject'" }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();

    // 4. Get the friendship request
    const { data: friendship, error: fetchError } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .eq('id', friendship_id)
      .single();

    if (fetchError || !friendship) {
      console.error('[respond-friend-request] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Friend request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const friendshipData = friendship as FriendshipRow;

    // 5. Verify the user is the addressee
    if (friendshipData.addressee_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only respond to requests sent to you' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Verify the request is still pending
    if (friendshipData.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: `Cannot respond to a ${friendshipData.status} request`,
          current_status: friendshipData.status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 7. Update the friendship status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    const { error: updateError } = await supabase
      .from('friendships')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq('id', friendship_id);

    if (updateError) {
      console.error('[respond-friend-request] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update friend request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. If accepted, send notification to the requester
    if (action === 'accept') {
      // Get requester's push token and responding user's name
      const [requesterResult, addresseeResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('expo_push_token')
          .eq('id', friendshipData.requester_id)
          .single(),
        supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user.id)
          .single(),
      ]);

      const requesterProfile = requesterResult.data;
      const addresseeProfile = addresseeResult.data;
      const addresseeName =
        addresseeProfile?.username || addresseeProfile?.display_name || 'Someone';

      if (requesterProfile?.expo_push_token) {
        await sendPushNotification(
          requesterProfile.expo_push_token,
          'Friend request accepted! 🎉',
          `@${addresseeName} is now your accountability partner`,
          { type: 'friend_request_accepted', friendship_id: friendship_id },
        );
      }
    }

    console.log(
      `[respond-friend-request] Request ${friendship_id} ${action}ed by ${user.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        friendship_id: friendship_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[respond-friend-request] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

