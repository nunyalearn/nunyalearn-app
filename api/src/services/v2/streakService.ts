import { updateStreak } from "../xpService";

export const recordQuizStreak = async (userId: number) => {
  return updateStreak(userId);
};

export const recordPracticeTestStreak = async (userId: number) => {
  return updateStreak(userId);
};
