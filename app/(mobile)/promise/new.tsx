import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineFriendPicker } from '@/components/promise';
import { VerificationPicker } from '@/components/verification';
import { VoiceRecorder } from '@/components/voice';
import { PROMISE_TEMPLATES, STAKES_THRESHOLDS, STATS_COPY, VERIFICATION_COPY, type PromiseTemplate } from '@/constants/content';
import { useAuth } from '@/context/auth';
import { usePromiseStore } from '@/context/promise-store';
import { useRequireAuth } from '@/hooks/use-require-auth';
import type { FriendProfile } from '@/lib/friends';
import { clampInt, formatShortDateTime } from '@/lib/promises/time';
import type { MoneyDestination, VerificationType } from '@/lib/promises/types';
import { getFailureMultiplier, getMultiplierResetProgress } from '@/lib/stats/store';
import { isStripeConfigured } from '@/lib/stripe';

const STAKE_PRESETS = [5, 10, 25, 50] as const;

const DESTINATIONS: {
  id: MoneyDestination;
  title: string;
  subtitle: string;
  emoji: string;
}[] = [
  {
    id: 'charity',
    title: 'Charity',
    subtitle: 'Failing, but make it philanthropic.',
    emoji: '💛',
  },
  {
    id: 'anti_charity',
    title: 'Anti-charity',
    subtitle: 'Spite is a motivational strategy.',
    emoji: '🧨',
  },
  {
    id: 'friend',
    title: 'Friend',
    subtitle: 'Social pressure, now with a Venmo receipt.',
    emoji: '🤝',
  },
  {
    id: 'oopsfee',
    title: 'OopsFee (us)',
    subtitle: "We'll buy coffee and call it \"infrastructure\".",
    emoji: '☕️',
  },
];

function formatDestinationTitle(
  destination: MoneyDestination,
  friendName?: string,
  selectedFriend?: FriendProfile | null
) {
  if (destination === 'friend') {
    if (selectedFriend) {
      const name = selectedFriend.display_name || selectedFriend.username || 'Friend';
      return selectedFriend.username ? `@${selectedFriend.username}` : name;
    }
    return friendName?.trim() ? `Friend · ${friendName.trim()}` : 'Friend';
  }
  if (destination === 'charity') return 'Charity';
  if (destination === 'anti_charity') return 'Anti-charity';
  return 'OopsFee';
}

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function withTime(dateStartMs: number, minutesSinceMidnight: number) {
  return dateStartMs + minutesSinceMidnight * 60_000;
}

function formatDeadlineFriendly(ms: number) {
  const now = new Date();
  const d = new Date(ms);

  const isSameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isSameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return formatShortDateTime(ms);
}

function defaultDeadlineForTemplate(t: PromiseTemplate, nowMs: number): number {
  // A little "I thought about it" goes a long way.
  switch (t.id) {
    case 'morning': {
      const d = new Date(nowMs);
      d.setDate(d.getDate() + 1);
      d.setHours(7, 0, 0, 0);
      return d.getTime();
    }
    case 'social': {
      const d = new Date(nowMs);
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    case 'alcohol': {
      const d = new Date(nowMs);
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 0, 0);
      return d.getTime();
    }
    case 'project': {
      // Next Friday 5pm.
      const d = new Date(nowMs);
      const day = d.getDay(); // 0 Sun ... 5 Fri
      const daysUntilFriday = (5 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilFriday);
      d.setHours(17, 0, 0, 0);
      return d.getTime();
    }
    case 'gym': {
      // End of this week (Sunday night). Yes, that's when consequences happen.
      const d = new Date(nowMs);
      const day = d.getDay(); // 0 Sun
      const daysUntilSunday = (7 - day) % 7;
      d.setDate(d.getDate() + daysUntilSunday);
      d.setHours(23, 59, 0, 0);
      return d.getTime();
    }
    default: {
      const d = new Date(nowMs);
      d.setDate(d.getDate() + 3);
      d.setHours(21, 0, 0, 0);
      return d.getTime();
    }
  }
}

function DeadlinePickerModal({
  visible,
  initialDeadlineAt,
  onClose,
  onSelect,
}: {
  visible: boolean;
  initialDeadlineAt: number;
  onClose: () => void;
  onSelect: (deadlineAt: number) => void;
}) {
  const nowMs = Date.now();
  const baseDay = startOfDay(nowMs);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const dayStart = baseDay + i * 86_400_000;
      const d = new Date(dayStart);
      const label =
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return { dayStart, label };
    });
  }, [baseDay]);

  const timeOptions = useMemo(
    () => [
      { label: 'End of day · 11:59 PM', minutes: 23 * 60 + 59 },
      { label: 'Morning · 7:00 AM', minutes: 7 * 60 },
      { label: 'Workday · 9:00 AM', minutes: 9 * 60 },
      { label: 'Lunch · 12:00 PM', minutes: 12 * 60 },
      { label: 'After work · 5:00 PM', minutes: 17 * 60 },
      { label: 'Night · 9:00 PM', minutes: 21 * 60 },
    ],
    []
  );

  function pad2(n: number) {
    return String(n).padStart(2, '0');
  }

  const initialDay = startOfDay(initialDeadlineAt);
  const initialDate = new Date(initialDeadlineAt);
  const initialHour = initialDate.getHours();
  const initialMinute = initialDate.getMinutes();
  const initialMinutes = initialHour * 60 + initialMinute;

  const hasExactPreset = timeOptions.some((o) => o.minutes === initialMinutes);
  const closestPreset = timeOptions.reduce(
    (best, opt) => (Math.abs(opt.minutes - initialMinutes) < Math.abs(best - initialMinutes) ? opt.minutes : best),
    timeOptions[0].minutes
  );

  const [selectedDayStart, setSelectedDayStart] = useState(initialDay);
  const [timeMode, setTimeMode] = useState<'preset' | 'custom'>(() => (hasExactPreset ? 'preset' : 'custom'));
  const [selectedPresetMinutes, setSelectedPresetMinutes] = useState<number>(() =>
    hasExactPreset ? initialMinutes : closestPreset
  );

  const [customHour, setCustomHour] = useState(() => pad2(clampInt(initialHour, 0, 23)));
  const [customMinute, setCustomMinute] = useState(() => pad2(clampInt(initialMinute, 0, 59)));

  useEffect(() => {
    if (!visible) return;
    setSelectedDayStart(initialDay);
    const exact = timeOptions.some((o) => o.minutes === initialMinutes);
    setTimeMode(exact ? 'preset' : 'custom');
    setSelectedPresetMinutes(exact ? initialMinutes : closestPreset);
    setCustomHour(pad2(clampInt(initialHour, 0, 23)));
    setCustomMinute(pad2(clampInt(initialMinute, 0, 59)));
  }, [closestPreset, initialDay, initialHour, initialMinute, initialMinutes, timeOptions, visible]);

  function parseTimePart(raw: string, maxLen: number) {
    return raw.replace(/[^\d]/g, '').slice(0, maxLen);
  }

  const hourRaw = parseTimePart(customHour, 2);
  const minuteRaw = parseTimePart(customMinute, 2);
  const hourNum = hourRaw.length > 0 ? Number.parseInt(hourRaw, 10) : NaN;
  const minuteNum = minuteRaw.length > 0 ? Number.parseInt(minuteRaw, 10) : NaN;
  const isCustomValid =
    Number.isFinite(hourNum) && Number.isFinite(minuteNum) && hourNum >= 0 && hourNum <= 23 && minuteNum >= 0 && minuteNum <= 59;

  const minutesSinceMidnight =
    timeMode === 'preset' ? selectedPresetMinutes : isCustomValid ? hourNum * 60 + minuteNum : null;

  const selectedDeadlineAt = minutesSinceMidnight === null ? null : withTime(selectedDayStart, minutesSinceMidnight);
  const isInPast = selectedDeadlineAt !== null && selectedDeadlineAt <= nowMs;

  const closingRef = useRef(false);
  const translateY = useSharedValue(0);
  const bodyScrollRef = useRef<ScrollView>(null);
  const hourInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateY.value = 0;
  }, [translateY, visible]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(700, { duration: 180 });
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 180);
  }, [onClose, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) => g.dy > 4 && Math.abs(g.dx) < 18,
        onPanResponderMove: (_evt, g) => {
          if (g.dy <= 0) return;
          translateY.value = g.dy;
        },
        onPanResponderRelease: (_evt, g) => {
          const shouldClose = g.dy > 120 || g.vy > 1.2;
          if (shouldClose) {
            dismiss();
            return;
          }
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
      }),
    [dismiss, translateY]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View className="flex-1 bg-black/65 items-center justify-end p-4">
        <Pressable className="absolute inset-0" onPress={dismiss} />

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          className="flex-1 w-full items-center justify-end"
          keyboardVerticalOffset={0}
        >
          <Animated.View
            style={sheetAnimStyle}
            className="w-full h-[78%] bg-[#0A0A0C] rounded-xxl border border-white/8 p-6 gap-4"
          >
            <View className="w-full items-center pt-0.5 pb-3 -mt-1.5" {...panResponder.panHandlers}>
              <View className="self-center w-11 h-[5px] rounded-[3px] bg-system-gray-4" />
            </View>

            <ScrollView
              className="flex-1 w-full"
              contentContainerClassName="gap-4 pb-2"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ref={bodyScrollRef}
            >
              <Text className="text-h3 text-white font-rounded text-center">Pick a deadline</Text>
              <Text className="text-caption text-white/45 text-center -mt-2">
                Be realistic. Then ignore it. (Just kidding. Mostly.)
              </Text>

              <View className="gap-2">
                <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">DATE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="py-2 pr-2 gap-2">
                  {dateOptions.map((opt) => {
                    const active = opt.dayStart === selectedDayStart;
                    return (
                      <Pressable
                        key={opt.dayStart}
                        onPress={() => {
                          hapticLight();
                          setSelectedDayStart(opt.dayStart);
                        }}
                        className={`py-2 px-3 rounded-full border ${
                          active
                            ? 'bg-imessage-dim border-imessage'
                            : 'bg-card border-white/8 active:opacity-90 active:scale-[0.98]'
                        }`}
                      >
                        <Text className={`text-caption font-semibold font-mono ${active ? 'text-white' : 'text-white/70'}`}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="gap-2">
                <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">TIME</Text>
                <View className="gap-2">
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      if (timeMode === 'custom') {
                        hourInputRef.current?.focus();
                        return;
                      }
                      setTimeMode('custom');
                      // Cue: reveal the inputs immediately.
                      setTimeout(() => {
                        bodyScrollRef.current?.scrollTo({ y: 9999, animated: true });
                        setTimeout(() => hourInputRef.current?.focus(), 120);
                      }, 60);
                    }}
                    className={`flex-row items-center justify-between py-3 px-3.5 rounded-lg border ${
                      timeMode === 'custom'
                        ? 'border-imessage bg-imessage-dim'
                        : 'bg-card border-white/8 active:bg-card-hover'
                    }`}
                  >
                    <Text className={`text-body-medium ${timeMode === 'custom' ? 'text-white' : 'text-white/70'}`}>
                      Custom · {timeMode === 'custom' ? (isCustomValid ? `${pad2(hourNum)}:${pad2(minuteNum)}` : '--:--') : 'Set your own'}
                    </Text>
                    {timeMode === 'custom' && <Text className="text-imessage font-bold">✓</Text>}
                  </Pressable>

                  {timeMode === 'custom' && (
                    <Animated.View
                      entering={FadeIn.duration(150)}
                      layout={Layout.springify()}
                      className="bg-[#0A0A0C] border border-white/5 rounded-lg p-3 gap-2"
                    >
                      <View className="flex-row items-center justify-center gap-2">
                        <View className="w-16 py-2.5 px-2.5 rounded-md bg-card border border-white/8">
                          <TextInput
                            ref={hourInputRef}
                            value={hourRaw}
                            onChangeText={(t) => setCustomHour(parseTimePart(t, 2))}
                            placeholder="HH"
                            placeholderTextColor="rgba(255, 255, 255, 0.30)"
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={2}
                            className="text-body-semibold text-white font-mono text-center py-0"
                          />
                        </View>
                        <Text className="text-white/70 text-xl font-bold -mt-0.5">:</Text>
                        <View className="w-16 py-2.5 px-2.5 rounded-md bg-card border border-white/8">
                          <TextInput
                            value={minuteRaw}
                            onChangeText={(t) => setCustomMinute(parseTimePart(t, 2))}
                            placeholder="MM"
                            placeholderTextColor="rgba(255, 255, 255, 0.30)"
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={2}
                            className="text-body-semibold text-white font-mono text-center py-0"
                          />
                        </View>
                        <Text className="text-caption text-white/30 font-mono">24h</Text>
                      </View>
                      <Text className={`text-caption text-center ${!isCustomValid ? 'text-danger font-semibold' : 'text-white/45'}`}>
                        {isCustomValid ? '00–23 hours · 00–59 minutes.' : 'Hour must be 00–23 and minutes 00–59.'}
                      </Text>
                    </Animated.View>
                  )}

                  {timeOptions.map((opt) => {
                    const active = timeMode === 'preset' && opt.minutes === selectedPresetMinutes;
                    return (
                      <Pressable
                        key={opt.minutes}
                        onPress={() => {
                          hapticLight();
                          setTimeMode('preset');
                          setSelectedPresetMinutes(opt.minutes);
                        }}
                        className={`flex-row items-center justify-between py-3 px-3.5 rounded-lg border ${
                          active
                            ? 'border-imessage bg-imessage-dim'
                            : 'bg-card border-white/8 active:bg-card-hover'
                        }`}
                      >
                        <Text className={`text-body-medium ${active ? 'text-white' : 'text-white/70'}`}>{opt.label}</Text>
                        {active && <Text className="text-imessage font-bold">✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View className="gap-3">
              <View className="flex-row items-center justify-between px-2">
                <Text className="text-label text-white/30 uppercase tracking-wide">DEADLINE</Text>
                <Text
                  className={`text-body-semibold font-rounded ${
                    selectedDeadlineAt === null || isInPast ? 'text-danger' : 'text-white'
                  }`}
                >
                  {selectedDeadlineAt === null ? 'Fix the time' : formatDeadlineFriendly(selectedDeadlineAt)}
                </Text>
              </View>

              <Pressable
                disabled={selectedDeadlineAt === null || isInPast}
                onPress={() => {
                  if (selectedDeadlineAt === null) return;
                  hapticMedium();
                  onSelect(selectedDeadlineAt);
                  dismiss();
                }}
                className={`h-12 rounded-3xl overflow-hidden ${
                  (selectedDeadlineAt === null || isInPast) ? 'opacity-60' : 'active:scale-[0.99]'
                }`}
              >
                <LinearGradient
                  colors={
                    selectedDeadlineAt === null || isInPast
                      ? ['#3A3A3C', '#2C2C2E']
                      : ['#0B93F6', '#0A7FD4']
                  }
                  className="flex-1 items-center justify-center"
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text className="text-body-semibold text-white">
                    {selectedDeadlineAt === null ? 'Fix it' : isInPast ? 'Time travel required' : 'Done'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ConfirmModal({
  visible,
  text,
  stake,
  baseStake,
  multiplier,
  deadlineAt,
  moneyDestination,
  friendName,
  selectedFriend,
  walletUsageDollars,
  cardChargeDollars,
  onCancel,
  onConfirm,
  confirming,
}: {
  visible: boolean;
  text: string;
  stake: number;
  baseStake: number;
  multiplier: number;
  deadlineAt: number;
  moneyDestination: MoneyDestination;
  friendName?: string;
  selectedFriend?: FriendProfile | null;
  walletUsageDollars: number;
  cardChargeDollars: number;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const hasMultiplier = multiplier > 1 && baseStake > 0;
  const hasWalletUsage = walletUsageDollars > 0;
  const closingRef = useRef(false);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateY.value = 0;
  }, [translateY, visible]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(700, { duration: 180 });
    setTimeout(() => {
      closingRef.current = false;
      onCancel();
    }, 180);
  }, [onCancel, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) => g.dy > 4 && Math.abs(g.dx) < 18,
        onPanResponderMove: (_evt, g) => {
          if (g.dy <= 0) return;
          translateY.value = g.dy;
        },
        onPanResponderRelease: (_evt, g) => {
          const shouldClose = g.dy > 120 || g.vy > 1.2;
          if (shouldClose) {
            dismiss();
            return;
          }
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
      }),
    [dismiss, translateY]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View className="flex-1 bg-black/65 items-center justify-end p-4">
        <Pressable className="absolute inset-0" onPress={dismiss} />
        <Animated.View
          style={sheetAnimStyle}
          className="w-full bg-[#0A0A0C] rounded-xxl border border-white/8 p-6 gap-4"
        >
          <View className="w-full items-center pt-0.5 pb-3 -mt-1.5" {...panResponder.panHandlers}>
            <View className="self-center w-11 h-[5px] rounded-[3px] bg-system-gray-4" />
          </View>

          <Text className="text-h3 text-white font-rounded text-center">Lock it in?</Text>
          <Text className="text-caption text-white/45 text-center -mt-2">
            This is the part where your future self gets nervous.
          </Text>

          <View className="bg-card rounded-xl border border-white/8 p-4 gap-4">
            <Text className="text-body-semibold text-white font-rounded leading-[22px]" numberOfLines={3}>
              {text}
            </Text>

            <View className="flex-row items-center gap-4">
              <View className="flex-1 gap-1">
                <Text className="text-label text-white/30 uppercase tracking-wide">FINE</Text>
                {hasMultiplier ? (
                  <View className="gap-0.5">
                    <Text className="text-caption text-white/70 font-mono">${baseStake} ×{multiplier}</Text>
                    <Text className="text-h2 text-danger font-mono">${stake}</Text>
                  </View>
                ) : (
                  <Text className="text-h2 text-danger font-mono">${stake}</Text>
                )}
              </View>
              <View className="w-px h-[42px] bg-white/8" />
              <View className="flex-1 gap-1">
                <Text className="text-label text-white/30 uppercase tracking-wide">DEADLINE</Text>
                <Text className="text-body-medium text-white/70">{formatDeadlineFriendly(deadlineAt)}</Text>
              </View>
            </View>

            {hasMultiplier && (
              <View className="flex-row items-center gap-2 bg-danger-dim rounded-md p-2">
                <Text className="text-sm">⚠️</Text>
                <Text className="text-caption text-danger flex-1">
                  Failure tax applied. Complete 3 promises to reset.
                </Text>
              </View>
            )}

            {hasWalletUsage && (
              <View className="flex-row items-center gap-2 bg-success-dim rounded-md p-2">
                <Text className="text-sm">💰</Text>
                <View className="flex-1 gap-0.5">
                  <Text className="text-caption text-success font-semibold">
                    ${walletUsageDollars.toFixed(2)} from wallet
                  </Text>
                  {cardChargeDollars > 0 && (
                    <Text className="text-caption text-white/70 font-mono">
                      + ${cardChargeDollars.toFixed(2)} from card
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View className="h-px bg-white/5" />
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-label text-white/30 uppercase tracking-wide">GOES TO</Text>
              <Text className="text-body-medium text-white/70">
                {formatDestinationTitle(moneyDestination, friendName, selectedFriend)}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={dismiss}
              className="flex-1 h-[52px] rounded-[26px] bg-card border border-white/8 items-center justify-center active:opacity-90 active:scale-[0.98]"
            >
              <Text className="text-body-semibold text-white/70">Not yet</Text>
            </Pressable>
            <Pressable
              disabled={confirming}
              onPress={onConfirm}
              className={`flex-1 h-[52px] rounded-[26px] overflow-hidden ${confirming ? 'opacity-70' : 'active:opacity-90 active:scale-[0.98]'}`}
            >
              <LinearGradient
                colors={['#FF453A', '#FF6B35']}
                className="flex-1 items-center justify-center"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text className="text-body-semibold text-white font-rounded">
                  {confirming ? 'Saving your regret…' : 'Lock it in 🔒'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function NewPromiseScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ templateId?: string }>();
  const { createPromise, isWorking, promises } = usePromiseStore();
  const { requireAuth } = useRequireAuth();
  const { paymentState, walletState, freePasses, isAuthenticated } = useAuth();

  const templateId = useMemo(() => {
    const raw = params.templateId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.templateId]);

  const initialTemplate = useMemo(() => {
    if (!templateId) return null;
    return PROMISE_TEMPLATES.find((t) => t.id === templateId) ?? null;
  }, [templateId]);

  const nowMs = Date.now();

  const [text, setText] = useState(initialTemplate?.text ?? '');
  const initialStake = initialTemplate?.stake ?? 25;
  const [stake, setStake] = useState<number>(initialStake);
  const [stakeInput, setStakeInput] = useState(() => String(initialStake));
  const [isEditingStake, setIsEditingStake] = useState(false);

  useEffect(() => {
    if (isEditingStake) return;
    setStakeInput(String(stake));
  }, [isEditingStake, stake]);

  const [moneyDestination, setMoneyDestination] = useState<MoneyDestination>('oopsfee');
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [useExternalFriend, setUseExternalFriend] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | undefined>(undefined);
  const [verificationType, setVerificationType] = useState<VerificationType>(
    () => initialTemplate?.defaultVerification ?? 'photo'
  );
  const [useFreePass, setUseFreePass] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<number>(() => {
    if (initialTemplate) return defaultDeadlineForTemplate(initialTemplate, nowMs);
    const d = new Date(nowMs);
    d.setDate(d.getDate() + 3);
    d.setHours(21, 0, 0, 0);
    return d.getTime();
  });

  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Failure escalation
  const failureMultiplier = useMemo(() => getFailureMultiplier(promises), [promises]);
  const showMultiplierWarning = failureMultiplier > 1;
  const multiplierProgress = useMemo(() => getMultiplierResetProgress(promises), [promises]);
  const [confirming, setConfirming] = useState(false);

  // Effective stake with multiplier applied
  const effectiveStake = stake * failureMultiplier;

  // Wallet usage calculation
  const effectiveStakeCents = effectiveStake * 100;
  const walletUsageCents = Math.min(walletState.balanceCents, effectiveStakeCents);
  const cardChargeCents = effectiveStakeCents - walletUsageCents;
  const walletUsageDollars = walletUsageCents / 100;
  const cardChargeDollars = cardChargeCents / 100;

  // Stakes gating: if honor is selected and stake goes above threshold, switch to photo
  useEffect(() => {
    if (verificationType === 'honor' && effectiveStake >= STAKES_THRESHOLDS.honorDisabled) {
      setVerificationType('photo');
    }
  }, [effectiveStake, verificationType]);

  // Reset free pass toggle if conditions change (no passes left or stake becomes 0)
  useEffect(() => {
    if (useFreePass && (freePasses <= 0 || effectiveStake <= 0)) {
      setUseFreePass(false);
    }
  }, [useFreePass, freePasses, effectiveStake]);

  // Friend validation: either in-app friend selected OR external with name + email
  const friendOk = moneyDestination !== 'friend' || 
    selectedFriend !== null ||
    (useExternalFriend && friendName.trim().length > 0 && friendEmail.trim().length > 0);
  const canLock = text.trim().length > 0 && stake >= 0 && deadlineAt > nowMs && friendOk;
  const warningFree = stake === 0;

  // Payment method required for staked promises
  const needsPaymentMethod = effectiveStake > 0 && isStripeConfigured() && isAuthenticated && !paymentState.hasPaymentMethod;
  const isPaymentBlocked = effectiveStake > 0 && isStripeConfigured() && isAuthenticated && paymentState.paymentBlocked;

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const applyTemplate = useCallback(
    (t: PromiseTemplate) => {
      hapticLight();
      setText(t.text);
      setStake(t.stake);
      setStakeInput(String(t.stake));
      setDeadlineAt(defaultDeadlineForTemplate(t, Date.now()));
      setVerificationType(t.defaultVerification);
    },
    [setText, setStake, setStakeInput, setDeadlineAt, setVerificationType]
  );

  const openConfirm = useCallback(() => {
    // Require auth for staked promises ($1+)
    if (effectiveStake > 0 && !requireAuth()) {
      return;
    }

    // Require payment method for staked promises (if Stripe is configured)
    if (effectiveStake > 0 && isStripeConfigured() && isAuthenticated) {
      if (paymentState.paymentBlocked) {
        // User has unresolved payment failures - must fix first
        router.push('/(auth)/payment-method' as never);
        return;
      }
      if (!paymentState.hasPaymentMethod) {
        // User needs to add a payment method first
        router.push('/(auth)/payment-method' as never);
        return;
      }
    }

    hapticMedium();
    setConfirmOpen(true);
  }, [effectiveStake, requireAuth, isAuthenticated, paymentState]);

  const doCreate = useCallback(async () => {
    if (!canLock) return;
    setConfirming(true);
    try {
      // Determine friend data based on selection
      const isFriendDestination = moneyDestination === 'friend';
      const friendUserId = isFriendDestination && selectedFriend ? selectedFriend.id : undefined;
      const finalFriendName = isFriendDestination
        ? selectedFriend?.display_name || selectedFriend?.username || friendName.trim()
        : undefined;
      const finalFriendEmail = isFriendDestination && useExternalFriend && friendEmail.trim()
        ? friendEmail.trim()
        : undefined;

      // Use effective stake (with failure multiplier applied)
      const created = await createPromise({
        text: text.trim(),
        stake: effectiveStake,
        deadlineAt,
        moneyDestination,
        friendUserId,
        friendName: finalFriendName || undefined,
        friendEmail: finalFriendEmail,
        voiceNoteUri,
        verificationType,
        usesFreePass: useFreePass && freePasses > 0,
      });
      hapticMedium();
      setConfirmOpen(false);
      router.replace({ pathname: '/(mobile)/promise/[id]', params: { id: created.id } });
    } finally {
      setConfirming(false);
    }
  }, [canLock, createPromise, deadlineAt, effectiveStake, freePasses, friendEmail, friendName, moneyDestination, selectedFriend, text, useExternalFriend, useFreePass, verificationType, voiceNoteUri]);

  return (
    <View className="flex-1 bg-black">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 6, android: 0 })}
      >
        <View
          className="px-6 pb-4 flex-row items-center gap-3 border-b border-white/5"
          style={{ paddingTop: insets.top + 16 }}
        >
          <Pressable
            onPress={handleBack}
            className="w-9 h-9 rounded-full bg-card border border-white/8 items-center justify-center active:opacity-90 active:scale-[0.98]"
          >
            <Text className="text-[28px] leading-7 text-white/70 -mt-0.5">‹</Text>
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text className="text-h2 text-white font-rounded">New promise</Text>
            <Text className="text-caption text-white/45">Say it out loud. Price it. Regret later.</Text>
          </View>
          <View className="w-9" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-6 gap-8"
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Templates */}
          <Animated.View entering={FadeInDown.duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">TEMPLATES</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">Because thinking is hard.</Text>
            <View className="flex-row flex-wrap gap-3">
              {PROMISE_TEMPLATES.map((t) => {
                const active = text.trim() === t.text.trim();
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => applyTemplate(t)}
                    className={`basis-[47%] grow bg-card rounded-lg border p-3 gap-1 ${
                      active
                        ? 'border-imessage bg-imessage-dim'
                        : 'border-white/8 active:bg-card-hover active:border-white/15'
                    }`}
                  >
                    <Text className="text-[22px]">{t.emoji}</Text>
                    <Text className="text-caption text-white leading-[18px] min-h-[36px]" numberOfLines={2}>
                      {t.text}
                    </Text>
                    <View className="self-start bg-danger-dim py-[3px] px-2 rounded-sm mt-1">
                      <Text className="text-caption text-danger font-mono font-semibold">${t.stake}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Text input */}
          <Animated.View entering={FadeInDown.delay(80).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">I WILL…</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">Try not to write a novel. Just the part you&apos;ll break.</Text>

            <View className="bg-card rounded-xl border border-white/8 p-4 gap-3">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Stop negotiating with my alarm clock"
                placeholderTextColor="rgba(255, 255, 255, 0.30)"
                multiline
                maxLength={120}
                className="min-h-[84px] text-body text-white leading-[22px]"
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-caption text-white/45 italic">
                  {text.trim().length === 0 ? 'Say it. Commit. Panic.' : 'Nice.'}
                </Text>
                <Text className="text-caption text-white/30 font-mono">{text.length}/120</Text>
              </View>
            </View>
          </Animated.View>

          {/* Deadline */}
          <Animated.View entering={FadeInDown.delay(120).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">DEADLINE</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">Pick a date your future self will hate.</Text>

            <Pressable
              onPress={() => {
                hapticLight();
                setDeadlineModalOpen(true);
              }}
              className="bg-card rounded-xl border border-white/8 p-4 flex-row items-center gap-3 active:bg-card-hover"
            >
              <View className="w-[34px] h-[34px] rounded-[17px] bg-[#0A0A0C] border border-white/5 items-center justify-center">
                <Text className="text-base">⏳</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-caption text-white/70 font-semibold">Deadline</Text>
                <Text className="text-body-medium text-white font-rounded">{formatDeadlineFriendly(deadlineAt)}</Text>
              </View>
              <Text className="text-[22px] text-white/30 font-light">›</Text>
            </Pressable>
          </Animated.View>

          {/* Stake */}
          <Animated.View entering={FadeInDown.delay(160).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">STAKES</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">Loss aversion, but make it personal.</Text>

            <View className="bg-card rounded-xl border border-white/8 p-4 gap-4">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-label text-white/30 uppercase tracking-wide">FINE</Text>
                <View className="flex-row items-baseline gap-2">
                  {showMultiplierWarning && stake > 0 && (
                    <Text className="text-body text-white/70 font-mono">${stake} ×{failureMultiplier} =</Text>
                  )}
                  <Text className={`text-display-sm font-rounded ${showMultiplierWarning && stake > 0 ? 'text-danger' : 'text-danger'}`}>
                    ${effectiveStake}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2 items-center">
                {STAKE_PRESETS.map((amt) => {
                  const active = amt === stake;
                  return (
                    <Pressable
                      key={amt}
                      onPress={() => {
                        hapticLight();
                        setStake(amt);
                        setStakeInput(String(amt));
                      }}
                      className={`py-2 px-3 rounded-full border ${
                        active
                          ? 'bg-danger-dim border-danger'
                          : 'bg-card border-white/8 active:opacity-90 active:scale-[0.98]'
                      }`}
                    >
                      <Text className={`text-caption font-semibold font-mono ${active ? 'text-white' : 'text-white/70'}`}>
                        ${amt}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => {
                    hapticLight();
                    setStake((s) => {
                      const next = clampInt(s + 5, 0, 999);
                      setStakeInput(String(next));
                      return next;
                    });
                  }}
                  className="w-10 h-9 rounded-full bg-[#0A0A0C] border border-white/5 items-center justify-center active:opacity-90 active:scale-[0.98]"
                >
                  <Text className="text-white/70 text-xl font-semibold -mt-0.5">+</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setStake((s) => {
                      const next = clampInt(s - 5, 0, 999);
                      setStakeInput(String(next));
                      return next;
                    });
                  }}
                  className="w-10 h-9 rounded-full bg-[#0A0A0C] border border-white/5 items-center justify-center active:opacity-90 active:scale-[0.98]"
                >
                  <Text className="text-white/70 text-xl font-semibold -mt-0.5">−</Text>
                </Pressable>
              </View>

              <View className="gap-2 pt-1">
                <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">CUSTOM</Text>
                <View className="flex-row items-center gap-2 py-3 px-3.5 rounded-lg bg-[#0A0A0C] border border-white/5">
                  <Text className="text-body-semibold text-white/70 font-mono">$</Text>
                  <TextInput
                    value={stakeInput}
                    onFocus={() => setIsEditingStake(true)}
                    onBlur={() => setIsEditingStake(false)}
                    onChangeText={(raw) => {
                      const digits = raw.replace(/[^\d]/g, '').slice(0, 3);
                      setStakeInput(digits);
                      const next = digits.length === 0 ? 0 : clampInt(Number.parseInt(digits, 10), 0, 999);
                      setStake(next);
                    }}
                    placeholder="25"
                    placeholderTextColor="rgba(255, 255, 255, 0.30)"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                    className="flex-1 text-body-semibold text-white font-mono py-0"
                  />
                </View>
                <Text className="text-caption text-white/45 italic ml-1">
                  Type it like an adult. We&apos;ll still judge quietly.
                </Text>
              </View>

              {warningFree && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  layout={Layout.springify()}
                  className="flex-row items-start gap-2 bg-[rgba(255,159,10,0.08)] border border-[rgba(255,159,10,0.18)] p-3 rounded-lg"
                >
                  <Text className="text-sm mt-0.5">⚠️</Text>
                  <Text className="text-caption text-warning flex-1">
                    $0 is allowed. So is lying for free. Classic combo.
                  </Text>
                </Animated.View>
              )}

              {/* Wallet Usage Indicator */}
              {effectiveStake > 0 && walletState.hasBalance && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  layout={Layout.springify()}
                  className="flex-row items-center gap-3 bg-success-dim border border-success/20 p-3 rounded-lg"
                >
                  <View className="w-7 h-7 rounded-[14px] bg-success/15 items-center justify-center">
                    <Text className="text-sm">💰</Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    {cardChargeCents > 0 ? (
                      <>
                        <Text className="text-caption text-success font-semibold">
                          Using <Text className="font-mono font-bold">${walletUsageDollars.toFixed(2)}</Text> from wallet
                        </Text>
                        <Text className="text-caption text-white/70 font-mono">
                          + ${cardChargeDollars.toFixed(2)} from card
                        </Text>
                      </>
                    ) : (
                      <Text className="text-caption text-success font-semibold">
                        Covered by wallet <Text className="font-mono font-bold">✓</Text>
                      </Text>
                    )}
                  </View>
                  <View className="bg-success/15 py-1 px-2 rounded-sm">
                    <Text className="text-caption text-success font-mono font-semibold">
                      ${walletState.balanceDollars.toFixed(2)}
                    </Text>
                  </View>
                </Animated.View>
              )}

              {/* Free Pass Toggle */}
              {freePasses > 0 && effectiveStake > 0 && (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  layout={Layout.springify()}
                  className="flex-row items-center gap-3 bg-imessage-dim border border-imessage/25 p-3 rounded-lg"
                >
                  <View className="w-7 h-7 rounded-[14px] bg-imessage/15 items-center justify-center">
                    <Text className="text-sm">🎟️</Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-caption text-imessage font-semibold">
                      Use free pass ({freePasses} left)
                    </Text>
                    <Text className="text-caption text-white/70">
                      If you fail, no charge. Pass consumed either way.
                    </Text>
                  </View>
                  <Switch
                    value={useFreePass}
                    onValueChange={(val) => {
                      hapticLight();
                      setUseFreePass(val);
                    }}
                    trackColor={{ false: '#3A3A3C', true: 'rgba(11, 147, 246, 0.4)' }}
                    thumbColor={useFreePass ? '#0B93F6' : '#636366'}
                    ios_backgroundColor="#3A3A3C"
                  />
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Verification */}
          <Animated.View entering={FadeInDown.delay(170).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">{VERIFICATION_COPY.sectionTitle}</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">{VERIFICATION_COPY.sectionHint}</Text>

            <VerificationPicker
              value={verificationType}
              onChange={setVerificationType}
              stake={effectiveStake}
            />
          </Animated.View>

          {/* Where money goes */}
          <Animated.View entering={FadeInDown.delay(190).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">WHERE THE MONEY GOES</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">UI-only for now. But your guilt can have preferences.</Text>

            <View className="gap-2">
              {DESTINATIONS.map((d) => {
                const active = d.id === moneyDestination;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      hapticLight();
                      setMoneyDestination(d.id);
                    }}
                    className={`flex-row items-center gap-3 rounded-xl border p-4 ${
                      active
                        ? 'border-imessage bg-imessage-dim'
                        : 'bg-card border-white/8 active:bg-card-hover'
                    }`}
                  >
                    <View className="w-[34px] h-[34px] rounded-[17px] bg-[#0A0A0C] border border-white/5 items-center justify-center">
                      <Text className="text-base">{d.emoji}</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-body-semibold text-white font-rounded">{d.title}</Text>
                      <Text className="text-caption text-white/45">{d.subtitle}</Text>
                    </View>
                    {active && <Text className="text-imessage font-bold text-base">✓</Text>}
                  </Pressable>
                );
              })}
            </View>

            {moneyDestination === 'friend' && (
              <Animated.View
                entering={FadeIn.duration(180)}
                layout={Layout.springify()}
                className="bg-card rounded-xl border border-white/8 p-4"
              >
                <InlineFriendPicker
                  selectedFriend={selectedFriend}
                  useExternal={useExternalFriend}
                  friendName={friendName}
                  friendEmail={friendEmail}
                  onSelectFriend={(friend) => {
                    setSelectedFriend(friend);
                    if (friend) {
                      setUseExternalFriend(false);
                      setFriendName('');
                      setFriendEmail('');
                    }
                  }}
                  onExternalChange={setUseExternalFriend}
                  onFriendNameChange={setFriendName}
                  onFriendEmailChange={setFriendEmail}
                />
              </Animated.View>
            )}
          </Animated.View>

          {/* Voice commitment */}
          <Animated.View entering={FadeInDown.delay(210).duration(220)} className="gap-3">
            <Text className="text-label text-white/30 ml-1 uppercase tracking-wide">OPTIONAL: VOICE COMMITMENT</Text>
            <Text className="text-caption text-white/45 ml-1 -mt-2">Say it out loud. We&apos;ll haunt you with it later.</Text>

            <VoiceRecorder
              existingUri={voiceNoteUri}
              onRecordingComplete={(uri) => setVoiceNoteUri(uri)}
              onClear={() => setVoiceNoteUri(undefined)}
            />

            {voiceNoteUri && (
              <Animated.View entering={FadeIn.duration(150)} className="flex-row items-center gap-2 pt-2 pl-1">
                <Text className="text-success text-sm font-bold">✓</Text>
                <Text className="text-caption text-success italic">
                  Voice recorded. Your future self will hear this.
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Failure Multiplier Warning */}
          {showMultiplierWarning && (
            <Animated.View
              entering={FadeIn.duration(200)}
              layout={Layout.springify()}
              className="bg-danger-dim border border-danger/25 rounded-xl p-4 gap-2"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-lg">⚠️</Text>
                <Text className="text-body-semibold text-danger font-rounded">
                  {STATS_COPY.multiplierTitle}: {failureMultiplier}×
                </Text>
              </View>
              <Text className="text-body text-danger">
                {failureMultiplier >= 8
                  ? STATS_COPY.multiplier8x
                  : failureMultiplier >= 4
                    ? STATS_COPY.multiplier4x
                    : STATS_COPY.multiplier2x}
              </Text>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-caption text-white/70">
                  Complete {3 - multiplierProgress.current} more to reset
                </Text>
                <View className="flex-row gap-1">
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      className={`w-2.5 h-2.5 rounded-[5px] border ${
                        i < multiplierProgress.current
                          ? 'bg-success border-success'
                          : 'bg-system-gray-4 border-system-gray-3'
                      }`}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Payment Warning */}
          {(needsPaymentMethod || isPaymentBlocked) && (
            <Animated.View
              entering={FadeIn.duration(200)}
              className="bg-warning-dim border border-warning/25 rounded-xl p-4 gap-2"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-lg">{isPaymentBlocked ? '🚫' : '💳'}</Text>
                <Text className="text-body-semibold text-warning font-rounded">
                  {isPaymentBlocked ? 'Payment required' : 'Add payment method'}
                </Text>
              </View>
              <Text className="text-body text-white/70">
                {isPaymentBlocked
                  ? 'Resolve your failed payment before creating new stakes.'
                  : 'Add a card to create promises with real stakes. You only pay if you fail.'}
              </Text>
              <Pressable
                onPress={() => router.push('/(auth)/payment-method' as never)}
                className="self-start bg-warning py-2 px-4 rounded-full mt-1 active:opacity-90 active:scale-[0.98]"
              >
                <Text className="text-caption text-black font-semibold">
                  {isPaymentBlocked ? 'Fix payment' : 'Add card'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Lock in */}
          <Animated.View entering={FadeInDown.delay(230).duration(220)} className="gap-3 pt-2">
            <Pressable
              disabled={!canLock || isWorking}
              onPress={openConfirm}
              className={`h-14 rounded-[28px] overflow-hidden shadow-lg ${
                (!canLock || isWorking) ? 'opacity-55' : 'active:scale-[0.99]'
              }`}
            >
              <LinearGradient
                colors={!canLock || isWorking ? ['#3A3A3C', '#2C2C2E'] : ['#FF453A', '#FF6B35']}
                className="flex-1 items-center justify-center"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text className="text-body-semibold text-white font-rounded">
                  {isWorking ? 'Working…' : needsPaymentMethod ? 'Add card to stake 💳' : 'Lock it in 🔒'}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text className="text-caption text-white/30 text-center italic">
              You can&apos;t &quot;un-send&quot; this. (You can, but it ruins the vibe.)
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DeadlinePickerModal
        visible={deadlineModalOpen}
        initialDeadlineAt={deadlineAt}
        onClose={() => setDeadlineModalOpen(false)}
        onSelect={(ms) => setDeadlineAt(ms)}
      />

      <ConfirmModal
        visible={confirmOpen}
        text={text.trim()}
        stake={effectiveStake}
        baseStake={stake}
        multiplier={failureMultiplier}
        deadlineAt={deadlineAt}
        moneyDestination={moneyDestination}
        friendName={friendName}
        selectedFriend={selectedFriend}
        walletUsageDollars={walletUsageDollars}
        cardChargeDollars={cardChargeDollars}
        confirming={confirming}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doCreate}
      />
    </View>
  );
}
