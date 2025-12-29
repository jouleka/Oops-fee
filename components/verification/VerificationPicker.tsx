import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { STAKES_THRESHOLDS, VERIFICATION_COPY, VERIFICATION_ORDER } from '@/constants/content';
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

  // Build dynamic className for card states
  const cardClassName = useMemo(() => {
    const base = 'w-[110px] min-h-[130px] bg-white/[0.04] rounded-xl border-[1.5px] border-white/10 p-3 items-center justify-start gap-1 relative';
    
    if (isSelected) {
      return `${base} border-imessage bg-imessage-dim`;
    }
    if (isDisabled) {
      return `${base} opacity-45`;
    }
    if (isComingSoon) {
      return `${base} opacity-50 border-dashed`;
    }
    if (hasWarning) {
      return `${base} border-warning/30 bg-warning/5`;
    }
    return base;
  }, [isSelected, isDisabled, isComingSoon, hasWarning]);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled || isComingSoon}
        className={cardClassName}
      >
        {/* Coming soon badge */}
        {isComingSoon && (
          <View className="absolute top-2 right-2 bg-system-gray-4 px-1.5 py-0.5 rounded">
            <Text className="text-[9px] font-semibold tracking-wide text-white/30 uppercase">Soon</Text>
          </View>
        )}

        {/* Emoji */}
        <Text
          className={`text-[28px] mt-1 ${(isDisabled || isComingSoon) ? 'opacity-50' : ''}`}
        >
          {config.emoji}
        </Text>

        {/* Title */}
        <Text
          className={`text-base font-semibold font-rounded text-center ${
            isDisabled || isComingSoon
              ? 'text-white/30 line-through'
              : 'text-white'
          }`}
        >
          {config.title}
        </Text>

        {/* Subtitle */}
        <Text
          className={`text-[13px] leading-4 font-medium text-center ${
            isSelected
              ? 'text-white/70'
              : isDisabled || isComingSoon
                ? 'text-white/30'
                : 'text-white/45'
          }`}
          numberOfLines={2}
        >
          {config.subtitle}
        </Text>

        {/* Selected indicator */}
        {isSelected && (
          <View className="absolute top-2 right-2 w-5 h-5 rounded-full bg-imessage items-center justify-center">
            <Text className="text-white text-xs font-bold">✓</Text>
          </View>
        )}

        {/* Warning indicator for honor with medium stakes */}
        {hasWarning && !isSelected && type === 'honor' && (
          <View className="absolute top-2 right-2">
            <Text className="text-sm">⚠️</Text>
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
    <View className="gap-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="py-1 px-1 gap-3"
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
        <Animated.View
          entering={FadeIn.duration(200)}
          className="flex-row items-center gap-2 bg-warning/10 border border-warning/20 rounded-lg p-3"
        >
          <Text className="text-sm">⚠️</Text>
          <Text className="text-[13px] leading-[18px] font-medium text-warning flex-1">
            {warningMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
