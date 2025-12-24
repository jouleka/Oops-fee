import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PulsingDot } from '@/components/home/PulsingDot';
import { TopUpModal, WithdrawModal } from '@/components/wallet';
import { getLiveBettorCount } from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { isStripeConfigured } from '@/lib/stripe';
import { formatCents } from '@/lib/wallet/api';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function getPaymentEmoji(brand: string | null): string {
  const map: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    discover: '💳',
    apple_pay: '🍎',
    google_pay: '🤖',
    link: '🔗',
    cashapp: '💵',
    amazon_pay: '📦',
  };
  return map[brand || ''] || '💳';
}

function getPaymentName(brand: string | null): string {
  const map: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    discover: 'Discover',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    link: 'Link',
    cashapp: 'Cash App',
    amazon_pay: 'Amazon Pay',
  };
  return map[brand || ''] || 'Card';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, profile, signOut, isLoading, paymentState, walletState, refreshProfile } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            await signOut();
            router.replace('/home');
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    hapticMedium();
    router.push('/auth/sign-in');
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || 'No email';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
      >
        {isAuthenticated ? (
          <>
            {/* Profile Card */}
            <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={[Colors.success, Colors.successDim]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{initial}</Text>
                </LinearGradient>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.displayName}>{displayName}</Text>
                <Text style={styles.email}>{email}</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Signed in</Text>
                </View>
              </View>
            </Animated.View>

            {/* Account Details */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Provider</Text>
                  <Text style={styles.detailValue}>
                    {user?.app_metadata?.provider === 'apple' ? '🍎 Apple' : 
                     user?.app_metadata?.provider === 'google' ? '🔵 Google' : 
                     '📧 Email'}
                  </Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>User ID</Text>
                  <Text style={styles.detailValueMono}>{user?.id?.slice(0, 8)}...</Text>
                </View>
              </View>
            </Animated.View>

            {/* Wallet */}
            {isStripeConfigured() && (
              <Animated.View entering={FadeInDown.delay(110).duration(300)} style={styles.section}>
                <Text style={styles.sectionTitle}>Wallet</Text>
                <View style={styles.walletCard}>
                  <View style={styles.walletHeader}>
                    <View style={styles.walletBalanceContainer}>
                      <Text style={styles.walletBalanceLabel}>Balance</Text>
                      <Text style={styles.walletBalanceValue}>
                        {formatCents(walletState.balanceCents)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.walletStatusBadge,
                        walletState.hasBalance && styles.walletStatusBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.walletStatusText,
                          walletState.hasBalance && styles.walletStatusTextActive,
                        ]}
                      >
                        {walletState.hasBalance ? 'Funds available' : 'Empty'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.walletDivider} />

                  <View style={styles.walletActions}>
                    <Pressable
                      onPress={() => {
                        hapticMedium();
                        setShowTopUp(true);
                      }}
                      style={({ pressed }) => [
                        styles.walletActionBtn,
                        styles.walletActionBtnPrimary,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={styles.walletActionIcon}>+</Text>
                      <Text style={styles.walletActionText}>Add Funds</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        hapticMedium();
                        setShowWithdraw(true);
                      }}
                      disabled={!walletState.hasBalance}
                      style={({ pressed }) => [
                        styles.walletActionBtn,
                        pressed && { opacity: 0.8 },
                        !walletState.hasBalance && styles.walletActionBtnDisabled,
                      ]}
                    >
                      <Text style={[styles.walletActionIcon, !walletState.hasBalance && styles.walletActionIconDisabled]}>↓</Text>
                      <Text style={[styles.walletActionText, !walletState.hasBalance && styles.walletActionTextDisabled]}>Withdraw</Text>
                    </Pressable>
                  </View>

                  {walletState.hasBalance && (
                    <Text style={styles.walletHint}>
                      Wallet funds are automatically used for stakes
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Payment Method */}
            {isStripeConfigured() && (
              <Animated.View entering={FadeInDown.delay(125).duration(300)} style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Method</Text>
                <Pressable
                  onPress={() => {
                    hapticMedium();
                    router.push('/(auth)/payment-method' as never);
                  }}
                  style={({ pressed }) => [
                    styles.detailsCard,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {paymentState.hasPaymentMethod
                        ? `${getPaymentEmoji(paymentState.brand)} ${getPaymentName(paymentState.brand)}${paymentState.last4 ? ` •••• ${paymentState.last4}` : ''}`
                        : '💳 No card'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[
                        styles.detailValue,
                        !paymentState.hasPaymentMethod && { color: Colors.textMuted }
                      ]}>
                        {paymentState.hasPaymentMethod ? 'Manage' : 'Add'}
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 16 }}>›</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            )}

            {/* Sign Out */}
            <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
              <Pressable
                onPress={handleSignOut}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && styles.signOutButtonPressed,
                  isLoading && styles.signOutButtonDisabled,
                ]}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </Animated.View>

            {/* Wallet Modals */}
            <TopUpModal
              visible={showTopUp}
              onClose={() => setShowTopUp(false)}
              onSuccess={() => {
                setShowTopUp(false);
                refreshProfile();
              }}
            />
            <WithdrawModal
              visible={showWithdraw}
              onClose={() => setShowWithdraw(false)}
              onSuccess={() => {
                setShowWithdraw(false);
                refreshProfile();
              }}
            />
          </>
        ) : (
          <GuestState onSignIn={handleSignIn} />
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// GUEST STATE COMPONENT
// ─────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    emoji: '💰',
    title: 'Real stakes',
    subtitle: 'Put money where your mouth is',
  },
  {
    emoji: '🔗',
    title: 'Share links',
    subtitle: 'Let friends hold you accountable',
  },
  {
    emoji: '📱',
    title: 'Sync devices',
    subtitle: 'Your promises, everywhere',
  },
  {
    emoji: '📊',
    title: 'Track stats',
    subtitle: 'See your accountability score',
  },
];

function GuestState({ onSignIn }: { onSignIn: () => void }) {
  const bettorCount = useMemo(() => getLiveBettorCount(), []);

  return (
    <>
      {/* Hero Card */}
      <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.heroCard}>
        <View style={styles.heroIconContainer}>
          <LinearGradient
            colors={[Colors.bgCardHover, Colors.bgCard]}
            style={styles.heroIconBg}
          >
            <Text style={styles.heroIcon}>👤</Text>
          </LinearGradient>
        </View>
        <Text style={styles.heroTitle}>Not Signed In</Text>
        <Text style={styles.heroSubtitle}>
          Free mode is cool, but you&apos;re leaving money on the table. Literally.
        </Text>

        {/* Sign In CTA */}
        <Pressable
          onPress={onSignIn}
          style={({ pressed }) => [styles.signInCard, pressed && styles.signInCardPressed]}
        >
          <LinearGradient
            colors={[Colors.accent, '#0A7FD4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.signInCardGradient}
          >
            <Text style={styles.signInCardText}>Sign In</Text>
          </LinearGradient>
          <Text style={styles.signInChevron}>›</Text>
        </Pressable>
      </Animated.View>

      {/* Social Proof */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.socialProof}>
        <PulsingDot />
        <Text style={styles.socialProofText}>
          <Text style={styles.socialProofNumber}>{bettorCount.toLocaleString()}</Text>{' '}
          people betting on themselves right now
        </Text>
      </Animated.View>

      {/* Benefits Grid */}
      <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>WHY SIGN IN?</Text>
        <View style={styles.benefitsGrid}>
          {BENEFITS.map((benefit, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(180 + i * 40).duration(280)}
              style={styles.benefitCard}
            >
              <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Snarky Footer */}
      <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.snarkFooter}>
        <Text style={styles.snarkText}>
          Still here? Just sign in already.
        </Text>
        <Text style={styles.snarkSubtext}>
          (Your future self will thank you. Or blame you. Either way, memorable.)
        </Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  backIcon: {
    fontSize: 20,
    color: Colors.text,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  avatarContainer: {},
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  profileInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  displayName: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  email: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.success,
  },

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },

  // Details Card
  detailsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  detailLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text,
  },
  detailValueMono: {
    ...Typography.body,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },

  // Wallet
  walletCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  walletBalanceContainer: {
    gap: 2,
  },
  walletBalanceLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  walletBalanceValue: {
    ...Typography.displaySmall,
    color: Colors.money,
    fontFamily: Fonts.mono,
  },
  walletStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCardHover,
  },
  walletStatusBadgeActive: {
    backgroundColor: Colors.successDim,
  },
  walletStatusText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  walletStatusTextActive: {
    color: Colors.success,
  },
  walletDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  walletActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  walletActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walletActionBtnPrimary: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success + '40',
  },
  walletActionBtnDisabled: {
    opacity: 0.5,
  },
  walletActionIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.success,
  },
  walletActionIconDisabled: {
    color: Colors.textMuted,
  },
  walletActionText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  walletActionTextDisabled: {
    color: Colors.textMuted,
  },
  walletHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },

  // Sign Out
  signOutButton: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  signOutButtonPressed: {
    opacity: 0.8,
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutText: {
    ...Typography.body,
    color: Colors.danger,
    fontWeight: '600',
  },

  // Hero Card (Guest)
  heroCard: {
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heroIconContainer: {
    marginBottom: Spacing.xs,
  },
  heroIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  heroIcon: {
    fontSize: 26,
    opacity: 0.6,
  },
  heroTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  heroSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },

  // Sign In Card (compact CTA)
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  signInCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  signInCardGradient: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  signInCardText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  signInChevron: {
    fontSize: 22,
    color: Colors.accent,
    fontWeight: '300',
    marginLeft: Spacing.xs,
  },

  // Social Proof
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  socialProofText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  socialProofNumber: {
    color: Colors.text,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },

  // Benefits Grid
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  benefitCard: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  benefitEmoji: {
    fontSize: 18,
    marginTop: 1,
  },
  benefitContent: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
  benefitSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textTertiary,
  },

  // Snarky Footer
  snarkFooter: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  snarkText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  snarkSubtext: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

