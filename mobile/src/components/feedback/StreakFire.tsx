import Animated, { withRepeat, withSequence, withTiming, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useEngagement } from "../../hooks/useEngagement";
import { feedbackColors } from "../../theme/feedbackColors";

type Props = {
  visible?: boolean;
};

export const StreakFire = ({ visible }: Props) => {
  const { streakDays, streakEventId, clearStreakEvent } = useEngagement();
  const shouldShow = typeof visible === "boolean" ? visible : streakEventId !== null;
  const glow = useSharedValue(0);

  useEffect(() => {
    if (shouldShow) {
      glow.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), 6, true);
      const timeout = setTimeout(() => {
        clearStreakEvent();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [shouldShow, glow, streakEventId, clearStreakEvent]);

  if (!shouldShow || !streakDays) {
    return null;
  }

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + glow.value * 0.4,
    transform: [{ scale: 1 + glow.value * 0.05 }],
  }));

  return (
    <Animated.View style={[styles.container, glowStyle]}>
      <Text style={styles.text}>🔥 {streakDays}-day streak!</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 140,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: feedbackColors.streakOrange,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
});

export default StreakFire;
