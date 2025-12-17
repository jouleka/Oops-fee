import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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

import { VerificationPicker } from '@/components/verification';
import { VoiceRecorder } from '@/components/voice';
import { PROMISE_TEMPLATES, STAKES_THRESHOLDS, STATS_COPY, VERIFICATION_COPY, type PromiseTemplate } from '@/constants/content';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import { clampInt, formatShortDateTime } from '@/lib/promises/time';
import type { MoneyDestination, VerificationType } from '@/lib/promises/types';
import { getFailureMultiplier, getMultiplierResetProgress } from '@/lib/stats/store';

const STAKE_PRESETS = [5, 10, 25, 50] as const;

const DESTINATIONS: Array<{
  id: MoneyDestination;
  title: string;
  subtitle: string;
  emoji: string;
}> = [
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
    subtitle: 'We’ll buy coffee and call it “infrastructure”.',
    emoji: '☕️',
  },
];

function formatDestinationTitle(destination: MoneyDestination, friendName?: string) {
  if (destination === 'friend') return friendName?.trim() ? `Friend · ${friendName.trim()}` : 'Friend';
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
      // End of this week (Sunday night). Yes, that’s when consequences happen.
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
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          style={styles.modalKav}
          keyboardVerticalOffset={0}
        >
          <Animated.View style={[styles.modalSheet, sheetAnimStyle]}>
            <View style={styles.modalHandleHit} {...panResponder.panHandlers}>
              <View style={styles.modalHandle} />
            </View>

            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ref={bodyScrollRef}
            >
              <Text style={styles.modalTitle}>Pick a deadline</Text>
              <Text style={styles.modalSubtitle}>Be realistic. Then ignore it. (Just kidding. Mostly.)</Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>DATE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {dateOptions.map((opt) => {
                    const active = opt.dayStart === selectedDayStart;
                    return (
                      <Pressable
                        key={opt.dayStart}
                        onPress={() => {
                          hapticLight();
                          setSelectedDayStart(opt.dayStart);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && styles.chipPressed,
                        ]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>TIME</Text>
                <View style={styles.timeList}>
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
                    style={({ pressed }) => [
                      styles.timeRow,
                      timeMode === 'custom' && styles.timeRowActive,
                      pressed && styles.timeRowPressed,
                    ]}
                  >
                    <Text style={[styles.timeRowText, timeMode === 'custom' && styles.timeRowTextActive]}>
                      Custom · {timeMode === 'custom' ? (isCustomValid ? `${pad2(hourNum)}:${pad2(minuteNum)}` : '--:--') : 'Set your own'}
                    </Text>
                    {timeMode === 'custom' && <Text style={styles.timeRowCheck}>✓</Text>}
                  </Pressable>

                  {timeMode === 'custom' && (
                    <Animated.View
                      entering={FadeIn.duration(150)}
                      layout={Layout.springify()}
                      style={styles.customTimePanel}
                    >
                      <View style={styles.customTimeInputsRow}>
                        <View style={styles.timeInputBox}>
                          <TextInput
                            ref={hourInputRef}
                            value={hourRaw}
                            onChangeText={(t) => setCustomHour(parseTimePart(t, 2))}
                            placeholder="HH"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={2}
                            style={styles.timeInput}
                          />
                        </View>
                        <Text style={styles.timeColon}>:</Text>
                        <View style={styles.timeInputBox}>
                          <TextInput
                            value={minuteRaw}
                            onChangeText={(t) => setCustomMinute(parseTimePart(t, 2))}
                            placeholder="MM"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={2}
                            style={styles.timeInput}
                          />
                        </View>
                        <Text style={styles.timeSuffix}>24h</Text>
                      </View>
                      <Text style={[styles.customTimeHelper, !isCustomValid && styles.customTimeHelperDanger]}>
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
                        style={({ pressed }) => [
                          styles.timeRow,
                          active && styles.timeRowActive,
                          pressed && styles.timeRowPressed,
                        ]}
                      >
                        <Text style={[styles.timeRowText, active && styles.timeRowTextActive]}>{opt.label}</Text>
                        {active && <Text style={styles.timeRowCheck}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.modalPreview}>
                <Text style={styles.modalPreviewLabel}>DEADLINE</Text>
                <Text
                  style={[
                    styles.modalPreviewValue,
                    (selectedDeadlineAt === null || isInPast) && styles.modalPreviewValueDanger,
                  ]}
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
                style={({ pressed }) => [
                  styles.modalPrimaryButton,
                  pressed && styles.modalPrimaryButtonPressed,
                  (selectedDeadlineAt === null || isInPast) && styles.modalPrimaryButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={
                    selectedDeadlineAt === null || isInPast
                      ? [Colors.systemGray4, Colors.systemGray5]
                      : [Colors.accent, '#0A7FD4']
                  }
                  style={styles.modalPrimaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalPrimaryButtonText}>
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
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const hasMultiplier = multiplier > 1 && baseStake > 0;
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
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <Animated.View style={[styles.confirmSheet, sheetAnimStyle]}>
          <View style={styles.modalHandleHit} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <Text style={styles.confirmTitle}>Lock it in?</Text>
          <Text style={styles.confirmSubtitle}>This is the part where your future self gets nervous.</Text>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmPromiseText} numberOfLines={3}>
              {text}
            </Text>

            <View style={styles.confirmMetaRow}>
              <View style={styles.confirmMetaItem}>
                <Text style={styles.confirmMetaLabel}>FINE</Text>
                {hasMultiplier ? (
                  <View style={styles.confirmStakeBreakdown}>
                    <Text style={styles.confirmBaseStake}>${baseStake} ×{multiplier}</Text>
                    <Text style={styles.confirmMetaValue}>${stake}</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmMetaValue}>${stake}</Text>
                )}
              </View>
              <View style={styles.confirmMetaDivider} />
              <View style={styles.confirmMetaItem}>
                <Text style={styles.confirmMetaLabel}>DEADLINE</Text>
                <Text style={styles.confirmMetaValueSmall}>{formatDeadlineFriendly(deadlineAt)}</Text>
              </View>
            </View>

            {hasMultiplier && (
              <View style={styles.confirmMultiplierNote}>
                <Text style={styles.confirmMultiplierNoteIcon}>⚠️</Text>
                <Text style={styles.confirmMultiplierNoteText}>
                  Failure tax applied. Complete 3 promises to reset.
                </Text>
              </View>
            )}

            <View style={styles.confirmMetaDividerHorizontal} />
            <View style={styles.confirmMetaRowSingle}>
              <Text style={styles.confirmMetaLabel}>GOES TO</Text>
              <Text style={styles.confirmMetaValueSmall}>
                {formatDestinationTitle(moneyDestination, friendName)}
              </Text>
            </View>
          </View>

          <View style={styles.confirmActions}>
            <Pressable onPress={dismiss} style={({ pressed }) => [styles.confirmSecondary, pressed && styles.pressed]}>
              <Text style={styles.confirmSecondaryText}>Not yet</Text>
            </Pressable>
            <Pressable
              disabled={confirming}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmPrimary,
                pressed && styles.pressed,
                confirming && styles.confirmPrimaryDisabled,
              ]}
            >
              <LinearGradient
                colors={[Colors.danger, '#FF6B35']}
                style={styles.confirmPrimaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.confirmPrimaryText}>{confirming ? 'Saving your regret…' : 'Lock it in 🔒'}</Text>
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
  const [friendName, setFriendName] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | undefined>(undefined);
  const [verificationType, setVerificationType] = useState<VerificationType>(
    () => initialTemplate?.defaultVerification ?? 'photo'
  );
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

  // Stakes gating: if honor is selected and stake goes above threshold, switch to photo
  useEffect(() => {
    if (verificationType === 'honor' && effectiveStake >= STAKES_THRESHOLDS.honorDisabled) {
      setVerificationType('photo');
    }
  }, [effectiveStake, verificationType]);

  const friendOk = moneyDestination !== 'friend' || friendName.trim().length > 0;
  const canLock = text.trim().length > 0 && stake >= 0 && deadlineAt > nowMs && friendOk;
  const warningFree = stake === 0;

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
    hapticMedium();
    setConfirmOpen(true);
  }, []);

  const doCreate = useCallback(async () => {
    if (!canLock) return;
    setConfirming(true);
    try {
      // Use effective stake (with failure multiplier applied)
      const created = await createPromise({
        text: text.trim(),
        stake: effectiveStake,
        deadlineAt,
        moneyDestination,
        friendName: moneyDestination === 'friend' ? friendName.trim() : undefined,
        voiceNoteUri,
        verificationType,
      });
      hapticMedium();
      setConfirmOpen(false);
      router.replace({ pathname: '/promise/[id]', params: { id: created.id } });
    } finally {
      setConfirming(false);
    }
  }, [canLock, createPromise, deadlineAt, effectiveStake, friendName, moneyDestination, text, verificationType, voiceNoteUri]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={Platform.select({ ios: 6, android: 0 })}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>New promise</Text>
            <Text style={styles.headerSubtitle}>Say it out loud. Price it. Regret later.</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Templates */}
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>TEMPLATES</Text>
            <Text style={styles.sectionHint}>Because thinking is hard.</Text>
            <View style={styles.templatesGrid}>
              {PROMISE_TEMPLATES.map((t) => {
                const active = text.trim() === t.text.trim();
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => applyTemplate(t)}
                    style={({ pressed }) => [
                      styles.templateCard,
                      active && styles.templateCardActive,
                      pressed && styles.templateCardPressed,
                    ]}
                  >
                    <Text style={styles.templateEmoji}>{t.emoji}</Text>
                    <Text style={styles.templateText} numberOfLines={2}>
                      {t.text}
                    </Text>
                    <View style={styles.templateStake}>
                      <Text style={styles.templateStakeText}>${t.stake}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Text input */}
          <Animated.View entering={FadeInDown.delay(80).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>I WILL…</Text>
            <Text style={styles.sectionHint}>Try not to write a novel. Just the part you’ll break.</Text>

            <View style={styles.inputCard}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Stop negotiating with my alarm clock"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={120}
                style={styles.textInput}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.inputHelper}>{text.trim().length === 0 ? 'Say it. Commit. Panic.' : 'Nice.'}</Text>
                <Text style={styles.charCount}>{text.length}/120</Text>
              </View>
            </View>
          </Animated.View>

          {/* Deadline */}
          <Animated.View entering={FadeInDown.delay(120).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>DEADLINE</Text>
            <Text style={styles.sectionHint}>Pick a date your future self will hate.</Text>

            <Pressable
              onPress={() => {
                hapticLight();
                setDeadlineModalOpen(true);
              }}
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>⏳</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Deadline</Text>
                <Text style={styles.rowValue}>{formatDeadlineFriendly(deadlineAt)}</Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          </Animated.View>

          {/* Stake */}
          <Animated.View entering={FadeInDown.delay(160).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>STAKES</Text>
            <Text style={styles.sectionHint}>Loss aversion, but make it personal.</Text>

            <View style={styles.stakeCard}>
              <View style={styles.stakeTopRow}>
                <Text style={styles.stakeLabel}>FINE</Text>
                <View style={styles.stakeAmountContainer}>
                  {showMultiplierWarning && stake > 0 && (
                    <Text style={styles.stakeBaseAmount}>${stake} ×{failureMultiplier} =</Text>
                  )}
                  <Text style={[styles.stakeAmount, showMultiplierWarning && stake > 0 && styles.stakeAmountPenalty]}>
                    ${effectiveStake}
                  </Text>
                </View>
              </View>

              <View style={styles.stakePresets}>
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
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipDangerActive,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>${amt}</Text>
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
                  style={({ pressed }) => [styles.iconChip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.iconChipText}>+</Text>
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
                  style={({ pressed }) => [styles.iconChip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.iconChipText}>−</Text>
                </Pressable>
              </View>

              <View style={styles.customFineRow}>
                <Text style={styles.customFineLabel}>CUSTOM</Text>
                <View style={styles.customFineInputWrap}>
                  <Text style={styles.customFineDollar}>$</Text>
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
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                    style={styles.customFineInput}
                  />
                </View>
                <Text style={styles.customFineHelper}>Type it like an adult. We’ll still judge quietly.</Text>
              </View>

              {warningFree && (
                <Animated.View entering={FadeIn.duration(180)} layout={Layout.springify()} style={styles.warningRow}>
                  <Text style={styles.warningIcon}>⚠️</Text>
                  <Text style={styles.warningText}>$0 is allowed. So is lying for free. Classic combo.</Text>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Verification */}
          <Animated.View entering={FadeInDown.delay(170).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>{VERIFICATION_COPY.sectionTitle}</Text>
            <Text style={styles.sectionHint}>{VERIFICATION_COPY.sectionHint}</Text>

            <VerificationPicker
              value={verificationType}
              onChange={setVerificationType}
              stake={effectiveStake}
            />
          </Animated.View>

          {/* Where money goes */}
          <Animated.View entering={FadeInDown.delay(190).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>WHERE THE MONEY GOES</Text>
            <Text style={styles.sectionHint}>UI-only for now. But your guilt can have preferences.</Text>

            <View style={styles.destinationList}>
              {DESTINATIONS.map((d) => {
                const active = d.id === moneyDestination;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      hapticLight();
                      setMoneyDestination(d.id);
                    }}
                    style={({ pressed }) => [
                      styles.destinationCard,
                      active && styles.destinationCardActive,
                      pressed && styles.destinationCardPressed,
                    ]}
                  >
                    <View style={styles.destinationLeft}>
                      <Text style={styles.destinationEmoji}>{d.emoji}</Text>
                    </View>
                    <View style={styles.destinationBody}>
                      <Text style={styles.destinationTitle}>{d.title}</Text>
                      <Text style={styles.destinationSubtitle}>{d.subtitle}</Text>
                    </View>
                    {active && <Text style={styles.destinationCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>

            {moneyDestination === 'friend' && (
              <Animated.View entering={FadeIn.duration(180)} layout={Layout.springify()} style={styles.friendCard}>
                <Text style={styles.friendLabel}>FRIEND</Text>
                <TextInput
                  value={friendName}
                  onChangeText={setFriendName}
                  placeholder="Name / @handle"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={32}
                  style={styles.friendInput}
                />
                <Text style={[styles.friendHelper, friendName.trim().length === 0 && styles.friendHelperDanger]}>
                  {friendName.trim().length === 0
                    ? "Name them. Otherwise it's imaginary accountability."
                    : 'Pick someone who enjoys saying "I told you so."'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Voice commitment */}
          <Animated.View entering={FadeInDown.delay(210).duration(220)} style={styles.section}>
            <Text style={styles.sectionLabel}>OPTIONAL: VOICE COMMITMENT</Text>
            <Text style={styles.sectionHint}>Say it out loud. We'll haunt you with it later.</Text>

            <VoiceRecorder
              existingUri={voiceNoteUri}
              onRecordingComplete={(uri) => setVoiceNoteUri(uri)}
              onClear={() => setVoiceNoteUri(undefined)}
            />

            {voiceNoteUri && (
              <Animated.View entering={FadeIn.duration(150)} style={styles.voiceConfirmation}>
                <Text style={styles.voiceConfirmationIcon}>✓</Text>
                <Text style={styles.voiceConfirmationText}>
                  Voice recorded. Your future self will hear this.
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Failure Multiplier Warning */}
          {showMultiplierWarning && (
            <Animated.View entering={FadeIn.duration(200)} layout={Layout.springify()} style={styles.multiplierWarning}>
              <View style={styles.multiplierWarningHeader}>
                <Text style={styles.multiplierWarningIcon}>⚠️</Text>
                <Text style={styles.multiplierWarningTitle}>{STATS_COPY.multiplierTitle}: {failureMultiplier}×</Text>
              </View>
              <Text style={styles.multiplierWarningText}>
                {failureMultiplier >= 8
                  ? STATS_COPY.multiplier8x
                  : failureMultiplier >= 4
                    ? STATS_COPY.multiplier4x
                    : STATS_COPY.multiplier2x}
              </Text>
              <View style={styles.multiplierProgressRow}>
                <Text style={styles.multiplierProgressText}>
                  Complete {3 - multiplierProgress.current} more to reset
                </Text>
                <View style={styles.multiplierProgressDots}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.multiplierDot,
                        i < multiplierProgress.current && styles.multiplierDotFilled,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Lock in */}
          <Animated.View entering={FadeInDown.delay(230).duration(220)} style={styles.lockSection}>
            <Pressable
              disabled={!canLock || isWorking}
              onPress={openConfirm}
              style={({ pressed }) => [
                styles.lockButton,
                pressed && styles.lockButtonPressed,
                (!canLock || isWorking) && styles.lockButtonDisabled,
              ]}
            >
              <LinearGradient
                colors={!canLock || isWorking ? [Colors.systemGray4, Colors.systemGray5] : [Colors.danger, '#FF6B35']}
                style={styles.lockButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.lockButtonText}>{isWorking ? 'Working…' : 'Lock it in 🔒'}</Text>
              </LinearGradient>
            </Pressable>
            <Text style={styles.lockFootnote}>You can't "un-send" this. (You can, but it ruins the vibe.)</Text>
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
        confirming={confirming}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.textSecondary,
    marginTop: -2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xxl,
  },

  section: { gap: Spacing.md },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
    marginTop: -8,
  },

  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  templateCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  templateCardPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.borderFocus,
  },
  templateCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  templateEmoji: { fontSize: 22 },
  templateText: {
    ...Typography.caption,
    color: Colors.text,
    lineHeight: 18,
    minHeight: 36,
  },
  templateStake: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dangerDim,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  templateStakeText: {
    ...Typography.caption,
    color: Colors.danger,
    fontFamily: Fonts.mono,
    fontWeight: '600',
  },

  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  textInput: {
    minHeight: 84,
    ...Typography.body,
    color: Colors.text,
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputHelper: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  charCount: {
    ...Typography.captionMono,
    color: Colors.textMuted,
  },

  rowCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowCardPressed: { backgroundColor: Colors.bgCardHover },
  rowLeft: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 16 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rowValue: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  rowChevron: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  stakeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  stakeTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  stakeLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  stakeAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  stakeBaseAmount: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  stakeAmount: {
    ...Typography.displaySmall,
    color: Colors.danger,
    fontFamily: Fonts.rounded,
  },
  stakeAmountPenalty: {
    color: Colors.danger,
  },
  stakePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },

  customFineRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  customFineLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  customFineInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  customFineDollar: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  customFineInput: {
    flex: 1,
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.mono,
    paddingVertical: 0,
  },
  customFineHelper: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginLeft: Spacing.xs,
  },

  chipsRow: {
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  chipDangerActive: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
  },
  chipPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  chipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },
  chipTextActive: { color: Colors.text },

  iconChip: {
    width: 40,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipText: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: -1,
  },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 159, 10, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.18)',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  warningIcon: { fontSize: 14, marginTop: 1 },
  warningText: {
    ...Typography.caption,
    color: Colors.warning,
    flex: 1,
  },

  destinationList: {
    gap: Spacing.sm,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  destinationCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  destinationCardPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  destinationLeft: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationEmoji: {
    fontSize: 16,
  },
  destinationBody: {
    flex: 1,
    gap: 2,
  },
  destinationTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  destinationSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  destinationCheck: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 16,
  },

  friendCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  friendLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  friendInput: {
    ...Typography.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  friendHelper: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginLeft: Spacing.xs,
  },
  friendHelperDanger: {
    color: Colors.danger,
    fontWeight: '600',
  },

  voiceConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  voiceConfirmationIcon: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  voiceConfirmationText: {
    ...Typography.caption,
    color: Colors.success,
    fontStyle: 'italic',
  },

  lockSection: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  lockButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  lockButtonDisabled: {
    opacity: 0.55,
  },
  lockButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  lockButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  lockFootnote: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Multiplier warning
  multiplierWarning: {
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  multiplierWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  multiplierWarningIcon: {
    fontSize: 18,
  },
  multiplierWarningTitle: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    fontFamily: Fonts.rounded,
  },
  multiplierWarningText: {
    ...Typography.body,
    color: Colors.danger,
  },
  multiplierProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  multiplierProgressText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  multiplierProgressDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  multiplierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.systemGray4,
    borderWidth: 1,
    borderColor: Colors.systemGray3,
  },
  multiplierDotFilled: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },

  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // Deadline modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  modalKav: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    width: '100%',
    height: '78%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  modalHandleHit: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: Spacing.md,
    marginTop: -6,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.systemGray4,
  },
  modalBodyScroll: {
    flex: 1,
    width: '100%',
  },
  modalBodyContent: {
    gap: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: -8,
  },
  modalSection: { gap: Spacing.sm },
  modalSectionLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  timeList: { gap: Spacing.sm },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeRowActive: { borderColor: Colors.accent, backgroundColor: Colors.accentDim },
  timeRowPressed: { backgroundColor: Colors.bgCardHover },
  timeRowText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  timeRowTextActive: { color: Colors.text },
  timeRowCheck: {
    color: Colors.accent,
    fontWeight: '700',
  },
  customTimePanel: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  customTimeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  timeInputBox: {
    width: 64,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeInput: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.mono,
    textAlign: 'center',
    paddingVertical: 0,
  },
  timeColon: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -1,
  },
  timeSuffix: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
  },
  customTimeHelper: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  customTimeHelperDanger: {
    color: Colors.danger,
    fontWeight: '600',
  },
  modalFooter: { gap: Spacing.md },
  modalPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  modalPreviewLabel: { ...Typography.label, color: Colors.textMuted },
  modalPreviewValue: { ...Typography.bodySemibold, color: Colors.text, fontFamily: Fonts.rounded },
  modalPreviewValueDanger: { color: Colors.danger },
  modalPrimaryButton: { height: 48, borderRadius: 24, overflow: 'hidden' },
  modalPrimaryButtonPressed: { transform: [{ scale: 0.99 }] },
  modalPrimaryButtonDisabled: { opacity: 0.6 },
  modalPrimaryButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryButtonText: { ...Typography.bodySemibold, color: Colors.text },

  // Confirm modal
  confirmSheet: {
    width: '100%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  confirmTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  confirmSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: -8,
  },
  confirmCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  confirmPromiseText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 22,
  },
  confirmMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  confirmMetaItem: { flex: 1, gap: 4 },
  confirmMetaLabel: { ...Typography.label, color: Colors.textMuted },
  confirmMetaValue: { ...Typography.h2, color: Colors.danger, fontFamily: Fonts.mono },
  confirmMetaValueSmall: { ...Typography.bodyMedium, color: Colors.textSecondary },
  confirmStakeBreakdown: { gap: 2 },
  confirmBaseStake: { ...Typography.caption, color: Colors.textSecondary, fontFamily: Fonts.mono },
  confirmMultiplierNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  confirmMultiplierNoteIcon: { fontSize: 14 },
  confirmMultiplierNoteText: { ...Typography.caption, color: Colors.danger, flex: 1 },
  confirmMetaDivider: { width: 1, height: 42, backgroundColor: Colors.border },
  confirmMetaDividerHorizontal: { height: 1, backgroundColor: Colors.borderSubtle },
  confirmMetaRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  confirmActions: { flexDirection: 'row', gap: Spacing.md },
  confirmSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: { ...Typography.bodySemibold, color: Colors.textSecondary },
  confirmPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  confirmPrimaryDisabled: { opacity: 0.7 },
  confirmPrimaryGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmPrimaryText: { ...Typography.bodySemibold, color: Colors.text, fontFamily: Fonts.rounded },
});


