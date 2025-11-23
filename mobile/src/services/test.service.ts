import api from "./api";

type ApiResponse<T> = {
  data?: T;
  success?: boolean;
  message?: string;
};

const extract = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
};

export type PracticeTestSummary = {
  id: number;
  title?: string;
  description?: string | null;
  questionCount?: number;
  durationMinutes?: number | null;
  [key: string]: unknown;
};

export type PracticeTestAttempt = {
  attemptId?: number;
  id?: number;
  practiceTestId?: number;
  questions?: Array<{
    questionId?: number;
    id?: number;
    questionText?: string;
    prompt?: string;
    options?: string[];
    choices?: string[];
  }>;
  score?: number;
  xpAwarded?: number;
  [key: string]: unknown;
};

export type PracticeTestSubmission = {
  attemptId?: number;
  score?: number;
  xpAwarded?: number;
  passed?: boolean;
  [key: string]: unknown;
};

export type PracticeTestResponsePayload = {
  questionId: number;
  selectedOption?: string | null;
  selectedOptions?: string[] | null;
};

export const getPracticeTestsByTopic = async (topicId: number): Promise<PracticeTestSummary[]> => {
  const response = await api.get("/api/v2/practice-tests", { params: { topicId } });
  const data = extract<{ tests?: PracticeTestSummary[] } | PracticeTestSummary[]>(response.data);
  if (Array.isArray(data)) {
    return data;
  }
  return data?.tests ?? [];
};

export const startPracticeTestAttempt = async (
  practiceTestId: number,
  params?: { mode?: string },
): Promise<PracticeTestAttempt> => {
  const response = await api.post(`/api/v2/practice-tests/${practiceTestId}/start`, params ?? {});
  return extract<PracticeTestAttempt>(response.data);
};

export const submitPracticeTestAttempt = async (
  practiceTestId: number,
  payload: { attemptId: number; responses: PracticeTestResponsePayload[]; durationSeconds?: number },
): Promise<PracticeTestSubmission> => {
  const response = await api.post(`/api/v2/practice-tests/${practiceTestId}/submit`, payload);
  return extract<PracticeTestSubmission>(response.data);
};

export const getPracticeTestAttempt = async (attemptId: number): Promise<PracticeTestAttempt> => {
  const response = await api.get(`/api/v2/attempts/${attemptId}`, { params: { type: "practice" } });
  return extract<PracticeTestAttempt>(response.data);
};

