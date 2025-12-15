import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  cancelAllNotifications,
  cancelPromiseReminders,
  scheduleDailyCheckIn,
  schedulePromiseReminders,
} from '@/lib/notifications/scheduler';
import {
  clearAllPromises,
  listPromises,
  createPromise as repoCreatePromise,
  deletePromise as repoDeletePromise,
  setPromiseStatus as repoSetPromiseStatus,
  updatePromise as repoUpdatePromise,
} from '@/lib/promises/repo';
import type { CreatePromiseInput, PromiseStatus, PromiseUpdate, UserPromise } from '@/lib/promises/types';
import { clearWidgetData, syncToWidget } from '@/lib/widgets';

type PromiseStore = {
  promises: UserPromise[];
  isHydrated: boolean;
  isWorking: boolean;

  refresh: () => Promise<void>;
  createPromise: (input: CreatePromiseInput) => Promise<UserPromise>;
  updatePromise: (id: string, patch: PromiseUpdate) => Promise<UserPromise | null>;
  setPromiseStatus: (id: string, status: PromiseStatus) => Promise<UserPromise | null>;
  deletePromise: (id: string) => Promise<boolean>;
  clearAll: () => Promise<void>;
};

const PromiseStoreContext = createContext<PromiseStore | null>(null);

export function PromiseStoreProvider({ children }: { children: ReactNode }) {
  const [promises, setPromises] = useState<UserPromise[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

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

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

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
      setPromises((prev) => [created, ...prev]);

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
      setPromises((prev) => prev.map((p) => (p.id === id ? updated : p)));

      // Cancel notifications when promise is resolved
      if (status === 'completed' || status === 'failed' || status === 'expired') {
        cancelPromiseReminders(id).catch(console.error);
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

  const value = useMemo<PromiseStore>(
    () => ({
      promises,
      isHydrated,
      isWorking,
      refresh,
      createPromise,
      updatePromise,
      setPromiseStatus,
      deletePromise,
      clearAll,
    }),
    [promises, isHydrated, isWorking, refresh, createPromise, updatePromise, setPromiseStatus, deletePromise, clearAll]
  );

  return <PromiseStoreContext.Provider value={value}>{children}</PromiseStoreContext.Provider>;
}

export function usePromiseStore(): PromiseStore {
  const ctx = useContext(PromiseStoreContext);
  if (!ctx) throw new Error('usePromiseStore must be used within PromiseStoreProvider');
  return ctx;
}


