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

  const friendName =
    typeof raw.friendName === 'string' && raw.friendName.trim().length > 0 ? raw.friendName.trim() : undefined;

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
  const iToldYouSoMessage =
    typeof raw.iToldYouSoMessage === 'string' && raw.iToldYouSoMessage.length > 0 ? raw.iToldYouSoMessage : undefined;
  const iToldYouSoFrom =
    typeof raw.iToldYouSoFrom === 'string' && raw.iToldYouSoFrom.length > 0 ? raw.iToldYouSoFrom : undefined;

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
    friendName: moneyDestination === 'friend' ? friendName : undefined,
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
    iToldYouSoMessage,
    iToldYouSoFrom,
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

function generateId(): string {
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
    friendName: input.moneyDestination === 'friend' ? input.friendName?.trim() || undefined : undefined,
    voiceNoteUri: input.voiceNoteUri?.trim() || undefined,
    verificationType: input.verificationType ?? 'photo', // Default to photo for new promises
    sponsorAmount: input.sponsorAmount,
    sponsorCount: input.sponsorCount,
    iToldYouSoMessage: input.iToldYouSoMessage?.trim() || undefined,
    iToldYouSoFrom: input.iToldYouSoFrom?.trim() || undefined,
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
      next.friendName = undefined;
    } else if (typeof next.friendName === 'string') {
      const trimmed = next.friendName.trim();
      next.friendName = trimmed.length > 0 ? trimmed : undefined;
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


