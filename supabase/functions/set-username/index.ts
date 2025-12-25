// @ts-nocheck
// deno-lint-ignore-file
/**
 * set-username Edge Function
 *
 * Sets the username for the authenticated user.
 * Validates format and availability before setting.
 * Rules: 3-20 chars, alphanumeric + underscores, unique (case-insensitive)
 *
 * POST /set-username
 * Body: { username: string }
 * Returns: { success: boolean, username: string } or { error: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Username validation regex: 3-20 chars, alphanumeric + underscores, must start with letter
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'oopsfee',
  'system',
  'root',
  'mod',
  'moderator',
  'official',
  'staff',
  'team',
  'null',
  'undefined',
  'api',
  'www',
]);

interface SetUsernameRequest {
  username: string;
}

function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    if (!/^[a-zA-Z]/.test(trimmed)) {
      return { valid: false, error: 'Username must start with a letter' };
    }
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
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
    const body: SetUsernameRequest = await req.json();
    const { username } = body;

    // 3. Validate format
    const formatResult = validateUsernameFormat(username);
    if (!formatResult.valid) {
      return new Response(
        JSON.stringify({ error: formatResult.error }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();
    const trimmedUsername = username.trim();
    const normalizedUsername = trimmedUsername.toLowerCase();

    // 4. Check if user already has a username set
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[set-username] Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 5. Check if new username is same as current (case-insensitive)
    if (currentProfile?.username?.toLowerCase() === normalizedUsername) {
      return new Response(
        JSON.stringify({ success: true, username: currentProfile.username }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 6. Check availability (case-insensitive, excluding current user)
    const { data: existing, error: queryError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', normalizedUsername)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[set-username] Availability check error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to check availability' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Username is already taken' }),
        {
          status: 409, // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 7. Update profile with new username
    const isFirstTimeSet = !currentProfile?.username;
    const updateData: Record<string, unknown> = {
      username: trimmedUsername,
    };

    // Only set username_set_at on first-time set
    if (isFirstTimeSet) {
      updateData.username_set_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[set-username] Update error:', updateError);
      
      // Handle unique constraint violation (race condition)
      if (updateError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Username is already taken' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to set username' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, username: trimmedUsername }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[set-username] Error:', error);
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

