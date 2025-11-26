import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styled } from "../../utils/styled";

import type { Achievement } from "../../services/achievement.service";
import { colors } from "../../theme/colors";

const StyledView = styled(View);
const StyledText = styled(Text);

type AchievementCardProps = {
  achievement: Achievement;
};

const clampProgress = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

export default function AchievementCard({ achievement }: AchievementCardProps) {
  const isUnlocked = Boolean(achievement.unlocked);
  const progressPercent = isUnlocked ? 100 : clampProgress(achievement.progressPercent);
  const xpLabel = `+${achievement.xpReward ?? 0} XP`;

  const iconNode = achievement.iconUrl ? (
    <Image source={{ uri: achievement.iconUrl }} style={styles.iconImage} />
  ) : (
    <StyledView style={[styles.iconFallback, { backgroundColor: colors.surface }]}>
      <StyledText style={[styles.iconFallbackText, { color: colors.primaryDark }]}>🎯</StyledText>
    </StyledView>
  );

  const content = (
    <StyledView className="gap-4">
      <StyledView className="flex-row items-start justify-between gap-4">
        <StyledView className="flex-row flex-1 items-start gap-4">
          {iconNode}
          <StyledView className="flex-1">
            <StyledText className="text-lg font-semibold" style={{ color: isUnlocked ? colors.surface : colors.text }}>
              {achievement.title}
            </StyledText>
            {achievement.description ? (
              <StyledText className="mt-1 text-sm" style={{ color: isUnlocked ? colors.surface : colors.muted }}>
                {achievement.description}
              </StyledText>
            ) : null}
          </StyledView>
        </StyledView>
        <StyledView
          style={[
            styles.xpBadge,
            {
              backgroundColor: isUnlocked ? colors.surface : colors.background,
              borderColor: isUnlocked ? "transparent" : colors.border,
            },
          ]}
        >
          <StyledText className="text-xs font-semibold" style={{ color: isUnlocked ? colors.primary : colors.text }}>
            {xpLabel}
          </StyledText>
        </StyledView>
      </StyledView>

      {isUnlocked ? (
        <StyledView className="flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={20} color={colors.primaryLight} />
          <StyledText className="text-sm font-semibold" style={{ color: colors.surface }}>
            Unlocked
          </StyledText>
        </StyledView>
      ) : (
        <StyledView className="gap-2">
          <StyledView style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <StyledView
              style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]}
            />
          </StyledView>
          <StyledText className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>
            {progressPercent}% complete
          </StyledText>
        </StyledView>
      )}
    </StyledView>
  );

  if (isUnlocked) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.unlockedContainer}>
        {content}
      </LinearGradient>
    );
  }

  return (
    <StyledView style={[styles.lockedContainer, { backgroundColor: colors.surface }]} className="gap-4">
      <StyledView style={[styles.lockBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="lock-closed" size={16} color={colors.muted} />
      </StyledView>
      {content}
    </StyledView>
  );
}

const styles = StyleSheet.create({
  unlockedContainer: {
    borderRadius: 24,
    padding: 20,
  },
  lockedContainer: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  iconImage: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  iconFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconFallbackText: {
    fontSize: 24,
  },
  xpBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  lockBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
