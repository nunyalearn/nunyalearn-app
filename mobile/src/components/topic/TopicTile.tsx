import { memo, useMemo } from "react";
import { Image, Pressable, StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { FadeInUp, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styled } from "../../utils/styled";

import { colors } from "../../theme/colors";
import type { Topic } from "../../services/topic.service";

const StyledText = styled(Text);
const StyledView = styled(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TopicTileProps = {
  topic: Topic;
  onQuizPress: () => void;
  onPracticePress: () => void;
  style?: StyleProp<ViewStyle>;
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  easy: "leaf-outline",
  medium: "speedometer-outline",
  hard: "flame-outline",
  default: "sparkles-outline",
};

const TopicTileComponent = ({ topic, onQuizPress, onPracticePress, style }: TopicTileProps) => {
  const displayName = topic.topicName ?? topic.name ?? "Topic";
  const description = topic.description ?? topic.summary ?? "Ready to explore";
  const difficulty = topic.difficulty?.toLowerCase();
  const iconName = useMemo(() => {
    if (!difficulty) return iconMap.default;
    return iconMap[difficulty] ?? iconMap.default;
  }, [difficulty]);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  return (
    <AnimatedPressable
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.wrapper, style, animatedStyle]}
    >
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
        <StyledView className="flex-row items-center gap-3">
          {topic.iconUrl ? (
            <Image source={{ uri: topic.iconUrl }} style={styles.iconImage} />
          ) : (
            <StyledView style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
              <Ionicons name={iconName} size={24} color={colors.primary} />
            </StyledView>
          )}
          <StyledView className="flex-1">
            <StyledText className="text-lg font-semibold" style={{ color: colors.surface }} numberOfLines={1}>
              {displayName}
            </StyledText>
            <StyledText className="text-xs" style={{ color: colors.surface, opacity: 0.75 }} numberOfLines={2}>
              {description}
            </StyledText>
          </StyledView>
        </StyledView>

        <StyledView className="mt-4 flex-row gap-3">
          <Pressable
            onPress={onQuizPress}
            style={[styles.chip, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <StyledText className="text-sm font-semibold" style={{ color: colors.primary }}>
              Quizzes
            </StyledText>
          </Pressable>
          <Pressable
            onPress={onPracticePress}
            style={[styles.chip, { borderColor: colors.surface, borderWidth: 1 }]}
            accessibilityRole="button"
          >
            <Ionicons name="trophy-outline" size={16} color={colors.surface} />
            <StyledText className="text-sm font-semibold" style={{ color: colors.surface }}>
              Practice
            </StyledText>
          </Pressable>
        </StyledView>
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 24,
  },
  gradient: {
    borderRadius: 24,
    padding: 18,
    minHeight: 140,
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  chip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});

export default memo(TopicTileComponent);
