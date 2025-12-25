// @ts-nocheck
// deno-lint-ignore-file
/**
 * charge-promise Edge Function
 *
 * Immediately charges a user for a failed promise.
 * Called when user manually marks a promise as failed.
 *
 * Returns the charge result so the app can show appropriate feedback.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// Friend claim expiration: 7 days
const CLAIM_EXPIRY_DAYS = 7;

interface ChargeRequest {
  promiseId: string;
}

interface ChargeResponse {
  success: boolean;
  charged: boolean;
  amount?: number;
  message: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  walletUsed?: number;  // Amount debited from wallet (in dollars)
  cardCharged?: number; // Amount charged to card (in dollars)
}

// ─────────────────────────────────────────────────────────────
// Friend Claim Email Notification
// ─────────────────────────────────────────────────────────────

interface ClaimEmailParams {
  to: string;
  friendName: string;
  userName: string;
  amountCents: number;
  promiseText: string;
  claimUrl: string;
  expiresAt: Date;
}

async function sendClaimNotificationEmail(params: ClaimEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[charge-promise] Resend API key not configured, skipping claim email');
    return false;
  }

  const { to, friendName, userName, amountCents, promiseText, claimUrl, expiresAt } = params;
  const amountDisplay = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
  const expiryDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const subject = `💰 ${userName} failed — claim your ${amountDisplay}!`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim Your Money</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 32px; font-weight: 700; margin: 0 0 8px 0; color: #22c55e;">
        💸 Cha-ching!
      </h1>
      <p style="font-size: 18px; color: #ffffff; margin: 0;">
        ${userName} didn't follow through
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #134e2a 0%, #166534 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #22c55e; text-align: center;">
      <p style="font-size: 14px; color: #86efac; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        Your Winnings
      </p>
      <p style="font-size: 48px; font-weight: 700; margin: 0; color: #22c55e;">
        ${amountDisplay}
      </p>
    </div>
    
    <div style="background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #333;">
      <p style="font-size: 12px; color: #888888; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        The Failed Promise
      </p>
      <p style="font-size: 16px; margin: 0; color: #ffffff;">
        "${promiseText}"
      </p>
    </div>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-size: 18px; font-weight: 700;">
        Claim Your ${amountDisplay}
      </a>
    </div>
    
    <p style="font-size: 14px; color: #ef4444; text-align: center; margin: 0 0 16px 0; font-weight: 500;">
      ⏰ Claim expires ${expiryDate}
    </p>
    
    <p style="font-size: 14px; color: #888888; text-align: center; margin: 0;">
      Click the button above to claim your payout via debit card or PayPal.
    </p>
    
    <hr style="border: none; border-top: 1px solid #333; margin: 40px 0 24px 0;">
    
    <p style="font-size: 12px; color: #666666; text-align: center; margin: 0;">
      Sent by <a href="${APP_URL}" style="color: #7c3aed;">OopsFee</a> — accountability with stakes
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `Hey ${friendName}!

${userName} failed to keep their promise: "${promiseText}"

That means ${amountDisplay} is yours!

Claim it here: ${claimUrl}

⏰ This offer expires ${expiryDate}.

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
      console.error('[charge-promise] Resend API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('[charge-promise] Claim notification email sent:', result.id);
    return true;
  } catch (error) {
    console.error('[charge-promise] Claim email send error:', error);
    return false;
  }
}

/**
 * Update friend claim and notify friend that money is available to claim
 */
async function handleFriendClaimNotification(
  promise: { id: string; user_id: string; text: string; friend_claim_id: string | null },
  supabase: ReturnType<typeof createAdminClient>,
  amountInCents: number,
): Promise<void> {
  if (!promise.friend_claim_id) {
    console.log('[charge-promise] No friend_claim_id, skipping friend notification');
    return;
  }

  console.log(`[charge-promise] Processing friend claim for promise ${promise.id}`);

  // 1. Fetch the friend claim record
  const { data: claim, error: claimError } = await supabase
    .from('friend_claims')
    .select('id, friend_email, friend_phone, friend_name, claim_token, claim_status')
    .eq('id', promise.friend_claim_id)
    .single();

  if (claimError || !claim) {
    console.error(`[charge-promise] Friend claim not found for promise ${promise.id}:`, claimError);
    return;
  }

  // 2. Calculate claim expiration (7 days from now)
  const claimExpiresAt = new Date(Date.now() + CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // 3. Update friend claim: set amount, status, and expiration
  const { error: updateError } = await supabase
    .from('friend_claims')
    .update({
      amount_cents: amountInCents,
      claim_status: 'notified',
      claim_expires_at: claimExpiresAt.toISOString(),
    })
    .eq('id', claim.id);

  if (updateError) {
    console.error(`[charge-promise] Error updating friend claim ${claim.id}:`, updateError);
    return;
  }

  console.log(`[charge-promise] Friend claim ${claim.id} updated: amount=${amountInCents}, expires=${claimExpiresAt.toISOString()}`);

  // 4. Get user's display name for the email
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', promise.user_id)
    .single();

  const userName = profile?.display_name || 'Someone';
  const claimUrl = `${APP_URL}/claim/${claim.claim_token}`;

  // 5. Send claim notification email to friend
  if (claim.friend_email) {
    const emailSent = await sendClaimNotificationEmail({
      to: claim.friend_email,
      friendName: claim.friend_name,
      userName,
      amountCents: amountInCents,
      promiseText: promise.text.substring(0, 100),
      claimUrl,
      expiresAt: claimExpiresAt,
    });

    console.log(`[charge-promise] Claim email sent to ${claim.friend_email}: ${emailSent}`);
  } else {
    console.log(`[charge-promise] No email for friend claim ${claim.id}, skipping email notification`);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, charged: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const { promiseId } = (await req.json()) as ChargeRequest;
    if (!promiseId) {
      return new Response(
        JSON.stringify({ success: false, charged: false, message: 'Missing promiseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Fetch the promise
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('*')
      .eq('id', promiseId)
      .eq('user_id', user.id)
      .single();

    if (promiseError || !promise) {
      console.error('[charge-promise] Promise not found:', promiseError);
      return new Response(
        JSON.stringify({ success: false, charged: false, message: 'Promise not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if already charged or in progress - PREVENT DOUBLE CHARGES
    if (promise.payment_status === 'succeeded') {
      console.log(`[charge-promise] Promise ${promiseId} already charged, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          charged: true,
          amount: promise.stake,
          message: 'Already charged',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if payment is already in progress (pending or requires_action)
    if (promise.payment_status === 'pending' || promise.payment_status === 'requires_action') {
      console.log(`[charge-promise] Promise ${promiseId} payment already in progress: ${promise.payment_status}`);
      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: promise.payment_status === 'requires_action' 
            ? 'Payment requires authentication - check your app'
            : 'Payment already in progress',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark as pending BEFORE attempting charge to prevent race conditions
    const { error: lockError } = await supabase
      .from('promises')
      .update({ payment_status: 'pending' })
      .eq('id', promiseId)
      .is('payment_status', null); // Only update if not already set

    if (lockError) {
      console.error(`[charge-promise] Failed to lock promise ${promiseId}:`, lockError);
    }

    // No stake = nothing to charge
    if (!promise.stake || promise.stake <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: 0,
          message: 'No stake to charge',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get user's payment method and wallet balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method_id, balance_cents')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[charge-promise] Profile not found:', profileError);
      return new Response(
        JSON.stringify({
          success: false,
          charged: false,
          message: 'Profile not found',
        } as ChargeResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { stripe_customer_id, default_payment_method_id, balance_cents } = profile;
    const walletBalance = balance_cents ?? 0;

    // Calculate amounts
    // Stake is stored in dollars, sponsor_total is stored in cents
    const sponsorCents = promise.sponsor_total ?? 0;
    const stakeCents = promise.stake * 100;
    const totalAmountCents = stakeCents + sponsorCents;
    const totalAmount = totalAmountCents / 100; // For display

    // Determine wallet vs card split
    const walletToUse = Math.min(walletBalance, totalAmountCents);
    const cardToCharge = totalAmountCents - walletToUse;

    console.log(`[charge-promise] Promise ${promiseId}: total=$${totalAmount}, wallet=$${walletToUse / 100} (available: $${walletBalance / 100}), card=$${cardToCharge / 100}`);

    // No payment method - check if wallet covers it
    if (!stripe_customer_id || !default_payment_method_id) {
      if (walletToUse >= totalAmountCents) {
        // Wallet covers the full amount! Debit wallet and proceed
        console.log(`[charge-promise] No card but wallet covers full amount: $${walletToUse / 100}`);
        
        const { data: debitResult, error: debitError } = await supabase
          .rpc('debit_wallet_with_log', {
            target_user_id: user.id,
            amount_cents: totalAmountCents,
            tx_type: 'stake',
            promise_id: promiseId,
            description_text: `Failed promise: "${promise.text.substring(0, 50)}..."`,
          });

        if (debitError || debitResult === -1) {
          console.error(`[charge-promise] Wallet debit failed:`, debitError || 'Insufficient balance');
          // Fall through to abandoned case
        } else {
          // Wallet debit successful
          await supabase
            .from('promises')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              payment_status: 'succeeded',
              payment_client_secret: null,
            })
            .eq('id', promiseId);

          // Log payment (wallet-only)
          await supabase.from('payments').insert({
            promise_id: promiseId,
            amount: totalAmountCents,
            currency: 'usd',
            status: 'succeeded',
            attempt_number: 1,
          });

          // Notify friend if applicable
          if (promise.money_destination === 'friend' && promise.friend_claim_id) {
            await handleFriendClaimNotification(promise, supabase, totalAmountCents);
          }

          return new Response(
            JSON.stringify({
              success: true,
              charged: true,
              amount: totalAmount,
              walletUsed: totalAmount,
              cardCharged: 0,
              message: `$${totalAmount} debited from wallet. The universe has collected.`,
            } as ChargeResponse),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      // No card and wallet doesn't cover it - abandon
      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'abandoned',
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: 'No payment method on file. You got away with it... this time.',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─────────────────────────────────────────────────────────────
    // WALLET-FIRST LOGIC: Debit wallet before charging card
    // ─────────────────────────────────────────────────────────────

    let walletDebited = 0;

    // If wallet has funds, debit wallet first
    if (walletToUse > 0) {
      console.log(`[charge-promise] Debiting $${walletToUse / 100} from wallet for promise ${promiseId}`);
      
      const { data: debitResult, error: debitError } = await supabase
        .rpc('debit_wallet_with_log', {
          target_user_id: user.id,
          amount_cents: walletToUse,
          tx_type: 'stake',
          promise_id: promiseId,
          description_text: cardToCharge > 0 
            ? `Partial stake (wallet portion) for: "${promise.text.substring(0, 40)}..."`
            : `Failed promise: "${promise.text.substring(0, 50)}..."`,
        });

      if (debitError) {
        console.error(`[charge-promise] Wallet debit RPC error:`, debitError);
        // Continue anyway - will charge full amount to card
      } else if (debitResult === -1) {
        console.log(`[charge-promise] Wallet insufficient at debit time, charging full amount to card`);
        // Balance changed between check and debit - charge full amount to card
      } else {
        walletDebited = walletToUse;
        console.log(`[charge-promise] Wallet debited successfully: $${walletDebited / 100}, new balance: $${debitResult / 100}`);
      }
    }

    // If wallet covered everything, we're done (no card charge needed)
    if (walletDebited >= totalAmountCents) {
      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'succeeded',
          payment_client_secret: null,
        })
        .eq('id', promiseId);

      // Log payment (wallet-only)
      await supabase.from('payments').insert({
        promise_id: promiseId,
        amount: totalAmountCents,
        currency: 'usd',
        status: 'succeeded',
        attempt_number: 1,
      });

      // Notify friend if applicable
      if (promise.money_destination === 'friend' && promise.friend_claim_id) {
        await handleFriendClaimNotification(promise, supabase, totalAmountCents);
      }

      return new Response(
        JSON.stringify({
          success: true,
          charged: true,
          amount: totalAmount,
          walletUsed: totalAmount,
          cardCharged: 0,
          message: `$${totalAmount} debited from wallet. The universe has collected.`,
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Calculate remaining amount to charge to card
    const amountToChargeCard = totalAmountCents - walletDebited;
    console.log(`[charge-promise] Charging $${amountToChargeCard / 100} to card (wallet covered: $${walletDebited / 100}) for promise ${promiseId}`);

    try {
      // Use idempotency key to prevent duplicate charges (include wallet amount for uniqueness)
      const idempotencyKey = `charge-promise-${promiseId}-${user.id}-card${amountToChargeCard}`;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountToChargeCard,
        currency: 'usd',
        customer: stripe_customer_id,
        payment_method: default_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          promise_id: promiseId,
          user_id: user.id,
          trigger: 'manual_fail',
          wallet_portion_cents: walletDebited.toString(),
          card_portion_cents: amountToChargeCard.toString(),
        },
        description: walletDebited > 0
          ? `OopsFee: Failed promise (card portion) "${promise.text.substring(0, 40)}..."`
          : `OopsFee: Failed promise "${promise.text.substring(0, 50)}..."`,
      }, {
        idempotencyKey,
      });

      console.log(`[charge-promise] PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);

      if (paymentIntent.status === 'succeeded') {
        // Update promise
        await supabase
          .from('promises')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            payment_status: 'succeeded',
            payment_client_secret: null,
          })
          .eq('id', promiseId);

        // Log payment (store total in cents)
        await supabase.from('payments').insert({
          promise_id: promiseId,
          amount: totalAmountCents, // Total amount (wallet + card)
          currency: 'usd',
          stripe_payment_intent_id: paymentIntent.id,
          status: 'succeeded',
          attempt_number: 1,
        });

        // Notify friend if money_destination is 'friend'
        console.log(`[charge-promise] Promise money_destination: ${promise.money_destination}, friend_claim_id: ${promise.friend_claim_id}`);
        if (promise.money_destination === 'friend' && promise.friend_claim_id) {
          await handleFriendClaimNotification(promise, supabase, totalAmountCents);
        } else {
          console.log(`[charge-promise] Skipping friend notification - conditions not met`);
        }

        // Build response message
        const walletDollars = walletDebited / 100;
        const cardDollars = amountToChargeCard / 100;
        let message: string;
        if (walletDebited > 0) {
          message = `$${totalAmount} collected ($${walletDollars} from wallet, $${cardDollars} from card).`;
        } else {
          message = `$${totalAmount} charged. The universe has collected.`;
        }

        return new Response(
          JSON.stringify({
            success: true,
            charged: true,
            amount: totalAmount,
            walletUsed: walletDollars,
            cardCharged: cardDollars,
            message,
            paymentIntentId: paymentIntent.id,
          } as ChargeResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (paymentIntent.status === 'requires_action') {
        // SCA required - store client secret for app to complete
        await supabase
          .from('promises')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            payment_status: 'requires_action',
            payment_client_secret: paymentIntent.client_secret,
          })
          .eq('id', promiseId);

        // Log payment attempt (store total in cents)
        await supabase.from('payments').insert({
          promise_id: promiseId,
          amount: totalAmountCents,
          currency: 'usd',
          stripe_payment_intent_id: paymentIntent.id,
          status: 'requires_action',
          attempt_number: 1,
        });

        const walletDollars = walletDebited / 100;
        const cardDollars = amountToChargeCard / 100;

        return new Response(
          JSON.stringify({
            success: true,
            charged: false,
            amount: totalAmount,
            walletUsed: walletDollars,
            cardCharged: cardDollars,
            message: walletDebited > 0
              ? `Your bank requires confirmation for the $${cardDollars} card charge. $${walletDollars} already debited from wallet.`
              : 'Your bank requires confirmation. One more tap to face the music.',
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          } as ChargeResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Other status - mark as pending
      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'pending',
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: totalAmount,
          message: `Payment processing (${paymentIntent.status})`,
          paymentIntentId: paymentIntent.id,
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } catch (stripeError: unknown) {
      const err = stripeError as { code?: string; message?: string };
      console.error('[charge-promise] Stripe error:', err);

      // If we debited wallet but card failed, refund the wallet
      if (walletDebited > 0) {
        console.log(`[charge-promise] Card charge failed, refunding $${walletDebited / 100} to wallet`);
        const { error: refundError } = await supabase
          .rpc('credit_wallet_with_log', {
            target_user_id: user.id,
            amount_cents: walletDebited,
            tx_type: 'refund',
            promise_id: promiseId,
            description_text: `Refund: card charge failed for "${promise.text.substring(0, 40)}..."`,
          });
        
        if (refundError) {
          console.error(`[charge-promise] CRITICAL: Failed to refund wallet:`, refundError);
          // This is a serious issue - wallet was debited but couldn't be refunded
        } else {
          console.log(`[charge-promise] Wallet refund successful`);
        }
      }

      // Log failed payment (store total in cents)
      await supabase.from('payments').insert({
        promise_id: promiseId,
        amount: totalAmountCents,
        currency: 'usd',
        status: 'failed',
        attempt_number: 1,
        error_code: err.code || 'unknown',
        error_message: err.message || 'Unknown error',
      });

      // Schedule for retry via settlement cron
      const nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'failed',
          payment_retry_count: 1,
          payment_next_retry_at: nextRetryAt.toISOString(),
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: totalAmount,
          walletUsed: 0, // Wallet was refunded
          cardCharged: 0,
          message: `Payment failed: ${err.message || 'Card declined'}. We'll try again.`,
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (error: unknown) {
    console.error('[charge-promise] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, charged: false, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

