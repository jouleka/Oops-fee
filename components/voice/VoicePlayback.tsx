/**
 * VoicePlayback - "Listen to yourself before you give up"
 * Plays the voice commitment when user tries to mark as failed.
 * Maximum guilt-trip energy.
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';

type VoicePlaybackProps = {
  uri: string;
  autoPlay?: boolean;
  onPlaybackComplete?: () => void;
  onError?: () => void;
  message?: string;
};

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const GUILT_MESSAGES = [
  "This is you. Remember?",
  "You said this. Out loud.",
  "Past you had faith. Current you... well.",
  "Listen before you quit.",
  "Your voice. Your promise. Your choice.",
];

export function VoicePlayback({
  uri,
  autoPlay = false,
  onPlaybackComplete,
  onError,
  message,
}: VoicePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const guiltMessage = useMemo(
    () => message ?? GUILT_MESSAGES[Math.floor(Math.random() * GUILT_MESSAGES.length)],
    [message]
  );

  // Pre-calculate waveform bar heights to avoid re-render jitter
  const barHeights = useMemo(
    () => Array.from({ length: 12 }, (_, i) => 8 + Math.sin((i * Math.PI) / 3) * 16 + Math.random() * 8),
    []
  );

  // Animation
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isPlaying) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isPlaying, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [1, 1.05], [0.4, 1]),
  }));

  // Load sound on mount
  useEffect(() => {
    let mounted = true;

    const loadSound = async () => {
      try {
        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (playbackStatus) => {
            if (!mounted) return;
            if (playbackStatus.isLoaded) {
              setPosition(playbackStatus.positionMillis);
              setDuration(playbackStatus.durationMillis ?? 0);
              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                setHasPlayed(true);
                onPlaybackComplete?.();
              }
            }
          }
        );

        if (!mounted) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        if (status.isLoaded) {
          setDuration(status.durationMillis ?? 0);
        }
        setIsLoading(false);

        // Auto-play if requested
        if (autoPlay) {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } catch (err) {
        console.error('Failed to load voice note:', err);
        setIsLoading(false);
        setLoadError(true);
        onError?.();
      }
    };

    loadSound();

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [uri, autoPlay, onPlaybackComplete, onError]);

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        // Restart from beginning if finished
        if (hasPlayed) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
      hapticLight();
    } catch (err) {
      console.error('Failed to toggle playback:', err);
    }
  }, [isPlaying, hasPlayed]);

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading your voice...</Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Voice note could not be loaded.</Text>
          <Text style={styles.errorSubtext}>The file may have been moved or deleted.</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🎙️</Text>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Your Voice Commitment</Text>
            <Text style={styles.headerSubtitle}>{guiltMessage}</Text>
          </View>
        </View>

        {/* Waveform visualization (decorative) */}
        <View style={styles.waveformContainer}>
          <Animated.View style={[styles.waveformBars, waveStyle]}>
            {barHeights.map((height, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  { height, opacity: isPlaying ? 0.9 : 0.4 },
                ]}
              />
            ))}
          </Animated.View>
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressTimes}>
            <Text style={styles.progressTime}>{formatDuration(position)}</Text>
            <Text style={styles.progressTime}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* Play button */}
        <Animated.View style={pulseStyle}>
          <Pressable
            onPress={togglePlayback}
            style={({ pressed }) => [
              styles.playButton,
              isPlaying && styles.playButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸ Pause' : hasPlayed ? '🔄 Replay' : '▶ Listen'}
            </Text>
          </Pressable>
        </Animated.View>

        {hasPlayed && !isPlaying && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={styles.listenedNote}>
              You heard yourself. Still want to give up?
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},

  card: {
    backgroundColor: 'rgba(255, 69, 58, 0.06)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.18)',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    fontFamily: Fonts.rounded,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Waveform
  waveformContainer: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waveformBar: {
    width: 4,
    backgroundColor: Colors.danger,
    borderRadius: 2,
  },

  // Progress
  progressContainer: {
    gap: Spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.danger,
    borderRadius: 2,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTime: {
    ...Typography.captionMono,
    color: Colors.textMuted,
  },

  // Play button
  playButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: Colors.danger + '22',
  },
  playButtonText: {
    ...Typography.bodySemibold,
    color: Colors.danger,
  },

  listenedNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Loading
  loadingCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Error state
  errorCard: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.danger + '33',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorIcon: {
    fontSize: 24,
  },
  errorText: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    textAlign: 'center',
  },
  errorSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

