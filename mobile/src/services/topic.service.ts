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

export type Topic = {
  id?: number;
  topicId?: number;
  name?: string;
  topicName?: string;
  description?: string | null;
  summary?: string | null;
  iconUrl?: string | null;
  difficulty?: string | null;
};

const normalize = (payload: { topics?: Topic[] } | Topic[] | undefined | null): Topic[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if ("topics" in payload) {
    return payload.topics ?? [];
  }
  return [];
};

const fetchLegacyTopics = async (subjectId: number): Promise<Topic[]> => {
  const response = await api.get("/curriculum/topics", { params: { subjectId } });
  return normalize(unwrap(response.data));
};

export const fetchTopics = async (subjectId: number): Promise<Topic[]> => {
  try {
    const response = await api.get("/api/v2/topics", { params: { subjectId } });
    return normalize(unwrap(response.data));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return fetchLegacyTopics(subjectId);
    }
    throw error;
  }
};

export const topicService = {
  fetchTopics,
};

export default topicService;
