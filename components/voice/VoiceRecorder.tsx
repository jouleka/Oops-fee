/**
 * VoiceRecorder - Record your promise out loud
 * "Saying it makes it real. Hearing it later makes it haunting."
 */

import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

type VoiceRecorderProps = {
  onRecordingComplete: (uri: string) => void;
  existingUri?: string;
  onClear?: () => void;
};

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const MAX_DURATION_MS = 30_000; // 30 seconds max

export function VoiceRecorder({ onRecordingComplete, existingUri, onClear }: VoiceRecorderProps) {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(existingUri ?? null);
  const [duration, setDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation values
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (existingUri && existingUri !== recordingUri) {
      setRecordingUri(existingUri);
    }
  }, [existingUri, recordingUri]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    })();

    return () => {
      // Cleanup
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withSpring(1, { damping: 15 });
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording, pulse, glow]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.6]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.3]) }],
  }));

  // Use a ref to avoid circular dependency between startRecording and stopRecording
  const stopRecordingRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      hapticMedium();

      if (uri) {
        setRecordingUri(uri);
        onRecordingComplete(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
    }
  }, [onRecordingComplete]);

  // Keep ref in sync
  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');
    }

    try {
      // Clear previous recording
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      hapticHeavy();

      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setDuration(elapsed);

        // Auto-stop at max duration - use ref to avoid circular dependency
        if (elapsed >= MAX_DURATION_MS) {
          stopRecordingRef.current?.();
        }
      }, 100);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [permissionStatus]);

  const playRecording = useCallback(async () => {
    if (!recordingUri || isPlaying) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true },
        (playbackStatus) => {
          if (playbackStatus.isLoaded) {
            setPlaybackPosition(playbackStatus.positionMillis);
            setPlaybackDuration(playbackStatus.durationMillis ?? 0);
            if (playbackStatus.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
            }
          }
        }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      if (status.isLoaded) {
        setPlaybackDuration(status.durationMillis ?? 0);
      }
      hapticLight();
    } catch (err) {
      console.error('Failed to play recording:', err);
    }
  }, [recordingUri, isPlaying]);

  const stopPlayback = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setPlaybackPosition(0);
      hapticLight();
    } catch (err) {
      console.error('Failed to stop playback:', err);
    }
  }, []);

  const clearRecording = useCallback(() => {
    setRecordingUri(null);
    setDuration(0);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    hapticLight();
    onClear?.();
  }, [onClear]);

  // Denied state
  if (permissionStatus === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedIcon}>🎤</Text>
          <Text style={styles.deniedTitle}>Microphone denied</Text>
          <Text style={styles.deniedSubtitle}>
            Can&apos;t record your voice without permission. Go to Settings to enable it.
          </Text>
        </View>
      </View>
    );
  }

  // Has recording - show playback controls
  if (recordingUri && !isRecording) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
        <View style={styles.playbackCard}>
          <View style={styles.playbackHeader}>
            <Text style={styles.recordedIcon}>🎙️</Text>
            <View style={styles.playbackInfo}>
              <Text style={styles.recordedLabel}>VOICE COMMITMENT</Text>
              <Text style={styles.recordedHint}>
                {isPlaying ? 'Playing your promise...' : 'Tap to hear yourself'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: playbackDuration > 0
                      ? `${(playbackPosition / playbackDuration) * 100}%`
                      : '0%',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressTime}>
              {formatDuration(isPlaying ? playbackPosition : playbackDuration)}
            </Text>
          </View>

          <View style={styles.playbackActions}>
            <Pressable
              onPress={isPlaying ? stopPlayback : playRecording}
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? '⏹ Stop' : '▶ Play'}
              </Text>
            </Pressable>

            <Pressable
              onPress={clearRecording}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.clearButtonText}>Re-record</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Recording state or empty state
  return (
    <View style={styles.container}>
      <View style={styles.recorderCard}>
        <View style={styles.recorderHeader}>
          <Text style={styles.recorderIcon}>🎙️</Text>
          <View style={styles.recorderInfo}>
            <Text style={styles.recorderLabel}>VOICE COMMITMENT</Text>
            <Text style={styles.recorderHint}>
              {isRecording
                ? 'Recording... Say your promise out loud.'
                : "Say it out loud. We'll play it back when you try to quit."}
            </Text>
          </View>
        </View>

        {/* Recording button */}
        <View style={styles.recordButtonContainer}>
          {isRecording && (
            <Animated.View style={[styles.recordGlow, glowStyle]} />
          )}
          <Animated.View style={pulseStyle}>
            <Pressable
              onPress={isRecording ? stopRecording : startRecording}
              style={({ pressed }) => [
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.recordButtonInner, isRecording && styles.recordButtonInnerActive]}>
                {isRecording ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <View style={styles.micIcon}>
                    <Text style={styles.micIconText}>🎤</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {/* Duration display */}
        {isRecording && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)}>
            <View style={styles.durationRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              <Text style={styles.durationMax}>/ {formatDuration(MAX_DURATION_MS)}</Text>
            </View>
          </Animated.View>
        )}

        {!isRecording && (
          <Text style={styles.tapHint}>Tap to record</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },

  // Recorder card
  recorderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  recorderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    width: '100%',
  },
  recorderIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  recorderInfo: {
    flex: 1,
    gap: 4,
  },
  recorderLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  recorderHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 18,
  },

  // Record button
  recordButtonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: 80,
  },
  recordGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.danger,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    borderWidth: 3,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  recordButtonActive: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
  },
  recordButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    width: 28,
    height: 28,
  },
  stopIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.danger,
    borderRadius: 4,
  },
  micIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIconText: {
    fontSize: 20,
  },

  // Duration
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  durationText: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontFamily: Fonts.mono,
  },
  durationMax: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
  },

  tapHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Playback card
  playbackCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  playbackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  recordedIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  playbackInfo: {
    flex: 1,
    gap: 4,
  },
  recordedLabel: {
    ...Typography.label,
    color: Colors.accent,
  },
  recordedHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressTime: {
    ...Typography.captionMono,
    color: Colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },

  // Actions
  playbackActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  playButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
  },
  clearButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },

  // Denied
  deniedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  deniedIcon: {
    fontSize: 32,
    opacity: 0.5,
  },
  deniedTitle: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  deniedSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

