/**
 * Animated Phone Mockup for Landing Page
 * Features:
 * - CSS-only device frame
 * - Live app simulation with promise card
 * - Pulsing countdown timer
 * - Animated money counter
 * - Sliding notification toasts
 */

import { useEffect, useState, useCallback } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface NotificationData {
  id: number;
  message: string;
  emoji: string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const NOTIFICATION_MESSAGES = [
  { message: 'Day 3 of 7 complete!', emoji: '🔥' },
  { message: 'Sarah verified your check-in', emoji: '✅' },
  { message: '$25 still on the line...', emoji: '💰' },
  { message: '2 days left. You got this.', emoji: '⏰' },
  { message: 'New streak record! 5 days', emoji: '🏆' },
];

// ─────────────────────────────────────────────────────────────
// ANIMATED COUNTER COMPONENT
// ─────────────────────────────────────────────────────────────

function AnimatedCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [value, displayValue]);

  return (
    <View style={styles.counterContainer}>
      <Text
        style={[
          styles.counterText,
          isAnimating && styles.counterAnimating,
        ]}
      >
        {prefix}{displayValue}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// COUNTDOWN TIMER COMPONENT
// ─────────────────────────────────────────────────────────────

function CountdownTimer() {
  const [seconds, setSeconds] = useState(47);
  const [minutes, setMinutes] = useState(23);
  const [hours, setHours] = useState(2);
  const [days, setDays] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev === 0) {
          setMinutes((m) => {
            if (m === 0) {
              setHours((h) => {
                if (h === 0) {
                  setDays((d) => Math.max(0, d - 1));
                  return 23;
                }
                return h - 1;
              });
              return 59;
            }
            return m - 1;
          });
          return 59;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatNum = (n: number) => n.toString().padStart(2, '0');

  return (
    <View style={styles.timerContainer}>
      <View style={styles.timerBlock}>
        <Text style={styles.timerValue}>{formatNum(days)}</Text>
        <Text style={styles.timerLabel}>days</Text>
      </View>
      <Text style={styles.timerSeparator}>:</Text>
      <View style={styles.timerBlock}>
        <Text style={styles.timerValue}>{formatNum(hours)}</Text>
        <Text style={styles.timerLabel}>hrs</Text>
      </View>
      <Text style={styles.timerSeparator}>:</Text>
      <View style={styles.timerBlock}>
        <Text style={styles.timerValue}>{formatNum(minutes)}</Text>
        <Text style={styles.timerLabel}>min</Text>
      </View>
      <Text style={styles.timerSeparator}>:</Text>
      <View style={styles.timerBlock}>
        <Text style={[styles.timerValue, styles.timerValueSeconds]}>{formatNum(seconds)}</Text>
        <Text style={styles.timerLabel}>sec</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION TOAST COMPONENT
// ─────────────────────────────────────────────────────────────

function NotificationToast({ notification, onComplete }: { notification: NotificationData; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <div
      className="absolute top-16 right-2 left-2 bg-neutral-800/95 backdrop-blur-lg rounded-2xl p-3 border border-neutral-700 shadow-2xl z-10"
      style={{
        animation: 'notification-slide 4s ease-in-out forwards',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{notification.emoji}</span>
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{notification.message}</p>
          <p className="text-neutral-400 text-xs">OopsFee • just now</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROMISE CARD COMPONENT
// ─────────────────────────────────────────────────────────────

function PromiseCard({ stake }: { stake: number }) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.promiseCardFallback}>
        <Text style={styles.promiseTitle}>Go to gym 3x this week</Text>
        <Text style={styles.stakeAmount}>${stake}</Text>
      </View>
    );
  }

  return (
    <div
      className="relative bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl p-4 border border-neutral-700"
      style={{
        boxShadow: '0 0 40px rgba(191, 255, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Active indicator */}
      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-lime-400">
        <div 
          className="absolute inset-0 rounded-full bg-lime-400"
          style={{
            animation: 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
      </div>

      {/* Promise text */}
      <p className="text-white text-base font-semibold mb-1">
        Go to gym 3x this week
      </p>
      <p className="text-neutral-400 text-xs mb-4">
        📸 Photo verification required
      </p>

      {/* Stake amount with glow */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">At stake</p>
          <div 
            className="flex items-baseline gap-1"
            style={{
              textShadow: '0 0 30px rgba(191, 255, 0, 0.6)',
            }}
          >
            <span className="text-lime-400 text-3xl font-mono font-bold">
              <AnimatedCounter value={stake} prefix="$" />
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Check-ins</p>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-full bg-lime-400 flex items-center justify-center">
              <span className="text-black text-[10px]">✓</span>
            </div>
            <div className="w-4 h-4 rounded-full bg-lime-400 flex items-center justify-center">
              <span className="text-black text-[10px]">✓</span>
            </div>
            <div 
              className="w-4 h-4 rounded-full border-2 border-neutral-600"
              style={{
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* Countdown timer */}
      <div className="bg-neutral-900/50 rounded-xl p-3 border border-neutral-800">
        <p className="text-neutral-500 text-[10px] uppercase tracking-wider mb-2 text-center">Time remaining</p>
        <CountdownTimer />
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-lime-500 to-lime-400 rounded-full"
          style={{
            width: '66%',
            boxShadow: '0 0 10px rgba(191, 255, 0, 0.5)',
          }}
        />
      </div>
      <p className="text-neutral-500 text-[10px] mt-1 text-right">2 of 3 complete</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP HEADER COMPONENT
// ─────────────────────────────────────────────────────────────

function AppHeader() {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderTitle}>OopsFee</Text>
      </View>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-800">
      <span className="text-lg font-bold text-white">OopsFee</span>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center">
          <span className="text-black text-xs font-bold">JD</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUICK ACTIONS COMPONENT
// ─────────────────────────────────────────────────────────────

function QuickActions() {
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <div className="flex gap-2 mt-4">
      <button 
        className="flex-1 py-3 px-4 bg-lime-400 rounded-xl flex items-center justify-center gap-2 font-semibold text-black text-sm border-none"
        style={{
          boxShadow: '0 4px 15px rgba(191, 255, 0, 0.3)',
        }}
      >
        <span>📸</span>
        <span>Check In</span>
      </button>
      <button className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center border border-neutral-700/50 text-white">
        <span className="text-xl">+</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BOTTOM NAV COMPONENT
// ─────────────────────────────────────────────────────────────

function BottomNav() {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.bottomNav}>
        <Text style={styles.bottomNavItem}>🏠</Text>
        <Text style={styles.bottomNavItem}>📊</Text>
        <Text style={styles.bottomNavItem}>🪦</Text>
        <Text style={styles.bottomNavItem}>👤</Text>
      </View>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-around items-center py-4 px-6 bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-800">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg">🏠</span>
        <div className="w-1 h-1 rounded-full bg-lime-400" />
      </div>
      <div className="flex flex-col items-center gap-1 opacity-50">
        <span className="text-lg">📊</span>
      </div>
      <div className="flex flex-col items-center gap-1 opacity-50">
        <span className="text-lg">🪦</span>
      </div>
      <div className="flex flex-col items-center gap-1 opacity-50">
        <span className="text-lg">👤</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PHONE MOCKUP COMPONENT
// ─────────────────────────────────────────────────────────────

export function PhoneMockup() {
  const [stake, setStake] = useState(50);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [notificationIndex, setNotificationIndex] = useState(0);

  // Animate stake value occasionally
  useEffect(() => {
    const interval = setInterval(() => {
      // Small random fluctuation to show it's "live"
      setStake((prev) => {
        const change = Math.random() > 0.7 ? Math.floor(Math.random() * 5) - 2 : 0;
        return Math.max(25, Math.min(100, prev + change));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Show notifications periodically
  useEffect(() => {
    const showNotification = () => {
      const notif = NOTIFICATION_MESSAGES[notificationIndex % NOTIFICATION_MESSAGES.length];
      const newNotification: NotificationData = {
        id: Date.now(),
        ...notif,
      };
      setNotifications((prev) => [...prev, newNotification]);
      setNotificationIndex((prev) => prev + 1);
    };

    // Show first notification after 2s, then every 6s
    const initialTimer = setTimeout(showNotification, 2000);
    const interval = setInterval(showNotification, 6000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [notificationIndex]);

  const handleNotificationComplete = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Fallback for non-web platforms
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.phoneFallback}>
        <Text style={styles.phoneFallbackEmoji}>📱</Text>
        <Text style={styles.phoneFallbackLabel}>${stake} on the line</Text>
        <Text style={styles.phoneFallbackSub}>3 days left</Text>
      </View>
    );
  }

  return (
    <div 
      className="relative"
      style={{
        perspective: '1000px',
      }}
    >
      {/* Glow effect behind phone */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(191, 255, 0, 0.15) 0%, transparent 70%)',
          transform: 'scale(1.5)',
          filter: 'blur(40px)',
        }}
      />

      {/* Phone device frame */}
      <div
        className="relative w-[280px] h-[580px] rounded-[3rem] border-4 border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden"
        style={{
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.1) inset,
            0 50px 100px -20px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(191, 255, 0, 0.1)
          `,
          transform: 'rotateY(-5deg) rotateX(2deg)',
        }}
      >
        {/* Dynamic Island / Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-20 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neutral-800" />
          <div className="w-3 h-3 rounded-full bg-neutral-800 ring-1 ring-neutral-700" />
        </div>

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 pt-1 z-10">
          <span className="text-white text-xs font-medium">9:41</span>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3a9 9 0 019 9v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a9 9 0 019-9z" opacity="0.3"/>
              <path d="M12 3a9 9 0 019 9v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a9 9 0 019-9z"/>
            </svg>
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2 17h2v4H2v-4zm4-5h2v9H6v-9zm4-4h2v13h-2V8zm4-5h2v18h-2V3z"/>
            </svg>
            <div className="flex items-center">
              <div className="w-6 h-3 rounded-sm border border-white flex items-center p-0.5">
                <div className="w-4 h-2 rounded-sm bg-lime-400" />
              </div>
              <div className="w-0.5 h-1.5 bg-white rounded-r-sm ml-0.5" />
            </div>
          </div>
        </div>

        {/* App content area */}
        <div className="absolute top-12 left-0 right-0 bottom-0 bg-gradient-to-b from-neutral-900 to-black">
          {/* App header */}
          <AppHeader />

          {/* Notifications */}
          {notifications.map((notification) => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onComplete={() => handleNotificationComplete(notification.id)}
            />
          ))}

          {/* Main content */}
          <div className="px-4 pt-4 pb-20">
            {/* Greeting */}
            <p className="text-neutral-400 text-sm mb-1">Welcome back,</p>
            <p className="text-white text-xl font-semibold mb-4">John 👋</p>

            {/* Promise card */}
            <PromiseCard stake={stake} />

            {/* Quick actions */}
            <QuickActions />

            {/* Stats row */}
            <div className="flex gap-2 mt-4">
              <div className="flex-1 bg-neutral-800/50 rounded-xl p-3 border border-neutral-700/50">
                <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Streak</p>
                <p className="text-white text-lg font-bold">🔥 12</p>
              </div>
              <div className="flex-1 bg-neutral-800/50 rounded-xl p-3 border border-neutral-700/50">
                <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Saved</p>
                <p className="text-lime-400 text-lg font-bold font-mono">$245</p>
              </div>
            </div>
          </div>

          {/* Bottom navigation */}
          <BottomNav />
        </div>

        {/* Screen reflection overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, transparent 100%)',
          }}
        />
      </div>

      {/* Floating money elements behind phone */}
      <div 
        className="absolute -right-4 top-20 text-2xl opacity-60"
        style={{
          animation: 'float 6s ease-in-out infinite',
        }}
      >
        💵
      </div>
      <div 
        className="absolute -left-6 bottom-32 text-xl opacity-40"
        style={{
          animation: 'float 8s ease-in-out infinite 1s',
        }}
      >
        💰
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES (for RN fallback / non-web)
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  phoneFallback: {
    width: 220,
    height: 400,
    backgroundColor: '#1f1f23',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  phoneFallbackEmoji: {
    fontSize: 64,
  },
  phoneFallbackLabel: {
    color: '#fafafa',
    fontSize: 24,
    fontWeight: '700',
  },
  phoneFallbackSub: {
    color: '#71717a',
    fontSize: 16,
  },
  counterContainer: {
    overflow: 'hidden',
  },
  counterText: {
    color: '#BFFF00',
    fontSize: 30,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  counterAnimating: {
    opacity: 0.5,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timerBlock: {
    alignItems: 'center',
  },
  timerValue: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'monospace',
    minWidth: 32,
    textAlign: 'center',
  },
  timerValueSeconds: {
    color: '#BFFF00',
  },
  timerLabel: {
    color: '#71717a',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerSeparator: {
    color: '#71717a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  promiseCardFallback: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 8,
  },
  promiseTitle: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '600',
  },
  stakeAmount: {
    color: '#BFFF00',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(23, 23, 23, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  appHeaderTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(23, 23, 23, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  bottomNavItem: {
    fontSize: 18,
  },
});

