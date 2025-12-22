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
import { fetchPromises, fetchRoastMessage, toLocalPromise } from './repo.remote';
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
    iToldYouSoMessage: remote.iToldYouSoMessage ?? local.iToldYouSoMessage,
    iToldYouSoFrom: remote.iToldYouSoFrom ?? local.iToldYouSoFrom,
    
    // Partner state from server
    partnerState: remote.partnerState ?? local.partnerState,
    partnerDeadlineAt: remote.partnerDeadlineAt ?? local.partnerDeadlineAt,
    
    // Payment status from server
    paymentStatus: remote.paymentStatus ?? local.paymentStatus,
    paymentClientSecret: remote.paymentClientSecret ?? local.paymentClientSecret,
    
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
    
    // Merge: start with local, merge in remote
    const mergedMap = new Map<string, UserPromise>();
    
    // Process local promises
    for (const localP of localPromises) {
      const remoteP = remoteMap.get(localP.id);
      if (remoteP) {
        // Both exist: merge
        mergedMap.set(localP.id, mergePromise(localP, remoteP));
      } else if (localP.remoteId) {
        // Local claims to be synced but remote doesn't have it
        // Could be deleted on server - keep for now but mark as needing sync
        mergedMap.set(localP.id, { ...localP, remoteId: undefined, syncedAt: undefined });
      } else {
        // Local only - not yet synced
        mergedMap.set(localP.id, localP);
      }
    }
    
    // Add remote-only promises
    for (const remoteP of remotePromises) {
      if (!mergedMap.has(remoteP.id)) {
        mergedMap.set(remoteP.id, remoteP);
      }
    }
    
    // Enrich promises with roast messages where needed
    const enrichPromises = Array.from(mergedMap.values()).map(async (p) => {
      // If has placeholder roast message, fetch the actual message
      if (p.iToldYouSoMessage === '(from server)' || (p.iToldYouSoMessage && !p.iToldYouSoFrom)) {
        try {
          const roast = await fetchRoastMessage(p.id);
          if (roast) {
            return { ...p, iToldYouSoMessage: roast.message, iToldYouSoFrom: roast.from };
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
    
    // Persist merged state locally
    await local.bulkUpsertPromises(merged);
    
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
    
    // Try to enrich with roast message if has_roast is true
    if ((newRow as PromiseRow).has_roast) {
      try {
        const roast = await fetchRoastMessage(remotePromise.id);
        if (roast) {
          remotePromise.iToldYouSoMessage = roast.message;
          remotePromise.iToldYouSoFrom = roast.from;
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
          // Only process if promise is active or just became resolved
          const newData = payload.new as PromiseRow | null;
          const oldData = payload.old as { status?: string; id?: string } | null;
          
          const isRelevant = 
            newData?.status === 'active' || 
            oldData?.status === 'active' ||
            payload.eventType === 'DELETE';
          
          if (!isRelevant) return;
          
          const currentPromises = getCurrentPromises();
          const result = await handleRealtimeChange(
            payload as RealtimePostgresChangesPayload<PromiseRow>,
            currentPromises
          );
          
          const promiseId = newData?.id || oldData?.id || '';
          onUpdate(result.type, result.promise, promiseId);
        } catch (error) {
          console.error('[sync] Error handling realtime change:', error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[sync] Subscribed to promise changes');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[sync] Channel error');
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

