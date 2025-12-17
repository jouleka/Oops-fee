import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { STAKES_THRESHOLDS, VERIFICATION_COPY, VERIFICATION_ORDER } from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import type { VerificationType } from '@/lib/promises/types';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

interface VerificationPickerProps {
  value: VerificationType;
  onChange: (type: VerificationType) => void;
  stake: number;
  disabled?: boolean;
}

interface VerificationCardProps {
  type: VerificationType;
  config: (typeof VERIFICATION_COPY.types)[keyof typeof VERIFICATION_COPY.types];
  isSelected: boolean;
  isDisabled: boolean;
  hasWarning: boolean;
  isComingSoon: boolean;
  onPress: () => void;
}

function VerificationCard({
  type,
  config,
  isSelected,
  isDisabled,
  hasWarning,
  isComingSoon,
  onPress,
}: VerificationCardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (isDisabled || isComingSoon) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [isDisabled, isComingSoon, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (isDisabled || isComingSoon) return;
    hapticLight();
    onPress();
  }, [isDisabled, isComingSoon, onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled || isComingSoon}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isDisabled && styles.cardDisabled,
          isComingSoon && styles.cardComingSoon,
          hasWarning && !isSelected && styles.cardWarning,
        ]}
      >
        {/* Coming soon badge */}
        {isComingSoon && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Soon</Text>
          </View>
        )}

        {/* Emoji */}
        <Text style={[styles.cardEmoji, (isDisabled || isComingSoon) && styles.cardEmojiDisabled]}>
          {config.emoji}
        </Text>

        {/* Title */}
        <Text
          style={[
            styles.cardTitle,
            isSelected && styles.cardTitleSelected,
            (isDisabled || isComingSoon) && styles.cardTitleDisabled,
          ]}
        >
          {config.title}
        </Text>

        {/* Subtitle */}
        <Text
          style={[
            styles.cardSubtitle,
            isSelected && styles.cardSubtitleSelected,
            (isDisabled || isComingSoon) && styles.cardSubtitleDisabled,
          ]}
          numberOfLines={2}
        >
          {config.subtitle}
        </Text>

        {/* Selected indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedCheck}>✓</Text>
          </View>
        )}

        {/* Warning indicator for honor with medium stakes */}
        {hasWarning && !isSelected && type === 'honor' && (
          <View style={styles.warningIndicator}>
            <Text style={styles.warningIcon}>⚠️</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function VerificationPicker({ value, onChange, stake, disabled = false }: VerificationPickerProps) {
  // Stakes gating logic
  const { isHonorDisabled, hasHonorWarning } = useMemo(() => {
    return {
      isHonorDisabled: stake >= STAKES_THRESHOLDS.honorDisabled,
      hasHonorWarning: stake >= STAKES_THRESHOLDS.honorWarning && stake < STAKES_THRESHOLDS.honorDisabled,
    };
  }, [stake]);

  // If honor is currently selected and becomes disabled, switch to photo
  const handleChange = useCallback(
    (type: VerificationType) => {
      if (disabled) return;
      onChange(type);
    },
    [disabled, onChange]
  );

  // Determine warning message
  const warningMessage = useMemo(() => {
    if (isHonorDisabled) {
      return VERIFICATION_COPY.stakesWarning.high;
    }
    if (hasHonorWarning && value === 'honor') {
      return VERIFICATION_COPY.stakesWarning.medium;
    }
    return null;
  }, [hasHonorWarning, isHonorDisabled, value]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {VERIFICATION_ORDER.map((type) => {
          const config = VERIFICATION_COPY.types[type];
          const isComingSoon = 'comingSoon' in config && config.comingSoon === true;
          const isTypeDisabled = disabled || (type === 'honor' && isHonorDisabled);
          const hasWarning = type === 'honor' && hasHonorWarning;

          return (
            <VerificationCard
              key={type}
              type={type}
              config={config}
              isSelected={value === type}
              isDisabled={isTypeDisabled}
              hasWarning={hasWarning}
              isComingSoon={isComingSoon}
              onPress={() => handleChange(type)}
            />
          );
        })}
      </ScrollView>

      {/* Warning message */}
      {warningMessage && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.warningBanner}>
          <Text style={styles.warningBannerIcon}>⚠️</Text>
          <Text style={styles.warningBannerText}>{warningMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  scrollContent: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.md,
  },

  // Card
  card: {
    width: 110,
    minHeight: 130,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
    position: 'relative',
  },
  cardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  cardDisabled: {
    opacity: 0.45,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  cardComingSoon: {
    opacity: 0.5,
    borderStyle: 'dashed',
  },
  cardWarning: {
    borderColor: Colors.warning + '55',
    backgroundColor: 'rgba(255, 159, 10, 0.05)',
  },

  // Emoji
  cardEmoji: {
    fontSize: 28,
    marginTop: Spacing.xs,
  },
  cardEmojiDisabled: {
    opacity: 0.5,
  },

  // Title
  cardTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  cardTitleSelected: {
    color: Colors.text,
  },
  cardTitleDisabled: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },

  // Subtitle
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  cardSubtitleSelected: {
    color: Colors.textSecondary,
  },
  cardSubtitleDisabled: {
    color: Colors.textMuted,
  },

  // Selected indicator
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },

  // Warning indicator
  warningIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  warningIcon: {
    fontSize: 14,
  },

  // Coming soon badge
  comingSoonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.systemGray4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  comingSoonText: {
    ...Typography.label,
    fontSize: 9,
    color: Colors.textMuted,
  },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 159, 10, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.18)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  warningBannerIcon: {
    fontSize: 14,
  },
  warningBannerText: {
    ...Typography.caption,
    color: Colors.warning,
    flex: 1,
  },
});

