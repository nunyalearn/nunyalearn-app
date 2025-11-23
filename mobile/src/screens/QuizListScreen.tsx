import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { LearnStackParamList } from "../navigation/types";
import { useQuiz } from "../hooks/useQuiz";
import type { QuizSummary } from "../services/quiz.service";

type Props = NativeStackScreenProps<LearnStackParamList, "QuizList">;

export default function QuizListScreen({ navigation, route }: Props) {
  const { topicId } = route.params;
  const { getQuizzesByTopic } = useQuiz();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuizzesByTopic(topicId);
      setQuizzes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  }, [getQuizzesByTopic, topicId]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleSelect = (quiz: QuizSummary) => {
    navigation.navigate("QuizPlayer", { quizId: quiz.quizId ?? quiz.id!, topicId });
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
        <TouchableOpacity onPress={loadQuizzes} style={{ padding: 12, backgroundColor: "#222", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={quizzes}
      keyExtractor={(item) => String(item.quizId ?? item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleSelect(item)}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#f9fafb" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title ?? "Quiz"}</Text>
          <Text style={{ color: "#4b5563" }}>{item.description ?? ""}</Text>
          <Text style={{ color: "#6b7280", marginTop: 4 }}>
            {item.questionCount ?? 0} questions • {item.difficulty ?? "mixed"}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

