import { useEffect } from "react";
import { Dimensions, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { feedbackColors } from "../../theme/feedbackColors";

const { width } = Dimensions.get("window");

type Props = {
  visible: boolean;
};

export const Confetti = ({ visible }: Props) => {
  const fall = useSharedValue(-40);

  useEffect(() => {
    if (visible) {
      fall.value = -40;
      fall.value = withRepeat(withSequence(withTiming(20, { duration: 600 }), withTiming(-40, { duration: 0 })), 6, false);
    }
  }, [visible, fall]);

  if (!visible) {
    return null;
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fall.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.emoji}>🎉🎊🎉</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    width,
    alignItems: "center",
    zIndex: 10,
  },
  emoji: {
    fontSize: 36,
    color: feedbackColors.celebratoryGold,
  },
});

export default Confetti;
