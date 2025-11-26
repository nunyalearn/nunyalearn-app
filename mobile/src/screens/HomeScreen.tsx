import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "../utils/styled";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";

import Screen from "../components/UI/Screen";
import { colors } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";
import { useEngagement } from "../hooks/useEngagement";
import { useQuiz } from "../hooks/useQuiz";
import { usePracticeTest } from "../hooks/usePracticeTest";
import ContinueLearningCard, { type ContinueLearningActivity } from "../components/home/ContinueLearningCard";
import GradeTile from "../components/home/GradeTile";
import Button from "../components/UI/Button";
import api from "../services/api";
import type { LearnStackParamList, ProfileStackParamList } from "../navigation/types";

const StyledView = styled(View);
const StyledText = styled(Text);

type HomeTabParamList = {
  Home: undefined;
  Learn: NavigatorScreenParams<LearnStackParamList>;
  Achievements: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

type HomeScreenNavigationProp = BottomTabNavigationProp<HomeTabParamList, "Home">;

type Grade = {
  id?: number;
  gradeId?: number;
  name?: string;
  gradeLevelName?: string;
};

type ActivityType = "quiz" | "practice";

type RawAttemptPayload = {
  attemptId?: number;
  id?: number;
  quizId?: number;
  testId?: number;
  resourceId?: number;
  topicId?: number;
  topicName?: string;
  topic?: { id?: number; name?: string };
  title?: string;
  completedQuestions?: number;
  answeredQuestions?: number;
  questionsAnswered?: number;
  totalQuestions?: number;
  questionCount?: number;
  questionTotal?: number;
  questions?: unknown[];
  progressPercent?: number;
  score?: number;
  updatedAt?: string;
  startedAt?: string;
};

type ContinueLearningData = ContinueLearningActivity & {
  attemptId: number;
  resourceId?: number;
  topicId?: number;
  updatedAt?: string;
};

const unwrap = <T,>(payload: T | { data?: T }): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
};

const extractAttemptPayload = (payload: unknown): RawAttemptPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if ("latestAttempt" in payload) {
    const latest = (payload as { latestAttempt?: RawAttemptPayload }).latestAttempt;
    if (latest) return latest;
  }
  if ("attempt" in payload) {
    const attempt = (payload as { attempt?: RawAttemptPayload }).attempt;
    if (attempt) return attempt;
  }
  if (Array.isArray(payload)) {
    return (payload as RawAttemptPayload[])[0] ?? null;
  }
  return payload as RawAttemptPayload;
};

const buildActivity = (type: ActivityType, attempt: RawAttemptPayload): ContinueLearningData | null => {
  const attemptId = attempt.attemptId ?? attempt.id;
  if (!attemptId) {
    return null;
  }

  const totalQuestions =
    attempt.totalQuestions ??
    attempt.questionCount ??
    attempt.questionTotal ??
    (Array.isArray(attempt.questions) ? attempt.questions.length : undefined);
  const completed =
    attempt.completedQuestions ?? attempt.answeredQuestions ?? attempt.questionsAnswered ?? (totalQuestions ? 0 : undefined);

  const computedProgress =
    typeof totalQuestions === "number" && totalQuestions > 0 && typeof completed === "number"
      ? (completed / totalQuestions) * 100
      : undefined;
  const progressPercent = attempt.progressPercent ?? computedProgress;

  const topicName = attempt.topicName ?? attempt.topic?.name ?? attempt.title ?? "Learning track";
  const title = attempt.title ?? (type === "quiz" ? "Quiz mastery" : "Practice test");
  const metaLabel = type === "quiz" ? "Latest quiz" : "Latest practice test";
  const progressCaption =
    typeof progressPercent === "number" ? `${Math.round(progressPercent)}% complete` : "Pick up where you left off";

  return {
    attemptId,
    resourceId: attempt.quizId ?? attempt.testId ?? attempt.resourceId,
    topicId: attempt.topicId ?? attempt.topic?.id,
    updatedAt: attempt.updatedAt ?? attempt.startedAt,
    type,
    title,
    topicName,
    metaLabel,
    progressPercent,
    progressCaption,
  };
};

const getTimestamp = (input?: string) => {
  if (!input) return 0;
  const value = Date.parse(input);
  return Number.isNaN(value) ? 0 : value;
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { xpToday, streakDays } = useEngagement();
  const { getQuizAttempt } = useQuiz();
  const { getPracticeTestAttempt } = usePracticeTest();

  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [gradesError, setGradesError] = useState<string | null>(null);

  const [activityLoading, setActivityLoading] = useState(true);
  const [continueActivity, setContinueActivity] = useState<ContinueLearningData | null>(null);

  const firstName = useMemo(() => {
    const raw = user?.fullName ?? "";
    const [first] = raw.trim().split(" ");
    return first?.length ? first : "Explorer";
  }, [user?.fullName]);

  const initials = useMemo(() => {
    const raw = user?.fullName ?? "";
    const parts = raw
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase());
    if (parts.length === 0) {
      return "ST";
    }
    return parts.join("");
  }, [user?.fullName]);

  const xpGoal = 120;
  const xpProgress = Math.min(xpToday / xpGoal, 1);
  const xpPercent = Math.round(xpProgress * 100);

  const handleGradePress = useCallback(
    (grade: Grade) => {
      const gradeId = grade.gradeId ?? grade.id;
      if (!gradeId) return;
      navigation.navigate("Learn", {
        screen: "Subjects",
        params: { gradeId },
      });
    },
    [navigation],
  );

  const fetchLatestAttempt = useCallback(
    async (type: ActivityType): Promise<ContinueLearningData | null> => {
      try {
        const response = await api.get("/api/v2/attempts/latest", { params: { type } });
        const payload = extractAttemptPayload(unwrap(response.data));
        if (!payload) {
          return null;
        }
        const attemptId = payload.attemptId ?? payload.id;
        if (!attemptId) {
          return null;
        }
        let enriched: RawAttemptPayload = payload;
        if (type === "quiz") {
          const detailed = await getQuizAttempt(attemptId);
          enriched = { ...payload, ...detailed };
        } else {
          const detailed = await getPracticeTestAttempt(attemptId);
          enriched = { ...payload, ...detailed };
        }
        return buildActivity(type, enriched);
      } catch {
        return null;
      }
    },
    [getPracticeTestAttempt, getQuizAttempt],
  );

  const loadLatestActivity = useCallback(async () => {
    setActivityLoading(true);
    const [quizResult, practiceResult] = await Promise.all([fetchLatestAttempt("quiz"), fetchLatestAttempt("practice")]);
    const attempts = [quizResult, practiceResult].filter(Boolean) as ContinueLearningData[];
    if (attempts.length === 0) {
      setContinueActivity(null);
      setActivityLoading(false);
      return;
    }
    attempts.sort((a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt));
    setContinueActivity(attempts[0]);
    setActivityLoading(false);
  }, [fetchLatestAttempt]);

  const loadGrades = useCallback(async () => {
    setGradesLoading(true);
    setGradesError(null);
    try {
      const response = await api.get("/api/v2/grades");
      const data = unwrap<{ grades?: Grade[] } | Grade[]>(response.data);
      if (Array.isArray(data)) {
        setGrades(data);
      } else if (data?.grades) {
        setGrades(data.grades);
      } else {
        setGrades([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load grades";
      setGradesError(message);
    } finally {
      setGradesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrades();
    loadLatestActivity();
  }, [loadGrades, loadLatestActivity]);

  const handleRetryGrades = () => {
    loadGrades();
  };

  const handleContinue = () => {
    if (!continueActivity) return;
    if (continueActivity.type === "quiz" && continueActivity.resourceId) {
      navigation.navigate("Learn", {
        screen: "QuizPlayer",
        params: {
          quizId: continueActivity.resourceId,
          topicId: continueActivity.topicId,
        },
      });
      return;
    }
    if (continueActivity.type === "practice" && continueActivity.resourceId) {
      navigation.navigate("Learn", {
        screen: "TestPlayer",
        params: {
          testId: continueActivity.resourceId,
          topicId: continueActivity.topicId,
        },
      });
      return;
    }
    navigation.navigate("Learn");
  };

  return (
    <Screen scrollable contentClassName="gap-8">
      <StyledView className="gap-8">
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
          <StyledView className="flex-row items-start justify-between">
            <StyledView className="flex-1 pr-4">
              <StyledText className="text-sm text-white/80">Welcome back,</StyledText>
              <StyledText className="text-3xl font-bold text-white">{firstName}</StyledText>
              <StyledText className="mt-2 text-base text-white/90">Let&apos;s make today count.</StyledText>
            </StyledView>
            <StyledView className="h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10">
              <StyledText className="text-lg font-semibold text-white">{initials}</StyledText>
            </StyledView>
          </StyledView>
          <StyledView className="mt-6 flex-row gap-4">
            <StyledView className="flex-1 rounded-3xl bg-white/15 p-4">
              <StyledText className="text-xs font-semibold uppercase tracking-wide text-white/70">XP today</StyledText>
              <StyledText className="mt-2 text-2xl font-bold text-white">{xpToday} XP</StyledText>
              <StyledView className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/30">
                <StyledView className="h-full rounded-full bg-white" style={{ width: `${xpPercent}%` }} />
              </StyledView>
            </StyledView>
            <StyledView className="w-32 items-center justify-center rounded-3xl bg-white/15 p-4">
              <Ionicons name="flame" size={28} color={colors.streak} />
              <StyledText className="mt-2 text-xl font-bold text-white">{streakDays}</StyledText>
              <StyledText className="text-xs font-semibold uppercase tracking-wide text-white/70">Day streak</StyledText>
            </StyledView>
          </StyledView>
        </LinearGradient>

        {activityLoading ? (
          <StyledView className="items-center justify-center py-6">
            <ActivityIndicator color={colors.primary} />
          </StyledView>
        ) : continueActivity ? (
          <ContinueLearningCard activity={continueActivity} onPress={handleContinue} />
        ) : null}

        <StyledView className="gap-3">
          <StyledView className="flex-row items-center justify-between">
            <StyledText className="text-xl font-semibold" style={styles.headingText}>
              Choose your grade
            </StyledText>
            <StyledText className="text-sm" style={styles.mutedText}>
              {grades.length} options
            </StyledText>
          </StyledView>

          {gradesLoading ? (
            <StyledView className="py-10">
              <ActivityIndicator color={colors.primary} />
            </StyledView>
          ) : gradesError ? (
            <StyledView className="items-center gap-4 rounded-3xl border border-dashed p-6" style={styles.borderCard}>
              <StyledText className="text-center text-base" style={styles.mutedText}>
                {gradesError}
              </StyledText>
              <Button title="Retry" onPress={handleRetryGrades} />
            </StyledView>
          ) : grades.length === 0 ? (
            <StyledView className="items-center rounded-3xl border border-dashed p-6" style={styles.borderCard}>
              <StyledText className="text-base" style={styles.mutedText}>
                No grades available yet.
              </StyledText>
            </StyledView>
          ) : (
            <StyledView className="flex-row flex-wrap justify-between gap-4">
              {grades.map((grade) => (
                <GradeTile
                  key={grade.id ?? grade.gradeId}
                  label={grade.gradeLevelName ?? grade.name ?? `Grade ${grade.gradeId ?? ""}`}
                  onPress={() => handleGradePress(grade)}
                />
              ))}
            </StyledView>
          )}
        </StyledView>
      </StyledView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 32,
    padding: 24,
  },
  headingText: {
    color: colors.text,
  },
  mutedText: {
    color: colors.muted,
  },
  borderCard: {
    borderColor: colors.border,
  },
});
