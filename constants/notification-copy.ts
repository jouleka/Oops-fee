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
// SETTLEMENT NOTIFICATIONS (Push from backend)
// When the settlement cron charges for failed promises
// ─────────────────────────────────────────────────────────────

export const SETTLEMENT_NOTIFICATIONS = {
  /** Successful charge after promise failure */
  chargeSuccess: [
    '💸 You lost ${amount}',
    '${amount} gone. Promise broken.',
    "That's ${amount} you won't see again.",
    'Promise failed. ${amount} charged.',
    'The wallet remembers: -${amount}.',
  ],

  /** Payment failed (card declined, etc.) */
  chargeFailed: [
    '⚠️ Payment failed for "${promise}"',
    "We couldn't charge ${amount}. Card issue.",
    'Payment declined. ${amount} still owed.',
    'Your card said no to ${amount}.',
    'Failed charge: ${amount}. Check your card.',
  ],

  /** SCA/3DS required - user must authenticate */
  requiresAction: [
    '🔐 Action needed: ${amount} charge',
    'Your bank needs confirmation for ${amount}.',
    'Authenticate the ${amount} payment in the app.',
    '${amount} charge pending your approval.',
    'One more step: confirm ${amount} payment.',
  ],

  /** Payment abandoned after max retries */
  paymentAbandoned: [
    '🚫 ${amount} charge abandoned. Account restricted.',
    "Couldn't collect ${amount}. Your account is blocked.",
    'Payment failed permanently. New stakes disabled.',
    '${amount} uncollected. Account frozen.',
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// RE-ENGAGEMENT NOTIFICATIONS
// Bring users back after inactivity (psychology: loss aversion + FOMO)
// ─────────────────────────────────────────────────────────────

export const REENGAGEMENT_NOTIFICATIONS = {
  /** 3 days inactive - gentle nudge */
  day3: [
    "Miss us? Your accountability partner is waiting.",
    "3 days without a promise. What are you working on?",
    "Your streak reset. Ready to start a new one?",
    "Promises kept this week: 0. That's unlike you.",
  ],

  /** 7 days inactive - loss framing */
  day7: [
    "A week without commitments. Playing it safe?",
    "7 days off. Sometimes we all need a break. Ready to come back?",
    "Your future self is wondering where you went.",
    "No stakes, no skin in the game. Miss the pressure?",
  ],

  /** 14 days inactive - identity challenge */
  day14: [
    "Remember when you were someone who kept promises?",
    "Two weeks. The app misses your ambition.",
    "Still there? One small promise can restart everything.",
    "Your accountability muscle is getting weak.",
  ],

  /** 30 days inactive - fresh start framing */
  day30: [
    "New month, clean slate. What will you commit to?",
    "30 days is a long time. Ready for a comeback?",
    "One promise. That's all it takes to restart.",
    "We saved your spot. Welcome back anytime.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// MOMENTUM NOTIFICATIONS
// Celebrate wins and build identity (psychology: positive reinforcement)
// ─────────────────────────────────────────────────────────────

export const MOMENTUM_NOTIFICATIONS = {
  /** Weekly summary - positive framing */
  weeklySummary: [
    "This week: {kept} kept, {failed} failed, ${saved} saved. Not bad.",
    "Weekly stats: {kept}/{total} promises kept. ${saved} in your pocket.",
    "You kept {kept} promises this week. Your past self would be proud.",
    "{kept} wins this week. The streak continues.",
  ],

  /** Money saved milestone */
  moneySaved: [
    "💰 You've saved ${total} by keeping promises. That's real money.",
    "${total} saved lifetime. Accountability pays.",
    "If you'd failed everything, you'd be down ${total}. Nice work.",
    "${total} kept in your pocket. Self-discipline has a price tag.",
  ],

  /** Near-miss celebration (completed just before deadline) */
  nearMiss: [
    "😅 Close call! You saved ${amount} with {hours} hours to spare.",
    "Cutting it close! ${amount} saved at the last minute.",
    "Photo finish! ${amount} stays in your wallet.",
    "That was tight. ${amount} saved. Maybe start earlier next time?",
  ],

  /** Comeback after failure */
  comeback: [
    "Back on track! First win after a loss. That's resilience.",
    "Redemption arc starting. Keep it going.",
    "One win doesn't erase the loss, but it's a start.",
    "The best time to start was yesterday. The second best time is now.",
  ],

  /** Perfect week */
  perfectWeek: [
    "🏆 Perfect week! Every promise kept. You're in the top 5%.",
    "Flawless. 7 days, zero failures. That's elite.",
    "100% this week. Your future self sends thanks.",
    "All promises kept. This is what discipline looks like.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// INSIGHT NOTIFICATIONS
// Personalized behavioral insights (psychology: self-awareness)
// ─────────────────────────────────────────────────────────────

export const INSIGHT_NOTIFICATIONS = {
  /** Best day pattern */
  bestDay: [
    "Fun fact: You're most successful on {day}s. Plan accordingly.",
    "Your best day is {day}. Consider frontloading your promises.",
    "{day} is your power day. {successRate}% success rate.",
  ],

  /** Worst day pattern */
  worstDay: [
    "Heads up: {day}s are your weak spot. Only {successRate}% success.",
    "You struggle on {day}s. Maybe go easier on yourself that day?",
    "{day} trips you up. Smaller stakes on those days?",
  ],

  /** Optimal stake range */
  optimalStake: [
    "Sweet spot: You're {successRate}% successful with ${min}-${max} stakes.",
    "Data says ${min}-${max} is your goldilocks zone.",
    "Stakes over ${max} stress you out. Stakes under ${min} don't motivate.",
  ],

  /** Time of day pattern */
  timePattern: [
    "Morning promises: {morningRate}%. Evening: {eveningRate}%. Interesting.",
    "You're a {preference} person. {rate}% success rate.",
    "Pro tip: Your {time} commitments have the best track record.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// SOCIAL PROOF NOTIFICATIONS
// Show that others are using the app (psychology: bandwagon effect)
// ─────────────────────────────────────────────────────────────

export const SOCIAL_PROOF_NOTIFICATIONS = [
  "{count} promises were kept today. You could add to that.",
  "Right now, {activeUsers} people have skin in the game. Join them?",
  "${totalStaked} is on the line across all users today.",
  "Someone just completed a ${amount} promise. Your turn?",
  "{count} people made promises this morning. Starting your day with intention?",
] as const;

// ─────────────────────────────────────────────────────────────
// PARTNER ACTION NOTIFICATIONS (Push from backend)
// When partners/sponsors interact with your promise
// ─────────────────────────────────────────────────────────────

export const PARTNER_ACTION_NOTIFICATIONS = {
  /** Someone sponsored your promise */
  sponsored: [
    '💰 {fromName} added ${amount} to your stake!',
    '+${amount} from {fromName}. No pressure.',
    '{fromName} just made your promise more expensive.',
    'Your stake just grew by ${amount}. Thanks, {fromName}.',
    '{fromName} is betting against you. +${amount}.',
  ],

  /** Someone left a roast message */
  roastReceived: [
    '📝 {fromName} left you a message',
    '🔥 New roast from {fromName}',
    '{fromName} has words for you...',
    'Message received from {fromName}',
    '{fromName} is watching. They left a note.',
  ],

  /** Partner approved your completion */
  partnerApproved: [
    '✅ Your partner confirmed you did it!',
    'Partner says you\'re good. Promise complete!',
    'Verified! Your partner approved.',
    'Your partner gave the thumbs up. Nice.',
    'Confirmation received. You actually did it.',
  ],

  /** Partner rejected your completion */
  partnerRejected: [
    '❌ Your partner says nope.',
    'Partner rejected your completion.',
    'Denied. Your partner didn\'t buy it.',
    'Your partner called BS. Promise failed.',
    'Verification denied. Oops.',
  ],
} as const;

// ─────────────────────────────────────────────────────────────
// FRIEND NOTIFICATIONS (Push from backend)
// Friend requests, acceptances, and activity
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FRIEND PAYOUT NOTIFICATIONS (Push from backend)
// When a friend wins money from a broken promise
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// INVITE REWARD NOTIFICATIONS
// When invite is claimed and both users get a free pass
// ─────────────────────────────────────────────────────────────

export const INVITE_REWARD_NOTIFICATIONS = {
  /** Notification to inviter when their invite is claimed */
  inviterReward: [
    '🎟️ Your invite was accepted! Free pass earned.',
    '🎉 @{name} joined! You got a free pass.',
    'Invite claimed! One free "oops" is yours.',
    '🎟️ @{name} is here! Free pass added to your account.',
  ],
  /** Welcome notification to new user who claimed invite */
  inviteeWelcome: [
    '🎟️ Welcome! You start with 1 free pass.',
    'First one is on us — your first failure is free!',
    '🎟️ Free pass unlocked! One promise failure, on the house.',
  ],
} as const;

export const FRIEND_PAYOUT_NOTIFICATIONS = {
  /** Notification when named as beneficiary */
  named: [
    '🎯 {userName} just put you on their promise',
    "📍 You're the beneficiary if {userName} fails",
    '💰 {userName} bet {amount} — yours if they break it',
  ],
  /** Notification when you get paid from a failed promise */
  payout: [
    '💸 {userName} broke their promise! {amount} is yours',
    '🎉 Cha-ching! {amount} added to your wallet',
    '💰 {userName} failed — {amount} just hit your wallet',
  ],
} as const;

export const FRIEND_NOTIFICATIONS = {
  /** Someone sent you a friend request */
  requestReceived: [
    '👋 @{username} wants to be your accountability partner',
    'New friend request from @{username}',
    '@{username} sent you a friend request',
    'Someone wants to keep you accountable: @{username}',
    '@{username} wants to join forces. Accept?',
  ],

  /** Your friend request was accepted */
  requestAccepted: [
    '🎉 @{username} accepted your friend request!',
    "You're now accountability partners with @{username}!",
    '@{username} is now your friend. Time to keep each other honest.',
    'Friend request accepted! @{username} is watching now.',
    '@{username} joined your circle. No more hiding.',
  ],

  /** Friend hit a streak milestone */
  friendStreak7: [
    '🔥 Your friend @{username} just hit a 7-day streak!',
    '@{username} is on fire! 7 days in a row.',
    "Week warrior: @{username} hasn't missed a beat.",
  ],

  friendStreak30: [
    '⚡ @{username} just hit a 30-day streak!',
    'Monthly monster: @{username} is crushing it.',
    "Your friend @{username} hasn't failed in a month.",
  ],

  friendStreak100: [
    '👑 @{username} just hit a 100-day streak!',
    'Legend status: @{username} hit 100 days.',
    '@{username} joined the 100 club. Respect.',
  ],

  /** Friend completed a promise */
  friendCompleted: [
    '✅ @{username} just kept a promise',
    '@{username} did the thing. Can you?',
    "Your friend @{username} isn't slacking.",
  ],

  /** Friend failed a promise */
  friendFailed: [
    '💸 @{username} just lost ${amount}',
    'Oops: @{username} broke a promise.',
    '@{username} failed. At least it wasn\'t you.',
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

/**
 * Get a friend notification message.
 */
export function getFriendNotification(
  type: keyof typeof FRIEND_NOTIFICATIONS,
  vars: Record<string, string | number> = {}
): string {
  const messages = FRIEND_NOTIFICATIONS[type];
  return formatMessage(pickRandom(messages), vars);
}

