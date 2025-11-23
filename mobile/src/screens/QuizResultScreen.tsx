import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { LearnStackParamList } from "../navigation/types";
import { useQuiz } from "../hooks/useQuiz";
import type { QuizAttempt } from "../services/quiz.service";
import XpPopup from "../components/feedback/XpPopup";
import StreakFire from "../components/feedback/StreakFire";
import MasteryRing from "../components/feedback/MasteryRing";
import Confetti from "../components/feedback/Confetti";

type Props = NativeStackScreenProps<LearnStackParamList, "QuizResult">;

export default function QuizResultScreen({ route, navigation }: Props) {
  const { attemptId } = route.params;
  const { getQuizAttempt } = useQuiz();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuizAttempt(attemptId);
      setAttempt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attempt");
    } finally {
      setLoading(false);
    }
  }, [attemptId, getQuizAttempt]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

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

  const masteryBefore = useMemo(
    () => (attempt ? Number((attempt as Record<string, unknown>)?.["masteryBefore"]) || 0 : 0),
    [attempt],
  );
  const masteryAfter = useMemo(
    () => (attempt ? Number((attempt as Record<string, unknown>)?.["masteryAfter"]) || masteryBefore : masteryBefore),
    [attempt, masteryBefore],
  );
  const score = attempt?.score ?? 0;

  if (!attempt) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Attempt not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
      <XpPopup />
      <StreakFire />
      <Confetti visible={score >= 80} />
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center" }}>Quiz Complete!</Text>
      <Text style={{ fontSize: 16, textAlign: "center" }}>Score: {score}%</Text>
      <Text style={{ textAlign: "center" }}>XP Earned: {attempt.xpAwarded ?? 0}</Text>
      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <MasteryRing masteryBefore={masteryBefore} masteryAfter={masteryAfter} />
      </View>
      <Button title="Continue" onPress={() => navigation.popToTop()} />
    </View>
  );
}

