export type PromiseStatus = 'active' | 'completed' | 'failed' | 'expired';

export type MoneyDestination = 'charity' | 'anti_charity' | 'friend' | 'oopsfee';

// ─────────────────────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────────────────────

/** How the user proves they completed their promise */
export type VerificationType = 'honor' | 'photo' | 'partner' | 'healthkit' | 'location';

// ─────────────────────────────────────────────────────────────
// PARTNER VERIFICATION STATE (Supabase sync)
// ─────────────────────────────────────────────────────────────

/** Partner verification state machine */
export type PartnerState = 'awaiting' | 'approved' | 'rejected' | 'expired';

// ─────────────────────────────────────────────────────────────
// PAYMENT STATUS (Supabase sync)
// ─────────────────────────────────────────────────────────────

/** Payment processing status for failed promise charges */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'requires_action' | 'abandoned';

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

  // ─── Virality: Sponsor My Failure ───
  /** Additional $ added by sponsors betting against you */
  sponsorAmount?: number;
  /** Number of people who sponsored your potential failure */
  sponsorCount?: number;

  // ─── Virality: I Told You So ───
  /** Friend's roast message revealed on failure */
  iToldYouSoMessage?: string;
  /** Who wrote the roast */
  iToldYouSoFrom?: string;

  // ─── Verification ───
  /** How the user proves completion (defaults to 'honor' for backwards compat) */
  verificationType: VerificationType;
  /** Local file:// URI to photo proof (when verificationType === 'photo') */
  verificationProof?: string;
  /** Timestamp when verification was submitted */
  verificationTimestamp?: number;

  // ─── Partner Verification (Supabase sync) ───
  /** Partner verification state machine */
  partnerState?: PartnerState;
  /** Deadline for partner to respond (24h after user claims completion) */
  partnerDeadlineAt?: number;

  // ─── Payment Tracking (Supabase sync) ───
  /** Status of failure charge payment */
  paymentStatus?: PaymentStatus;
  /** Stripe client secret for SCA resolution in-app */
  paymentClientSecret?: string;

  // ─── Remote Sync ───
  /** Timestamp of last sync with Supabase */
  syncedAt?: number;
  /** Confirms promise exists on server (same as id) */
  remoteId?: string;
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
  // Virality fields (optional at creation, can be added later)
  sponsorAmount?: number;
  sponsorCount?: number;
  iToldYouSoMessage?: string;
  iToldYouSoFrom?: string;
  // Verification
  verificationType?: VerificationType; // Defaults to 'photo' in repo
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
    | 'sponsorAmount'
    | 'sponsorCount'
    | 'iToldYouSoMessage'
    | 'iToldYouSoFrom'
    | 'verificationType'
    | 'verificationProof'
    | 'verificationTimestamp'
    // Partner verification
    | 'partnerState'
    | 'partnerDeadlineAt'
    // Payment tracking
    | 'paymentStatus'
    | 'paymentClientSecret'
    // Sync
    | 'syncedAt'
    | 'remoteId'
  >
>;

// ─────────────────────────────────────────────────────────────
// USER PAYMENT STATE (from profile)
// ─────────────────────────────────────────────────────────────

/** User payment state from their profile */
export interface UserPaymentState {
  /** Whether user has a valid payment method on file */
  hasPaymentMethod: boolean;
  /** Whether user must resolve failed payments before creating new staked promises */
  paymentBlocked: boolean;
  /** Number of abandoned/failed payments */
  failedPaymentCount: number;
}

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


