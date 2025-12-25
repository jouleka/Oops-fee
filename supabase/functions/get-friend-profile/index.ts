// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-friend-profile Edge Function
 *
 * Get a friend's profile, active promises, and stats summary.
 * Requires an accepted friendship between the requesting user and the target friend.
 *
 * POST /get-friend-profile
 * Body: { friend_id: string }
 * Returns: {
 *   profile: FriendProfileData,
 *   activePromises: FriendPromise[],
 *   stats: FriendStats,
 *   recentHistory: HistoryItem[]
 * }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface FriendProfileData {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface FriendPromise {
  id: string;
  text: string;
  stake: number;
  deadline_at: string;
  verification_type: string;
  sponsor_total: number;
  sponsor_count: number;
  has_roast: boolean;
  created_at: string;
}

interface FriendStats {
  totalPromises: number;
  completed: number;
  failed: number;
  successRate: number;
  currentStreak: number;
  longestStreak: number;
  totalSaved: number;
  totalLost: number;
}

interface HistoryItem {
  id: string;
  text: string;
  stake: number;
  status: string;
  completed_at: string | null;
  failed_at: string | null;
}

interface GetFriendProfileResponse {
  profile: FriendProfileData;
  activePromises: FriendPromise[];
  stats: FriendStats;
  recentHistory: HistoryItem[];
}

interface RequestBody {
  friend_id: string;
}

// ─────────────────────────────────────────────────────────────
// STATS COMPUTATION HELPERS
// ─────────────────────────────────────────────────────────────

interface PromiseRecord {
  id: string;
  status: string;
  stake: number;
  updated_at: string;
}

function computeCurrentStreak(promises: PromiseRecord[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  let streak = 0;
  for (const p of sorted) {
    if (p.status === 'completed') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function computeLongestStreak(promises: PromiseRecord[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  let longest = 0;
  let current = 0;

  for (const p of sorted) {
    if (p.status === 'completed') {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

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
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { friend_id } = body;

    if (!friend_id || typeof friend_id !== 'string') {
      return new Response(JSON.stringify({ error: 'friend_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Can't view your own profile through this endpoint
    if (friend_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot view your own profile here' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();

    // 3. Verify accepted friendship exists
    const { data: friendship, error: friendshipError } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${friend_id}),and(requester_id.eq.${friend_id},addressee_id.eq.${user.id})`
      )
      .eq('status', 'accepted')
      .maybeSingle();

    if (friendshipError) {
      console.error('[get-friend-profile] Friendship check error:', friendshipError);
      return new Response(JSON.stringify({ error: 'Failed to verify friendship' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!friendship) {
      return new Response(JSON.stringify({ error: 'Not friends with this user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Get friend's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', friend_id)
      .single();

    if (profileError || !profile) {
      console.error('[get-friend-profile] Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Friend not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Get friend's promises (all for stats, active for display)
    const { data: allPromises, error: promisesError } = await supabase
      .from('promises')
      .select(
        'id, text, stake, status, deadline_at, verification_type, sponsor_total, sponsor_count, has_roast, created_at, updated_at, completed_at, failed_at'
      )
      .eq('user_id', friend_id)
      .order('created_at', { ascending: false });

    if (promisesError) {
      console.error('[get-friend-profile] Promises fetch error:', promisesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch promises' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promises = allPromises ?? [];

    // 6. Filter active promises for display (no verification proofs for privacy)
    const activePromises: FriendPromise[] = promises
      .filter((p) => p.status === 'active')
      .map((p) => ({
        id: p.id,
        text: p.text,
        stake: p.stake,
        deadline_at: p.deadline_at,
        verification_type: p.verification_type,
        sponsor_total: p.sponsor_total ?? 0,
        sponsor_count: p.sponsor_count ?? 0,
        has_roast: p.has_roast ?? false,
        created_at: p.created_at,
      }));

    // 7. Compute stats
    const completed = promises.filter((p) => p.status === 'completed').length;
    const failed = promises.filter((p) => p.status === 'failed').length;
    const expired = promises.filter((p) => p.status === 'expired').length;
    const totalDecided = completed + failed + expired;

    const totalSaved = promises
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + (p.stake ?? 0), 0);

    const totalLost = promises
      .filter((p) => p.status === 'failed' || p.status === 'expired')
      .reduce((sum, p) => sum + (p.stake ?? 0), 0);

    const successRate = totalDecided > 0 ? Math.round((completed / totalDecided) * 100) : 0;

    const promiseRecords: PromiseRecord[] = promises.map((p) => ({
      id: p.id,
      status: p.status,
      stake: p.stake,
      updated_at: p.updated_at,
    }));

    const currentStreak = computeCurrentStreak(promiseRecords);
    const longestStreak = computeLongestStreak(promiseRecords);

    const stats: FriendStats = {
      totalPromises: promises.length,
      completed,
      failed: failed + expired,
      successRate,
      currentStreak,
      longestStreak,
      totalSaved,
      totalLost,
    };

    // 8. Get recent history (last 10 completed/failed promises)
    const recentHistory: HistoryItem[] = promises
      .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        text: p.text,
        stake: p.stake,
        status: p.status,
        completed_at: p.completed_at,
        failed_at: p.failed_at,
      }));

    // 9. Build response
    const response: GetFriendProfileResponse = {
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      activePromises,
      stats,
      recentHistory,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[get-friend-profile] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

