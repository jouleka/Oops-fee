/**
 * Promise Repository Facade
 * 
 * Orchestrates local and remote storage.
 * - Always writes to local first (offline-first)
 * - Syncs to remote when user is signed in and online
 * - Handles conflicts via merge strategy
 */
import { getCurrentUserId, isSupabaseConfigured } from '@/lib/supabase';

import * as local from './repo.local';
import * as remote from './repo.remote';
import { queueSyncOperation, mergePromise, hasPendingSync } from './sync';
import type { CreatePromiseInput, PromiseStatus, PromiseUpdate, UserPromise } from './types';

// Re-export reconcileExpired for external use
export { reconcileExpired } from './repo.local';

// ─────────────────────────────────────────────────────────────
// List & Get
// ─────────────────────────────────────────────────────────────

/**
 * List all promises (from local storage).
 * Call syncWithRemote() separately for full sync.
 */
export async function listPromises(): Promise<UserPromise[]> {
  return local.listPromises();
}

/**
 * Get a single promise by ID
 */
export async function getPromiseById(id: string): Promise<UserPromise | null> {
  return local.getPromiseById(id);
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

/**
 * Create a new promise.
 * - Always creates locally first
 * - If signed in, also creates on remote
 * - If remote fails, queues for later sync
 */
export async function createPromise(input: CreatePromiseInput): Promise<UserPromise> {
  // Create locally first (always succeeds, offline-first)
  const localPromise = await local.createPromise(input);
  
  // Try to sync to remote if configured and signed in
  if (isSupabaseConfigured()) {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const remotePromise = await remote.syncPromiseToRemote(localPromise, userId);
        // Update local with synced data
        const merged = mergePromise(localPromise, remotePromise);
        await local.upsertPromise(merged);
        return merged;
      }
    } catch (error) {
      console.warn('[repo] Failed to sync new promise to remote, queuing:', error);
      queueSyncOperation({ type: 'create', promiseId: localPromise.id });
    }
  }
  
  return localPromise;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

/**
 * Update a promise.
 * - Always updates locally first
 * - If signed in and promise is synced, also updates on remote
 */
export async function updatePromise(id: string, patch: PromiseUpdate): Promise<UserPromise | null> {
  // Update locally first
  const updated = await local.updatePromise(id, patch);
  if (!updated) return null;
  
  // Try to sync to remote if promise is synced
  if (isSupabaseConfigured() && updated.remoteId) {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const remotePromise = await remote.updatePromise(id, patch, userId);
        if (remotePromise) {
          // Update local with remote response
          const merged = mergePromise(updated, remotePromise);
          await local.upsertPromise(merged);
          return merged;
        }
      }
    } catch (error) {
      console.warn('[repo] Failed to sync update to remote, queuing:', error);
      queueSyncOperation({ type: 'update', promiseId: id, data: patch });
    }
  } else if (isSupabaseConfigured() && !updated.remoteId && !hasPendingSync(id)) {
    // Promise exists locally but not synced - queue for initial sync
    queueSyncOperation({ type: 'create', promiseId: id });
  }
  
  return updated;
}

/**
 * Set the status of a promise (convenience wrapper)
 */
export async function setPromiseStatus(id: string, status: PromiseStatus): Promise<UserPromise | null> {
  const now = Date.now();
  const patch: PromiseUpdate = { status };
  if (status === 'completed') patch.completedAt = now;
  if (status === 'failed') patch.failedAt = now;
  if (status === 'expired') patch.expiredAt = now;
  return updatePromise(id, patch);
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

/**
 * Delete a promise.
 * - Always deletes locally first
 * - If signed in and promise is synced, also deletes on remote
 */
export async function deletePromise(id: string): Promise<boolean> {
  // Get the promise first to check if it's synced
  const promise = await local.getPromiseById(id);
  
  // Delete locally first
  const deleted = await local.deletePromise(id);
  if (!deleted) return false;
  
  // Try to delete from remote if promise was synced
  if (isSupabaseConfigured() && promise?.remoteId) {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        await remote.deletePromise(id, userId);
      }
    } catch (error) {
      console.warn('[repo] Failed to delete from remote, queuing:', error);
      queueSyncOperation({ type: 'delete', promiseId: id });
    }
  }
  
  return true;
}

/**
 * Clear all promises (local only - dangerous!)
 */
export async function clearAllPromises(): Promise<void> {
  await local.clearAllPromises();
  // Note: This doesn't clear remote. Use with caution.
}

// ─────────────────────────────────────────────────────────────
// Sync
// ─────────────────────────────────────────────────────────────

/**
 * Sync local-only promises to remote.
 * Call this after user signs in to push any local promises.
 */
export async function syncLocalToRemote(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  const localPromises = await local.listPromises();
  const unsyncedPromises = localPromises.filter(p => !p.remoteId);
  
  for (const promise of unsyncedPromises) {
    try {
      const remotePromise = await remote.syncPromiseToRemote(promise, userId);
      const merged = mergePromise(promise, remotePromise);
      await local.upsertPromise(merged);
    } catch (error) {
      console.error('[repo] Failed to sync promise:', promise.id, error);
      // Continue with other promises
    }
  }
}

/**
 * Get a promise with fresh roast message from remote (if available)
 */
export async function getPromiseWithRoast(id: string): Promise<UserPromise | null> {
  const promise = await local.getPromiseById(id);
  if (!promise) return null;
  
  if (isSupabaseConfigured() && promise.remoteId) {
    try {
      const roast = await remote.fetchRoastMessage(id);
      if (roast) {
        return {
          ...promise,
          iToldYouSoMessage: roast.message,
          iToldYouSoFrom: roast.from,
        };
      }
    } catch {
      // Ignore and return local
    }
  }
  
  return promise;
}
