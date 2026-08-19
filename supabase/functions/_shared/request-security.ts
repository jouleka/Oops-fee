// @ts-nocheck
// deno-lint-ignore-file

/**
 * Return the client address supplied by Supabase's trusted proxy.
 * The value is only used for abuse throttling and is never stored in plaintext.
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/** Hash an IP with a deployment-specific secret so hashes are not portable. */
export async function hashClientIp(req: Request): Promise<string> {
  const salt = Deno.env.get('IP_SALT');
  if (!salt) {
    throw new Error('Required server configuration is missing');
  }

  const input = new TextEncoder().encode(`${getClientIp(req)}:${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index++) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

/**
 * Require a configured cron secret and a matching Bearer credential.
 * The first configured environment variable in `secretNames` is used.
 */
export function requireCronAuthorization(
  req: Request,
  secretNames: string[],
): Response | null {
  const secret = secretNames
    .map((name) => Deno.env.get(name))
    .find((value): value is string => Boolean(value));

  if (!secret) {
    console.error(`Missing cron secret: configure one of ${secretNames.join(', ')}`);
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const expected = `Bearer ${secret}`;
  const provided = req.headers.get('Authorization') ?? '';
  if (!timingSafeEqual(provided, expected)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return null;
}
