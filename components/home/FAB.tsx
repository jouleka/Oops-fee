/**
 * FAB - Floating Action Button for creating new promises
 */

import { LinearGradient } from "expo-linear-gradient";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { Animation } from "@/constants/theme";
import { hapticMedium } from "@/lib/haptics";

interface FABProps {
  onPress: () => void;
}

export function FAB({ onPress }: FABProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 12 }),
      withSpring(1, Animation.spring),
    );
    hapticMedium();
    onPress();
  }, [onPress, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      className="w-14 h-14 rounded-full shadow-lg"
      style={animStyle}
    >
      <Pressable
        onPress={handlePress}
        className="flex-1 rounded-full overflow-hidden"
      >
        <LinearGradient
          colors={["#0B93F6", "#0A7FD4"]}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text className="text-[30px] text-white font-light">+</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface FABWrapperProps {
  children: React.ReactNode;
  bottom: number;
}

export function FABWrapper({ children, bottom }: FABWrapperProps) {
  return (
    <View className="absolute right-6" style={{ bottom: bottom + 24 }}>
      {children}
    </View>
  );
}
