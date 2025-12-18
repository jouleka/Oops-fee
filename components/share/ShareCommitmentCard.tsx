/**
 * ShareCommitmentCard
 * A visually striking card for sharing active commitments.
 * "Hold me to it" energy - bold stake, urgent deadline.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { SHARE_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { formatShortDateTime } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';

interface ShareCommitmentCardProps {
  promise: UserPromise;
}

export function ShareCommitmentCard({ promise }: ShareCommitmentCardProps) {
  const totalStake = promise.stake + (promise.sponsorAmount ?? 0);
  const hasSponsor = (promise.sponsorAmount ?? 0) > 0;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#0A0A14', '#12121E', '#0A0A14']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative corner accents */}
        <View style={[styles.cornerAccent, styles.cornerTopLeft]} />
        <View style={[styles.cornerAccent, styles.cornerTopRight]} />
        <View style={[styles.cornerAccent, styles.cornerBottomLeft]} />
        <View style={[styles.cornerAccent, styles.cornerBottomRight]} />

        <View style={styles.content}>
          {/* Label */}
          <Text style={styles.label}>{SHARE_COPY.cardLabel}</Text>

          {/* Stake amount - the hero */}
          <View style={styles.stakeRow}>
            <Text style={styles.dollarSign}>$</Text>
            <Text style={styles.stakeAmount}>{totalStake}</Text>
          </View>

          {/* Sponsor badge if applicable */}
          {hasSponsor && (
            <View style={styles.sponsorBadge}>
              <Text style={styles.sponsorBadgeText}>
                +${promise.sponsorAmount} from {promise.sponsorCount ?? 1} sponsor
                {(promise.sponsorCount ?? 1) > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Promise text */}
          <View style={styles.promiseContainer}>
            <Text style={styles.promiseLabel}>{SHARE_COPY.cardPromise}</Text>
            <Text style={styles.promiseText} numberOfLines={3}>
              &quot;{promise.text}&quot;
            </Text>
          </View>

          {/* Deadline */}
          <View style={styles.deadlineContainer}>
            <Text style={styles.deadlineLabel}>{SHARE_COPY.cardDeadline}</Text>
            <Text style={styles.deadlineValue}>
              {formatShortDateTime(promise.deadlineAt)}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* CTA */}
          <Text style={styles.cta}>{SHARE_COPY.cardCta}</Text>

          {/* Brand */}
          <Text style={styles.brand}>OopsFee</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gradient: {
    padding: Spacing.xl,
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },

  // Corner accents
  cornerAccent: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: Colors.danger,
    opacity: 0.4,
  },
  cornerTopLeft: {
    top: Spacing.md,
    left: Spacing.md,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTopRight: {
    top: Spacing.md,
    right: Spacing.md,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBottomLeft: {
    bottom: Spacing.md,
    left: Spacing.md,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBottomRight: {
    bottom: Spacing.md,
    right: Spacing.md,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },

  // Label
  label: {
    ...Typography.label,
    color: Colors.textMuted,
    letterSpacing: 2,
  },

  // Stake
  stakeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dollarSign: {
    ...Typography.h1,
    color: Colors.danger,
    marginTop: 8,
    marginRight: 2,
    fontFamily: Fonts.rounded,
  },
  stakeAmount: {
    fontSize: 72,
    fontWeight: '800',
    color: Colors.danger,
    fontFamily: Fonts.rounded,
    lineHeight: 80,
    letterSpacing: -2,
  },

  // Sponsor badge
  sponsorBadge: {
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  sponsorBadgeText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },

  // Promise
  promiseContainer: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  promiseLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promiseText: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
  },

  // Deadline
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  deadlineLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  deadlineValue: {
    ...Typography.bodySemibold,
    color: Colors.warning,
    fontFamily: Fonts.rounded,
  },

  // Divider
  divider: {
    width: 60,
    height: 2,
    backgroundColor: Colors.accent,
    marginVertical: Spacing.md,
    borderRadius: 1,
  },

  // CTA
  cta: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
  },

  // Brand
  brand: {
    ...Typography.label,
    color: Colors.textMuted,
    letterSpacing: 3,
    marginTop: Spacing.lg,
  },
});

