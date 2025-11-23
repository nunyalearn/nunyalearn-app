import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Button, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { LearnStackParamList } from "../navigation/types";
import { usePracticeTest } from "../hooks/usePracticeTest";
import type { PracticeTestAttempt } from "../services/test.service";
import { useEngagement } from "../hooks/useEngagement";

type Props = NativeStackScreenProps<LearnStackParamList, "TestPlayer">;

export default function TestPlayerScreen({ route, navigation }: Props) {
  const { testId, topicId, mode } = route.params;
  const { startPracticeTestAttempt, submitPracticeTestAttempt } = usePracticeTest();
  const { triggerXpPopup, triggerStreakAnimation, triggerMasteryUpdate } = useEngagement();
  const [attempt, setAttempt] = useState<PracticeTestAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await startPracticeTestAttempt(testId, { mode });
      setAttempt(data);
      setCurrentIndex(0);
      setResponses({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start test");
    } finally {
      setLoading(false);
    }
  }, [mode, startPracticeTestAttempt, testId]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const currentQuestion = questions[currentIndex];
  const currentQuestionId = currentQuestion?.questionId ?? currentQuestion?.id;
  const options = currentQuestion?.options ?? currentQuestion?.choices ?? [];

  const selectOption = (option: string) => {
    if (!currentQuestionId) return;
    setResponses((prev) => ({ ...prev, [currentQuestionId]: option }));
  };

  const handleSubmit = async () => {
    if (!attempt || !currentQuestionId) return;
    const attemptId = attempt.attemptId ?? attempt.id;
    if (!attemptId) {
      Alert.alert("Unable to submit test");
      return;
    }

    const formattedResponses = questions.map((question) => {
      const qId = question.questionId ?? question.id;
      return {
        questionId: qId!,
        selectedOption: responses[qId!] ?? null,
        selectedOptions: null,
      };
    });

    setSubmitting(true);
    try {
      const result = await submitPracticeTestAttempt(testId, {
        attemptId,
        responses: formattedResponses,
      });
      const rawResult = result as Record<string, any>;
      const xpAwarded = typeof rawResult?.xpAwarded === "number" ? rawResult.xpAwarded : 0;
      const masteryDelta =
        typeof rawResult?.masteryDelta === "number"
          ? rawResult.masteryDelta
          : topicId && rawResult?.masteryDeltaByTopic
            ? rawResult.masteryDeltaByTopic[topicId]
            : null;
      const newStreakValue = typeof rawResult?.streakDays === "number" ? rawResult.streakDays : undefined;
      const streakIncreased = rawResult?.streakIncreased || rawResult?.streakAwarded;

      if (xpAwarded > 0) {
        triggerXpPopup(xpAwarded);
      }
      if (streakIncreased || newStreakValue !== undefined) {
        triggerStreakAnimation(newStreakValue);
      }
      if (typeof masteryDelta === "number" && topicId) {
        triggerMasteryUpdate(topicId, masteryDelta);
      }

      const resultId = result?.attemptId ?? attemptId;
      navigation.replace("TestResult", { attemptId: resultId });
    } catch (err) {
      Alert.alert("Submission error", err instanceof Error ? err.message : "Unable to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      handleSubmit();
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text style={{ color: "red", marginBottom: 12 }}>{error}</Text>
        <Button title="Try again" onPress={loadAttempt} />
      </View>
    );
  }

  if (!currentQuestion || !currentQuestionId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>No questions available.</Text>
      </View>
    );
  }

  const selectedOption = responses[currentQuestionId];
  const questionPrompt = currentQuestion.prompt ?? currentQuestion.questionText ?? "Question";

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 16, color: "#6b7280" }}>
        Question {currentIndex + 1} / {questions.length}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>{questionPrompt}</Text>

      <View style={{ gap: 12 }}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => selectOption(option)}
            style={{
              padding: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: selectedOption === option ? "#047857" : "#d1d5db",
              backgroundColor: selectedOption === option ? "#047857" : "#fff",
            }}
          >
            <Text style={{ color: selectedOption === option ? "#fff" : "#111827" }}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ marginTop: "auto" }}>
        <Button
          title={currentIndex === questions.length - 1 ? "Submit" : "Next"}
          onPress={handleNext}
          disabled={submitting || !selectedOption}
        />
      </View>
    </View>
  );
}

