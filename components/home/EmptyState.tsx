/**
 * EmptyState - Shown when user has no active promises
 * Includes rotating quotes, templates, and graveyard preview
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  COPY,
  getLiveBettorCount,
  GRAVEYARD_ENTRIES,
  PROMISE_TEMPLATES,
  ROTATING_QUOTES,
  type PromiseTemplate,
} from '@/constants/content';
import { Fonts } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';

import { PulsingDot } from './PulsingDot';

interface EmptyStateProps {
  onSelectTemplate: (template: PromiseTemplate) => void;
}

export function EmptyState({ onSelectTemplate }: EmptyStateProps) {
  return (
    <View className="pt-2">
      <RotatingQuote />
      <SocialProof />

      <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mb-8">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-label text-text-muted uppercase tracking-wide">{COPY.templatesTitle}</Text>
        </View>
        <Text className="text-caption text-text-tertiary mb-4">{COPY.templatesSubtitle}</Text>

        <View className="flex-row flex-wrap gap-3">
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

      <Animated.View entering={FadeIn.delay(600).duration(400)} className="items-center py-4">
        <Text className="text-caption text-text-tertiary">{COPY.footerPrimary}</Text>
        <Text className="text-caption text-text-muted italic mt-0.5">{COPY.footerSecondary}</Text>
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
    <Animated.View
      key={index}
      entering={FadeIn.duration(500)}
      className="items-center py-4 px-3 min-h-[90px]"
    >
      <Text className="text-[28px] mb-1">{quote.icon}</Text>
      <Text className="text-h3 text-text-secondary text-center italic">{quote.text}</Text>
    </Animated.View>
  );
}

function SocialProof() {
  const count = useMemo(() => getLiveBettorCount(), []);

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(400)}
      className="flex-row items-center justify-center gap-2 mb-6"
    >
      <PulsingDot />
      <Text className="text-caption text-text-tertiary">
        <Text className="text-white font-semibold" style={{ fontFamily: Fonts.mono }}>
          {count.toLocaleString()}
        </Text>{' '}
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
    <Animated.View
      entering={FadeInDown.delay(180 + index * 50).duration(280)}
      className="basis-[47%] flex-grow"
    >
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
        className="bg-card rounded-lg border border-border p-3 gap-1 active:bg-card-hover active:border-border-focus"
      >
        <Text className="text-[22px]">{template.emoji}</Text>
        <Text
          className="text-caption text-white leading-[18px] min-h-[36px]"
          numberOfLines={2}
        >
          {template.text}
        </Text>
        <View className="self-start bg-danger-dim py-[3px] px-2 rounded-sm mt-1">
          <Text
            className="text-caption text-danger font-semibold"
            style={{ fontFamily: Fonts.mono }}
          >
            ${template.stake}
          </Text>
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
    <Animated.View entering={FadeInDown.delay(450).duration(400)} className="mb-8">
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-[16px]">⚰️</Text>
        <Text className="text-label text-text-muted uppercase tracking-wide">{COPY.graveyardTitle}</Text>
      </View>

      <Pressable
        onPress={handleGraveyardPress}
        className="flex-row items-center bg-danger/5 rounded-lg border border-danger/[0.12] p-4 mt-2 active:bg-danger/[0.08] active:border-danger/[0.18]"
      >
        <View className="flex-1 gap-[3px]">
          <Text className="text-label text-danger text-[10px]">RIP</Text>
          <Text className="text-body-medium text-text-secondary italic">
            &ldquo;{entry.text}&rdquo;
          </Text>
          <Text className="text-caption text-text-tertiary">
            Lasted {entry.lasted} · Lost ${entry.lost}
          </Text>
        </View>
        <View className="items-center gap-1">
          <Text className="text-[26px] opacity-60">💀</Text>
          <Text className="text-[18px] text-text-muted font-light">›</Text>
        </View>
      </Pressable>

      <Pressable onPress={handleGraveyardPress}>
        <Text className="text-caption text-danger text-center mt-3 font-medium">
          {COPY.graveyardWarning}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
