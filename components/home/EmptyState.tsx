/**
 * EmptyState - Shown when user has no active promises
 * Includes rotating quotes, templates, and graveyard preview
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
    COPY,
    getLiveBettorCount,
    GRAVEYARD_ENTRIES,
    PROMISE_TEMPLATES,
    ROTATING_QUOTES,
    type PromiseTemplate,
} from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';

import { PulsingDot } from './PulsingDot';

interface EmptyStateProps {
  onSelectTemplate: (template: PromiseTemplate) => void;
}

export function EmptyState({ onSelectTemplate }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <RotatingQuote />
      <SocialProof />

      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.templatesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{COPY.templatesTitle}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{COPY.templatesSubtitle}</Text>

        <View style={styles.templatesGrid}>
          {PROMISE_TEMPLATES.map((template, i) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={i}
              onPress={() => onSelectTemplate(template)}
            />
          ))}
        </View>
      </Animated.View>

      <GraveyardPreview />

      <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.footerNudge}>
        <Text style={styles.footerText}>{COPY.footerPrimary}</Text>
        <Text style={styles.footerSubtext}>{COPY.footerSecondary}</Text>
      </Animated.View>
    </View>
  );
}

function RotatingQuote() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * ROTATING_QUOTES.length)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_QUOTES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const quote = ROTATING_QUOTES[index];

  return (
    <Animated.View key={index} entering={FadeIn.duration(500)} style={styles.quoteContainer}>
      <Text style={styles.quoteIcon}>{quote.icon}</Text>
      <Text style={styles.quoteText}>{quote.text}</Text>
    </Animated.View>
  );
}

function SocialProof() {
  const count = useMemo(() => getLiveBettorCount(), []);

  return (
    <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.socialProof}>
      <PulsingDot />
      <Text style={styles.socialProofText}>
        <Text style={styles.socialProofNumber}>{count.toLocaleString()}</Text>{' '}
        {COPY.socialProofSuffix}
      </Text>
    </Animated.View>
  );
}

function TemplateCard({
  template,
  index,
  onPress,
}: {
  template: PromiseTemplate;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(180 + index * 50).duration(280)}>
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
        style={({ pressed }) => [
          styles.templateCard,
          pressed && styles.templateCardPressed,
        ]}
      >
        <Text style={styles.templateEmoji}>{template.emoji}</Text>
        <Text style={styles.templateText} numberOfLines={2}>
          {template.text}
        </Text>
        <View style={styles.templateStake}>
          <Text style={styles.templateStakeText}>${template.stake}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function GraveyardPreview() {
  const entry = useMemo(
    () => GRAVEYARD_ENTRIES[Math.floor(Math.random() * GRAVEYARD_ENTRIES.length)],
    []
  );

  const handleGraveyardPress = useCallback(() => {
    hapticLight();
    router.push('/(mobile)/graveyard');
  }, []);

  return (
    <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.graveyardSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>⚰️</Text>
        <Text style={styles.sectionTitle}>{COPY.graveyardTitle}</Text>
      </View>

      <Pressable
        onPress={handleGraveyardPress}
        style={({ pressed }) => [
          styles.graveyardCard,
          pressed && styles.graveyardCardPressed,
        ]}
      >
        <View style={styles.graveyardContent}>
          <Text style={styles.graveyardRip}>RIP</Text>
          <Text style={styles.graveyardText}>&ldquo;{entry.text}&rdquo;</Text>
          <Text style={styles.graveyardMeta}>
            Lasted {entry.lasted} · Lost ${entry.lost}
          </Text>
        </View>
        <View style={styles.graveyardRight}>
          <Text style={styles.graveyardSkull}>💀</Text>
          <Text style={styles.graveyardChevron}>›</Text>
        </View>
      </Pressable>

      <Pressable onPress={handleGraveyardPress}>
        <Text style={styles.graveyardWarning}>{COPY.graveyardWarning}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
  },

  // Quote
  quoteContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 90,
  },
  quoteIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  quoteText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Social proof
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
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

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },

  // Templates
  templatesSection: {
    marginBottom: Spacing.xxl,
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
  templateEmoji: {
    fontSize: 22,
  },
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

  // Graveyard
  graveyardSection: {
    marginBottom: Spacing.xxl,
  },
  graveyardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.05)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.12)',
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  graveyardCardPressed: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderColor: 'rgba(255, 69, 58, 0.18)',
  },
  graveyardContent: {
    flex: 1,
    gap: 3,
  },
  graveyardRight: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  graveyardChevron: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  graveyardRip: {
    ...Typography.label,
    color: Colors.danger,
    fontSize: 10,
  },
  graveyardText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  graveyardMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  graveyardSkull: {
    fontSize: 26,
    opacity: 0.6,
  },
  graveyardWarning: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontWeight: '500',
  },

  // Footer nudge
  footerNudge: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  footerSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});

