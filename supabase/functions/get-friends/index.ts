// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-friends Edge Function
 *
 * Get all friends and pending friend requests for the authenticated user.
 *
 * POST /get-friends
 * Body: {} (no body required)
 * Returns: {
 *   friends: Array<FriendProfile>,
 *   pendingReceived: Array<FriendRequest>,
 *   pendingSent: Array<FriendRequest>
 * }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

interface FriendProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  friendship_id: string;
  created_at: string;
}

interface FriendRequest {
  friendship_id: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
}

interface GetFriendsResponse {
  friends: FriendProfile[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
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

    // 2. Get all friendships involving this user
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendshipsError) {
      console.error('[get-friends] Friendships query error:', friendshipsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch friendships' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Categorize friendships
    const acceptedFriendships: { id: string; friendId: string; created_at: string }[] = [];
    const pendingReceived: { id: string; requesterId: string; created_at: string }[] = [];
    const pendingSent: { id: string; addresseeId: string; created_at: string }[] = [];

    for (const f of friendships ?? []) {
      if (f.status === 'accepted') {
        // Get the friend's ID (the other user)
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        acceptedFriendships.push({ id: f.id, friendId, created_at: f.created_at });
      } else if (f.status === 'pending') {
        if (f.addressee_id === user.id) {
          // Request sent TO us
          pendingReceived.push({ id: f.id, requesterId: f.requester_id, created_at: f.created_at });
        } else {
          // Request sent BY us
          pendingSent.push({ id: f.id, addresseeId: f.addressee_id, created_at: f.created_at });
        }
      }
    }

    // 4. Collect all user IDs we need to fetch
    const userIds = new Set<string>();
    acceptedFriendships.forEach((f) => userIds.add(f.friendId));
    pendingReceived.forEach((f) => userIds.add(f.requesterId));
    pendingSent.forEach((f) => userIds.add(f.addresseeId));

    // 5. Fetch profiles for all users
    let profilesMap: Record<
      string,
      { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
    > = {};

    if (userIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(userIds));

      if (profilesError) {
        console.error('[get-friends] Profiles query error:', profilesError);
        return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      for (const p of profiles ?? []) {
        profilesMap[p.id] = p;
      }
    }

    // 6. Build response
    const response: GetFriendsResponse = {
      friends: acceptedFriendships.map((f) => {
        const profile = profilesMap[f.friendId];
        return {
          id: profile?.id ?? f.friendId,
          username: profile?.username ?? null,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          friendship_id: f.id,
          created_at: f.created_at,
        };
      }),
      pendingReceived: pendingReceived.map((f) => {
        const profile = profilesMap[f.requesterId];
        return {
          friendship_id: f.id,
          user: {
            id: profile?.id ?? f.requesterId,
            username: profile?.username ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          },
          created_at: f.created_at,
        };
      }),
      pendingSent: pendingSent.map((f) => {
        const profile = profilesMap[f.addresseeId];
        return {
          friendship_id: f.id,
          user: {
            id: profile?.id ?? f.addresseeId,
            username: profile?.username ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          },
          created_at: f.created_at,
        };
      }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[get-friends] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

