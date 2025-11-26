import api from "./api";

type ApiResponse<T> = {
  data?: T;
  message?: string;
  success?: boolean;
};

const extract = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
};

export type QuizAttemptSummary = {
  attemptId?: number;
  score?: number;
  totalQuestions?: number;
  questionCount?: number;
  completedQuestions?: number;
  correctCount?: number;
  [key: string]: unknown;
};

export type QuizSummary = {
  quizId?: number;
  id?: number;
  title?: string;
  description?: string | null;
  difficulty?: string | null;
  questionCount?: number;
  xpReward?: number;
  isActive?: boolean;
  latestAttempt?: QuizAttemptSummary | null;
  progressPercent?: number;
  [key: string]: unknown;
};

export type QuizAttemptQuestion = {
  questionId?: number;
  id?: number;
  prompt?: string;
  questionText?: string;
  options?: string[];
  choices?: string[];
  [key: string]: unknown;
};

export type QuizAttempt = {
  attemptId?: number;
  id?: number;
  quizId?: number;
  questions?: QuizAttemptQuestion[];
  score?: number;
  xpAwarded?: number;
  [key: string]: unknown;
};

export type QuizSubmissionResponse = {
  attemptId?: number;
  score?: number;
  xpAwarded?: number;
  [key: string]: unknown;
};

export type QuizResponsePayload = {
  questionId: number;
  selectedOption?: string | null;
  selectedOptions?: string[] | null;
};

export const getQuizzesByTopic = async (topicId: number): Promise<QuizSummary[]> => {
  const response = await api.get("/api/v2/quizzes", { params: { topicId } });
  const data = extract<{ quizzes?: QuizSummary[] } | QuizSummary[]>(response.data);
  if (Array.isArray(data)) {
    return data;
  }
  return data?.quizzes ?? [];
};

export const startQuizAttempt = async (quizId: number): Promise<QuizAttempt> => {
  const response = await api.post(`/api/v2/quizzes/${quizId}/start`);
  return extract<QuizAttempt>(response.data);
};

export const submitQuizAttempt = async (
  quizId: number,
  payload: { attemptId: number; responses: QuizResponsePayload[]; durationSeconds?: number },
): Promise<QuizSubmissionResponse> => {
  const response = await api.post(`/api/v2/quizzes/${quizId}/submit`, payload);
  return extract<QuizSubmissionResponse>(response.data);
};

export const getQuizAttempt = async (attemptId: number): Promise<QuizAttempt> => {
  const response = await api.get(`/api/v2/attempts/${attemptId}`, { params: { type: "quiz" } });
  return extract<QuizAttempt>(response.data);
};

