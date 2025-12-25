// @ts-nocheck
// deno-lint-ignore-file
/**
 * validate-username Edge Function
 *
 * Validates username format and checks availability.
 * Rules: 3-20 chars, alphanumeric + underscores, unique (case-insensitive)
 *
 * POST /validate-username
 * Body: { username: string }
 * Returns: { valid: boolean, available: boolean, error?: string }
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

interface ValidateUsernameRequest {
  username: string;
}

interface ValidationResult {
  valid: boolean;
  available: boolean;
  error?: string;
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
    // 1. Authenticate user (optional for validation, but recommended)
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
    const body: ValidateUsernameRequest = await req.json();
    const { username } = body;

    // 3. Validate format
    const formatResult = validateUsernameFormat(username);
    if (!formatResult.valid) {
      const result: ValidationResult = {
        valid: false,
        available: false,
        error: formatResult.error,
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();
    const normalizedUsername = username.trim().toLowerCase();

    // 4. Check availability (case-insensitive)
    const { data: existing, error: queryError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', normalizedUsername)
      .neq('id', user.id) // Exclude current user (in case they're checking their own username)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[validate-username] Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to check availability' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const available = !existing;

    const result: ValidationResult = {
      valid: true,
      available,
      error: available ? undefined : 'Username is already taken',
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[validate-username] Error:', error);
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

