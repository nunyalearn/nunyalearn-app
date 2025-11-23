import { useCallback } from "react";
import {
  getQuizzesByTopic,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttempt,
  QuizSummary,
  QuizAttempt,
  QuizSubmissionResponse,
  QuizResponsePayload,
} from "../services/quiz.service";

export const useQuiz = () => {
  const fetchQuizzes = useCallback(async (topicId: number): Promise<QuizSummary[]> => {
    return getQuizzesByTopic(topicId);
  }, []);

  const startAttempt = useCallback(async (quizId: number): Promise<QuizAttempt> => {
    return startQuizAttempt(quizId);
  }, []);

  const submitAttempt = useCallback(
    async (
      quizId: number,
      payload: { attemptId: number; responses: QuizResponsePayload[]; durationSeconds?: number },
    ): Promise<QuizSubmissionResponse> => {
      return submitQuizAttempt(quizId, payload);
    },
    [],
  );

  const fetchAttempt = useCallback(async (attemptId: number): Promise<QuizAttempt> => {
    return getQuizAttempt(attemptId);
  }, []);

  return {
    getQuizzesByTopic: fetchQuizzes,
    startQuizAttempt: startAttempt,
    submitQuizAttempt: submitAttempt,
    getQuizAttempt: fetchAttempt,
  };
};

export type UseQuizReturn = ReturnType<typeof useQuiz>;

