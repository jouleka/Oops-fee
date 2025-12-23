// @ts-nocheck
// deno-lint-ignore-file
/**
 * CORS headers for edge functions
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsOptions(): Response {
  return new Response('ok', { headers: corsHeaders });
}

