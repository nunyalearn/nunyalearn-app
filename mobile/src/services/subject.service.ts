import { isAxiosError } from "axios";

import api from "./api";

type ApiResponse<T> = {
  data?: T;
  success?: boolean;
  message?: string;
};

const unwrap = <T,>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
};

export type Subject = {
  id?: number;
  subjectId?: number;
  name?: string;
  subjectName?: string;
  description?: string | null;
  summary?: string | null;
  iconUrl?: string | null;
  topicCount?: number;
};

const normalize = (payload: { subjects?: Subject[] } | Subject[] | undefined | null): Subject[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if ("subjects" in payload) {
    return payload.subjects ?? [];
  }
  return [];
};

const fetchLegacySubjects = async (gradeId: number): Promise<Subject[]> => {
  const response = await api.get("/curriculum/subjects", { params: { gradeLevelId: gradeId } });
  return normalize(unwrap(response.data));
};

export const fetchSubjects = async (gradeId: number): Promise<Subject[]> => {
  try {
    const response = await api.get("/api/v2/subjects", { params: { gradeId } });
    return normalize(unwrap(response.data));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return fetchLegacySubjects(gradeId);
    }
    throw error;
  }
};

export const subjectService = {
  fetchSubjects,
};

export default subjectService;
