/**
 * CheckInBanner - Inline daily check-in prompt
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CHECKIN_COPY } from '@/constants/content';
import { hapticMedium } from '@/lib/haptics';

interface CheckInBannerProps {
  totalAtStake: number;
  streak: number;
  onCommit: (committed: boolean) => void | Promise<void>;
}

export function CheckInBanner({ totalAtStake, streak, onCommit }: CheckInBannerProps) {
  const [working, setWorking] = useState(false);

  const handleCommit = async (committed: boolean) => {
    if (working) return;
    setWorking(true);
    hapticMedium();
    await onCommit(committed);
    setWorking(false);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className="bg-card rounded-xl border border-success/30 p-4 mb-4 gap-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <Text className="text-[28px]">👋</Text>
          <View>
            <Text className="text-body-medium text-white">{CHECKIN_COPY.title}</Text>
            <Text className="text-caption text-text-tertiary mt-0.5">
              ${totalAtStake} on the line
              {streak > 0 && ` • 🔥 ${streak} day streak`}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          disabled={working}
          onPress={() => handleCommit(true)}
          className={`flex-1 h-11 bg-success rounded-md items-center justify-center active:opacity-90 active:scale-[0.98] ${working ? 'opacity-60' : ''}`}
        >
          <Text className="text-body-semibold text-black">✓ On track</Text>
        </Pressable>

        <Pressable
          disabled={working}
          onPress={() => handleCommit(false)}
          className={`flex-1 h-11 bg-abyss-800 rounded-md border border-border items-center justify-center active:bg-danger-dim active:border-danger/40 ${working ? 'opacity-60' : ''}`}
        >
          <Text className="text-body-semibold text-text-secondary">✗ Failed</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
