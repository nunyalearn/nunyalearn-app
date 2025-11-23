import { useCallback } from "react";
import {
  getPracticeTestsByTopic,
  startPracticeTestAttempt,
  submitPracticeTestAttempt,
  getPracticeTestAttempt,
  PracticeTestSummary,
  PracticeTestAttempt,
  PracticeTestSubmission,
  PracticeTestResponsePayload,
} from "../services/test.service";

export const usePracticeTest = () => {
  const fetchTests = useCallback(async (topicId: number): Promise<PracticeTestSummary[]> => {
    return getPracticeTestsByTopic(topicId);
  }, []);

  const startAttempt = useCallback(async (testId: number, params?: { mode?: string }): Promise<PracticeTestAttempt> => {
    return startPracticeTestAttempt(testId, params);
  }, []);

  const submitAttempt = useCallback(
    async (
      testId: number,
      payload: { attemptId: number; responses: PracticeTestResponsePayload[]; durationSeconds?: number },
    ): Promise<PracticeTestSubmission> => {
      return submitPracticeTestAttempt(testId, payload);
    },
    [],
  );

  const fetchAttempt = useCallback(async (attemptId: number): Promise<PracticeTestAttempt> => {
    return getPracticeTestAttempt(attemptId);
  }, []);

  return {
    getPracticeTestsByTopic: fetchTests,
    startPracticeTestAttempt: startAttempt,
    submitPracticeTestAttempt: submitAttempt,
    getPracticeTestAttempt: fetchAttempt,
  };
};

export type UsePracticeTestReturn = ReturnType<typeof usePracticeTest>;

