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

import { ShareModal } from '@/components/share';
import { LoadingState } from '@/components/ui/loading-state';
import { PhotoCaptureModal } from '@/components/verification';
import { VoicePlayback } from '@/components/voice';
import { FAILURE_COPY, VERIFICATION_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { usePromiseStore } from '@/context/promise-store';
import { formatShortDateTime, getTimeRemaining, type Urgency } from '@/lib/promises/time';
import type { PromiseStatus, UserPromise } from '@/lib/promises/types';
import { supabase } from '@/lib/supabase';

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
 * Shows "I Told You So" message reveal with dramatic animation.
 */
function FailConfirmModal({
  visible,
  voiceNoteUri,
  iToldYouSoMessages,
  sponsorAmount,
  stake,
  onCancel,
  onConfirm,
  working,
}: {
  visible: boolean;
  voiceNoteUri?: string;
  iToldYouSoMessages?: { message: string; from: string }[];
  sponsorAmount?: number;
  stake: number;
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
  const hasIToldYouSo = (iToldYouSoMessages?.length ?? 0) > 0;
  const hasSponsor = (sponsorAmount ?? 0) > 0;
  const hasStake = stake > 0;
  const totalLoss = stake + (sponsorAmount ?? 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <Animated.View style={[styles.failModalSheet, sheetAnimStyle]}>
          <View style={styles.modalHandleHit} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <ScrollView 
            style={styles.failModalScroll}
            contentContainerStyle={styles.failModalContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
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

            {/* I Told You So preview - show sealed envelope before confirming */}
            {hasIToldYouSo && (
              <Animated.View entering={FadeInDown.delay(100).duration(250)} style={styles.sealedEnvelope}>
                <View style={styles.envelopeIcon}>
                  <Text style={styles.envelopeEmoji}>💌</Text>
                </View>
                <View style={styles.envelopeContent}>
                  <Text style={styles.envelopeTitle}>A message awaits...</Text>
                  <Text style={styles.envelopeHint}>
                    Someone left you a note. It will be revealed after you confirm.
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Sponsor warning */}
            {hasSponsor && (
              <Animated.View entering={FadeIn.delay(150).duration(200)} style={styles.sponsorWarning}>
                <Text style={styles.sponsorWarningIcon}>👀</Text>
                <Text style={styles.sponsorWarningText}>
                  +${sponsorAmount} from sponsors is also on the line.
                </Text>
              </Animated.View>
            )}

            {/* Charge warning - the real talk */}
            {hasStake && (
              <Animated.View entering={FadeIn.delay(200).duration(250)} style={styles.chargeWarning}>
                <View style={styles.chargeWarningHeader}>
                  <Text style={styles.chargeWarningIcon}>💳</Text>
                  <Text style={styles.chargeWarningTitle}>Real money. Real consequences.</Text>
                </View>
                <Text style={styles.chargeWarningAmount}>
                  ${totalLoss} will be charged
                </Text>
                <Text style={styles.chargeWarningSubtext}>
                  No refunds. No excuses. No &quot;my dog ate my gym shoes.&quot;
                </Text>
              </Animated.View>
            )}

            {/* Action buttons - stacked vertically for better layout */}
            <View style={styles.failModalActions}>
              <Pressable
                disabled={working || !canConfirm}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.failPrimaryBtn,
                  pressed && styles.pressed,
                  (working || !canConfirm) && styles.disabled,
                ]}
              >
                <LinearGradient
                  colors={canConfirm ? [Colors.danger, '#FF6B35'] : [Colors.systemGray4, Colors.systemGray5]}
                  style={styles.failPrimaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.failPrimaryBtnText}>
                    {working
                      ? 'Processing…'
                      : !canConfirm
                        ? 'Listen first'
                        : hasStake
                          ? `💳 Pay $${totalLoss} & admit defeat`
                          : 'Yes, I failed'}
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={dismiss} style={({ pressed }) => [styles.failSecondaryBtn, pressed && styles.pressed]}>
                <Text style={styles.failSecondaryBtnText}>Wait, I changed my mind</Text>
              </Pressable>
            </View>
          </ScrollView>
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
            router.replace('/(mobile)/home');
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
  const { promises, setPromiseStatus, updatePromise, deletePromise, isWorking, isHydrated } = usePromiseStore();
  const { session, refreshProfile } = useAuth();

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
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showPartnerSendPrompt, setShowPartnerSendPrompt] = useState(false);

  // Calculate total stake including sponsors
  const totalStake = promise ? promise.stake + (promise.sponsorAmount ?? 0) : 0;
  const hasSponsor = promise && (promise.sponsorAmount ?? 0) > 0;
  const needsPhotoProof = promise?.verificationType === 'photo';
  const needsPartnerVerification = promise?.verificationType === 'partner';
  const isAwaitingPartner = promise?.partnerState === 'awaiting';

  // Fetch roast messages directly for failed promises
  const [roastMessages, setRoastMessages] = useState<{ message: string; from: string }[]>([]);
  const [loadingRoasts, setLoadingRoasts] = useState(false);

  useEffect(() => {
    if (!promise || promise.status !== 'failed') return;
    
    const promiseId = promise.id;
    const existingMessages = promise.iToldYouSoMessages ?? [];
    const hasPlaceholder = existingMessages.some(m => m.message === '(from server)');
    
    // If we already have valid messages (not placeholders), use them
    if (existingMessages.length > 0 && !hasPlaceholder) {
      setRoastMessages(existingMessages);
      return;
    }

    // Fetch fresh messages from database
    async function fetchMessages() {
      setLoadingRoasts(true);
      try {
        const { data, error } = await supabase
          .from('roast_messages')
          .select('message, from_name')
          .eq('promise_id', promiseId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setRoastMessages(data.map(r => ({ message: r.message, from: r.from_name })));
        } else {
          // Fallback to existing messages if fetch fails
          const filtered = existingMessages.filter(m => m.message !== '(from server)');
          setRoastMessages(filtered);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setLoadingRoasts(false);
      }
    }

    fetchMessages();
  }, [promise]);

  const hasIToldYouSo = roastMessages.length > 0;

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const canChangeStatus = promise?.status !== 'completed' && promise?.status !== 'failed';

  // Handler for initiating completion - checks if verification is needed
  const handleInitiateComplete = useCallback(() => {
    if (!promise) return;
    hapticLight();
    
    if (needsPhotoProof) {
      // Photo verification required - show photo capture modal
      setShowPhotoCapture(true);
    } else if (needsPartnerVerification) {
      // Partner verification required
      if (isAwaitingPartner) {
        // Already awaiting - just show share modal
        setShowShareModal(true);
      } else {
        // Show prompt to send to partner
        setShowPartnerSendPrompt(true);
      }
    } else {
      // No special verification needed - show regular confirmation
      setConfirmComplete(true);
    }
  }, [promise, needsPhotoProof, needsPartnerVerification, isAwaitingPartner]);

  // Handler for completing with photo proof
  const handlePhotoCapture = useCallback(async (photoUri: string) => {
    if (!promise) return;
    hapticMedium();
    
    // Store photo proof and mark as completed
    await updatePromise(promise.id, {
      status: 'completed',
      completedAt: Date.now(),
      verificationProof: photoUri,
      verificationTimestamp: Date.now(),
    });
    
    setShowPhotoCapture(false);
    // Navigate to success celebration screen
    router.replace({ pathname: '/(mobile)/promise/success', params: { promiseId: promise.id } });
  }, [promise, updatePromise]);

  // Handler for completing without photo (honor system)
  const handleComplete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await setPromiseStatus(promise.id, 'completed');
    setConfirmComplete(false);
    // Navigate to success celebration screen
    router.replace({ pathname: '/(mobile)/promise/success', params: { promiseId: promise.id } });
  }, [promise, setPromiseStatus]);

  // Handler for initiating partner verification - sets awaiting state and opens share modal
  const handlePartnerVerificationStart = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    
    // Set partner state to awaiting with 24h deadline
    const partnerDeadlineAt = Date.now() + 24 * 60 * 60 * 1000;
    await updatePromise(promise.id, {
      partnerState: 'awaiting',
      partnerDeadlineAt,
    });
    
    setShowPartnerSendPrompt(false);
    // Open share modal so they can send the partner link
    setShowShareModal(true);
  }, [promise, updatePromise]);

  // Track if we're processing a failure to prevent double charges
  const [isProcessingFail, setIsProcessingFail] = useState(false);

  const handleFail = useCallback(async () => {
    if (!promise) return;
    
    // CRITICAL: Prevent double-click charges
    if (isProcessingFail) {
      console.log('[handleFail] Already processing, ignoring duplicate click');
      return;
    }
    setIsProcessingFail(true);
    
    hapticMedium();

    // If there's a stake and user is authenticated, charge immediately
    if (promise.stake > 0 && session?.access_token) {
      try {
        const { data, error } = await supabase.functions.invoke('charge-promise', {
          body: { promiseId: promise.id },
        });

        if (error) {
          console.error('[handleFail] Edge function error:', error);
          // No alert - the fail banner will show appropriate status
        } else if (data) {
          console.log('[handleFail] Charge result:', data);
          // Refresh profile to update wallet balance if wallet was used
          if (data.walletUsed && data.walletUsed > 0) {
            refreshProfile().catch(() => {});
          }
          // No alerts - the updated fail banner shows accurate payment status
          // User will see "💸 $X charged" or "🔐 Bank confirmation needed" etc.
        }
      } catch (err) {
        console.error('[handleFail] Error calling charge-promise:', err);
        // Still mark as failed locally even if charge call fails
      }
    }

    // Update local state
    await setPromiseStatus(promise.id, 'failed');
    setConfirmFail(false);
    setIsProcessingFail(false);
  }, [promise, setPromiseStatus, session, isProcessingFail, refreshProfile]);

  const handleDelete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await deletePromise(promise.id);
    setConfirmDelete(false);
    router.replace('/(mobile)/home');
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

        <View style={styles.headerButtons}>
          {canChangeStatus && (
            <Pressable
              onPress={() => {
                hapticLight();
                setShowShareModal(true);
              }}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Text style={styles.iconButtonText}>↗</Text>
            </Pressable>
          )}
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
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(220)} style={styles.hero}>
          <View style={styles.heroTop}>
            <StatusPill status={promise.status} />
            <View style={styles.stakeChipContainer}>
              {hasSponsor && (
                <View style={[styles.sponsorChip, { backgroundColor: Colors.warningDim, borderColor: Colors.warning + '44' }]}>
                  <Text style={styles.sponsorChipText}>+${promise.sponsorAmount} sponsored</Text>
                </View>
              )}
              <View style={[styles.moneyChip, { backgroundColor: Colors.dangerDim, borderColor: Colors.danger + '55' }]}>
                <Text style={styles.moneyChipText}>${promise.stake}</Text>
              </View>
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
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>VERIFICATION</Text>
              <Text style={[
                styles.metaValue,
                promise.partnerState === 'approved' && { color: Colors.success },
                promise.partnerState === 'rejected' && { color: Colors.danger },
                promise.partnerState === 'awaiting' && { color: Colors.accent },
              ]}>
                {promise.verificationType === 'photo' && '📷 Photo proof'}
                {promise.verificationType === 'partner' && (
                  promise.partnerState === 'approved' ? '✅ Partner approved' :
                  promise.partnerState === 'rejected' ? '❌ Partner rejected' :
                  promise.partnerState === 'awaiting' ? '👀 Awaiting partner' :
                  promise.partnerState === 'expired' ? '⏳ Partner timed out' :
                  '👥 Friend confirms'
                )}
                {promise.verificationType === 'honor' && '🤞 Honor system'}
                {promise.verificationType === 'healthkit' && '⌚ Health data'}
                {promise.verificationType === 'location' && '📍 Location check'}
              </Text>
            </View>
            {promise.verificationProof && promise.status === 'completed' && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>PROOF</Text>
                  <Text style={[styles.metaValue, { color: Colors.success }]}>✓ {VERIFICATION_COPY.verifiedBadge}</Text>
                </View>
              </>
            )}
          </View>

          {/* Awaiting partner verification banner */}
          {isAwaitingPartner && promise.status === 'active' && (
            <Animated.View entering={FadeIn.duration(180)} layout={Layout.springify()} style={styles.awaitingPartnerBanner}>
              <Text style={styles.awaitingPartnerIcon}>👀</Text>
              <View style={styles.awaitingPartnerContent}>
                <Text style={styles.awaitingPartnerTitle}>Waiting for partner</Text>
                <Text style={styles.awaitingPartnerText}>
                  Your accountability partner needs to confirm you completed this.
                  {promise.partnerDeadlineAt && (
                    ` They have until ${formatShortDateTime(promise.partnerDeadlineAt)}.`
                  )}
                </Text>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setShowShareModal(true);
                  }}
                  style={({ pressed }) => [styles.awaitingPartnerBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.awaitingPartnerBtnText}>Send reminder ↗</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {isExpiredView && !isAwaitingPartner && (
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
              <Text style={styles.failIcon}>
                {promise.paymentStatus === 'succeeded' ? '💸' : 
                 promise.paymentStatus === 'requires_action' ? '🔐' :
                 promise.paymentStatus === 'failed' ? '⚠️' :
                 promise.stake > 0 ? '💸' : '😔'}
              </Text>
              <Text style={styles.failText}>
                {promise.paymentStatus === 'succeeded' 
                  ? `You failed. $${totalStake} charged. The universe collected.`
                  : promise.paymentStatus === 'requires_action'
                  ? 'You failed. Your bank needs you to confirm the payment.'
                  : promise.paymentStatus === 'failed'
                  ? `You failed. Payment of $${totalStake} didn't go through. We'll retry.`
                  : promise.paymentStatus === 'abandoned'
                  ? `You failed. Payment couldn't be collected after multiple attempts.`
                  : totalStake > 0
                  ? `You failed. $${totalStake} will be charged.`
                  : 'You failed. No stake, no pain. Just disappointment.'}
              </Text>
            </Animated.View>
          )}

          {/* I Told You So reveal - only shown after failure */}
          {promise.status === 'failed' && hasIToldYouSo && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.iToldYouSoCard}>
              <View style={styles.iToldYouSoHeader}>
                <Text style={styles.iToldYouSoEmoji}>💌</Text>
                <Text style={styles.iToldYouSoTitle}>
                  {roastMessages.length > 1
                    ? `${roastMessages.length} messages were left for you...`
                    : FAILURE_COPY.iToldYouSoRevealTitle}
                </Text>
              </View>
              <View style={styles.iToldYouSoContent}>
                {loadingRoasts ? (
                  <Text style={styles.iToldYouSoMessage}>Loading messages...</Text>
                ) : (
                  roastMessages.map((msg, index) => (
                    <View key={index} style={styles.roastMessageItem}>
                      <Text style={styles.iToldYouSoMessage}>&quot;{msg.message}&quot;</Text>
                      {msg.from && (
                        <Text style={styles.iToldYouSoFrom}>— {msg.from}</Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </Animated.View>
          )}

          {/* Sponsor loss notification */}
          {promise.status === 'failed' && hasSponsor && (
            <Animated.View entering={FadeIn.delay(350).duration(250)} style={styles.sponsorLossBanner}>
              <Text style={styles.sponsorLossIcon}>👀</Text>
              <View style={styles.sponsorLossContent}>
                <Text style={styles.sponsorLossTitle}>
                  {FAILURE_COPY.sponsorLossTitle.replace('{amount}', `$${promise.sponsorAmount}`)}
                </Text>
                <Text style={styles.sponsorLossSubtitle}>{FAILURE_COPY.sponsorLossSubtitle}</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {canChangeStatus && (
          <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.actions}>
            {/* For awaiting partner state, show different action */}
            {isAwaitingPartner ? (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setShowShareModal(true);
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, styles.actionWaiting]}
              >
                <LinearGradient
                  colors={[Colors.accent, '#0A84FF']}
                  style={styles.actionBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.actionBtnText}>Send to partner 👀</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleInitiateComplete}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed, styles.actionSuccess]}
              >
                <LinearGradient
                  colors={[Colors.success, '#2EC44F']}
                  style={styles.actionBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.actionBtnText}>
                    {needsPhotoProof 
                      ? 'I did it 📷' 
                      : needsPartnerVerification 
                        ? 'I did it 👥' 
                        : 'I did it ✓'}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}

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
        iToldYouSoMessages={promise.iToldYouSoMessages}
        sponsorAmount={promise.sponsorAmount}
        stake={promise.stake}
        onCancel={() => setConfirmFail(false)}
        onConfirm={handleFail}
        working={isWorking || isProcessingFail}
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

      {/* Share Modal */}
      {promise && (
        <ShareModal
          visible={showShareModal}
          promise={promise}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Photo Capture Modal for verification */}
      {promise && (
        <PhotoCaptureModal
          visible={showPhotoCapture}
          promiseText={promise.text}
          onCapture={handlePhotoCapture}
          onCancel={() => setShowPhotoCapture(false)}
        />
      )}

      {/* Partner Verification Prompt Modal */}
      <ConfirmActionModal
        visible={showPartnerSendPrompt}
        title="Get verified by your partner"
        subtitle="You're claiming you did it. Now your accountability partner needs to confirm. They'll have 24 hours to respond."
        confirmText="Send to partner 👀"
        confirmColors={[Colors.accent, '#0A84FF']}
        onCancel={() => setShowPartnerSendPrompt(false)}
        onConfirm={handlePartnerVerificationStart}
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
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

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
  stakeChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sponsorChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  sponsorChipText: { ...Typography.caption, color: Colors.warning, fontWeight: '600' },

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

  // Awaiting partner banner
  awaitingPartnerBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  awaitingPartnerIcon: { fontSize: 24 },
  awaitingPartnerContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  awaitingPartnerTitle: {
    ...Typography.bodySemibold,
    color: Colors.accent,
  },
  awaitingPartnerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  awaitingPartnerBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  awaitingPartnerBtnText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },

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

  // I Told You So card
  iToldYouSoCard: {
    backgroundColor: 'rgba(255, 159, 10, 0.08)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.warning + '33',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  iToldYouSoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iToldYouSoEmoji: {
    fontSize: 20,
  },
  iToldYouSoTitle: {
    ...Typography.label,
    color: Colors.warning,
    flex: 1,
  },
  iToldYouSoContent: {
    gap: Spacing.sm,
  },
  iToldYouSoMessage: {
    ...Typography.h3,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  iToldYouSoFrom: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  roastMessageItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },

  // Sponsor loss banner
  sponsorLossBanner: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  sponsorLossIcon: {
    fontSize: 20,
  },
  sponsorLossContent: {
    flex: 1,
    gap: 2,
  },
  sponsorLossTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  sponsorLossSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

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
  actionWaiting: {},

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
  failModalScroll: {
    flexGrow: 0,
  },
  failModalContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
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

  // Sealed envelope (I Told You So preview)
  sealedEnvelope: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: 'rgba(255, 159, 10, 0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '33',
    borderStyle: 'dashed',
    padding: Spacing.lg,
  },
  envelopeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warningDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeEmoji: {
    fontSize: 20,
  },
  envelopeContent: {
    flex: 1,
    gap: 2,
  },
  envelopeTitle: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },
  envelopeHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Sponsor warning in fail modal
  sponsorWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  sponsorWarningIcon: {
    fontSize: 16,
  },
  sponsorWarningText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Charge warning styles
  chargeWarning: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.25)',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  chargeWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chargeWarningIcon: {
    fontSize: 20,
  },
  chargeWarningTitle: {
    ...Typography.bodySemibold,
    color: Colors.danger,
  },
  chargeWarningAmount: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.mono,
    textAlign: 'center',
    marginVertical: Spacing.xs,
  },
  chargeWarningSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Fail modal specific action buttons (stacked vertically)
  failModalActions: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  failPrimaryBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  failPrimaryBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  failPrimaryBtnText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  failSecondaryBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failSecondaryBtnText: {
    ...Typography.body,
    color: Colors.textSecondary,
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


