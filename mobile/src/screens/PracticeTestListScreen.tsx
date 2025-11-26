import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Button from "../components/UI/Button";
import PracticeTestTile from "../components/test/PracticeTestTile";
import { usePracticeTest } from "../hooks/usePracticeTest";
import type { PracticeTestSummary } from "../services/test.service";
import type { LearnStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<LearnStackParamList, "PracticeTestList">;

const StyledView = styled(View);
const StyledText = styled(Text);

export default function PracticeTestListScreen({ navigation, route }: Props) {
  const { topicId, topicName, subjectName } = route.params;
  const { getPracticeTestsByTopic } = usePracticeTest();

  const [tests, setTests] = useState<PracticeTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadTests = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await getPracticeTestsByTopic(topicId);
        setTests(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load practice tests");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [getPracticeTestsByTopic, topicId],
  );

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTests(false);
    setRefreshing(false);
  }, [loadTests]);

  const activeTests = useMemo(() => tests.filter((test) => test.isActive !== false), [tests]);

  const handleSelect = useCallback(
    (test: PracticeTestSummary) => {
      navigation.navigate("TestPlayer", {
        testId: test.id,
        topicId,
        topicName,
        mode: "practice",
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
            {subjectName ?? "Practice track"}
          </StyledText>
          <StyledText className="mt-1 text-3xl font-bold" style={styles.heroHeading}>
            Practice Tests
          </StyledText>
          <StyledText className="mt-2 text-base" style={styles.heroSubheading}>
            {topicName ?? "Topic"} • {activeTests.length} sets
          </StyledText>
        </StyledView>
      </StyledView>
    </LinearGradient>
  );

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

  if (error && !activeTests.length) {
    return (
      <Screen contentClassName="gap-8">
        {hero}
        <StyledView className="items-center gap-4 rounded-3xl border p-6" style={styles.errorCard}>
          <StyledText className="text-center text-base" style={styles.mutedText}>
            {error}
          </StyledText>
          <Button title="Try again" onPress={() => loadTests()} />
        </StyledView>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={activeTests}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <PracticeTestTile test={item} onPress={() => handleSelect(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<StyledView className="gap-6 mb-6">{hero}</StyledView>}
        ListEmptyComponent={
          <StyledView className="items-center gap-3 rounded-3xl border p-6" style={styles.emptyCard}>
            <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
              No practice tests yet
            </StyledText>
            <StyledText className="text-center" style={styles.mutedText}>
              We&apos;re stitching together new simulations for this topic. Check back soon!
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
  listContent: {
    paddingBottom: 32,
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
    marginTop: 16,
  },
});
