export type PromiseStatus = 'active' | 'completed' | 'failed' | 'expired';

export type MoneyDestination = 'charity' | 'anti_charity' | 'friend' | 'oopsfee';

export interface UserPromise {
  id: string;
  text: string;
  stake: number;
  deadlineAt: number; // ms since epoch
  createdAt: number; // ms since epoch
  updatedAt: number; // ms since epoch
  status: PromiseStatus;

  moneyDestination: MoneyDestination;
  friendName?: string; // only when moneyDestination === 'friend'

  /** Local file:// URI to voice commitment recording */
  voiceNoteUri?: string;

  completedAt?: number;
  failedAt?: number;
  expiredAt?: number;

  /** Streak count at the time of completion */
  streakAtCompletion?: number;
}

// ─────────────────────────────────────────────────────────────
// STATS & RETENTION
// ─────────────────────────────────────────────────────────────

export interface UserStats {
  totalPromises: number;
  completed: number;
  failed: number;
  expired: number;
  successRate: number; // 0-100, completed / (completed + failed + expired)

  currentStreak: number; // Consecutive completions (no fails/expires between)
  longestStreak: number;

  totalAtRisk: number; // Lifetime $ wagered
  totalSaved: number; // $ saved by completing
  totalLost: number; // $ lost to failures/expires

  failureMultiplier: number; // Current escalation (1, 2, 4, 8... capped at 8)
  consecutiveCompletions: number; // Resets multiplier after 3

  lastCheckIn?: number; // ms timestamp of last check-in
  checkInStreak: number; // Consecutive daily check-ins
  missedCheckIns: number; // Consecutive missed check-ins (resets on check-in)
}

export interface CheckInRecord {
  date: string; // YYYY-MM-DD
  committed: boolean;
  promiseIds: string[]; // Active promises at check-in time
  timestamp: number; // ms since epoch
}

export type StreakBadgeLevel = 7 | 30 | 100;

export interface StreakBadge {
  level: StreakBadgeLevel;
  emoji: string;
  label: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export type CreatePromiseInput = {
  text: string;
  stake: number;
  deadlineAt: number;
  moneyDestination: MoneyDestination;
  friendName?: string;
  voiceNoteUri?: string;
};

export type PromiseUpdate = Partial<
  Pick<
    UserPromise,
    | 'text'
    | 'stake'
    | 'deadlineAt'
    | 'moneyDestination'
    | 'friendName'
    | 'voiceNoteUri'
    | 'status'
    | 'completedAt'
    | 'failedAt'
    | 'expiredAt'
    | 'streakAtCompletion'
  >
>;

// ─────────────────────────────────────────────────────────────
// FACTORIES
// ─────────────────────────────────────────────────────────────

export function createEmptyStats(): UserStats {
  return {
    totalPromises: 0,
    completed: 0,
    failed: 0,
    expired: 0,
    successRate: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalAtRisk: 0,
    totalSaved: 0,
    totalLost: 0,
    failureMultiplier: 1,
    consecutiveCompletions: 0,
    checkInStreak: 0,
    missedCheckIns: 0,
  };
}


