import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useEngagement } from "../../hooks/useEngagement";
import { feedbackColors } from "../../theme/feedbackColors";

type Props = {
  xpAmount?: number | null;
  visible?: boolean;
};

export const XpPopup = ({ xpAmount, visible }: Props) => {
  const { lastEarnedXp, xpEventId, clearXpPopup } = useEngagement();
  const amount = xpAmount ?? lastEarnedXp;
  const shouldShow = typeof visible === "boolean" ? visible : Boolean(amount);
  const animation = useSharedValue(0);

  useEffect(() => {
    if (shouldShow && amount) {
      animation.value = 0;
      animation.value = withSequence(
        withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) }),
        withDelay(1200, withTiming(0, { duration: 250 })),
      );
      const timeout = setTimeout(() => {
        clearXpPopup();
      }, 1600);
      return () => clearTimeout(timeout);
    }
  }, [shouldShow, amount, xpEventId, animation, clearXpPopup]);

  if (!shouldShow || !amount) {
    return null;
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [
      {
        translateY: (1 - animation.value) * 20,
      },
    ],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.text}>+{amount} XP</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: feedbackColors.xpBlue,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default XpPopup;
