import { useCallback } from "react";
import { updateTopicMastery } from "../services/mastery.service";

export const useMastery = () => {
  const update = useCallback(
    async (topicId: number, body: { accuracy?: number; correct?: number; total?: number }) => {
      return updateTopicMastery(topicId, body);
    },
    [],
  );

  return {
    updateTopicMastery: update,
  };
};

export type UseMasteryReturn = ReturnType<typeof useMastery>;

