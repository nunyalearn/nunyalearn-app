import { memo, useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../../utils/styled";

import { colors } from "../../theme/colors";
import type { PracticeTestSummary } from "../../services/test.service";

const StyledView = styled(View);
const StyledText = styled(Text);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PracticeTestTileProps = {
  test: PracticeTestSummary;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const PracticeTestTileComponent = ({ test, onPress, style }: PracticeTestTileProps) => {
  const scale = useSharedValue(1);

  const progressPercent = useMemo(() => {
    if (typeof test.progressPercent === "number") {
      return Math.max(0, Math.min(100, test.progressPercent));
    }
    const attempt = test.latestAttempt;
    if (!attempt) return null;
    const total = attempt.totalQuestions ?? attempt.questionCount ?? test.questionCount ?? 0;
    if (!total || typeof attempt.score !== "number") {
      return null;
    }
    return Math.max(0, Math.min(100, (attempt.score / total) * 100));
  }, [test.latestAttempt, test.progressPercent, test.questionCount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressValue = typeof progressPercent === "number" ? progressPercent : 0;
  const dashOffset = circumference - (progressValue / 100) * circumference;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.wrapper, style, animatedStyle]}
    >
      <LinearGradient colors={[colors.surface, colors.background]} style={styles.gradient}>
        <StyledView className="flex-row justify-between gap-4">
          <StyledView className="flex-1 gap-3">
            <StyledText className="text-lg font-semibold" style={{ color: colors.text }} numberOfLines={1}>
              {test.title ?? "Practice Test"}
            </StyledText>
            {test.description ? (
              <StyledText className="text-sm" style={{ color: colors.muted }} numberOfLines={2}>
                {test.description}
              </StyledText>
            ) : null}
            <StyledView className="flex-row flex-wrap items-center gap-3">
              {typeof test.durationMinutes === "number" ? (
                <StyledView style={styles.metaChip}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                    {test.durationMinutes} min
                  </StyledText>
                </StyledView>
              ) : null}
              {typeof test.questionCount === "number" ? (
                <StyledView style={styles.metaChip}>
                  <Ionicons name="list-outline" size={16} color={colors.primary} />
                  <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                    {test.questionCount} questions
                  </StyledText>
                </StyledView>
              ) : null}
            </StyledView>
            <StyledView className="flex-row flex-wrap items-center gap-2">
              {test.difficultyMix ? (
                <StyledView style={[styles.chip, { backgroundColor: colors.primaryLight }]}>
                  <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                    {test.difficultyMix.toUpperCase()}
                  </StyledText>
                </StyledView>
              ) : null}
              {typeof test.xpReward === "number" ? (
                <StyledView style={[styles.xpBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="flash" size={14} color={colors.text} />
                  <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                    +{test.xpReward} XP
                  </StyledText>
                </StyledView>
              ) : null}
            </StyledView>
          </StyledView>
          <StyledView style={styles.progressWrapper}>
            <Svg width={size} height={size}>
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="transparent" />
              {typeof progressPercent === "number" ? (
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={colors.primary}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              ) : null}
            </Svg>
            <StyledView style={styles.progressCenter}>
              <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                {typeof progressPercent === "number" ? `${Math.round(progressPercent)}%` : "NEW"}
              </StyledText>
            </StyledView>
          </StyledView>
        </StyledView>
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 28,
  },
  gradient: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressWrapper: {
    width: 64,
    height: 64,
  },
  progressCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default memo(PracticeTestTileComponent);
