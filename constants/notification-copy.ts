/**
 * Mean Notification Copy
 * Progressive roast messages that get increasingly passive-aggressive.
 * Variety prevents predictability. Tone stays dry, never preachy.
 */

// ─────────────────────────────────────────────────────────────
// DEADLINE REMINDERS
// Scheduled based on time remaining
// ─────────────────────────────────────────────────────────────

export const DEADLINE_REMINDERS = {
  /** 7 days before deadline */
  day7: [
    "Hey! Don't forget your promise 😊",
    "Friendly reminder: you made a promise. Remember promises?",
    "7 days left. Plenty of time to procrastinate and then panic.",
    "A week out. Still confident? Suspicious.",
    "Your promise is lonely. Visit it sometime.",
  ],

  /** 3 days before deadline */
  day3: [
    "Still haven't done it? Interesting.",
    "3 days. That's 72 hours. That's 4,320 minutes of opportunity.",
    "The deadline is getting closer. So is the payment.",
    "Three days left. Your future self is nervous.",
    "Tick tock. Your wallet is listening.",
  ],

  /** 1 day before deadline */
  day1: [
    "So we're really doing this huh?",
    "Tomorrow. That's it. That's the deadline.",
    "24 hours left. Your wallet is nervous.",
    "One day. One promise. One chance to not pay us.",
    "Tomorrow is deadline day. Classic last-minute energy incoming.",
  ],

  /** 6 hours before deadline */
  hour6: [
    "Time's running out. Classic you.",
    "6 hours. The window is closing.",
    "Half a workday left. Priorities, please.",
    "The clock isn't your friend right now.",
    "Six hours until consequences. How's that going?",
  ],

  /** 1 hour before deadline */
  hour1: [
    "🤡",
    "This is fine. Everything is fine.",
    "60 minutes. ${stake}. No pressure.",
    "An hour. That's one episode. Or one promise kept. Choose wisely.",
    "👀",
  ],

  /** At deadline */
  expired: [
    "It's done. You know what you did.",
    "Time's up. The deadline has passed.",
    "Well, that happened. Or didn't happen, rather.",
    "Deadline reached. Consequences pending.",
    "The moment of truth. Or payment. Same thing here.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// DAILY CHECK-IN REMINDERS
// Morning prompts to reaffirm commitment
// ─────────────────────────────────────────────────────────────

export const CHECKIN_REMINDERS = {
  /** First morning check-in prompt */
  morning: [
    "Still committed to your promise?",
    "Morning! Quick check: still on track?",
    "New day. Same promise. Still in?",
    "Your daily accountability moment.",
    "Rise and shine. Your promise didn't oversleep.",
  ],

  /** Missed yesterday's check-in */
  missedOne: [
    "You didn't check in yesterday. Avoiding something?",
    "Missing check-ins now? Interesting pattern.",
    "Yesterday's check-in? Nowhere to be found.",
    "We noticed you skipped yesterday. We always notice.",
    "One missed check-in. Not a big deal. Right?",
  ],

  /** Missed multiple check-ins */
  missedMultiple: [
    "{count} missed check-ins. That's concerning.",
    "You've been quiet lately. {count} check-ins missed.",
    "{count} days of silence. The promise is still there though.",
    "Ignoring us won't make the deadline go away. {count} missed.",
    "Radio silence: {count} days and counting.",
  ],

  /** Warning before auto-fail */
  autoFailWarning: [
    "One more missed check-in = auto-fail. Just saying.",
    "Check in or check out. One more miss and we decide for you.",
    "Final warning: 3 missed check-ins triggers auto-fail.",
    "The next skip costs you ${stake}. Your call.",
    "Last chance to check in before the app makes decisions.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// STAKE REMINDERS
// Periodic reminders of money on the line
// ─────────────────────────────────────────────────────────────

export const STAKE_REMINDERS = [
  "You have ${total} on the line right now.",
  "${total} at stake across your promises. No pressure.",
  "Current exposure: ${total}. Sleep well.",
  "Just a reminder: ${total} is riding on your word.",
  "Your promises are worth ${total}. Literally.",
] as const;

// ─────────────────────────────────────────────────────────────
// SUCCESS NOTIFICATIONS
// When they actually do the thing
// ─────────────────────────────────────────────────────────────

export const SUCCESS_NOTIFICATIONS = [
  "You did it! ${saved} saved. Rare, but nice.",
  "Promise kept. Wallet intact. Wild.",
  "Look at you, doing things you said you'd do.",
  "✓ Complete. Your future self sends thanks.",
  "${saved} stays in your pocket. Shocking development.",
] as const;

// ─────────────────────────────────────────────────────────────
// FAILURE NOTIFICATIONS
// When they don't
// ─────────────────────────────────────────────────────────────

export const FAILURE_NOTIFICATIONS = [
  "Promise broken. ${lost} goes to {destination}.",
  "That's a fail. ${lost} isn't yours anymore.",
  "Well, you tried. (Did you though?) ${lost} gone.",
  "Another one for the graveyard. ${lost} lost.",
  "The streak is dead. ${lost} has left the building.",
] as const;

// ─────────────────────────────────────────────────────────────
// STREAK NOTIFICATIONS
// Celebrating consistency (or mourning its absence)
// ─────────────────────────────────────────────────────────────

export const STREAK_NOTIFICATIONS = {
  milestone7: [
    "🔥 7-day streak! Week Warrior unlocked.",
    "A full week of kept promises. Are you feeling okay?",
    "7 in a row. The stats don't lie.",
  ],
  milestone30: [
    "⚡ 30-day streak! Monthly Monster achieved.",
    "30 consecutive wins. This is getting suspicious.",
    "A month of accountability. Your therapist approves.",
  ],
  milestone100: [
    "👑 100-day streak! You're Promise Royalty now.",
    "100. One hundred. That's commitment.",
    "Welcome to the 100 club. Population: rare.",
  ],
  streakBroken: [
    "Your {count}-day streak just ended. Starting over.",
    "Streak broken at {count}. The counter resets.",
    "From {count} to 0. Classic.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// MULTIPLIER WARNINGS
// When failure costs more than expected
// ─────────────────────────────────────────────────────────────

export const MULTIPLIER_NOTIFICATIONS = {
  activated: [
    "Failure tax activated: {multiplier}x on your next stakes.",
    "Your losses have escalated. {multiplier}x multiplier active.",
    "Stakes just got real. {multiplier}x penalty in effect.",
  ],
  increased: [
    "Multiplier increased to {multiplier}x. This is getting expensive.",
    "Another failure, another escalation. Now at {multiplier}x.",
    "Your failure tax is now {multiplier}x. Math is not on your side.",
  ],
  maxed: [
    "Maximum penalty: 8x. It doesn't get worse. But it's bad.",
    "You've hit rock bottom multiplier-wise. 8x active.",
    "8x multiplier. The system has run out of escalations.",
  ],
  reset: [
    "Multiplier reset! 3 wins in a row did the trick.",
    "Back to 1x. Your redemption arc worked.",
    "Clean slate. No more failure tax. Don't mess it up.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Pick a random message from an array.
 */
export function pickRandom<T>(messages: readonly T[]): T {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Format a message with variable replacements.
 * Supports: {variable}, ${amount} formats
 */
export function formatMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), `$${value}`);
  }
  return result;
}

/**
 * Get a deadline reminder message based on time remaining.
 */
export function getDeadlineReminder(
  hoursRemaining: number,
  vars: Record<string, string | number> = {}
): string {
  let tier: keyof typeof DEADLINE_REMINDERS;

  if (hoursRemaining <= 0) {
    tier = 'expired';
  } else if (hoursRemaining <= 1) {
    tier = 'hour1';
  } else if (hoursRemaining <= 6) {
    tier = 'hour6';
  } else if (hoursRemaining <= 24) {
    tier = 'day1';
  } else if (hoursRemaining <= 72) {
    tier = 'day3';
  } else {
    tier = 'day7';
  }

  const message = pickRandom(DEADLINE_REMINDERS[tier]);
  return formatMessage(message, vars);
}

/**
 * Get a check-in reminder based on missed count.
 */
export function getCheckInReminder(
  missedCount: number,
  vars: Record<string, string | number> = {}
): string {
  let messages: readonly string[];

  if (missedCount >= 2) {
    messages = CHECKIN_REMINDERS.missedMultiple;
    vars.count = missedCount;
  } else if (missedCount === 1) {
    messages = CHECKIN_REMINDERS.missedOne;
  } else {
    messages = CHECKIN_REMINDERS.morning;
  }

  return formatMessage(pickRandom(messages), vars);
}

