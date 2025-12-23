// @ts-nocheck
// deno-lint-ignore-file
/**
 * create-friend-claim Edge Function
 *
 * Creates a friend claim record when a user creates a promise with money_destination='friend'.
 * Sends invite notification to the friend via email.
 *
 * The friend does NOT need to set up anything upfront - they only go through
 * Stripe Connect onboarding when there's actual money to claim (after user fails).
 *
 * POST /create-friend-claim
 * Body: {
 *   promiseId: string,
 *   friendName: string,
 *   friendEmail: string,
 *   stakeAmount: number,      // in dollars
 *   promiseText: string,
 *   deadline: string,         // ISO date string
 *   userName?: string         // Display name of promise creator
 * }
 *
 * Returns: { claimId: string, claimToken: string, claimUrl: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// ─────────────────────────────────────────────────────────────
// Token Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate a secure URL-safe random token
 * Uses 24 bytes = 48 hex chars, suitable for claim URLs
 */
function generateClaimToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────
// Email Notification (Resend)
// ─────────────────────────────────────────────────────────────

interface EmailParams {
  to: string;
  friendName: string;
  userName: string;
  stakeAmount: number; // in dollars
  promiseText: string;
  deadline: string;
  claimUrl: string;
}

async function sendEmailNotification(params: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[create-friend-claim] Resend API key not configured, skipping email');
    return false;
  }

  const { to, friendName, userName, stakeAmount, promiseText, deadline, claimUrl } = params;
  const stakeDisplay = `$${stakeAmount}`;
  const deadlineDate = new Date(deadline).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const subject = `${userName} just bet ${stakeDisplay} on a promise — and you get it if they fail`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Named as Friend</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #ffffff;">
        💸 You're in the money
      </h1>
      <p style="font-size: 16px; color: #888888; margin: 0;">
        (if ${userName} fails, that is)
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid #333;">
      <p style="font-size: 14px; color: #888888; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        The Promise
      </p>
      <p style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #ffffff;">
        "${promiseText}"
      </p>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
        <tr>
          <td style="vertical-align: top;">
            <p style="font-size: 12px; color: #888888; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">STAKE</p>
            <p style="font-size: 24px; font-weight: 700; margin: 0; color: #22c55e;">${stakeDisplay}</p>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <p style="font-size: 12px; color: #888888; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">DEADLINE</p>
            <p style="font-size: 16px; font-weight: 500; margin: 0; color: #ffffff;">${deadlineDate}</p>
          </td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 16px; line-height: 1.6; color: #cccccc; text-align: center; margin-bottom: 32px;">
      ${userName} put ${stakeDisplay} on the line. If they don't follow through, that money goes to <strong>you</strong>.
    </p>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600;">
        View Promise
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666666; text-align: center; margin: 0;">
      We'll notify you if ${userName} fails and there's money to claim.
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

${userName} just bet ${stakeDisplay} they'll "${promiseText}"

Deadline: ${deadlineDate}

If they fail, the money's yours.

Preview: ${claimUrl}

We'll notify you if ${userName} fails and there's money to claim.

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
      console.error('[create-friend-claim] Resend API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('[create-friend-claim] Email sent:', result.id);
    return true;
  } catch (error) {
    console.error('[create-friend-claim] Email send error:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

interface CreateFriendClaimRequest {
  promiseId: string;
  friendName: string;
  friendEmail: string;
  stakeAmount: number; // in dollars
  promiseText: string;
  deadline: string; // ISO date string
  userName?: string;
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
        }
      );
    }

    // 2. Parse request body
    const body: CreateFriendClaimRequest = await req.json();
    const {
      promiseId,
      friendName,
      friendEmail,
      stakeAmount,
      promiseText,
      deadline,
      userName,
    } = body;

    // 3. Validate required fields
    if (!promiseId || !friendName?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing promiseId or friendName' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!friendEmail?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Friend email is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createAdminClient();

    // 4. Verify promise exists and belongs to user
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('id, user_id, money_destination, status, stake')
      .eq('id', promiseId)
      .single();

    if (promiseError || !promise) {
      return new Response(
        JSON.stringify({ error: 'Promise not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (promise.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - not your promise' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (promise.money_destination !== 'friend') {
      return new Response(
        JSON.stringify({ error: 'Promise money_destination must be "friend"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Check if a friend claim already exists for this promise
    const { data: existingClaim } = await supabase
      .from('friend_claims')
      .select('id')
      .eq('promise_id', promiseId)
      .single();

    if (existingClaim) {
      return new Response(
        JSON.stringify({ error: 'Friend claim already exists for this promise' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Generate claim token
    const claimToken = generateClaimToken();
    const claimUrl = `${APP_URL}/claim/${claimToken}`;

    // 7. Create friend_claims record
    const { data: claim, error: insertError } = await supabase
      .from('friend_claims')
      .insert({
        promise_id: promiseId,
        friend_name: friendName.trim(),
        friend_email: friendEmail.trim(),
        claim_token: claimToken,
        claim_status: 'pending',
        stripe_account_status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[create-friend-claim] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create friend claim' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 8. Update promise with friend_claim_id
    const { error: updateError } = await supabase
      .from('promises')
      .update({ friend_claim_id: claim.id })
      .eq('id', promiseId);

    if (updateError) {
      console.error('[create-friend-claim] Error linking claim to promise:', updateError);
      // Don't fail the request - claim was created successfully
    }

    // 9. Get user's display name from profile
    let displayName = userName || 'Someone';
    if (!userName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      
      if (profile?.display_name) {
        displayName = profile.display_name;
      }
    }
    
    // stakeAmount and promise.stake are both in dollars
    const stake = stakeAmount || promise.stake || 0;

    // 10. Send email notification
    const emailSent = await sendEmailNotification({
      to: friendEmail.trim(),
      friendName: friendName.trim(),
      userName: displayName,
      stakeAmount: stake,
      promiseText: promiseText || 'keep their promise',
      deadline: deadline || new Date().toISOString(),
      claimUrl,
    });

    console.log('[create-friend-claim] Created claim:', {
      claimId: claim.id,
      promiseId,
      emailSent,
    });

    // 11. Return success response
    return new Response(
      JSON.stringify({
        claimId: claim.id,
        claimToken,
        claimUrl,
        emailSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('[create-friend-claim] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
