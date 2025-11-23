import prisma from "../../config/db";
import { applyXpChange, calculateXp } from "../xpService";
import { applyRewards } from "../gamificationService";

const QUIZ_SOURCE = "quiz_v2";
const PRACTICE_TEST_SOURCE = "practice_test_v2";

export const recordQuizAttemptXp = async (params: {
  userId: number;
  quizId: number;
  difficulty: string;
  scorePercentage: number;
}) => {
  const { userId, quizId, difficulty, scorePercentage } = params;
  const xpAwarded = calculateXp(scorePercentage, difficulty);
  const transaction = await prisma.xpTransaction.create({
    data: {
      userId,
      amount: xpAwarded,
      source: QUIZ_SOURCE,
      reason: `Quiz ${quizId} attempt`,
      metadata: {
        scorePercentage,
      },
    },
  });
  const updatedUser = await applyXpChange(userId, xpAwarded, "Quiz V2 attempt");
  const rewards = await applyRewards(userId, xpAwarded, "Quiz V2 attempt");
  return { xpAwarded, updatedUser, rewards, transactionId: transaction.id };
};

export const recordPracticeTestXp = async (params: {
  userId: number;
  practiceTestId: number;
  xpReward: number;
}) => {
  const { userId, practiceTestId, xpReward } = params;
  const transaction = await prisma.xpTransaction.create({
    data: {
      userId,
      amount: xpReward,
      source: PRACTICE_TEST_SOURCE,
      reason: `Practice test ${practiceTestId} attempt`,
    },
  });
  const updatedUser = await applyXpChange(userId, xpReward, "Practice Test V2 attempt");
  const rewards = await applyRewards(userId, xpReward, "Practice Test V2 attempt");
  return { xpAwarded: xpReward, updatedUser, rewards, transactionId: transaction.id };
};
