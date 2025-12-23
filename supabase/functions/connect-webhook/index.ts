// @ts-nocheck
// deno-lint-ignore-file
/**
 * connect-webhook Edge Function
 *
 * Handles Stripe Connect webhook events:
 * - account.updated: When a Connect account status changes
 *   - If account becomes charges_enabled + payouts_enabled, trigger transfer
 *
 * This is separate from stripe-webhook because Connect events may use
 * a different webhook secret (STRIPE_CONNECT_WEBHOOK_SECRET).
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient } from '../_shared/supabase.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// Two secrets for v1 (snapshot) and v2 (thin) payload styles
const STRIPE_CONNECT_WEBHOOK_SECRET = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') ?? '';
const STRIPE_CONNECT_WEBHOOK_SECRET_V2 = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET_V2') ?? '';

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get raw body and signature
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    const stripe = createStripeClient();

    // Verify webhook signature - try both secrets (v1 snapshot and v2 thin payloads)
    let event: any;
    let verified = false;
    const secrets = [STRIPE_CONNECT_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET_V2].filter(Boolean);
    
    for (const secret of secrets) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          payload,
          signature,
          secret,
        );
        verified = true;
        break;
      } catch {
        // Try next secret
      }
    }

    if (!verified) {
      console.error('[connect-webhook] Signature verification failed with all secrets');
      return new Response(
        'Webhook signature verification failed',
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    console.log(`[connect-webhook] Processing event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      // v1 event (legacy)
      case 'account.updated': {
        await handleAccountUpdated(event, supabase, stripe);
        break;
      }

      // v2 event (new Stripe API)
      case 'v2.core.account.updated': {
        await handleAccountUpdatedV2(event, supabase, stripe);
        break;
      }

      default:
        console.log(`[connect-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[connect-webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ─────────────────────────────────────────────────────────────
// Email Notification (Resend)
// ─────────────────────────────────────────────────────────────

interface TransferEmailParams {
  to: string;
  friendName: string;
  amountCents: number;
  promiseText?: string;
  transferId: string;
}

async function sendTransferSuccessEmail(params: TransferEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[connect-webhook] Resend API key not configured, skipping email');
    return false;
  }

  const { to, friendName, amountCents, promiseText, transferId } = params;
  const amountDisplay = `$${(amountCents / 100).toFixed(2)}`;

  const subject = `💰 ${amountDisplay} is on its way to you!`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transfer Complete</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 32px; font-weight: 700; margin: 0 0 8px 0; color: #22c55e;">
        💸 Cha-ching!
      </h1>
      <p style="font-size: 18px; color: #ffffff; margin: 0;">
        Your money is on its way
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #134e2a 0%, #166534 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #22c55e; text-align: center;">
      <p style="font-size: 48px; font-weight: 700; margin: 0; color: #22c55e;">
        ${amountDisplay}
      </p>
      <p style="font-size: 14px; color: #86efac; margin: 8px 0 0 0;">
        Transfer initiated
      </p>
    </div>
    
    ${promiseText ? `
    <div style="background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #333;">
      <p style="font-size: 12px; color: #888888; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        They failed to:
      </p>
      <p style="font-size: 16px; margin: 0; color: #ffffff;">
        "${promiseText}"
      </p>
    </div>
    ` : ''}
    
    <p style="font-size: 16px; line-height: 1.6; color: #cccccc; text-align: center; margin-bottom: 24px;">
      The funds have been sent to your connected bank account. Depending on your bank, it may take 1-2 business days to appear.
    </p>
    
    <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 12px; color: #666666; margin: 0;">
        Transfer ID: <span style="color: #888888; font-family: monospace;">${transferId}</span>
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #333; margin: 40px 0 24px 0;">
    
    <p style="font-size: 12px; color: #666666; text-align: center; margin: 0;">
      Sent by <a href="${APP_URL}" style="color: #7c3aed;">OopsFee</a> — accountability with stakes
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `Hey ${friendName}!

Great news — ${amountDisplay} is on its way to you!

${promiseText ? `They failed to: "${promiseText}"\n` : ''}
The funds have been sent to your connected bank account. Depending on your bank, it may take 1-2 business days to appear.

Transfer ID: ${transferId}

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
      console.error('[connect-webhook] Resend API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('[connect-webhook] Transfer success email sent:', result.id);
    return true;
  } catch (error) {
    console.error('[connect-webhook] Email send error:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handle v2.core.account.updated events (new Stripe API)
 * Fetches the full account and delegates to shared logic
 */
async function handleAccountUpdatedV2(
  event: { data: { id?: string } },
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
) {
  // v2 events only contain the account ID, need to fetch full account
  const accountId = event.data?.id;
  
  if (!accountId) {
    console.error('[connect-webhook] v2 event missing account ID');
    return;
  }

  console.log(`[connect-webhook] v2 account updated: ${accountId}`);

  try {
    // Fetch full account details from Stripe
    const account = await stripe.accounts.retrieve(accountId);
    
    // Delegate to shared handler
    await processAccountUpdate(account, supabase, stripe);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[connect-webhook] Failed to retrieve account ${accountId}:`, message);
  }
}

/**
 * Handle account.updated events (v1/legacy)
 * When a Connect account becomes active, transfer pending funds
 */
async function handleAccountUpdated(
  event: { data: { object: Record<string, unknown> } },
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
) {
  const account = event.data.object as {
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements?: {
      currently_due?: string[];
      pending_verification?: string[];
      disabled_reason?: string | null;
    };
  };

  await processAccountUpdate(account, supabase, stripe);
}

/**
 * Shared logic for processing account updates (used by both v1 and v2 handlers)
 */
async function processAccountUpdate(
  account: {
    id: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    requirements?: {
      currently_due?: string[];
      pending_verification?: string[];
      disabled_reason?: string | null;
    };
  },
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
) {
  console.log(`[connect-webhook] Processing account: ${account.id}`, {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
  });

  // Determine account status
  let accountStatus: 'pending' | 'onboarding' | 'active' | 'restricted' = 'pending';
  
  if (account.charges_enabled && account.payouts_enabled) {
    accountStatus = 'active';
  } else if (account.details_submitted) {
    // Details submitted but not yet enabled - could be pending verification or restricted
    if (account.requirements?.disabled_reason) {
      accountStatus = 'restricted';
    } else {
      accountStatus = 'onboarding'; // Still processing
    }
  } else {
    accountStatus = 'onboarding';
  }

  // Find all claims with this Stripe account (include friend info for notifications)
  const { data: claims, error: claimsError } = await supabase
    .from('friend_claims')
    .select(`
      id,
      claim_status,
      amount_cents,
      stripe_account_status,
      friend_name,
      friend_email,
      promise_id,
      promises:promise_id (
        text
      )
    `)
    .eq('stripe_account_id', account.id);

  if (claimsError || !claims || claims.length === 0) {
    console.log(`[connect-webhook] No claims found for account: ${account.id}`);
    return;
  }

  console.log(`[connect-webhook] Found ${claims.length} claim(s) for account: ${account.id}`);

  // Update all claims with new account status
  for (const claim of claims) {
    // Always update the account status
    const updates: Record<string, unknown> = {
      stripe_account_status: accountStatus,
    };

    // If account is now active and claim is claimed (started onboarding), trigger transfer
    if (
      accountStatus === 'active' &&
      claim.claim_status === 'claimed' &&
      claim.amount_cents &&
      claim.amount_cents > 0
    ) {
      console.log(`[connect-webhook] Triggering transfer for claim: ${claim.id}`);
      
      try {
        // Create transfer to the connected account
        const transfer = await stripe.transfers.create({
          amount: claim.amount_cents,
          currency: 'usd',
          destination: account.id,
          metadata: {
            claim_id: claim.id,
          },
        });

        console.log(`[connect-webhook] Transfer created: ${transfer.id}`);

        updates.claim_status = 'transferred';
        updates.transfer_id = transfer.id;

        // Send notification to friend about successful transfer
        if (claim.friend_email) {
          const promiseText = (claim.promises as { text?: string } | null)?.text;
          await sendTransferSuccessEmail({
            to: claim.friend_email,
            friendName: claim.friend_name || 'Friend',
            amountCents: claim.amount_cents,
            promiseText,
            transferId: transfer.id,
          });
        }
        
      } catch (transferError: unknown) {
        const message = transferError instanceof Error 
          ? transferError.message 
          : 'Unknown transfer error';
        console.error(`[connect-webhook] Transfer failed for claim ${claim.id}:`, message);
        
        // If transfer fails due to account issues, mark as restricted
        if (message.includes('insufficient') || message.includes('balance')) {
          console.error('[connect-webhook] Insufficient balance for transfer');
          // Don't update claim status - will retry on next account update or manual trigger
        }
      }
    }

    // Update the claim
    const { error: updateError } = await supabase
      .from('friend_claims')
      .update(updates)
      .eq('id', claim.id);

    if (updateError) {
      console.error(`[connect-webhook] Failed to update claim ${claim.id}:`, updateError);
    } else {
      console.log(`[connect-webhook] Updated claim ${claim.id}:`, updates);
    }
  }
}

