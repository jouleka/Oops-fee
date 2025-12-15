import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/ui/loading-state';
import { VoicePlayback } from '@/components/voice';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import { formatShortDateTime, getTimeRemaining, type Urgency } from '@/lib/promises/time';
import type { PromiseStatus, UserPromise } from '@/lib/promises/types';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

const URGENCY_COLORS: Record<Urgency, string> = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.danger,
  critical: Colors.danger,
};

function StatusPill({ status }: { status: PromiseStatus }) {
  const { label, color, bg } = useMemo(() => {
    switch (status) {
      case 'completed':
        return { label: 'COMPLETED', color: Colors.success, bg: Colors.successDim };
      case 'failed':
        return { label: 'FAILED', color: Colors.danger, bg: Colors.dangerDim };
      case 'expired':
        return { label: 'EXPIRED', color: Colors.danger, bg: Colors.dangerDim };
      default:
        return { label: 'ACTIVE', color: Colors.accent, bg: Colors.accentDim };
    }
  }, [status]);

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function formatDestination(p: UserPromise): string {
  switch (p.moneyDestination) {
    case 'charity':
      return '💛 Charity';
    case 'anti_charity':
      return '🧨 Anti-charity';
    case 'friend':
      return p.friendName?.trim() ? `🤝 Friend · ${p.friendName.trim()}` : '🤝 Friend';
    default:
      return '☕️ OopsFee (us)';
  }
}

function ConfirmActionModal({
  visible,
  title,
  subtitle,
  confirmText,
  confirmColors,
  onCancel,
  onConfirm,
  working,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmText: string;
  confirmColors: [string, string];
  onCancel: () => void;
  onConfirm: () => void;
  working: boolean;
}) {
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
        <Animated.View style={[styles.modalSheet, sheetAnimStyle]}>
          <View style={styles.modalHandleHit} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>

          <View style={styles.modalActions}>
            <Pressable onPress={dismiss} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={working}
              onPress={onConfirm}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, working && styles.disabled]}
            >
              <LinearGradient
                colors={confirmColors}
                style={styles.primaryBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.primaryBtnText}>{working ? 'Processing feelings…' : confirmText}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * FailConfirmModal - The guilt-trip modal
 * If there's a voice recording, makes the user listen before they can confirm failure.
 */
function FailConfirmModal({
  visible,
  voiceNoteUri,
  onCancel,
  onConfirm,
  working,
}: {
  visible: boolean;
  voiceNoteUri?: string;
  onCancel: () => void;
  onConfirm: () => void;
  working: boolean;
}) {
  const [hasListened, setHasListened] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const closingRef = useRef(false);
  const translateY = useSharedValue(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setHasListened(false);
      setVoiceError(false);
      closingRef.current = false;
      translateY.value = 0;
    }
  }, [visible, translateY]);

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

  // Allow confirmation if: no voice note, already listened, or voice failed to load
  const canConfirm = !voiceNoteUri || hasListened || voiceError;
  const hasVoice = !!voiceNoteUri && !voiceError;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <Animated.View style={[styles.failModalSheet, sheetAnimStyle]}>
          <View style={styles.modalHandleHit} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <View style={styles.failModalContent}>
            {/* Header with emoji */}
            <View style={styles.failModalHeader}>
              <Text style={styles.failModalEmoji}>💸</Text>
              <Text style={styles.modalTitle}>Mark as failed?</Text>
              <Text style={styles.modalSubtitle}>
                {hasVoice
                  ? "Wait. Before you quit, listen to yourself."
                  : "Pressing this builds character. Allegedly."}
              </Text>
            </View>

            {/* Voice playback if exists */}
            {hasVoice && (
              <View style={styles.voiceSection}>
                <VoicePlayback
                  uri={voiceNoteUri}
                  autoPlay={true}
                  onPlaybackComplete={() => setHasListened(true)}
                  onError={() => {
                    setVoiceError(true);
                    setHasListened(true);
                  }}
                  message="This is what you said when you still believed."
                />
                {!hasListened && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.listenWarning}>
                    <Text style={styles.listenWarningText}>
                      Listen to your voice commitment before confirming.
                    </Text>
                  </Animated.View>
                )}
              </View>
            )}

            {/* No voice note message */}
            {!hasVoice && !voiceNoteUri && (
              <View style={styles.noVoiceHint}>
                <Text style={styles.noVoiceHintText}>
                  No voice commitment recorded. (Next time, guilt-trip yourself.)
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <Pressable onPress={dismiss} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                <Text style={styles.secondaryBtnText}>I changed my mind</Text>
              </Pressable>
              <Pressable
                disabled={working || !canConfirm}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  (working || !canConfirm) && styles.disabled,
                ]}
              >
                <LinearGradient
                  colors={canConfirm ? [Colors.danger, '#FF6B35'] : [Colors.systemGray4, Colors.systemGray5]}
                  style={styles.primaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.primaryBtnText}>
                    {working
                      ? 'Processing feelings…'
                      : !canConfirm
                        ? 'Listen first'
                        : 'Yes, I failed'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function NotFound() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>It’s gone.</Text>
        <Text style={styles.notFoundSubtitle}>Like motivation. Like innocence. Like that promise.</Text>
        <Pressable
          onPress={() => {
            hapticLight();
            router.replace('/home');
          }}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryBtnText}>Back to reality</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PromiseDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);
  const { promises, setPromiseStatus, deletePromise, isWorking, isHydrated } = usePromiseStore();

  const promise: UserPromise | null = useMemo(() => {
    if (!id) return null;
    return promises.find((p) => p.id === id) ?? null;
  }, [id, promises]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remaining = promise ? getTimeRemaining(promise.deadlineAt, now) : null;
  const urgencyColor = remaining ? URGENCY_COLORS[remaining.urgency] : Colors.textMuted;

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmFail, setConfirmFail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const canChangeStatus = promise?.status !== 'completed' && promise?.status !== 'failed';

  const handleComplete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await setPromiseStatus(promise.id, 'completed');
    setConfirmComplete(false);
    // Navigate to success celebration screen
    router.replace({ pathname: '/promise/success', params: { promiseId: promise.id } });
  }, [promise, setPromiseStatus]);

  const handleFail = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await setPromiseStatus(promise.id, 'failed');
    setConfirmFail(false);
  }, [promise, setPromiseStatus]);

  const handleDelete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await deletePromise(promise.id);
    setConfirmDelete(false);
    router.replace('/home');
  }, [deletePromise, promise]);

  if (!isHydrated) {
    return <LoadingState title="Loading promise…" subtitle="Locating the thing you swore you’d do." />;
  }

  if (!promise) return <NotFound />;

  const isExpiredView = promise.status === 'expired' || (promise.status === 'active' && promise.deadlineAt <= now);
  const showCountdown = promise.status === 'active' || promise.status === 'expired';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Promise</Text>
          <Text style={styles.headerSubtitle}>Your move.</Text>
        </View>

        <Pressable
          onPress={() => {
            hapticLight();
            setConfirmDelete(true);
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(220)} style={styles.hero}>
          <View style={styles.heroTop}>
            <StatusPill status={promise.status} />
            <View style={[styles.moneyChip, { backgroundColor: Colors.dangerDim, borderColor: Colors.danger + '55' }]}>
              <Text style={styles.moneyChipText}>${promise.stake}</Text>
            </View>
          </View>

          <Text style={styles.promiseText}>{promise.text}</Text>

          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>DEADLINE</Text>
              <Text style={styles.metaValue}>{formatShortDateTime(promise.deadlineAt)}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{showCountdown ? 'TIME LEFT' : 'WHEN'}</Text>
              <Text style={[styles.metaValue, showCountdown && { color: urgencyColor }]}>
                {showCountdown ? remaining?.label : formatShortDateTime(promise.updatedAt)}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>GOES TO</Text>
              <Text style={styles.metaValue}>{formatDestination(promise)}</Text>
            </View>
            {promise.voiceNoteUri && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>VOICE</Text>
                  <Text style={styles.metaValue}>🎙️ Recorded</Text>
                </View>
              </>
            )}
          </View>

          {isExpiredView && (
            <Animated.View entering={FadeIn.duration(180)} layout={Layout.springify()} style={styles.expiredBanner}>
              <Text style={styles.expiredIcon}>⏰</Text>
              <Text style={styles.expiredText}>
                Deadline passed. This is the part where you either own it or rewrite history.
              </Text>
            </Animated.View>
          )}

          {promise.status === 'completed' && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.successBanner}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successText}>You did it. Your wallet lives to see another day.</Text>
            </Animated.View>
          )}

          {promise.status === 'failed' && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.failBanner}>
              <Text style={styles.failIcon}>💸</Text>
              <Text style={styles.failText}>
                You failed. Payment is “coming soon”. Convenient timing, I know.
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {canChangeStatus && (
          <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.actions}>
            <Pressable
              onPress={() => {
                hapticLight();
                setConfirmComplete(true);
              }}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, styles.actionSuccess]}
            >
              <LinearGradient
                colors={[Colors.success, '#2EC44F']}
                style={styles.actionBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.actionBtnText}>I did it ✓</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                hapticLight();
                setConfirmFail(true);
              }}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, styles.actionDanger]}
            >
              <LinearGradient
                colors={[Colors.danger, '#FF6B35']}
                style={styles.actionBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.actionBtnText}>I failed 💸</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {promise.status === 'active'
              ? "Reminder: lying to the app is easier than lying to yourself. But not by much."
              : 'No further actions required. (Unless you enjoy consequences.)'}
          </Text>
        </View>
      </ScrollView>

      <ConfirmActionModal
        visible={confirmComplete}
        title="Mark as completed?"
        subtitle="This is the part where the app trusts you. Weird."
        confirmText="Yes, I did it"
        confirmColors={[Colors.success, '#2EC44F']}
        onCancel={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        working={isWorking}
      />

      <FailConfirmModal
        visible={confirmFail}
        voiceNoteUri={promise.voiceNoteUri}
        onCancel={() => setConfirmFail(false)}
        onConfirm={handleFail}
        working={isWorking}
      />

      <ConfirmActionModal
        visible={confirmDelete}
        title="Delete this promise?"
        subtitle="Sure. Delete the evidence. Very healthy."
        confirmText="Delete"
        confirmColors={[Colors.systemGray2, Colors.systemGray4]}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        working={isWorking}
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
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { ...Typography.h2, color: Colors.text, fontFamily: Fonts.rounded },
  headerSubtitle: { ...Typography.caption, color: Colors.textTertiary },
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: { color: Colors.textSecondary, fontSize: 18, fontWeight: '700', marginTop: -2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.xl },

  hero: { gap: Spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pillText: { ...Typography.label },
  moneyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  moneyChipText: { ...Typography.bodySemibold, color: Colors.danger, fontFamily: Fonts.mono },

  promiseText: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 28,
  },

  metaCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  metaLabel: { ...Typography.label, color: Colors.textMuted },
  metaValue: { ...Typography.bodySemibold, color: Colors.textSecondary, fontFamily: Fonts.rounded },
  metaDivider: { height: 1, backgroundColor: Colors.borderSubtle },

  expiredBanner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.18)',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  expiredIcon: { fontSize: 14, marginTop: 1 },
  expiredText: { ...Typography.caption, color: Colors.danger, flex: 1 },

  successBanner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.successDim,
    borderWidth: 1,
    borderColor: Colors.success + '55',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  successIcon: { fontSize: 14, marginTop: 1 },
  successText: { ...Typography.caption, color: Colors.success, flex: 1 },

  failBanner: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '55',
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  failIcon: { fontSize: 14, marginTop: 1 },
  failText: { ...Typography.caption, color: Colors.danger, flex: 1 },

  actions: { gap: Spacing.md, paddingTop: Spacing.md },
  actionBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  actionBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { ...Typography.bodySemibold, color: Colors.text, fontFamily: Fonts.rounded },
  actionSuccess: {},
  actionDanger: {},

  footer: { paddingTop: Spacing.xl },
  footerText: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic' },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.7 },

  // modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  modalSheet: {
    width: '100%',
    maxHeight: '88%',
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
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.systemGray4,
  },
  modalTitle: { ...Typography.h3, color: Colors.text, fontFamily: Fonts.rounded, textAlign: 'center' },
  modalSubtitle: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: -8 },
  modalActions: { flexDirection: 'row', gap: Spacing.md },

  // Fail modal specific
  failModalSheet: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  failModalContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  failModalHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  failModalEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  voiceSection: {
    gap: Spacing.md,
  },
  listenWarning: {
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  listenWarningText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
    textAlign: 'center',
  },
  noVoiceHint: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  noVoiceHintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { ...Typography.bodySemibold, color: Colors.textSecondary },
  primaryBtn: { flex: 1, height: 52, borderRadius: 26, overflow: 'hidden' },
  primaryBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { ...Typography.bodySemibold, color: Colors.text, fontFamily: Fonts.rounded },

  // not found
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  notFoundTitle: { ...Typography.h1, color: Colors.text, fontFamily: Fonts.rounded },
  notFoundSubtitle: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center' },
});


