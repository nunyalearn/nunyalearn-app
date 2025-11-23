import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../services/api";
import { LearnStackParamList } from "../navigation/types";

type Subject = {
  id: number;
  subjectId?: number;
  subjectName?: string;
  name?: string;
};

type Props = NativeStackScreenProps<LearnStackParamList, "Subjects">;

export default function SubjectScreen({ navigation, route }: Props) {
  const { gradeId } = route.params;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/curriculum/subjects", { params: { gradeLevelId: gradeId } });
      const data = response.data?.data ?? response.data;
      setSubjects(data?.subjects ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load subjects");
    } finally {
      setLoading(false);
    }
  }, [gradeId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const handleSelect = (subject: Subject) => {
    navigation.navigate("Topics", { subjectId: subject.subjectId ?? subject.id });
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
        <TouchableOpacity onPress={loadSubjects} style={{ padding: 12, backgroundColor: "#222", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={subjects}
      keyExtractor={(item) => String(item.subjectId ?? item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleSelect(item)}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#f3f3f3" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.subjectName ?? item.name ?? "Subject"}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

