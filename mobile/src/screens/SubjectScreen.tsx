import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styled } from "../utils/styled";

import Screen from "../components/UI/Screen";
import Button from "../components/UI/Button";
import SubjectTile from "../components/subject/SubjectTile";
import { colors } from "../theme/colors";
import { subjectService, type Subject } from "../services/subject.service";
import type { LearnStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<LearnStackParamList, "Subjects">;

const StyledView = styled(View);
const StyledText = styled(Text);

export default function SubjectScreen({ navigation, route }: Props) {
  const { gradeId } = route.params;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await subjectService.fetchSubjects(gradeId);
      setSubjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load subjects");
    } finally {
      setLoading(false);
    }
  }, [gradeId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const subjectCount = subjects.length;

  const gridData = useMemo(() => subjects, [subjects]);

  const handleSelect = useCallback(
    (subject: Subject) => {
      const subjectId = subject.subjectId ?? subject.id;
      if (!subjectId) return;
      navigation.navigate("Topics", { subjectId, subjectName: subject.subjectName ?? subject.name });
    },
    [navigation],
  );

  const renderGrid = () => (
    <StyledView className="flex-row flex-wrap justify-between gap-4">
      {gridData.map((subject, index) => (
        <SubjectTile
          key={`${subject.subjectId ?? subject.id ?? index}`}
          subject={subject}
          onPress={() => handleSelect(subject)}
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
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { borderColor: colors.surface }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.surface} />
          </TouchableOpacity>
          <StyledView className="flex-1">
            <StyledText
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.surface, opacity: 0.8 }}
            >
              Grade {gradeId}
            </StyledText>
            <StyledText className="mt-1 text-3xl font-bold" style={{ color: colors.surface }}>
              Subjects
            </StyledText>
            <StyledText className="mt-2 text-base" style={{ color: colors.surface, opacity: 0.9 }}>
              {subjectCount} available courses
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
          <Button title="Try again" onPress={loadSubjects} />
        </StyledView>
      ) : subjectCount === 0 ? (
        <StyledView className="items-center gap-3 rounded-3xl border p-6" style={styles.emptyCard}>
          <StyledText className="text-lg font-semibold" style={styles.sectionHeading}>
            Nothing here yet
          </StyledText>
          <StyledText className="text-center" style={styles.mutedText}>
            We&apos;re stitching together new content for this grade. Check back soon!
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
