import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { LearnStackParamList } from "../navigation/types";
import { usePracticeTest } from "../hooks/usePracticeTest";
import type { PracticeTestAttempt } from "../services/test.service";
import XpPopup from "../components/feedback/XpPopup";
import StreakFire from "../components/feedback/StreakFire";
import MasteryRing from "../components/feedback/MasteryRing";
import Confetti from "../components/feedback/Confetti";

type Props = NativeStackScreenProps<LearnStackParamList, "TestResult">;

export default function TestResultScreen({ route, navigation }: Props) {
  const { attemptId } = route.params;
  const { getPracticeTestAttempt } = usePracticeTest();
  const [attempt, setAttempt] = useState<PracticeTestAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPracticeTestAttempt(attemptId);
      setAttempt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load attempt");
    } finally {
      setLoading(false);
    }
  }, [attemptId, getPracticeTestAttempt]);

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

  const masteryBefore = attempt ? Number((attempt as Record<string, unknown>)?.["masteryBefore"]) || 0 : 0;
  const masteryAfter = attempt ? Number((attempt as Record<string, unknown>)?.["masteryAfter"]) || masteryBefore : masteryBefore;
  const score = attempt?.score ?? 0;

  if (!attempt) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Attempt not available.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
      <XpPopup />
      <StreakFire />
      <Confetti visible={score >= 80} />
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center" }}>Practice Test Complete!</Text>
      <Text style={{ fontSize: 16, textAlign: "center" }}>Score: {score}%</Text>
      <Text style={{ textAlign: "center" }}>XP Earned: {attempt.xpAwarded ?? 0}</Text>
      {attempt["passed"] !== undefined ? (
        <Text style={{ fontWeight: "600", textAlign: "center" }}>{attempt["passed"] ? "Passed" : "Needs Review"}</Text>
      ) : null}
      {attempt["certificateUrl"] ? (
        <Text style={{ color: "#1d4ed8", textAlign: "center" }}>Certificate: {String(attempt["certificateUrl"])}</Text>
      ) : null}
      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <MasteryRing masteryBefore={masteryBefore} masteryAfter={masteryAfter} />
      </View>
      <Button title="Continue" onPress={() => navigation.popToTop()} />
    </View>
  );
}

