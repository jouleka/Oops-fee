import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { PartnerNotification, type PartnerNotificationType } from '@/components/notifications';
import { SettlementToast, type SettlementType } from '@/components/ui/SettlementToast';
import { formatMessage, MOMENTUM_NOTIFICATIONS, pickRandom } from '@/constants/notification-copy';
import {
  cancelAllNotifications,
  cancelPromiseReminders,
  checkStreakMilestone,
  scheduleDailyCheckIn,
  schedulePromiseReminders,
  sendImmediateNotification,
} from '@/lib/notifications/scheduler';
import {
  clearAllPromises,
  listPromises,
  createPromise as repoCreatePromise,
  deletePromise as repoDeletePromise,
  setPromiseStatus as repoSetPromiseStatus,
  updatePromise as repoUpdatePromise,
} from '@/lib/promises/repo';
import { performFullSync, subscribeToPromiseChanges } from '@/lib/promises/sync';
import type { CreatePromiseInput, PromiseStatus, PromiseUpdate, UserPromise } from '@/lib/promises/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { clearCheckIns } from '@/lib/stats/store';
import { clearWidgetData, syncToWidget } from '@/lib/widgets';

import { useAuth } from './auth';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Computes current streak by looking at promises sorted by completion time.
 * A streak breaks when there's a failure or expiration.
 */
function computeCurrentStreak(promises: UserPromise[]): number {
  const sorted = [...promises]
    .filter((p) => p.status === 'completed' || p.status === 'failed' || p.status === 'expired')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  let streak = 0;
  for (const p of sorted) {
    if (p.status === 'completed') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// Partner notification state type
export interface PartnerNotificationData {
  visible: boolean;
  type: PartnerNotificationType;
  promiseText: string;
  stake: number;
}

type PromiseStore = {
  promises: UserPromise[];
  isHydrated: boolean;
  isWorking: boolean;
  isSyncing: boolean;
  
  // Partner notification
  partnerNotification: PartnerNotificationData;
  dismissPartnerNotification: () => void;

  refresh: () => Promise<void>;
  syncWithRemote: () => Promise<void>;
  createPromise: (input: CreatePromiseInput) => Promise<UserPromise>;
  updatePromise: (id: string, patch: PromiseUpdate) => Promise<UserPromise | null>;
  setPromiseStatus: (id: string, status: PromiseStatus) => Promise<UserPromise | null>;
  deletePromise: (id: string) => Promise<boolean>;
  clearAll: () => Promise<void>;
};

const PromiseStoreContext = createContext<PromiseStore | null>(null);

// Notification state for partner verification
interface PartnerNotificationState {
  visible: boolean;
  type: PartnerNotificationType;
  promiseText: string;
  stake: number;
}

// Settlement notification state
interface SettlementNotificationState {
  visible: boolean;
  type: SettlementType;
  promiseText: string;
  stake: number;
}

export function PromiseStoreProvider({ children }: { children: ReactNode }) {
  const [promises, setPromises] = useState<UserPromise[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Partner notification state
  const [partnerNotification, setPartnerNotification] = useState<PartnerNotificationState>({
    visible: false,
    type: 'approved',
    promiseText: '',
    stake: 0,
  });
  
  // Settlement notification state
  const [settlementNotification, setSettlementNotification] = useState<SettlementNotificationState>({
    visible: false,
    type: 'charged',
    promiseText: '',
    stake: 0,
  });
  
  const { user, isAuthenticated } = useAuth();
  const promisesRef = useRef<UserPromise[]>([]);
  const wasAuthenticatedRef = useRef(false);
  
  // Keep ref in sync for realtime callback
  useEffect(() => {
    promisesRef.current = promises;
  }, [promises]);
  
  // Clear all local data when user signs out to prevent data leaking to next user
  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated) {
      // User just signed out - clear everything synchronously
      console.log('[PromiseStore] User signed out, clearing local data');
      Promise.all([
        clearAllPromises(),
        clearCheckIns(),
        clearWidgetData(),
        cancelAllNotifications(),
      ]).catch(console.error);
      setPromises([]);
      // Keep isHydrated true but with empty data - we're "hydrated" with nothing
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    setIsWorking(true);
    try {
      const all = await listPromises();
      setPromises(all);
    } finally {
      setIsHydrated(true);
      setIsWorking(false);
    }
  }, []);
  
  const syncWithRemote = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.id) return;
    
    setIsSyncing(true);
    try {
      // Skip syncing local-only promises - they may belong to a previous user
      // Just fetch from server and replace local state entirely
      const merged = await performFullSync(user.id);
      setPromises(merged);
    } catch (error) {
      console.error('[PromiseStore] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id]);

  // Initial hydration - run on mount and when user changes
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, user?.id]);
  
  // Sync when user signs in
  useEffect(() => {
    if (isAuthenticated && user?.id && isHydrated) {
      syncWithRemote().catch(console.error);
    }
  }, [isAuthenticated, user?.id, isHydrated, syncWithRemote]);
  
  // Subscribe to realtime changes when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !isSupabaseConfigured()) {
      return;
    }
    
    const unsubscribe = subscribeToPromiseChanges(
      user.id,
      () => promisesRef.current,
      (type, promise, promiseId) => {
        if (type === 'delete') {
          setPromises(prev => prev.filter(p => p.id !== promiseId));
        } else if (promise) {
          // Check for partner state changes to show notification
          const oldPromise = promisesRef.current.find(p => p.id === promise.id);
          
          console.log('[PromiseStore] Realtime update - old partnerState:', oldPromise?.partnerState, 'new partnerState:', promise.partnerState);
          
          // Partner verification completed - show custom notification
          if (oldPromise?.partnerState === 'awaiting' && promise.partnerState !== 'awaiting') {
            console.log('[PromiseStore] Partner verification completed! Showing notification for:', promise.partnerState);
            if (promise.partnerState === 'approved' || promise.partnerState === 'rejected') {
              setPartnerNotification({
                visible: true,
                type: promise.partnerState,
                promiseText: promise.text,
                stake: promise.stake,
              });
            }
          }
          
          // Settlement notification - promise was charged or payment failed
          if (oldPromise?.status === 'active' && promise.status === 'failed') {
            console.log('[PromiseStore] Promise settled! Payment status:', promise.paymentStatus);
            const settlementType: SettlementType = 
              promise.paymentStatus === 'succeeded' ? 'charged' :
              promise.paymentStatus === 'failed' ? 'failed' :
              promise.paymentStatus === 'requires_action' ? 'requires_action' :
              promise.paymentStatus === 'abandoned' ? 'abandoned' : 'charged';
            
            setSettlementNotification({
              visible: true,
              type: settlementType,
              promiseText: promise.text,
              stake: promise.stake,
            });
          }
          
          setPromises(prev => {
            const existingIndex = prev.findIndex(p => p.id === promise.id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = promise;
              return updated;
            } else {
              // New promise from server - add at appropriate position
              return [promise, ...prev].sort((a, b) => b.createdAt - a.createdAt);
            }
          });
        }
      }
    );
    
    return unsubscribe;
  }, [isAuthenticated, user?.id]);

  // Sync to iOS widget whenever promises change
  const didHydrate = useRef(false);
  useEffect(() => {
    if (!isHydrated) return;
    
    // Only sync after initial hydration
    if (!didHydrate.current) {
      didHydrate.current = true;
    }
    
    // Sync promises to widget
    syncToWidget(promises).catch(console.error);
  }, [promises, isHydrated]);

  const createPromise = useCallback(async (input: CreatePromiseInput) => {
    setIsWorking(true);
    try {
      const created = await repoCreatePromise(input);
      // Add to state, but avoid duplicates (realtime might beat us)
      setPromises((prev) => {
        if (prev.some(p => p.id === created.id)) {
          return prev.map(p => p.id === created.id ? created : p);
        }
        return [created, ...prev];
      });

      // Schedule notifications for this promise
      schedulePromiseReminders(created).catch(console.error);

      // Ensure daily check-in is scheduled if we have active promises
      scheduleDailyCheckIn().catch(console.error);

      return created;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const updatePromise = useCallback(async (id: string, patch: PromiseUpdate) => {
    setIsWorking(true);
    try {
      const updated = await repoUpdatePromise(id, patch);
      if (!updated) return null;
      setPromises((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const setPromiseStatus = useCallback(async (id: string, status: PromiseStatus) => {
    setIsWorking(true);
    try {
      const updated = await repoSetPromiseStatus(id, status);
      if (!updated) return null;
      
      // Get merged promises list for streak calculation
      const mergedPromises = promisesRef.current.map((p) => (p.id === id ? updated : p));
      setPromises(mergedPromises);

      // Cancel notifications when promise is resolved
      if (status === 'completed' || status === 'failed' || status === 'expired') {
        cancelPromiseReminders(id).catch(console.error);
      }

      // Check for streak milestones on completion
      if (status === 'completed') {
        // Compute previous streak (before this completion)
        const previousStreak = computeCurrentStreak(promisesRef.current);
        const currentStreak = computeCurrentStreak(mergedPromises);
        
        checkStreakMilestone(currentStreak).catch(console.error);
        
        // Comeback notification: first win after a failure
        const hadPreviousFailure = promisesRef.current.some(
          (p) => (p.status === 'failed' || p.status === 'expired') && p.id !== id
        );
        if (previousStreak === 0 && currentStreak === 1 && hadPreviousFailure) {
          sendImmediateNotification(
            '💪 Redemption Arc',
            pickRandom(MOMENTUM_NOTIFICATIONS.comeback),
            { type: 'comeback', promiseId: updated.id }
          ).catch(console.error);
        }
        
        // Near-miss celebration: completed with less than 2 hours to spare
        const hoursRemaining = (updated.deadlineAt - Date.now()) / (1000 * 60 * 60);
        if (hoursRemaining > 0 && hoursRemaining < 2) {
          sendImmediateNotification(
            '😅 Photo Finish!',
            formatMessage(pickRandom(MOMENTUM_NOTIFICATIONS.nearMiss), {
              amount: updated.stake,
              hours: Math.max(1, Math.round(hoursRemaining)),
            }),
            { type: 'near_miss', promiseId: updated.id }
          ).catch(console.error);
        }
      }

      return updated;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const deletePromise = useCallback(async (id: string) => {
    setIsWorking(true);
    try {
      const ok = await repoDeletePromise(id);
      if (ok) {
        setPromises((prev) => prev.filter((p) => p.id !== id));
        // Cancel any scheduled notifications for this promise
        cancelPromiseReminders(id).catch(console.error);
      }
      return ok;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    setIsWorking(true);
    try {
      // Cancel all scheduled notifications before clearing promises
      await cancelAllNotifications();
      await clearAllPromises();
      // Clear widget data
      await clearWidgetData();
      setPromises([]);
    } finally {
      setIsWorking(false);
    }
  }, []);

  const dismissPartnerNotification = useCallback(() => {
    setPartnerNotification(prev => ({ ...prev, visible: false }));
  }, []);
  
  const dismissSettlementNotification = useCallback(() => {
    setSettlementNotification(prev => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo<PromiseStore>(
    () => ({
      promises,
      isHydrated,
      isWorking,
      isSyncing,
      partnerNotification,
      dismissPartnerNotification,
      refresh,
      syncWithRemote,
      createPromise,
      updatePromise,
      setPromiseStatus,
      deletePromise,
      clearAll,
    }),
    [promises, isHydrated, isWorking, isSyncing, partnerNotification, dismissPartnerNotification, refresh, syncWithRemote, createPromise, updatePromise, setPromiseStatus, deletePromise, clearAll]
  );

  return (
    <PromiseStoreContext.Provider value={value}>
      {children}
      <PartnerNotification
        visible={partnerNotification.visible}
        type={partnerNotification.type}
        promiseText={partnerNotification.promiseText}
        stake={partnerNotification.stake}
        onDismiss={dismissPartnerNotification}
      />
      <SettlementToast
        visible={settlementNotification.visible}
        type={settlementNotification.type}
        promiseText={settlementNotification.promiseText}
        stake={settlementNotification.stake}
        onDismiss={dismissSettlementNotification}
      />
    </PromiseStoreContext.Provider>
  );
}

export function usePromiseStore(): PromiseStore {
  const ctx = useContext(PromiseStoreContext);
  if (!ctx) throw new Error('usePromiseStore must be used within PromiseStoreProvider');
  return ctx;
}