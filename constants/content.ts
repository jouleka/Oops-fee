/**
 * OopsFee Content & Copy
 * Dry humor, self-aware, not trying too hard
 */

// ─────────────────────────────────────────────────────────────
// ROTATING QUOTES
// Short, punchy, slightly uncomfortable truths
// ─────────────────────────────────────────────────────────────

export const ROTATING_QUOTES = [
  { text: "Your gym membership misses you.", icon: "🏋️" },
  { text: "That book won't read itself.", icon: "📚" },
  { text: "Your future self is taking notes.", icon: "📝" },
  { text: "Motivation expires. Money doesn't.", icon: "💵" },
  { text: "Free will has a price tag now.", icon: "🏷️" },
  { text: "Your excuses are free. For now.", icon: "⏳" },
  { text: "Willpower is overrated. Try cash.", icon: "💸" },
  { text: "Procrastination costs $0. Suspiciously cheap.", icon: "🤔" },
  { text: "Your comfort zone called. It's worried.", icon: "📞" },
  { text: "Tomorrow you starts today. Unfortunately.", icon: "📅" },
] as const;

// ─────────────────────────────────────────────────────────────
// QUICK TEMPLATES
// Common promises, realistic stakes, relatable
// ─────────────────────────────────────────────────────────────

export const PROMISE_TEMPLATES = [
  { id: "gym", text: "Hit the gym 3x this week", stake: 25, emoji: "💪" },
  { id: "alcohol", text: "No drinks for 7 days", stake: 20, emoji: "🍷" },
  { id: "morning", text: "Up before 7am tomorrow", stake: 10, emoji: "☀️" },
  { id: "social", text: "No doomscrolling until 6pm", stake: 15, emoji: "📵" },
  { id: "meditate", text: "10 min meditation daily", stake: 15, emoji: "🧘" },
  { id: "project", text: "Ship that thing by Friday", stake: 50, emoji: "🚀" },
] as const;

export type PromiseTemplate = (typeof PROMISE_TEMPLATES)[number];

// ─────────────────────────────────────────────────────────────
// THE GRAVEYARD
// Failed promises - short, tragic, relatable
// ─────────────────────────────────────────────────────────────

export const GRAVEYARD_ENTRIES = [
  { text: "Quit smoking", lasted: "3 days", lost: 25 },
  { text: "No fast food this month", lasted: "36 hours", lost: 20 },
  { text: "Study 2 hours daily", lasted: "1 day", lost: 30 },
  { text: "No Netflix until finals", lasted: "4 hours", lost: 15 },
  { text: "Dry January", lasted: "January 3rd", lost: 40 },
  { text: "Run every morning", lasted: "1 morning", lost: 25 },
] as const;

// ─────────────────────────────────────────────────────────────
// UI COPY
// Headers, labels, CTAs - dry but not cold
// ─────────────────────────────────────────────────────────────

export const COPY = {
  // Header
  headerTitle: "Your promises",
  headerSubtitle: "Keep your word. Or don't. Your wallet.",

  // Stake counter
  stakeLabel: "ON THE LINE",
  stakeEmpty: "Nothing yet. Suspicious.",
  stakeActive: "No pressure.",

  // Templates section
  templatesTitle: "PICK YOUR POISON",
  templatesSubtitle: "Or make your own. We don't judge. Much.",

  // Graveyard
  graveyardTitle: "THE GRAVEYARD",
  graveyardWarning: "You don't want to end up here.",

  // Social proof (number injected dynamically)
  socialProofSuffix: "people putting money where their mouth is",

  // Empty state footer
  footerPrimary: "Still scrolling?",
  footerSecondary: "Bold strategy.",

  // Dev footer
  version: "v0.1.0",
  tagline: "Built with accountability issues",
} as const;

// ─────────────────────────────────────────────────────────────
// FAKE SOCIAL PROOF
// Will be real eventually
// ─────────────────────────────────────────────────────────────

export function getLiveBettorCount(): number {
  // Base + slight randomness so it feels "live"
  return 1247 + Math.floor(Math.random() * 200);
}

// ─────────────────────────────────────────────────────────────
// STREAK BADGES
// Milestones worth celebrating. Theoretically achievable.
// ─────────────────────────────────────────────────────────────

export const STREAK_BADGES = [
  {
    level: 7 as const,
    emoji: "🔥",
    label: "Week Warrior",
    description: "7 promises kept in a row",
    lockedHint: "Complete 7 promises in a row. Theoretically possible.",
  },
  {
    level: 30 as const,
    emoji: "⚡",
    label: "Monthly Monster",
    description: "30 promises kept in a row",
    lockedHint: "30 in a row. Some say it's been done.",
  },
  {
    level: 100 as const,
    emoji: "👑",
    label: "Promise Royalty",
    description: "100 promises kept in a row",
    lockedHint: "100 consecutive. Legend has it...",
  },
] as const;

export type StreakBadgeConfig = (typeof STREAK_BADGES)[number];

// ─────────────────────────────────────────────────────────────
// STATS COPY
// For the stats dashboard
// ─────────────────────────────────────────────────────────────

export const STATS_COPY = {
  // Page header
  title: "The Numbers",
  subtitle: "A numerical summary of your commitment issues.",

  // Empty state
  emptyTitle: "No stats yet.",
  emptySubtitle: "Bold of you to check before doing anything.",

  // Streak section
  streakTitle: "CURRENT STREAK",
  streakEmpty: "0. Fresh start or fresh failure?",
  streakActive: "Don't mess this up.",

  // Success rate interpretations
  successHigh: "You're actually doing it. Suspicious.",
  successMedium: "Room for improvement. (A lot of room.)",
  successLow: "Your wallet is funding our coffee fund.",
  successNone: "We appreciate your financial support.",

  // Failure multiplier warnings
  multiplierTitle: "FAILURE TAX",
  multiplier1x: "No penalty. Yet.",
  multiplier2x: "Last time didn't go well. Stakes doubled.",
  multiplier4x: "Third strike territory. This will hurt.",
  multiplier8x: "This is what rock bottom looks like in app form.",
  multiplierReset: "Complete {n} more to reset your multiplier.",

  // Check-in streak
  checkInTitle: "CHECK-IN STREAK",
  checkInEmpty: "No check-ins yet. We'll remind you.",
  checkInActive: "Your therapist would be proud.",

  // Badges section
  badgesTitle: "BADGES",
  badgesSubtitle: "Collect them all. (Nobody has.)",
} as const;

// ─────────────────────────────────────────────────────────────
// SUCCESS CELEBRATION COPY
// For when they actually do the thing
// ─────────────────────────────────────────────────────────────

export const SUCCESS_COPY = {
  titles: [
    "You actually did it.",
    "Wait, really?",
    "Look at you go.",
    "Against all odds.",
    "The prophecy fulfilled.",
  ],
  subtitles: [
    "Your wallet survives another day.",
    "We believed in you. Mostly.",
    "Your future self is typing a thank you note.",
    "Statistically improbable. Yet here we are.",
    "We had our doubts. You proved us... adequate.",
  ],
  sharePrompt: "Brag about it",
  shareCard: "I bet ${amount} I'd {promise} and I did it 💪",
  streakNote: "🔥 Streak: {count} in a row",
  continueButton: "Back to reality",
} as const;

// ─────────────────────────────────────────────────────────────
// CHECK-IN COPY
// Daily commitment confirmation
// ─────────────────────────────────────────────────────────────

export const CHECKIN_COPY = {
  title: "Still committed?",
  subtitle: "Daily sanity check. Tap honestly.",
  
  // Button labels
  yesButton: "Yes, I'm on it",
  noButton: "Actually, I failed",
  
  // After check-in
  confirmed: "Noted. Don't make us look foolish.",
  failed: "Honesty. Rare but appreciated.",
  
  // Streak messages
  streakPrefix: "Check-in streak:",
  streakSuffix: "days",
  
  // Missed check-in warnings
  missedYesterday: "You didn't check in yesterday. Avoiding something?",
  missedMultiple: "You've missed {n} check-ins. That's concerning.",
  autoFailWarning: "3 missed check-ins = auto-fail",
} as const;
