// @ts-nocheck
// deno-lint-ignore-file
/**
 * search-users Edge Function
 *
 * Search for users by username prefix for friend discovery.
 * Returns users with matching username, excluding self and existing friends/pending requests.
 *
 * POST /search-users
 * Body: { query: string, limit?: number }
 * Returns: { users: Array<{ id, username, display_name, avatar_url }> }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

interface SearchUsersRequest {
  query: string;
  limit?: number;
}

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface SearchResponse {
  users: UserResult[];
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
    const body: SearchUsersRequest = await req.json();
    const { query, limit: requestedLimit } = body;

    // 3. Validate query
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Query must be at least ${MIN_QUERY_LENGTH} characters` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 4. Validate and apply limit
    const limit = Math.min(
      Math.max(1, requestedLimit ?? DEFAULT_LIMIT),
      MAX_LIMIT,
    );

    const supabase = createAdminClient();

    // 5. Get IDs of users to exclude (self + existing friendships in any status)
    // This includes pending, accepted, rejected, and blocked to avoid re-sending requests
    const { data: existingFriendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendshipError) {
      console.error('[search-users] Friendship query error:', friendshipError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing friendships' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Build set of user IDs to exclude
    const excludeIds = new Set<string>([user.id]);
    for (const friendship of existingFriendships ?? []) {
      if (friendship.requester_id !== user.id) {
        excludeIds.add(friendship.requester_id);
      }
      if (friendship.addressee_id !== user.id) {
        excludeIds.add(friendship.addressee_id);
      }
    }

    // 6. Search for users by username prefix (case-insensitive)
    // Using ilike with pattern for prefix search
    const searchPattern = `${trimmedQuery}%`;
    
    let queryBuilder = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .not('username', 'is', null) // Only users with usernames
      .ilike('username', searchPattern)
      .limit(limit + excludeIds.size); // Fetch extra to account for exclusions

    const { data: searchResults, error: searchError } = await queryBuilder;

    if (searchError) {
      console.error('[search-users] Search query error:', searchError);
      return new Response(
        JSON.stringify({ error: 'Failed to search users' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 7. Filter out excluded users and apply limit
    const filteredUsers: UserResult[] = (searchResults ?? [])
      .filter((profile) => !excludeIds.has(profile.id))
      .slice(0, limit)
      .map((profile) => ({
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }));

    const response: SearchResponse = {
      users: filteredUsers,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[search-users] Error:', error);
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

