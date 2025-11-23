import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../services/api";
import { LearnStackParamList } from "../navigation/types";

type Topic = {
  id: number;
  topicId?: number;
  topicName?: string;
  name?: string;
};

type Props = NativeStackScreenProps<LearnStackParamList, "Topics">;

export default function TopicScreen({ navigation, route }: Props) {
  const { subjectId } = route.params;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/curriculum/topics", { params: { subjectId } });
      const data = response.data?.data ?? response.data;
      setTopics(data?.topics ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load topics");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const renderActions = (topic: Topic) => {
    const topicId = topic.topicId ?? topic.id;
    return (
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity
          style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: "#1f2937" }}
          onPress={() => navigation.navigate("QuizList", { topicId })}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>Quizzes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, padding: 10, borderRadius: 6, backgroundColor: "#4b5563" }}
          onPress={() => navigation.navigate("PracticeTestList", { topicId })}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>Practice Tests</Text>
        </TouchableOpacity>
      </View>
    );
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
        <TouchableOpacity onPress={loadTopics} style={{ padding: 12, backgroundColor: "#222", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={topics}
      keyExtractor={(item) => String(item.topicId ?? item.id)}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderRadius: 8, backgroundColor: "#f3f3f3" }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.topicName ?? item.name ?? "Topic"}</Text>
          {renderActions(item)}
        </View>
      )}
    />
  );
}

