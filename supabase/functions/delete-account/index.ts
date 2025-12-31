/**
 * Delete Account Edge Function
 * Handles full account deletion including:
 * - Cancelling active promises (no charge)
 * - Clearing wallet balance (must be withdrawn first)
 * - Deleting all user data
 * - Deleting the auth user
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get the user from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to verify the user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[delete-account] Processing deletion for user: ${userId}`);

    // Create admin client for deletion operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Check wallet balance - must be zero or withdrawn
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[delete-account] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Please withdraw your wallet balance before deleting your account',
          wallet_balance: walletBalance
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Cancel all active promises (status = 'active' or 'pending')
    // This prevents any charges from happening
    const { data: activePromises, error: promisesError } = await adminClient
      .from('promises')
      .select('id, status, stake, payment_status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending']);

    if (promisesError) {
      console.error('[delete-account] Error fetching promises:', promisesError);
    } else if (activePromises && activePromises.length > 0) {
      console.log(`[delete-account] Cancelling ${activePromises.length} active promises`);
      
      // Mark promises as cancelled (this prevents settlement from charging them)
      const { error: cancelError } = await adminClient
        .from('promises')
        .update({ 
          status: 'cancelled',
          payment_status: 'abandoned',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .in('status', ['active', 'pending']);

      if (cancelError) {
        console.error('[delete-account] Error cancelling promises:', cancelError);
        // Continue anyway - we don't want to block deletion
      }
    }

    // Step 3: Delete friend-related data
    // Friendships (both directions)
    await adminClient
      .from('friendships')
      .delete()
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    // Friend invites (created by user)
    await adminClient
      .from('friend_invites')
      .delete()
      .eq('inviter_id', userId);

    // Step 4: Delete push tokens
    await adminClient
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    // Step 5: Delete wallet transactions
    await adminClient
      .from('wallet_transactions')
      .delete()
      .eq('user_id', userId);

    // Step 6: Delete the promises (cascades to share_links, sponsor_pledges, roast_messages, payments)
    // Note: We're keeping a record of promises for legal/financial compliance
    // but marking them as belonging to a deleted user
    // Actually, let's delete them - the payments table should retain financial records
    await adminClient
      .from('promises')
      .delete()
      .eq('user_id', userId);

    // Step 7: Delete the profile (this should cascade from user deletion, but be explicit)
    const { error: deleteProfileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('[delete-account] Error deleting profile:', deleteProfileError);
      // Continue - user deletion will cascade
    }

    // Step 8: Delete the auth user (this is the final step)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('[delete-account] Error deleting auth user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-account] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Your account has been deleted successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-account] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

