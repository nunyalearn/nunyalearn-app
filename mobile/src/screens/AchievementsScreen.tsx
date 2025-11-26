import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Button from "../components/UI/Button";
import AchievementCard from "../components/achievements/AchievementCard";
import { colors } from "../theme/colors";
import { achievementService, type Achievement } from "../services/achievement.service";

const StyledView = styled(View);
const StyledText = styled(Text);

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await achievementService.fetchAchievements();
      setAchievements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load achievements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const unlocked = useMemo(() => achievements.filter((item) => item.unlocked), [achievements]);
  const locked = useMemo(() => achievements.filter((item) => !item.unlocked), [achievements]);
  const totalXp = useMemo(() => unlocked.reduce((sum, item) => sum + (item.xpReward ?? 0), 0), [unlocked]);

  const renderSection = (title: string, data: Achievement[]) => {
    if (!data.length) return null;
    return (
      <StyledView className="gap-4">
        <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
          {title}
        </StyledText>
        <StyledView className="gap-4">
          {data.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </StyledView>
      </StyledView>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <StyledView className="items-center justify-center py-10">
          <ActivityIndicator color={colors.primary} />
        </StyledView>
      );
    }

    if (error) {
      return (
        <StyledView className="items-center gap-4 rounded-3xl border p-6" style={styles.errorCard}>
          <StyledText className="text-base text-center" style={styles.mutedText}>
            {error}
          </StyledText>
          <Button title="Retry" onPress={loadAchievements} />
        </StyledView>
      );
    }

    if (!achievements.length) {
      return (
        <StyledView className="items-center gap-3 rounded-3xl border p-6" style={styles.emptyCard}>
          <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
            No achievements yet
          </StyledText>
          <StyledText className="text-center" style={styles.mutedText}>
            Keep learning to unlock your first reward.
          </StyledText>
        </StyledView>
      );
    }

    return (
      <StyledView className="gap-8">
        {renderSection("Unlocked", unlocked)}
        {renderSection("Locked", locked)}
      </StyledView>
    );
  };

  return (
    <Screen scrollable contentClassName="gap-8">
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
        <StyledView className="flex-row items-center justify-between">
          <StyledView className="gap-1">
            <StyledText className="text-sm font-semibold uppercase tracking-wide" style={styles.heroSubheading}>
              Stitch rewards
            </StyledText>
            <StyledText className="text-3xl font-bold" style={styles.heroHeading}>
              Achievements
            </StyledText>
            <StyledText style={styles.heroBody}>Push your streaks and collect XP.</StyledText>
          </StyledView>
          <StyledView style={[styles.xpPill, { backgroundColor: colors.surface }]}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <StyledText className="font-semibold" style={{ color: colors.primary }}>
              {totalXp} XP
            </StyledText>
          </StyledView>
        </StyledView>
      </LinearGradient>

      {renderContent()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 32,
    padding: 24,
  },
  heroHeading: {
    color: colors.surface,
  },
  heroSubheading: {
    color: colors.surface,
  },
  heroBody: {
    color: colors.surface,
    fontSize: 16,
  },
  xpPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeading: {
    color: colors.text,
  },
  mutedText: {
    color: colors.muted,
  },
  errorCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
