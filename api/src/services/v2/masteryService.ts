import prisma from "../../config/db";

type MasteryUpdatePayload = {
  userId: number;
  topicId: number;
  isCorrect: boolean;
};

export const recordTopicMastery = async ({ userId, topicId, isCorrect }: MasteryUpdatePayload) => {
  const correctIncrement = isCorrect ? 1 : 0;
  const mastery = await prisma.topicMastery.upsert({
    where: {
      userId_topicId: {
        userId,
        topicId,
      },
    },
    update: {
      totalAttempts: { increment: 1 },
      correctAttempts: { increment: correctIncrement },
    },
    create: {
      userId,
      topicId,
      totalAttempts: 1,
      correctAttempts: correctIncrement,
      accuracy: correctIncrement ? 100 : 0,
    },
  });

  const accuracy =
    mastery.totalAttempts === 0 ? 0 : Math.round((mastery.correctAttempts / mastery.totalAttempts) * 100);

  await prisma.topicMastery.update({
    where: { id: mastery.id },
    data: { accuracy },
  });

  return accuracy;
};
