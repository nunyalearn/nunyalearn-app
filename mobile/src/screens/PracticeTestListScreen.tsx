import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { LearnStackParamList } from "../navigation/types";
import { usePracticeTest } from "../hooks/usePracticeTest";
import type { PracticeTestSummary } from "../services/test.service";

type Props = NativeStackScreenProps<LearnStackParamList, "PracticeTestList">;

export default function PracticeTestListScreen({ navigation, route }: Props) {
  const { topicId } = route.params;
  const { getPracticeTestsByTopic } = usePracticeTest();
  const [tests, setTests] = useState<PracticeTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPracticeTestsByTopic(topicId);
      setTests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load practice tests");
    } finally {
      setLoading(false);
    }
  }, [getPracticeTestsByTopic, topicId]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const handleSelect = (test: PracticeTestSummary) => {
    navigation.navigate("TestPlayer", { testId: test.id, topicId, mode: "practice" });
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
        <TouchableOpacity onPress={loadTests} style={{ padding: 12, backgroundColor: "#222", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={tests}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleSelect(item)}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#f9fafb" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title ?? "Practice Test"}</Text>
          <Text style={{ color: "#4b5563" }}>{item.description ?? ""}</Text>
          <Text style={{ color: "#6b7280", marginTop: 4 }}>
            {item.questionCount ?? 0} questions • {item.durationMinutes ?? 0} min
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

