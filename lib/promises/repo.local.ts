/**
 * Local Promise Repository
 * 
 * Handles all AsyncStorage operations for promises.
 * This is the primary storage for offline-first UX.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CreatePromiseInput, MoneyDestination, PromiseStatus, PromiseUpdate, UserPromise, VerificationType } from './types';

const STORAGE_KEY = 'oopsfee.promises.v1';
const STORAGE_VERSION = 1 as const;

type StoredStateV1 = {
  version: typeof STORAGE_VERSION;
  promises: UserPromise[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function coercePromise(raw: unknown): UserPromise | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  const text = typeof raw.text === 'string' ? raw.text : null;
  const stake = typeof raw.stake === 'number' ? raw.stake : null;
  const deadlineAt = typeof raw.deadlineAt === 'number' ? raw.deadlineAt : null;
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : null;
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : null;
  const status = typeof raw.status === 'string' ? (raw.status as PromiseStatus) : null;

  if (!id || !text || stake === null || deadlineAt === null || createdAt === null || updatedAt === null || !status) {
    return null;
  }

  // Backwards-compatible: old promises won't have destination fields.
  const moneyDestinationRaw = typeof raw.moneyDestination === 'string' ? raw.moneyDestination : null;
  const moneyDestination: MoneyDestination =
    moneyDestinationRaw === 'charity' ||
    moneyDestinationRaw === 'anti_charity' ||
    moneyDestinationRaw === 'friend' ||
    moneyDestinationRaw === 'oopsfee'
      ? moneyDestinationRaw
      : 'oopsfee';

  const friendUserId =
    typeof raw.friendUserId === 'string' && raw.friendUserId.length > 0 ? raw.friendUserId : undefined;
  const friendName =
    typeof raw.friendName === 'string' && raw.friendName.trim().length > 0 ? raw.friendName.trim() : undefined;
  const friendEmail =
    typeof raw.friendEmail === 'string' && raw.friendEmail.trim().length > 0 ? raw.friendEmail.trim() : undefined;

  const completedAt = typeof raw.completedAt === 'number' ? raw.completedAt : undefined;
  const failedAt = typeof raw.failedAt === 'number' ? raw.failedAt : undefined;
  const expiredAt = typeof raw.expiredAt === 'number' ? raw.expiredAt : undefined;
  const voiceNoteUri =
    typeof raw.voiceNoteUri === 'string' && raw.voiceNoteUri.length > 0 ? raw.voiceNoteUri : undefined;
  const streakAtCompletion = typeof raw.streakAtCompletion === 'number' ? raw.streakAtCompletion : undefined;

  // Verification fields - backwards compatible (default to 'honor' for old promises)
  const verificationTypeRaw = typeof raw.verificationType === 'string' ? raw.verificationType : null;
  const verificationType: VerificationType =
    verificationTypeRaw === 'honor' ||
    verificationTypeRaw === 'photo' ||
    verificationTypeRaw === 'partner' ||
    verificationTypeRaw === 'healthkit' ||
    verificationTypeRaw === 'location'
      ? verificationTypeRaw
      : 'honor'; // Default for old promises without verification
  const verificationProof =
    typeof raw.verificationProof === 'string' && raw.verificationProof.length > 0 ? raw.verificationProof : undefined;
  const verificationTimestamp = typeof raw.verificationTimestamp === 'number' ? raw.verificationTimestamp : undefined;

  // Virality fields
  const sponsorAmount = typeof raw.sponsorAmount === 'number' ? raw.sponsorAmount : undefined;
  const sponsorCount = typeof raw.sponsorCount === 'number' ? raw.sponsorCount : undefined;
  const iToldYouSoMessages = Array.isArray(raw.iToldYouSoMessages)
    ? (raw.iToldYouSoMessages as Array<{ message: string; from: string }>).filter(
        (m) => typeof m.message === 'string' && typeof m.from === 'string'
      )
    : undefined;

  // Partner verification fields
  const partnerStateRaw = typeof raw.partnerState === 'string' ? raw.partnerState : null;
  const partnerState =
    partnerStateRaw === 'awaiting' || partnerStateRaw === 'approved' || partnerStateRaw === 'rejected' || partnerStateRaw === 'expired'
      ? partnerStateRaw
      : undefined;
  const partnerDeadlineAt = typeof raw.partnerDeadlineAt === 'number' ? raw.partnerDeadlineAt : undefined;

  // Payment fields
  const paymentStatusRaw = typeof raw.paymentStatus === 'string' ? raw.paymentStatus : null;
  const paymentStatus =
    paymentStatusRaw === 'pending' ||
    paymentStatusRaw === 'succeeded' ||
    paymentStatusRaw === 'failed' ||
    paymentStatusRaw === 'requires_action' ||
    paymentStatusRaw === 'abandoned'
      ? paymentStatusRaw
      : undefined;
  const paymentClientSecret =
    typeof raw.paymentClientSecret === 'string' && raw.paymentClientSecret.length > 0 ? raw.paymentClientSecret : undefined;

  // Sync fields
  const syncedAt = typeof raw.syncedAt === 'number' ? raw.syncedAt : undefined;
  const remoteId = typeof raw.remoteId === 'string' && raw.remoteId.length > 0 ? raw.remoteId : undefined;

  // Free pass
  const usesFreePass = typeof raw.usesFreePass === 'boolean' ? raw.usesFreePass : undefined;

  if (!['active', 'completed', 'failed', 'expired'].includes(status)) return null;

  return {
    id,
    text,
    stake,
    deadlineAt,
    createdAt,
    updatedAt,
    status,
    moneyDestination,
    friendUserId: moneyDestination === 'friend' ? friendUserId : undefined,
    friendName: moneyDestination === 'friend' ? friendName : undefined,
    friendEmail: moneyDestination === 'friend' ? friendEmail : undefined,
    voiceNoteUri,
    completedAt,
    failedAt,
    expiredAt,
    streakAtCompletion,
    verificationType,
    verificationProof,
    verificationTimestamp,
    sponsorAmount,
    sponsorCount,
    iToldYouSoMessages,
    partnerState,
    partnerDeadlineAt,
    paymentStatus,
    paymentClientSecret,
    usesFreePass,
    syncedAt,
    remoteId,
  };
}

function normalizeState(raw: unknown): StoredStateV1 {
  if (!isRecord(raw)) return { version: STORAGE_VERSION, promises: [] };
  const version = raw.version;
  const promises = raw.promises;

  if (version !== STORAGE_VERSION || !Array.isArray(promises)) {
    return { version: STORAGE_VERSION, promises: [] };
  }

  const coerced = promises.map(coercePromise).filter(Boolean) as UserPromise[];
  return { version: STORAGE_VERSION, promises: coerced };
}

export function reconcileExpired(promises: UserPromise[], now: number = Date.now()): { promises: UserPromise[]; didChange: boolean } {
  let didChange = false;

  const next = promises.map((p) => {
    if (p.status !== 'active') return p;
    if (p.deadlineAt > now) return p;

    didChange = true;
    return {
      ...p,
      status: 'expired' as const,
      expiredAt: now,
      updatedAt: now,
    };
  });

  return { promises: next, didChange };
}

export function generateId(): string {
  // Good enough for local-first MVP. If you collide, buy a lottery ticket.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readState(): Promise<StoredStateV1> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = safeParseJson(raw);
  return normalizeState(parsed);
}

async function writeState(state: StoredStateV1): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function listPromises(): Promise<UserPromise[]> {
  const state = await readState();
  const { promises, didChange } = reconcileExpired(state.promises);
  if (didChange) await writeState({ version: STORAGE_VERSION, promises });
  return promises;
}

export async function getPromiseById(id: string): Promise<UserPromise | null> {
  const all = await listPromises();
  return all.find((p) => p.id === id) ?? null;
}

export async function createPromise(input: CreatePromiseInput): Promise<UserPromise> {
  const now = Date.now();
  const text = input.text.trim();

  const promise: UserPromise = {
    id: generateId(),
    text,
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
    verificationType: input.verificationType ?? 'photo', // Default to photo for new promises
    sponsorAmount: input.sponsorAmount,
    sponsorCount: input.sponsorCount,
    usesFreePass: input.usesFreePass ?? undefined,
  };

  const state = await readState();
  const next = { version: STORAGE_VERSION, promises: [promise, ...state.promises] };
  await writeState(next);
  return promise;
}

export async function updatePromise(id: string, patch: PromiseUpdate): Promise<UserPromise | null> {
  const now = Date.now();
  const state = await readState();

  let updated: UserPromise | null = null;

  const promises = state.promises.map((p) => {
    if (p.id !== id) return p;

    const next: UserPromise = {
      ...p,
      ...patch,
      updatedAt: now,
    };

    // Keep destination fields coherent.
    if (next.moneyDestination !== 'friend') {
      next.friendUserId = undefined;
      next.friendName = undefined;
      next.friendEmail = undefined;
    } else {
      // friendUserId is a UUID, don't trim
      if (typeof next.friendUserId === 'string' && next.friendUserId.length === 0) {
        next.friendUserId = undefined;
      }
      if (typeof next.friendName === 'string') {
        const trimmed = next.friendName.trim();
        next.friendName = trimmed.length > 0 ? trimmed : undefined;
      }
      if (typeof next.friendEmail === 'string') {
        const trimmed = next.friendEmail.trim();
        next.friendEmail = trimmed.length > 0 ? trimmed : undefined;
      }
    }

    // Keep timestamps coherent.
    if (next.status === 'completed' && !next.completedAt) next.completedAt = now;
    if (next.status === 'failed' && !next.failedAt) next.failedAt = now;
    if (next.status === 'expired' && !next.expiredAt) next.expiredAt = now;

    updated = next;
    return next;
  });

  if (!updated) return null;

  const reconciled = reconcileExpired(promises, now).promises;
  await writeState({ version: STORAGE_VERSION, promises: reconciled });
  return updated;
}

export async function setPromiseStatus(id: string, status: PromiseStatus): Promise<UserPromise | null> {
  const now = Date.now();
  const patch: PromiseUpdate = { status };
  if (status === 'completed') patch.completedAt = now;
  if (status === 'failed') patch.failedAt = now;
  if (status === 'expired') patch.expiredAt = now;
  return updatePromise(id, patch);
}

export async function deletePromise(id: string): Promise<boolean> {
  const state = await readState();
  const before = state.promises.length;
  const promises = state.promises.filter((p) => p.id !== id);
  if (promises.length === before) return false;
  await writeState({ version: STORAGE_VERSION, promises });
  return true;
}

export async function clearAllPromises(): Promise<void> {
  await writeState({ version: STORAGE_VERSION, promises: [] });
}

/**
 * Atomically replace all promises in storage.
 * Unlike clear + bulkUpsert, this is a single write operation.
 */
export async function replaceAllPromises(promises: UserPromise[]): Promise<void> {
  const sorted = [...promises].sort((a, b) => b.createdAt - a.createdAt);
  await writeState({ version: STORAGE_VERSION, promises: sorted });
}

/**
 * Upsert a promise into local storage (used for sync merges)
 * If the promise exists, updates it. If not, inserts it.
 */
export async function upsertPromise(promise: UserPromise): Promise<void> {
  const state = await readState();
  const existingIndex = state.promises.findIndex((p) => p.id === promise.id);
  
  let promises: UserPromise[];
  if (existingIndex >= 0) {
    promises = [...state.promises];
    promises[existingIndex] = promise;
  } else {
    promises = [promise, ...state.promises];
  }
  
  await writeState({ version: STORAGE_VERSION, promises });
}

/**
 * Bulk upsert promises (for initial sync)
 */
export async function bulkUpsertPromises(incoming: UserPromise[]): Promise<void> {
  const state = await readState();
  const promiseMap = new Map<string, UserPromise>();
  
  // First add all existing local promises
  for (const p of state.promises) {
    promiseMap.set(p.id, p);
  }
  
  // Then upsert incoming (they take precedence when merging happens separately)
  for (const p of incoming) {
    promiseMap.set(p.id, p);
  }
  
  const promises = Array.from(promiseMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  await writeState({ version: STORAGE_VERSION, promises });
}

