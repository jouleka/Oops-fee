// @ts-nocheck
// deno-lint-ignore-file
/**
 * expire-claims Edge Function (Cron)
 *
 * Runs daily to expire unclaimed friend claims after 7 days.
 * 
 * When a user fails a promise with money_destination='friend', the friend has
 * 7 days to claim the funds. If they don't claim within that window, this
 * function marks the claim as expired and the funds stay with OopsFee.
 *
 * This function is invoked by Supabase cron (pg_cron) or external scheduler.
 * It uses the service role key to bypass RLS.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// Batch size for processing (avoid timeouts)
const BATCH_SIZE = 100;

interface FriendClaim {
  id: string;
  promise_id: string;
  friend_email: string | null;
  friend_phone: string | null;
  friend_name: string;
  claim_token: string;
  claim_status: string;
  claim_expires_at: string;
  amount_cents: number | null;
}

interface ExpirationResult {
  claimId: string;
  action: 'expired' | 'skipped';
  message: string;
}

/**
 * Send "claim expired" notification email to friend
 */
async function sendClaimExpiredEmail(
  to: string,
  friendName: string,
  amountCents: number,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[expire-claims] Resend API key not configured, skipping expiration email');
    return false;
  }

  const amountDisplay = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
  const subject = `⏰ Your ${amountDisplay} claim has expired`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim Expired</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 32px; font-weight: 700; margin: 0 0 8px 0; color: #ef4444;">
        ⏰ Time's Up
      </h1>
      <p style="font-size: 18px; color: #ffffff; margin: 0;">
        Your claim window has closed
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #ef4444; text-align: center;">
      <p style="font-size: 14px; color: #fca5a5; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        Expired Amount
      </p>
      <p style="font-size: 48px; font-weight: 700; margin: 0; color: #ef4444; text-decoration: line-through;">
        ${amountDisplay}
      </p>
    </div>
    
    <div style="background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #333;">
      <p style="font-size: 14px; color: #888888; margin: 0;">
        Hey ${friendName}, the 7-day window to claim your payout has passed. 
        The funds have been forfeited.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #888888; text-align: center; margin: 0;">
      Next time, claim your winnings faster! 💨
    </p>
    
    <hr style="border: none; border-top: 1px solid #333; margin: 40px 0 24px 0;">
    
    <p style="font-size: 12px; color: #666666; text-align: center; margin: 0;">
      Sent by <a href="${APP_URL}" style="color: #7c3aed;">OopsFee</a> — accountability with stakes
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `Hey ${friendName},

Unfortunately, the 7-day window to claim your ${amountDisplay} payout has passed.

The funds have been forfeited.

Next time, claim your winnings faster! 💨

— OopsFee`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OopsFee <hello@oopsfee.app>',
        to: [to],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[expire-claims] Resend API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('[expire-claims] Claim expired email sent:', result.id);
    return true;
  } catch (error) {
    console.error('[expire-claims] Claim expired email send error:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Accept both GET (for cron) and POST (for manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Optional: Verify cron secret for security (reuses same secret as settle-promises)
  const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();

    const results: ExpirationResult[] = [];

    // =========================================================================
    // Find claims that are past their expiration date
    // =========================================================================
    // Look for claims where:
    // - claim_status = 'notified' (friend was told but hasn't claimed)
    // - claim_expires_at < now (7-day window has passed)
    const { data: expiredClaims, error: fetchError } = await supabase
      .from('friend_claims')
      .select('id, promise_id, friend_email, friend_phone, friend_name, claim_token, claim_status, claim_expires_at, amount_cents')
      .eq('claim_status', 'notified')
      .lt('claim_expires_at', now.toISOString())
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[expire-claims] Error fetching expired claims:', fetchError);
      throw fetchError;
    }

    console.log(`[expire-claims] Found ${expiredClaims?.length ?? 0} claims to expire`);

    // =========================================================================
    // Process each expired claim
    // =========================================================================
    for (const claim of (expiredClaims ?? []) as FriendClaim[]) {
      const result = await processExpiredClaim(claim, supabase);
      results.push(result);
    }

    // Summary
    const summary = {
      timestamp: now.toISOString(),
      claimsExpired: results.filter((r) => r.action === 'expired').length,
      claimsSkipped: results.filter((r) => r.action === 'skipped').length,
      results,
    };

    console.log('[expire-claims] Expiration complete:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[expire-claims] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Process a single expired claim
 */
async function processExpiredClaim(
  claim: FriendClaim,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<ExpirationResult> {
  console.log(`[expire-claims] Processing expired claim: ${claim.id}`);

  // Update claim status to expired
  const { error: updateError } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'expired',
    })
    .eq('id', claim.id);

  if (updateError) {
    console.error(`[expire-claims] Error updating claim ${claim.id}:`, updateError);
    return {
      claimId: claim.id,
      action: 'skipped',
      message: `Failed to update: ${updateError.message}`,
    };
  }

  console.log(`[expire-claims] Claim ${claim.id} marked as expired`);

  // Send expiration notification email if we have an email address
  if (claim.friend_email && claim.amount_cents) {
    const emailSent = await sendClaimExpiredEmail(
      claim.friend_email,
      claim.friend_name,
      claim.amount_cents,
    );
    console.log(`[expire-claims] Expiration email sent to ${claim.friend_email}: ${emailSent}`);
  }

  // Note: Funds already stay with OopsFee since they were never transferred.
  // No Stripe operations needed here.

  return {
    claimId: claim.id,
    action: 'expired',
    message: 'Claim expired, friend did not claim within 7 days',
  };
}

