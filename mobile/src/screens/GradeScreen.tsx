import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import api from "../services/api";
import { LearnStackParamList } from "../navigation/types";

type Grade = {
  id: number;
  gradeId?: number;
  name?: string;
  gradeLevelName?: string;
};

type Props = NativeStackScreenProps<LearnStackParamList, "Grades">;

export default function GradeScreen({ navigation }: Props) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/curriculum/grades");
      const data = response.data?.data ?? response.data;
      setGrades(data?.grades ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load grades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  const handleSelect = (grade: Grade) => {
    navigation.navigate("Subjects", { gradeId: grade.gradeId ?? grade.id });
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
        <TouchableOpacity onPress={loadGrades} style={{ padding: 12, backgroundColor: "#222", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={grades}
      keyExtractor={(item) => String(item.gradeId ?? item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleSelect(item)}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#f3f3f3" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.gradeLevelName ?? item.name ?? `Grade ${item.id}`}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

