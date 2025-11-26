import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Button from "../components/UI/Button";
import QuizTile, { sortByDifficulty } from "../components/quiz/QuizTile";
import { useQuiz } from "../hooks/useQuiz";
import { useEngagement } from "../hooks/useEngagement";
import type { LearnStackParamList } from "../navigation/types";
import type { QuizSummary } from "../services/quiz.service";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<LearnStackParamList, "QuizList">;

const StyledView = styled(View);
const StyledText = styled(Text);

export default function QuizListScreen({ navigation, route }: Props) {
  const { topicId, topicName, subjectName } = route.params;
  const { getQuizzesByTopic } = useQuiz();
  const { xpToday, streakDays } = useEngagement();

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuizzes = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await getQuizzesByTopic(topicId);
        setQuizzes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quizzes");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [getQuizzesByTopic, topicId],
  );

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQuizzes(false);
    setRefreshing(false);
  }, [fetchQuizzes]);

  const activeQuizzes = useMemo(() => quizzes.filter((quiz) => quiz.isActive !== false), [quizzes]);
  const recommendedQuizzes = useMemo(() => {
    const withDifficulty = activeQuizzes.filter((quiz) => quiz.difficulty);
    if (!withDifficulty.length) {
      return [];
    }
    return [...withDifficulty].sort(sortByDifficulty).slice(0, 3);
  }, [activeQuizzes]);

  const handleSelect = useCallback(
    (quiz: QuizSummary) => {
      const quizId = quiz.quizId ?? quiz.id;
      if (!quizId) return;
      navigation.navigate("QuizPlayer", {
        quizId,
        topicId,
        topicName,
      });
    },
    [navigation, topicId, topicName],
  );

  const hero = (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
      <StyledView className="flex-row items-start gap-4">
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { borderColor: colors.surface }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.surface} />
        </TouchableOpacity>
        <StyledView className="flex-1">
          <StyledText className="text-xs font-semibold uppercase tracking-wide" style={styles.heroSubheading}>
            {subjectName ?? "Learning Path"}
          </StyledText>
          <StyledText className="mt-1 text-3xl font-bold" style={styles.heroHeading}>
            {topicName ?? "Quizzes"}
          </StyledText>
          <StyledText className="mt-2 text-base" style={styles.heroSubheading}>
            {activeQuizzes.length} quizzes ready
          </StyledText>
        </StyledView>
        <StyledView style={[styles.heroStats, { backgroundColor: colors.surface }]}>
          <StyledText className="text-xs font-semibold" style={{ color: colors.primary }}>
            {xpToday} XP
          </StyledText>
          <StyledView style={styles.streakRow}>
            <Ionicons name="flame" size={16} color={colors.streak} />
            <StyledText className="text-xs font-semibold" style={{ color: colors.text }}>
              {streakDays}d
            </StyledText>
          </StyledView>
        </StyledView>
      </StyledView>
    </LinearGradient>
  );

  const inlineError = error && activeQuizzes.length ? (
    <StyledView className="rounded-2xl border px-4 py-3" style={styles.inlineError}>
      <StyledText className="text-sm" style={styles.mutedText}>
        {error}
      </StyledText>
    </StyledView>
  ) : null;

  const renderRecommended = () =>
    recommendedQuizzes.length ? (
      <StyledView className="gap-3">
        <StyledView className="flex-row items-center justify-between">
          <StyledText className="text-base font-semibold" style={styles.sectionHeading}>
            Recommended
          </StyledText>
          <StyledText className="text-xs uppercase tracking-wide" style={styles.mutedText}>
            Based on difficulty
          </StyledText>
        </StyledView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendRow}>
          {recommendedQuizzes.map((quiz) => (
            <TouchableOpacity
              key={quiz.quizId ?? quiz.id}
              onPress={() => handleSelect(quiz)}
              style={[styles.recommendationCard, { borderColor: colors.border }]}
            >
              <StyledText className="text-sm font-semibold" style={styles.recommendationTitle} numberOfLines={1}>
                {quiz.title ?? "Quiz"}
              </StyledText>
              <StyledText className="text-xs" style={styles.mutedText}>
                {quiz.difficulty ?? "mixed"}
              </StyledText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </StyledView>
    ) : null;

  if (loading) {
    return (
      <Screen contentClassName="gap-8">
        {hero}
        <StyledView className="items-center justify-center py-10">
          <ActivityIndicator color={colors.primary} />
        </StyledView>
      </Screen>
    );
  }

  if (error && !activeQuizzes.length) {
    return (
      <Screen contentClassName="gap-8">
        {hero}
        <StyledView className="items-center gap-4 rounded-3xl border p-6" style={styles.errorCard}>
          <StyledText className="text-center text-base" style={styles.mutedText}>
            {error}
          </StyledText>
          <Button title="Try again" onPress={() => fetchQuizzes()} />
        </StyledView>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={activeQuizzes}
        keyExtractor={(item) => String(item.quizId ?? item.id)}
        renderItem={({ item }) => <QuizTile quiz={item} onPress={() => handleSelect(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <StyledView className="gap-6 mb-6">
            {hero}
            {renderRecommended()}
            {inlineError}
          </StyledView>
        }
        ListEmptyComponent={
          <StyledView className="items-center gap-3 rounded-3xl border p-6" style={styles.emptyCard}>
            <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
              No quizzes yet
            </StyledText>
            <StyledText className="text-center" style={styles.mutedText}>
              We&apos;re stitching fresh challenges for this topic. Check back soon!
            </StyledText>
          </StyledView>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 32,
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroHeading: {
    color: colors.surface,
  },
  heroSubheading: {
    color: colors.surface,
    opacity: 0.85,
  },
  heroStats: {
    borderRadius: 24,
    padding: 12,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionHeading: {
    color: colors.text,
  },
  mutedText: {
    color: colors.muted,
  },
  listContent: {
    paddingBottom: 32,
  },
  errorCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 16,
  },
  recommendRow: {
    paddingRight: 12,
  },
  recommendationCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 140,
    backgroundColor: colors.surface,
    marginRight: 12,
  },
  recommendationTitle: {
    color: colors.text,
  },
  inlineError: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
