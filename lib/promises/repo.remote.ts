/**
 * Remote Promise Repository
 * 
 * Handles all Supabase operations for promises.
 * Used when user is signed in and online.
 */
import type { PromiseInsert, PromiseRow, PromiseUpdate as RemotePromiseUpdate } from '@/lib/supabase';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

import { generateId } from './repo.local';
import type { CreatePromiseInput, UserPromise } from './types';

// Supabase URL for edge function calls
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// ─────────────────────────────────────────────────────────────
// Type Conversions
// ─────────────────────────────────────────────────────────────

/**
 * Convert local UserPromise to Supabase PromiseInsert
 */
export function toRemoteInsert(local: UserPromise, userId: string): PromiseInsert {
  // Calculate settle_at (deadline + 1 hour grace period)
  const settleAt = new Date(local.deadlineAt + 60 * 60 * 1000).toISOString();
  
  // Handle money_destination: anti_charity is not in DB schema, map to oopsfee
  let moneyDestination: 'oopsfee' | 'charity' | 'friend' = 'oopsfee';
  if (local.moneyDestination === 'charity') {
    moneyDestination = 'charity';
  } else if (local.moneyDestination === 'friend') {
    moneyDestination = 'friend';
  }
  
  return {
    id: local.id,
    user_id: userId,
    text: local.text,
    stake: local.stake,
    deadline_at: new Date(local.deadlineAt).toISOString(),
    status: local.status,
    money_destination: moneyDestination,
    friend_user_id: local.friendUserId ?? null, // in-app friend for direct wallet credit
    verification_type: local.verificationType,
    verification_proof_ref: local.verificationProof ?? null,
    verification_timestamp: local.verificationTimestamp 
      ? new Date(local.verificationTimestamp).toISOString() 
      : null,
    partner_state: local.partnerState ?? null,
    partner_deadline_at: local.partnerDeadlineAt 
      ? new Date(local.partnerDeadlineAt).toISOString() 
      : null,
    voice_note_ref: local.voiceNoteUri ?? null,
    completed_at: local.completedAt ? new Date(local.completedAt).toISOString() : null,
    failed_at: local.failedAt ? new Date(local.failedAt).toISOString() : null,
    expired_at: local.expiredAt ? new Date(local.expiredAt).toISOString() : null,
    streak_at_completion: local.streakAtCompletion ?? null,
    settle_at: settleAt,
    payment_status: local.paymentStatus ?? null,
    payment_next_retry_at: null,
    payment_client_secret: local.paymentClientSecret ?? null,
    sponsor_total: Math.round((local.sponsorAmount ?? 0) * 100), // Store in cents
    sponsor_count: local.sponsorCount ?? 0,
    has_roast: (local.iToldYouSoMessages?.length ?? 0) > 0,
  };
}

/**
 * Convert local PromiseUpdate to Supabase PromiseUpdate
 */
export function toRemoteUpdate(patch: Partial<UserPromise>): RemotePromiseUpdate {
  const update: RemotePromiseUpdate = {};
  
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.stake !== undefined) update.stake = patch.stake;
  if (patch.deadlineAt !== undefined) {
    update.deadline_at = new Date(patch.deadlineAt).toISOString();
    // Recalculate settle_at
    update.settle_at = new Date(patch.deadlineAt + 60 * 60 * 1000).toISOString();
  }
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.moneyDestination !== undefined) {
    // Map anti_charity to oopsfee for DB
    let moneyDestination: 'oopsfee' | 'charity' | 'friend' = 'oopsfee';
    if (patch.moneyDestination === 'charity') {
      moneyDestination = 'charity';
    } else if (patch.moneyDestination === 'friend') {
      moneyDestination = 'friend';
    }
    update.money_destination = moneyDestination;
  }
  if (patch.friendUserId !== undefined) update.friend_user_id = patch.friendUserId;
  if (patch.verificationType !== undefined) update.verification_type = patch.verificationType;
  if (patch.verificationProof !== undefined) update.verification_proof_ref = patch.verificationProof;
  if (patch.verificationTimestamp !== undefined) {
    update.verification_timestamp = new Date(patch.verificationTimestamp).toISOString();
  }
  if (patch.partnerState !== undefined) update.partner_state = patch.partnerState;
  if (patch.partnerDeadlineAt !== undefined) {
    update.partner_deadline_at = new Date(patch.partnerDeadlineAt).toISOString();
  }
  if (patch.completedAt !== undefined) {
    update.completed_at = new Date(patch.completedAt).toISOString();
  }
  if (patch.failedAt !== undefined) {
    update.failed_at = new Date(patch.failedAt).toISOString();
  }
  if (patch.expiredAt !== undefined) {
    update.expired_at = new Date(patch.expiredAt).toISOString();
  }
  if (patch.streakAtCompletion !== undefined) update.streak_at_completion = patch.streakAtCompletion;
  if (patch.paymentStatus !== undefined) update.payment_status = patch.paymentStatus;
  if (patch.paymentClientSecret !== undefined) update.payment_client_secret = patch.paymentClientSecret;
  if (patch.sponsorAmount !== undefined) update.sponsor_total = Math.round(patch.sponsorAmount * 100); // Store in cents
  if (patch.sponsorCount !== undefined) update.sponsor_count = patch.sponsorCount;
  if (patch.iToldYouSoMessages !== undefined) update.has_roast = patch.iToldYouSoMessages.length > 0;
  
  // Always update updated_at
  update.updated_at = new Date().toISOString();
  
  return update;
}

/**
 * Convert Supabase PromiseRow to local UserPromise
 */
export function toLocalPromise(remote: PromiseRow): UserPromise {
  // Map money_destination back (no anti_charity in DB, default to oopsfee)
  let moneyDestination: 'oopsfee' | 'charity' | 'anti_charity' | 'friend' = 'oopsfee';
  if (remote.money_destination === 'charity') {
    moneyDestination = 'charity';
  } else if (remote.money_destination === 'friend') {
    moneyDestination = 'friend';
  }

  // Map status string to PromiseStatus
  const status = remote.status as 'active' | 'completed' | 'failed' | 'expired';
  
  // Map verification_type string to VerificationType
  const verificationType = remote.verification_type as 'honor' | 'photo' | 'partner' | 'healthkit' | 'location';

  // Map partner_state string to PartnerState
  const partnerState = remote.partner_state as 'awaiting' | 'approved' | 'rejected' | 'expired' | null;

  // Map payment_status string to PaymentStatus  
  const paymentStatus = remote.payment_status as 'pending' | 'succeeded' | 'failed' | 'requires_action' | 'abandoned' | null;
  
  return {
    id: remote.id,
    text: remote.text,
    stake: remote.stake,
    deadlineAt: new Date(remote.deadline_at).getTime(),
    createdAt: remote.created_at ? new Date(remote.created_at).getTime() : Date.now(),
    updatedAt: remote.updated_at ? new Date(remote.updated_at).getTime() : Date.now(),
    status,
    moneyDestination,
    friendUserId: remote.friend_user_id ?? undefined, // in-app friend's profile ID
    voiceNoteUri: remote.voice_note_ref ?? undefined,
    completedAt: remote.completed_at ? new Date(remote.completed_at).getTime() : undefined,
    failedAt: remote.failed_at ? new Date(remote.failed_at).getTime() : undefined,
    expiredAt: remote.expired_at ? new Date(remote.expired_at).getTime() : undefined,
    streakAtCompletion: remote.streak_at_completion ?? undefined,
    verificationType,
    verificationProof: remote.verification_proof_ref ?? undefined,
    verificationTimestamp: remote.verification_timestamp 
      ? new Date(remote.verification_timestamp).getTime() 
      : undefined,
    sponsorAmount: remote.sponsor_total ? remote.sponsor_total / 100 : undefined, // Convert cents to dollars
    sponsorCount: remote.sponsor_count ?? undefined,
    iToldYouSoMessages: remote.has_roast ? [{ message: '(from server)', from: '' }] : undefined, // Placeholder, actual messages from roast_messages table
    partnerState: partnerState ?? undefined,
    partnerDeadlineAt: remote.partner_deadline_at 
      ? new Date(remote.partner_deadline_at).getTime() 
      : undefined,
    paymentStatus: paymentStatus ?? undefined,
    paymentClientSecret: remote.payment_client_secret ?? undefined,
    syncedAt: Date.now(),
    remoteId: remote.id,
  };
}

// ─────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────

/**
 * Check if remote operations are available
 */
export function isRemoteAvailable(): boolean {
  return isSupabaseConfigured();
}

// ─────────────────────────────────────────────────────────────
// Friend Claim
// ─────────────────────────────────────────────────────────────

interface CreateFriendClaimInput {
  promiseId: string;
  friendName: string;
  friendEmail: string;
  stakeAmount: number;
  promiseText: string;
  deadline: string;
  userName?: string;
}

interface CreateFriendClaimResult {
  claimId: string;
  claimToken: string;
  claimUrl: string;
  notifications: {
    emailSent: boolean;
    smsSent: boolean;
  };
}

interface NotifyFriendNamedInput {
  promiseId: string;
  friendUserId: string;
  stakeAmount: number;
  promiseText: string;
}

interface NotifyFriendNamedResult {
  success: boolean;
  notification_sent: boolean;
}

/**
 * Notify an in-app friend that they've been named as beneficiary
 * Sends a push notification via edge function
 */
async function notifyFriendNamed(input: NotifyFriendNamedInput): Promise<NotifyFriendNamedResult> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/notify-friend-named`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        promise_id: input.promiseId,
        friend_user_id: input.friendUserId,
        stake_amount: input.stakeAmount,
        promise_text: input.promiseText,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a friend claim via the edge function
 * This notifies the friend about the promise and creates a claim record
 */
async function createFriendClaim(input: CreateFriendClaimInput): Promise<CreateFriendClaimResult> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-friend-claim`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all promises for a user from Supabase
 */
export async function fetchPromises(userId: string): Promise<UserPromise[]> {
  if (!isRemoteAvailable()) return [];
  
  const { data, error } = await supabase
    .from('promises')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[repo.remote] Error fetching promises:', error);
    throw error;
  }

  return (data ?? []).map(toLocalPromise);
}

/**
 * Fetch a single promise by ID
 */
export async function fetchPromiseById(id: string, userId: string): Promise<UserPromise | null> {
  if (!isRemoteAvailable()) return null;
  
  const { data, error } = await supabase
    .from('promises')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[repo.remote] Error fetching promise:', error);
    throw error;
  }

  return data ? toLocalPromise(data) : null;
}

/**
 * Create a promise on Supabase
 */
export async function createPromise(input: CreatePromiseInput, userId: string): Promise<UserPromise> {
  if (!isRemoteAvailable()) {
    throw new Error('Remote not available');
  }
  
  const now = Date.now();
  const id = generateId();
  
  const localPromise: UserPromise = {
    id,
    text: input.text.trim(),
    stake: Math.max(0, Math.round(input.stake)),
    deadlineAt: input.deadlineAt,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    moneyDestination: input.moneyDestination,
    friendUserId: input.moneyDestination === 'friend' ? input.friendUserId || undefined : undefined,
    friendName: input.moneyDestination === 'friend' ? input.friendName?.trim() || undefined : undefined,
    friendEmail: input.moneyDestination === 'friend' ? input.friendEmail?.trim() || undefined : undefined,
    voiceNoteUri: input.voiceNoteUri?.trim() || undefined,
    verificationType: input.verificationType ?? 'photo',
    sponsorAmount: input.sponsorAmount,
    sponsorCount: input.sponsorCount,
  };
  
  const insert = toRemoteInsert(localPromise, userId);
  
  const { data, error } = await supabase
    .from('promises')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[repo.remote] Error creating promise:', error);
    throw error;
  }

  if (!data) {
    throw new Error('No data returned from insert');
  }

  // If money_destination is 'friend' with external email (no in-app friend), create friend claim
  // Skip if friendUserId is set - in-app friends get direct wallet credits on failure
  if (input.moneyDestination === 'friend' && input.friendEmail && !input.friendUserId) {
    console.log('[repo.remote] Creating friend claim for promise:', id, 'email:', input.friendEmail);
    try {
      const claimResult = await createFriendClaim({
        promiseId: id,
        friendName: input.friendName || 'Friend',
        friendEmail: input.friendEmail,
        stakeAmount: localPromise.stake, // in dollars
        promiseText: localPromise.text,
        deadline: new Date(localPromise.deadlineAt).toISOString(),
      });
      console.log('[repo.remote] Friend claim created:', claimResult);
    } catch (claimError) {
      // Log error but don't fail promise creation
      console.error('[repo.remote] Failed to create friend claim:', claimError);
    }
  } else if (input.moneyDestination === 'friend' && input.friendUserId) {
    // In-app friend: send notification that they've been named as beneficiary
    console.log('[repo.remote] In-app friend selected:', input.friendUserId, '- sending notification');
    try {
      const notifyResult = await notifyFriendNamed({
        promiseId: id,
        friendUserId: input.friendUserId,
        stakeAmount: localPromise.stake,
        promiseText: localPromise.text,
      });
      console.log('[repo.remote] Friend named notification result:', notifyResult);
    } catch (notifyError) {
      // Log error but don't fail promise creation
      console.error('[repo.remote] Failed to notify friend:', notifyError);
    }
  } else {
    console.log('[repo.remote] Skipping friend claim - moneyDestination:', input.moneyDestination, 'friendEmail:', input.friendEmail);
  }

  return {
    ...toLocalPromise(data),
    // Preserve local-only fields (friendUserId comes from DB)
    friendName: localPromise.friendName,
    friendEmail: localPromise.friendEmail,
    iToldYouSoMessages: localPromise.iToldYouSoMessages,
  };
}

/**
 * Update a promise on Supabase
 */
export async function updatePromise(
  id: string, 
  patch: Partial<UserPromise>, 
  userId: string
): Promise<UserPromise | null> {
  if (!isRemoteAvailable()) return null;
  
  const update = toRemoteUpdate(patch);
  
  const { data, error } = await supabase
    .from('promises')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[repo.remote] Error updating promise:', error);
    throw error;
  }

  return data ? toLocalPromise(data) : null;
}

/**
 * Delete a promise from Supabase
 */
export async function deletePromise(id: string, userId: string): Promise<boolean> {
  if (!isRemoteAvailable()) return false;
  
  const { error } = await supabase
    .from('promises')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('[repo.remote] Error deleting promise:', error);
    return false;
  }

  return true;
}

/**
 * Sync a local promise to remote (upsert)
 * Used when syncing local-only promises to the server
 */
export async function syncPromiseToRemote(local: UserPromise, userId: string): Promise<UserPromise> {
  if (!isRemoteAvailable()) {
    throw new Error('Remote not available');
  }
  
  const insert = toRemoteInsert(local, userId);
  
  // Use upsert to handle both create and update
  const { data, error } = await supabase
    .from('promises')
    .upsert(insert, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[repo.remote] Error syncing promise:', error);
    throw error;
  }

  if (!data) {
    throw new Error('No data returned from upsert');
  }

  // If money_destination is 'friend' with external email (no in-app friend), create friend claim
  // Skip if friendUserId is set - in-app friends get direct wallet credits on failure
  if (local.moneyDestination === 'friend' && local.friendEmail && !local.friendUserId) {
    console.log('[repo.remote] Creating friend claim for synced promise:', local.id, 'email:', local.friendEmail);
    try {
      const claimResult = await createFriendClaim({
        promiseId: local.id,
        friendName: local.friendName || 'Friend',
        friendEmail: local.friendEmail,
        stakeAmount: local.stake, // in dollars
        promiseText: local.text,
        deadline: new Date(local.deadlineAt).toISOString(),
      });
      console.log('[repo.remote] Friend claim created:', claimResult);
    } catch (claimError) {
      // Log error but don't fail sync
      console.error('[repo.remote] Failed to create friend claim:', claimError);
    }
  } else if (local.moneyDestination === 'friend' && local.friendUserId) {
    // In-app friend: send notification that they've been named as beneficiary
    console.log('[repo.remote] In-app friend selected for synced promise:', local.friendUserId, '- sending notification');
    try {
      const notifyResult = await notifyFriendNamed({
        promiseId: local.id,
        friendUserId: local.friendUserId,
        stakeAmount: local.stake,
        promiseText: local.text,
      });
      console.log('[repo.remote] Friend named notification result:', notifyResult);
    } catch (notifyError) {
      // Log error but don't fail sync
      console.error('[repo.remote] Failed to notify friend:', notifyError);
    }
  } else if (local.moneyDestination === 'friend') {
    console.log('[repo.remote] Skipping friend claim for synced promise - no friendEmail');
  }

  return {
    ...toLocalPromise(data),
    // Preserve local-only fields
    friendName: local.friendName,
    friendEmail: local.friendEmail,
    voiceNoteUri: local.voiceNoteUri,
    iToldYouSoMessages: local.iToldYouSoMessages,
  };
}

/**
 * Fetch all roast messages for a promise
 */
export async function fetchRoastMessages(promiseId: string): Promise<{ message: string; from: string }[]> {
  if (!isRemoteAvailable()) return [];
  
  const { data, error } = await supabase
    .from('roast_messages')
    .select('message, from_name')
    .eq('promise_id', promiseId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchRoastMessages] Error:', error);
    return [];
  }

  return (data ?? []).map(row => ({ message: row.message, from: row.from_name }));
}
