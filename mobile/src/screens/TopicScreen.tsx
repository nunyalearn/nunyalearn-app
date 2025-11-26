import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Button from "../components/UI/Button";
import TopicTile from "../components/topic/TopicTile";
import { colors } from "../theme/colors";
import { topicService, type Topic } from "../services/topic.service";
import type { LearnStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<LearnStackParamList, "Topics">;

const StyledView = styled(View);
const StyledText = styled(Text);

export default function TopicScreen({ navigation, route }: Props) {
  const { subjectId, subjectName } = route.params;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await topicService.fetchTopics(subjectId);
      setTopics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load topics");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const topicCount = topics.length;

  const gridData = useMemo(() => topics, [topics]);

  const buildParams = useCallback(
    (topic: Topic) => ({
      topicId: topic.topicId ?? topic.id,
      topicName: topic.topicName ?? topic.name,
      subjectName,
    }),
    [subjectName],
  );

  const renderGrid = () => (
    <StyledView className="flex-row flex-wrap justify-between gap-4">
      {gridData.map((topic, index) => (
        <TopicTile
          key={`${topic.topicId ?? topic.id ?? index}`}
          topic={topic}
          onQuizPress={() => {
            const params = buildParams(topic);
            if (params.topicId) {
              navigation.navigate("QuizList", params);
            }
          }}
          onPracticePress={() => {
            const params = buildParams(topic);
            if (params.topicId) {
              navigation.navigate("PracticeTestList", params);
            }
          }}
          style={styles.tile}
        />
      ))}
    </StyledView>
  );

  return (
    <Screen scrollable contentClassName="gap-8">
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
        <StyledView className="flex-row items-start gap-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={[styles.backButton, { borderColor: colors.surface }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.surface} />
          </TouchableOpacity>
          <StyledView className="flex-1">
            <StyledText className="text-xs font-semibold uppercase tracking-wide" style={styles.heroSubheading}>
              {subjectName ?? "Subject"}
            </StyledText>
            <StyledText className="mt-1 text-3xl font-bold" style={styles.heroHeading}>
              Topics
            </StyledText>
            <StyledText className="mt-2 text-base" style={styles.heroSubheading}>
              {topicCount} learning paths
            </StyledText>
          </StyledView>
        </StyledView>
      </LinearGradient>

      {loading ? (
        <StyledView className="items-center justify-center py-10">
          <ActivityIndicator color={colors.primary} />
        </StyledView>
      ) : error ? (
        <StyledView className="items-center gap-4 rounded-3xl border p-6" style={styles.errorCard}>
          <StyledText className="text-center text-base" style={styles.mutedText}>
            {error}
          </StyledText>
          <Button title="Try again" onPress={loadTopics} />
        </StyledView>
      ) : topicCount === 0 ? (
        <StyledView className="items-center gap-3 rounded-3xl border p-6" style={styles.emptyCard}>
          <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
            Nothing here yet
          </StyledText>
          <StyledText className="text-center" style={styles.mutedText}>
            We&apos;re stitching fresh topics for this subject. Please check again soon!
          </StyledText>
        </StyledView>
      ) : (
        renderGrid()
      )}
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
  tile: {
    flexBasis: "48%",
    minWidth: 150,
    flexGrow: 1,
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
