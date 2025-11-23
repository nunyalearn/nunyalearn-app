import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { feedbackColors } from "../../theme/feedbackColors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  masteryBefore?: number;
  masteryAfter?: number;
};

export const MasteryRing = ({ masteryBefore = 0, masteryAfter = 0 }: Props) => {
  const clampedBefore = Math.max(0, Math.min(100, masteryBefore));
  const clampedAfter = Math.max(0, Math.min(100, masteryAfter));
  const progress = useSharedValue(clampedBefore);

  useEffect(() => {
    progress.value = withTiming(clampedAfter, { duration: 800 });
  }, [clampedAfter, progress]);

  const animatedProps = useAnimatedProps(() => {
    const circumference = 2 * Math.PI * 42;
    const strokeDashoffset = circumference - (progress.value / 100) * circumference;
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={styles.wrapper}>
      <Svg width={110} height={110}>
        <Circle cx={55} cy={55} r={42} stroke="#e5e7eb" strokeWidth={10} fill="transparent" />
        <AnimatedCircle
          cx={55}
          cy={55}
          r={42}
          stroke={feedbackColors.masteryGreen}
          strokeWidth={10}
          strokeDasharray={2 * Math.PI * 42}
          animatedProps={animatedProps}
          strokeLinecap="round"
          fill="transparent"
          transform="rotate(-90 55 55)"
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.percent}>{Math.round(clampedAfter)}%</Text>
        <Text style={styles.label}>Mastery</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  percent: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
  },
});

export default MasteryRing;
