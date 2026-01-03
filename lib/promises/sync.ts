/**
 * Promise Sync Layer
 * 
 * Handles conflict resolution and realtime subscriptions.
 * Implements local-first sync with remote as source of truth for server-controlled fields.
 */
import type { PromiseRow } from '@/lib/supabase';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import * as local from './repo.local';
import { fetchPromises, fetchRoastMessages, toLocalPromise } from './repo.remote';
import type { UserPromise } from './types';

// ─────────────────────────────────────────────────────────────
// Merge Strategy
// ─────────────────────────────────────────────────────────────

/**
 * Merge a local promise with a remote promise.
 * 
 * Strategy:
 * - Remote always wins for server-controlled fields (sponsors, roasts, partner state, payment)
 * - Remote wins for status if resolved
 * - Local wins for local-only fields (voiceNoteUri, friendName)
 * - updatedAt is max of both
 */
export function mergePromise(local: UserPromise, remote: UserPromise): UserPromise {
  // If remote status is resolved, remote wins for everything server-controlled
  const statusFromRemote = remote.status !== 'active';
  
  return {
    // Base from local
    ...local,
    
    // Remote always wins for these (server-controlled)
    sponsorAmount: remote.sponsorAmount ?? local.sponsorAmount,
    sponsorCount: remote.sponsorCount ?? local.sponsorCount,
    iToldYouSoMessages: remote.iToldYouSoMessages ?? local.iToldYouSoMessages,
    
    // Partner state from server
    partnerState: remote.partnerState ?? local.partnerState,
    partnerDeadlineAt: remote.partnerDeadlineAt ?? local.partnerDeadlineAt,
    
    // Payment status from server
    paymentStatus: remote.paymentStatus ?? local.paymentStatus,
    paymentClientSecret: remote.paymentClientSecret ?? local.paymentClientSecret,
    
    // Free pass: remote wins if set (server tracks consumption)
    usesFreePass: remote.usesFreePass ?? local.usesFreePass,
    
    // Status: remote wins if resolved
    status: statusFromRemote ? remote.status : local.status,
    completedAt: statusFromRemote && remote.completedAt ? remote.completedAt : local.completedAt,
    failedAt: statusFromRemote && remote.failedAt ? remote.failedAt : local.failedAt,
    expiredAt: statusFromRemote && remote.expiredAt ? remote.expiredAt : local.expiredAt,
    
    // updatedAt: max of both
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    
    // Mark as synced
    syncedAt: Date.now(),
    remoteId: remote.remoteId ?? local.remoteId,
  };
}

/**
 * Perform full sync between local and remote.
 * Returns the merged list of promises.
 */
export async function performFullSync(userId: string): Promise<UserPromise[]> {
  if (!isSupabaseConfigured()) {
    return local.listPromises();
  }
  
  try {
    // Fetch both local and remote
    const [localPromises, remotePromises] = await Promise.all([
      local.listPromises(),
      fetchPromises(userId),
    ]);
    
    // Build a map for O(1) lookup
    const localMap = new Map<string, UserPromise>();
    for (const p of localPromises) {
      localMap.set(p.id, p);
    }
    
    const remoteMap = new Map<string, UserPromise>();
    for (const p of remotePromises) {
      remoteMap.set(p.id, p);
    }
    
    // Merge: remote is source of truth, only merge local data for matching IDs
    const mergedMap = new Map<string, UserPromise>();
    
    // Start with remote promises (these are authoritative for this user)
    for (const remoteP of remotePromises) {
      const localP = localMap.get(remoteP.id);
      if (localP) {
        // Both exist: merge local data into remote
        mergedMap.set(remoteP.id, mergePromise(localP, remoteP));
      } else {
        // Remote only - add as-is
        mergedMap.set(remoteP.id, remoteP);
      }
    }
    
    // IMPORTANT: Do NOT include local-only promises (those without matching remote)
    // They could belong to a different user from a previous session
    
    // Enrich promises with roast messages where needed
    const enrichPromises = Array.from(mergedMap.values()).map(async (p) => {
      // Fetch roast messages if we don't have them yet or have placeholder
      const hasPlaceholder = p.iToldYouSoMessages?.some(m => m.message === '(from server)');
      if (!p.iToldYouSoMessages || hasPlaceholder) {
        try {
          const messages = await fetchRoastMessages(p.id);
          if (messages.length > 0) {
            return { ...p, iToldYouSoMessages: messages };
          }
        } catch {
          // Ignore errors
        }
      }
      return p;
    });
    
    const enriched = await Promise.all(enrichPromises);
    
    // Sort by creation date (newest first)
    const merged = enriched.sort((a, b) => b.createdAt - a.createdAt);
    
    // Atomically replace local storage with the merged result
    // Using replaceAllPromises ensures we don't lose data if write fails
    // (unlike clear + bulkUpsert which can leave storage empty on failure)
    await local.replaceAllPromises(merged);
    
    return merged;
  } catch (error) {
    console.error('[sync] Full sync failed, falling back to local:', error);
    return local.listPromises();
  }
}

/**
 * Handle a single promise change from realtime subscription.
 * Updates local storage and returns the updated promise (or null if deleted).
 */
export async function handleRealtimeChange(
  payload: RealtimePostgresChangesPayload<PromiseRow>,
  localPromises: UserPromise[]
): Promise<{ type: 'insert' | 'update' | 'delete'; promise: UserPromise | null }> {
  const { eventType, new: newRow, old: oldRow } = payload;
  
  if (eventType === 'DELETE' && oldRow && typeof oldRow.id === 'string') {
    // Remote deleted - remove from local
    await local.deletePromise(oldRow.id);
    return { type: 'delete', promise: null };
  }
  
  if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow) {
    const remotePromise = toLocalPromise(newRow as PromiseRow);
    
    // Try to enrich with roast messages if has_roast is true
    if ((newRow as PromiseRow).has_roast) {
      try {
        const messages = await fetchRoastMessages(remotePromise.id);
        if (messages.length > 0) {
          remotePromise.iToldYouSoMessages = messages;
        }
      } catch {
        // Ignore errors fetching roast
      }
    }
    
    // Find existing local promise
    const localPromise = localPromises.find(p => p.id === remotePromise.id);
    
    let merged: UserPromise;
    if (localPromise) {
      // Merge with existing
      merged = mergePromise(localPromise, remotePromise);
    } else {
      // New from server
      merged = remotePromise;
    }
    
    // Update local storage
    await local.upsertPromise(merged);
    
    return { 
      type: eventType === 'INSERT' ? 'insert' : 'update', 
      promise: merged 
    };
  }
  
  return { type: 'update', promise: null };
}

// ─────────────────────────────────────────────────────────────
// Realtime Subscription
// ─────────────────────────────────────────────────────────────

type RealtimeCallback = (
  type: 'insert' | 'update' | 'delete',
  promise: UserPromise | null,
  promiseId: string
) => void;

type UnsubscribeFn = () => void;

/**
 * Subscribe to realtime promise changes for a user.
 * Only subscribes to active promises to reduce server load.
 * 
 * @param userId The authenticated user's ID
 * @param getCurrentPromises Function to get current local promises
 * @param onUpdate Callback when a promise changes
 * @returns Unsubscribe function
 */
export function subscribeToPromiseChanges(
  userId: string,
  getCurrentPromises: () => UserPromise[],
  onUpdate: RealtimeCallback
): UnsubscribeFn {
  if (!isSupabaseConfigured()) {
    return () => {}; // No-op unsubscribe
  }
  
  const channel = supabase
    .channel(`user-promises-${userId}`)
    .on<PromiseRow>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'promises',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        try {
          const newData = payload.new as PromiseRow | null;
          const oldData = payload.old as { id?: string } | null;
          const promiseId = newData?.id || oldData?.id || '';
          
          console.log('[sync] Realtime event:', payload.eventType, 'promiseId:', promiseId, 'partner_state:', newData?.partner_state);
          
          // For DELETE events, always process
          if (payload.eventType === 'DELETE') {
            const currentPromises = getCurrentPromises();
            const result = await handleRealtimeChange(
              payload as RealtimePostgresChangesPayload<PromiseRow>,
              currentPromises
            );
            onUpdate(result.type, result.promise, promiseId);
            return;
          }
          
          // For INSERT/UPDATE, check if we have this promise locally
          // or if it's a status/partner_state change we care about
          const currentPromises = getCurrentPromises();
          const localPromise = currentPromises.find(p => p.id === promiseId);
          
          // Process if:
          // 1. It's a new promise (INSERT)
          // 2. We have it locally (could be partner verification update)
          // 3. New data shows it's active or just became resolved
          const shouldProcess = 
            payload.eventType === 'INSERT' ||
            localPromise !== undefined ||
            newData?.status === 'active' ||
            newData?.status === 'completed' ||
            newData?.status === 'failed';
          
          if (!shouldProcess) return;
          
          const result = await handleRealtimeChange(
            payload as RealtimePostgresChangesPayload<PromiseRow>,
            currentPromises
          );
          
          onUpdate(result.type, result.promise, promiseId);
        } catch (error) {
          console.error('[sync] Error handling realtime change:', error);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[sync] Subscribed to promise changes');
      } else if (status === 'CHANNEL_ERROR') {
        // This can happen due to network issues, especially on emulators
        // The channel will auto-reconnect, so we just log at debug level
        console.log('[sync] Channel error (will auto-reconnect):', err?.message || 'unknown');
      } else if (status === 'TIMED_OUT') {
        console.log('[sync] Channel timed out, will retry');
      } else if (status === 'CLOSED') {
        console.log('[sync] Channel closed');
      }
    });
  
  return () => {
    console.log('[sync] Unsubscribing from promise changes');
    supabase.removeChannel(channel);
  };
}

// ─────────────────────────────────────────────────────────────
// Sync Queue for Offline Mutations
// ─────────────────────────────────────────────────────────────

type SyncQueueItem = {
  type: 'create' | 'update' | 'delete';
  promiseId: string;
  data?: Partial<UserPromise>;
  timestamp: number;
};

// In-memory queue for pending sync operations
// In production, this should be persisted to AsyncStorage
let syncQueue: SyncQueueItem[] = [];

/**
 * Queue a sync operation for when we come back online
 */
export function queueSyncOperation(item: Omit<SyncQueueItem, 'timestamp'>): void {
  syncQueue.push({ ...item, timestamp: Date.now() });
}

/**
 * Get pending sync operations
 */
export function getPendingSyncOperations(): SyncQueueItem[] {
  return [...syncQueue];
}

/**
 * Clear a sync operation (after successful sync)
 */
export function clearSyncOperation(promiseId: string, type: SyncQueueItem['type']): void {
  syncQueue = syncQueue.filter(
    item => !(item.promiseId === promiseId && item.type === type)
  );
}

/**
 * Clear all sync operations
 */
export function clearAllSyncOperations(): void {
  syncQueue = [];
}

/**
 * Check if a promise has pending sync operations
 */
export function hasPendingSync(promiseId: string): boolean {
  return syncQueue.some(item => item.promiseId === promiseId);
}