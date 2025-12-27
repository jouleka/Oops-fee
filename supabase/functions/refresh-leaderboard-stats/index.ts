// @ts-nocheck
// deno-lint-ignore-file
/**
 * refresh-leaderboard-stats Edge Function (Cron)
 *
 * Refreshes the leaderboard_stats materialized view every 15 minutes.
 * This keeps global leaderboard rankings up-to-date without computing
 * them on every request.
 *
 * Schedule: Every 15 minutes via Supabase cron (pg_cron) or external scheduler.
 * Can also be triggered manually after promise completion/failure.
 *
 * Uses service role key to execute the refresh function.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Accept both GET (for cron) and POST (for manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify cron secret for security (reuses same secret as other cron jobs)
  const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Call the refresh_leaderboard_stats() function
    // This uses REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid locks
    const { error } = await supabase.rpc('refresh_leaderboard_stats');

    if (error) {
      console.error('[refresh-leaderboard-stats] Error refreshing view:', error);
      throw error;
    }

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      message: 'Leaderboard stats refreshed successfully',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
    };

    console.log('[refresh-leaderboard-stats] Refresh complete:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error('[refresh-leaderboard-stats] Error:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

