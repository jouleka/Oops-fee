// @ts-nocheck
// deno-lint-ignore-file
/**
 * paypal-webhook Edge Function
 *
 * Handles PayPal Payouts webhook events for claim status updates:
 * - PAYMENT.PAYOUTSBATCH.SUCCESS: Batch completed successfully
 * - PAYMENT.PAYOUTSBATCH.DENIED: Batch failed/denied
 * - PAYMENT.PAYOUTS-ITEM.SUCCEEDED: Individual payout succeeded
 * - PAYMENT.PAYOUTS-ITEM.UNCLAIMED: Recipient didn't claim (30 days)
 * - PAYMENT.PAYOUTS-ITEM.RETURNED: Payout returned to sender
 * - PAYMENT.PAYOUTS-ITEM.REFUNDED: Payout was refunded
 * - PAYMENT.PAYOUTS-ITEM.BLOCKED: Recipient blocked
 * - PAYMENT.PAYOUTS-ITEM.FAILED: Payout failed
 * - PAYMENT.PAYOUTS-ITEM.CANCELLED: Payout cancelled
 *
 * Note: PayPal webhooks require registration in the PayPal Developer Dashboard.
 * Set PAYPAL_WEBHOOK_ID environment variable to the webhook ID from PayPal.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import {
  verifyWebhookSignature,
  PayPalWebhookEvents,
  extractClaimIdFromPayoutItem,
} from '../_shared/paypal.ts';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  resource: {
    batch_header?: {
      payout_batch_id: string;
      batch_status: string;
      sender_batch_header?: {
        sender_batch_id: string;
      };
    };
    payout_item_id?: string;
    payout_batch_id?: string;
    transaction_status?: string;
    payout_item?: {
      sender_item_id: string;
      receiver: string;
      amount: {
        value: string;
        currency: string;
      };
    };
    errors?: {
      name: string;
      message: string;
    };
  };
  create_time: string;
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Verify webhook signature using PayPal's verification endpoint
    const verification = await verifyWebhookSignature(req);

    if (!verification.valid) {
      console.error('[paypal-webhook] Webhook signature verification failed');
      return new Response('Invalid webhook signature', { status: 401 });
    }

    const event = verification.event as PayPalWebhookEvent;
    const supabase = createAdminClient();

    console.log(`[paypal-webhook] Processing event: ${event.event_type}`);
    console.log(`[paypal-webhook] Event ID: ${event.id}`);

    // Handle different event types
    switch (event.event_type) {
      // ─────────────────────────────────────────────────────────────
      // BATCH EVENTS
      // ─────────────────────────────────────────────────────────────

      case PayPalWebhookEvents.BATCH_SUCCESS: {
        await handleBatchSuccess(event, supabase);
        break;
      }

      case PayPalWebhookEvents.BATCH_DENIED: {
        await handleBatchDenied(event, supabase);
        break;
      }

      // ─────────────────────────────────────────────────────────────
      // ITEM EVENTS
      // ─────────────────────────────────────────────────────────────

      case PayPalWebhookEvents.ITEM_SUCCEEDED: {
        await handleItemSucceeded(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_UNCLAIMED: {
        await handleItemUnclaimed(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_RETURNED: {
        await handleItemReturned(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_REFUNDED: {
        await handleItemRefunded(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_BLOCKED: {
        await handleItemBlocked(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_FAILED: {
        await handleItemFailed(event, supabase);
        break;
      }

      case PayPalWebhookEvents.ITEM_CANCELLED: {
        await handleItemCancelled(event, supabase);
        break;
      }

      default:
        console.log(`[paypal-webhook] Unhandled event type: ${event.event_type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[paypal-webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// ─────────────────────────────────────────────────────────────
// Batch Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handle PAYMENT.PAYOUTSBATCH.SUCCESS
 * Batch completed - all items processed (may include individual failures)
 */
async function handleBatchSuccess(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const batchId = event.resource.batch_header?.payout_batch_id;
  
  if (!batchId) {
    console.error('[paypal-webhook] BATCH_SUCCESS missing batch_id');
    return;
  }

  console.log(`[paypal-webhook] Batch succeeded: ${batchId}`);

  // Find claim by batch ID - the individual item webhook will handle the final status
  // This is mainly for logging/monitoring
  const { data: claim, error } = await supabase
    .from('friend_claims')
    .select('id, claim_status')
    .eq('paypal_batch_id', batchId)
    .single();

  if (error || !claim) {
    console.log(`[paypal-webhook] No claim found for batch ${batchId} (may be non-OopsFee payout)`);
    return;
  }

  console.log(`[paypal-webhook] Batch ${batchId} succeeded for claim ${claim.id}`);
}

/**
 * Handle PAYMENT.PAYOUTSBATCH.DENIED
 * Batch denied/failed - need to revert claim status and potentially refund
 */
async function handleBatchDenied(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const batchId = event.resource.batch_header?.payout_batch_id;
  
  if (!batchId) {
    console.error('[paypal-webhook] BATCH_DENIED missing batch_id');
    return;
  }

  console.error(`[paypal-webhook] Batch DENIED: ${batchId}`);

  // Find and update the claim
  const { data: claim, error: fetchError } = await supabase
    .from('friend_claims')
    .select('id, claim_status, amount_cents, promise_id')
    .eq('paypal_batch_id', batchId)
    .single();

  if (fetchError || !claim) {
    console.log(`[paypal-webhook] No claim found for denied batch ${batchId}`);
    return;
  }

  // Revert claim to 'notified' so user can try again with different method
  const { error: updateError } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'notified',
      payout_method: null,
      paypal_email: null,
      paypal_batch_id: null,
      paypal_payout_item_id: null,
    })
    .eq('id', claim.id);

  if (updateError) {
    console.error(`[paypal-webhook] Failed to revert claim ${claim.id}:`, updateError);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} reverted to 'notified' after batch denial`);

  // TODO: Log this for platform reconciliation - batch denied means PayPal
  // couldn't process the batch (insufficient funds, etc.)
  // The platform may need to investigate and potentially handle refunds
}

// ─────────────────────────────────────────────────────────────
// Item Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Find claim by payout item ID or sender_item_id
 */
async function findClaimByItem(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ id: string; claim_status: string; amount_cents: number; promise_id: string } | null> {
  const payoutItemId = event.resource.payout_item_id;
  const senderItemId = event.resource.payout_item?.sender_item_id;

  // Try by payout_item_id first
  if (payoutItemId) {
    const { data: claim } = await supabase
      .from('friend_claims')
      .select('id, claim_status, amount_cents, promise_id')
      .eq('paypal_payout_item_id', payoutItemId)
      .single();

    if (claim) return claim;
  }

  // Try by sender_item_id (format: "claim-{claimId}")
  if (senderItemId) {
    const claimId = extractClaimIdFromPayoutItem(senderItemId);
    if (claimId) {
      const { data: claim } = await supabase
        .from('friend_claims')
        .select('id, claim_status, amount_cents, promise_id')
        .eq('id', claimId)
        .single();

      if (claim) return claim;
    }
  }

  return null;
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.SUCCEEDED
 * Individual payout item completed successfully
 */
async function handleItemSucceeded(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item succeeded: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for item ${payoutItemId}`);
    return;
  }

  // Item succeeded - claim should already be 'transferred' from the payout function
  // This confirms the transfer completed
  console.log(`[paypal-webhook] Payout item ${payoutItemId} succeeded for claim ${claim.id}`);

  // Update payout_item_id if we found claim by sender_item_id
  if (!await hasPayoutItemId(claim.id, supabase)) {
    await supabase
      .from('friend_claims')
      .update({ paypal_payout_item_id: payoutItemId })
      .eq('id', claim.id);
  }
}

/**
 * Check if claim already has payout_item_id
 */
async function hasPayoutItemId(
  claimId: string,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const { data } = await supabase
    .from('friend_claims')
    .select('paypal_payout_item_id')
    .eq('id', claimId)
    .single();

  return !!data?.paypal_payout_item_id;
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.UNCLAIMED
 * Recipient didn't claim within 30 days - funds returned to sender
 */
async function handleItemUnclaimed(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item UNCLAIMED: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for unclaimed item ${payoutItemId}`);
    return;
  }

  // Update claim status to reflect unclaimed payout
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'paypal_unclaimed',
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to update claim ${claim.id} to unclaimed:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} marked as paypal_unclaimed - funds returned to platform`);

  // TODO: Log for reconciliation - PayPal returned funds to our account
  // We may want to notify the original promiser or handle this differently
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.RETURNED
 * Payout returned (e.g., recipient account issue)
 */
async function handleItemReturned(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item RETURNED: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for returned item ${payoutItemId}`);
    return;
  }

  // Revert claim so user can try again
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'notified',
      payout_method: null,
      paypal_email: null,
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to revert claim ${claim.id}:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} reverted after payout return - friend can try again`);
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.REFUNDED
 * Payout was refunded
 */
async function handleItemRefunded(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item REFUNDED: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for refunded item ${payoutItemId}`);
    return;
  }

  // Update claim to reflect refund
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'paypal_refunded',
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to update claim ${claim.id} to refunded:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} marked as paypal_refunded`);
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.BLOCKED
 * Recipient account is blocked/restricted
 */
async function handleItemBlocked(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item BLOCKED: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for blocked item ${payoutItemId}`);
    return;
  }

  // Revert claim so user can try a different method
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'notified',
      payout_method: null,
      paypal_email: null,
      paypal_batch_id: null,
      paypal_payout_item_id: null,
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to revert claim ${claim.id}:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} reverted after recipient blocked - can try different method`);
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.FAILED
 * Payout failed for some reason
 */
async function handleItemFailed(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  const errorInfo = event.resource.errors;
  
  console.error(`[paypal-webhook] Item FAILED: ${payoutItemId}`, errorInfo);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for failed item ${payoutItemId}`);
    return;
  }

  // Revert claim so user can try again
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'notified',
      payout_method: null,
      paypal_email: null,
      paypal_batch_id: null,
      paypal_payout_item_id: null,
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to revert claim ${claim.id}:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} reverted after payout failure - friend can try again`);
}

/**
 * Handle PAYMENT.PAYOUTS-ITEM.CANCELLED
 * Payout was cancelled
 */
async function handleItemCancelled(
  event: PayPalWebhookEvent,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const payoutItemId = event.resource.payout_item_id;
  
  console.log(`[paypal-webhook] Item CANCELLED: ${payoutItemId}`);

  const claim = await findClaimByItem(event, supabase);
  
  if (!claim) {
    console.log(`[paypal-webhook] No claim found for cancelled item ${payoutItemId}`);
    return;
  }

  // Revert claim so user can try again
  const { error } = await supabase
    .from('friend_claims')
    .update({
      claim_status: 'notified',
      payout_method: null,
      paypal_email: null,
      paypal_batch_id: null,
      paypal_payout_item_id: null,
    })
    .eq('id', claim.id);

  if (error) {
    console.error(`[paypal-webhook] Failed to revert claim ${claim.id}:`, error);
    return;
  }

  console.log(`[paypal-webhook] Claim ${claim.id} reverted after cancellation - friend can try again`);
}









