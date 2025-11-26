import { memo, useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../../utils/styled";

import type { QuizSummary } from "../../services/quiz.service";
import { colors } from "../../theme/colors";

const StyledView = styled(View);
const StyledText = styled(Text);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type QuizTileProps = {
  quiz: QuizSummary;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const difficultyOrder: Record<string, number> = {
  hard: 3,
  medium: 2,
  easy: 1,
};

const difficultyPalette: Record<
  string,
  {
    background: string;
    text: string;
  }
> = {
  hard: { background: colors.primaryDark, text: colors.surface },
  medium: { background: colors.accent, text: colors.surface },
  easy: { background: colors.surface, text: colors.primary },
  default: { background: colors.border, text: colors.text },
};

const QuizTileComponent = ({ quiz, onPress, style }: QuizTileProps) => {
  const scale = useSharedValue(1);
  const difficultyKey = quiz.difficulty?.toLowerCase() ?? "default";
  const difficultyStyle = difficultyPalette[difficultyKey] ?? difficultyPalette.default;

  const progressPercent = useMemo(() => {
    if (typeof quiz.progressPercent === "number") {
      return Math.max(0, Math.min(100, quiz.progressPercent));
    }
    const attempt = quiz.latestAttempt;
    if (!attempt) return null;
    const total =
      attempt.totalQuestions ??
      attempt.questionCount ??
      quiz.questionCount ??
      0;
    if (!total || !attempt.score) {
      return null;
    }
    return Math.max(0, Math.min(100, (attempt.score / total) * 100));
  }, [quiz.latestAttempt, quiz.progressPercent, quiz.questionCount]);

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
      onPress={onPress}
      accessibilityRole="button"
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.wrapper, style, animatedStyle]}
    >
      <LinearGradient colors={[colors.surface, colors.background]} style={styles.gradient}>
        <StyledView className="flex-row justify-between gap-4">
          <StyledView className="flex-1 gap-2">
            <StyledText className="text-lg font-semibold" style={{ color: colors.text }} numberOfLines={1}>
              {quiz.title ?? "Quiz"}
            </StyledText>
            {quiz.description ? (
              <StyledText className="text-sm" style={{ color: colors.muted }} numberOfLines={2}>
                {quiz.description}
              </StyledText>
            ) : null}
            <StyledView className="flex-row flex-wrap items-center gap-2">
              <StyledView
                style={[styles.chip, { backgroundColor: difficultyStyle.background }]}
              >
              <StyledText className="text-xs font-semibold" style={{ color: difficultyStyle.text }}>
                {(quiz.difficulty ?? "ungraded").toUpperCase()}
              </StyledText>
              </StyledView>
              {quiz.questionCount ? (
                <StyledText className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
                  {quiz.questionCount} questions
                </StyledText>
              ) : null}
            </StyledView>
            {typeof quiz.xpReward === "number" ? (
              <StyledView style={[styles.xpBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="flash" size={14} color={colors.text} />
                <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
                  +{quiz.xpReward} XP
                </StyledText>
              </StyledView>
            ) : null}
          </StyledView>
          <StyledView style={styles.progressWrapper}>
            <Svg width={size} height={size}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.border}
                strokeWidth={strokeWidth}
                fill="transparent"
              />
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
              <StyledText
                className="text-xs font-semibold"
                style={{ color: colors.text }}
              >
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
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
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

export const sortByDifficulty = (a: QuizSummary, b: QuizSummary) => {
  const rankA = difficultyOrder[a.difficulty?.toLowerCase() ?? ""] ?? 0;
  const rankB = difficultyOrder[b.difficulty?.toLowerCase() ?? ""] ?? 0;
  return rankB - rankA;
};

export default memo(QuizTileComponent);
