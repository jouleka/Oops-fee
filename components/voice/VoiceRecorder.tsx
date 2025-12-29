/**
 * VoiceRecorder - Record your promise out loud
 * "Saying it makes it real. Hearing it later makes it haunting."
 */

import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
      <View className="gap-3">
        <View className="bg-white/[0.04] rounded-xl border border-white/10 p-6 items-center gap-3">
          <Text className="text-[32px] opacity-50">🎤</Text>
          <Text className="text-base font-semibold text-white/70">Microphone denied</Text>
          <Text className="text-[13px] leading-[18px] font-medium text-white/45 text-center">
            Can&apos;t record your voice without permission. Go to Settings to enable it.
          </Text>
        </View>
      </View>
    );
  }

  // Has recording - show playback controls
  if (recordingUri && !isRecording) {
    const progressPercent = playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0;

    return (
      <Animated.View entering={FadeIn.duration(200)} className="gap-3">
        <View className="bg-white/[0.04] rounded-xl border border-imessage/25 p-4 gap-3">
          <View className="flex-row items-start gap-3">
            <Text className="text-2xl mt-0.5">🎙️</Text>
            <View className="flex-1 gap-1">
              <Text className="text-[11px] leading-[14px] font-semibold tracking-[0.5px] uppercase text-imessage">
                VOICE COMMITMENT
              </Text>
              <Text className="text-[13px] leading-[18px] font-medium text-white/45">
                {isPlaying ? 'Playing your promise...' : 'Tap to hear yourself'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-1 bg-abyss-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-imessage rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
            <Text className="text-[13px] leading-[18px] font-medium font-mono text-white/70 min-w-[40px] text-right">
              {formatDuration(isPlaying ? playbackPosition : playbackDuration)}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={isPlaying ? stopPlayback : playRecording}
              className="flex-1 h-11 rounded-full bg-imessage-dim border border-imessage/25 items-center justify-center active:opacity-90 active:scale-[0.98]"
            >
              <Text className="text-base font-semibold text-imessage">
                {isPlaying ? '⏹ Stop' : '▶ Play'}
              </Text>
            </Pressable>

            <Pressable
              onPress={clearRecording}
              className="flex-1 h-11 rounded-full bg-abyss-800 border border-white/10 items-center justify-center active:opacity-90 active:scale-[0.98]"
            >
              <Text className="text-base font-semibold text-white/70">Re-record</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Recording state or empty state
  return (
    <View className="gap-3">
      <View className="bg-white/[0.04] rounded-xl border border-white/10 p-4 gap-4 items-center">
        <View className="flex-row items-start gap-3 w-full">
          <Text className="text-2xl mt-0.5">🎙️</Text>
          <View className="flex-1 gap-1">
            <Text className="text-[11px] leading-[14px] font-semibold tracking-[0.5px] uppercase text-white/30">
              VOICE COMMITMENT
            </Text>
            <Text className="text-[13px] leading-[18px] font-medium text-white/45">
              {isRecording
                ? 'Recording... Say your promise out loud.'
                : "Say it out loud. We'll play it back when you try to quit."}
            </Text>
          </View>
        </View>

        {/* Recording button */}
        <View className="relative items-center justify-center h-20 w-20">
          {isRecording && (
            <Animated.View
              style={glowStyle}
              className="absolute w-20 h-20 rounded-full bg-danger"
            />
          )}
          <Animated.View style={pulseStyle}>
            <Pressable
              onPress={isRecording ? stopRecording : startRecording}
              className={`w-[72px] h-[72px] rounded-full border-[3px] border-danger items-center justify-center shadow-md ${
                isRecording ? 'bg-danger-dim' : 'bg-abyss-800'
              } active:opacity-90`}
            >
              <View
                className={`items-center justify-center ${
                  isRecording
                    ? 'w-7 h-7 rounded-lg bg-danger'
                    : 'w-12 h-12 rounded-full bg-danger'
                }`}
              >
                {isRecording ? (
                  <View className="w-full h-full bg-danger rounded" />
                ) : (
                  <Text className="text-xl">🎤</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {/* Duration display */}
        {isRecording && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)}>
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-danger" />
              <Text className="text-base font-medium font-mono text-white">
                {formatDuration(duration)}
              </Text>
              <Text className="text-[13px] leading-[18px] font-medium font-mono text-white/30">
                / {formatDuration(MAX_DURATION_MS)}
              </Text>
            </View>
          </Animated.View>
        )}

        {!isRecording && (
          <Text className="text-[13px] leading-[18px] font-medium text-white/30 italic">
            Tap to record
          </Text>
        )}
      </View>
    </View>
  );
}
