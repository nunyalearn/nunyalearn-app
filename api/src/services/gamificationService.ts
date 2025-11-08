import { ChallengeStatus } from "@prisma/client";
import prisma from "../config/db";
import { getBadgeForXp, getLevel } from "./xpService";

type AchievementRule = {
  key: string;
  name: string;
  description?: string;
  criteriaDescription?: string;
  xpReward: number;
  iconUrl?: string;
  check: (stats: AchievementStats) => boolean;
};

type AchievementStats = {
  attempts: number;
  correctAttempts: number;
};

const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    key: "first_quiz",
    name: "First Quiz Completed",
    description: "Complete your very first quiz attempt.",
    criteriaDescription: "Attempt at least 1 quiz.",
    xpReward: 15,
    check: (stats) => stats.attempts >= 1,
  },
  {
    key: "quiz_enthusiast",
    name: "Quiz Enthusiast",
    description: "Attempt 10 quizzes.",
    criteriaDescription: "Attempt at least 10 quizzes.",
    xpReward: 25,
    check: (stats) => stats.attempts >= 10,
  },
  {
    key: "accuracy_ace",
    name: "Accuracy Ace",
    description: "Maintain 80% accuracy over at least 5 correct tries.",
    criteriaDescription: "5 correct attempts with ≥80% accuracy.",
    xpReward: 40,
    check: (stats) =>
      stats.attempts > 0 &&
      stats.correctAttempts >= 5 &&
      stats.correctAttempts / stats.attempts >= 0.8,
  },
];

const getAchievementStats = async (userId: number): Promise<AchievementStats> => {
  const [attempts, correctAttempts] = await Promise.all([
    prisma.attempt.count({ where: { user_id: userId } }),
    prisma.attempt.count({ where: { user_id: userId, is_correct: true } }),
  ]);

  return { attempts, correctAttempts };
};

const ensureAchievementRecord = async (rule: AchievementRule) => {
  return prisma.achievement.upsert({
    where: { name: rule.name },
    update: {
      description: rule.description ?? null,
      criteria: rule.criteriaDescription ?? null,
      xp_reward: rule.xpReward,
      icon_url: rule.iconUrl ?? null,
    },
    create: {
      name: rule.name,
      description: rule.description ?? null,
      criteria: rule.criteriaDescription ?? null,
      xp_reward: rule.xpReward,
      icon_url: rule.iconUrl ?? null,
    },
  });
};

export const checkBadge = async (xpTotal: number) => {
  return getBadgeForXp(xpTotal);
};

export const checkAchievements = async (userId: number) => {
  const stats = await getAchievementStats(userId);

  const existing = await prisma.userAchievement.findMany({
    where: { user_id: userId },
    select: {
      achievement_id: true,
      Achievement: {
        select: { id: true, name: true },
      },
    },
  });

  const owned = new Set(existing.map((item) => item.Achievement.name));

  const earned = [];

  for (const rule of ACHIEVEMENT_RULES) {
    const achievement = await ensureAchievementRecord(rule);
    if (owned.has(achievement.name)) {
      continue;
    }

    if (stats.attempts === 0) {
      continue;
    }

    if (rule.check(stats)) {
      const record = await prisma.userAchievement.create({
        data: {
          user_id: userId,
          achievement_id: achievement.id,
        },
        include: {
          Achievement: true,
        },
      });
      earned.push(record.Achievement);
    }
  }

  return earned;
};

export const recordXpChange = async (userId: number, amount: number, reason?: string) => {
  if (amount === 0) return;
  await prisma.xpHistory.create({
    data: {
      user_id: userId,
      xp_change: amount,
      reason: reason ?? null,
    },
  });
};

export const expireStaleChallenges = async (userId?: number) => {
  await prisma.userChallenge.updateMany({
    where: {
      status: ChallengeStatus.joined,
      ...(userId ? { user_id: userId } : {}),
      Challenge: {
        end_date: { lt: new Date() },
      },
    },
    data: { status: ChallengeStatus.expired },
  });
};

export const validateChallenge = async (
  userId: number,
  challengeId: number,
  progressDelta = 0,
) => {
  const challengeEntry = await prisma.userChallenge.findUnique({
    where: {
      user_id_challenge_id: {
        user_id: userId,
        challenge_id: challengeId,
      },
    },
    include: {
      Challenge: true,
    },
  });

  if (!challengeEntry) {
    return null;
  }

  const now = new Date();
  let status = challengeEntry.status;
  let progress = challengeEntry.progress ?? 0;
  let completedAt = challengeEntry.completed_at;

  if (challengeEntry.Challenge.end_date < now && status !== ChallengeStatus.completed) {
    status = ChallengeStatus.expired;
  } else if (progressDelta > 0 && status === ChallengeStatus.joined) {
    progress = Math.min(100, progress + progressDelta);
    if (progress >= 100) {
      status = ChallengeStatus.completed;
      completedAt = now;
    }
  }

  if (
    status === challengeEntry.status &&
    progress === (challengeEntry.progress ?? 0) &&
    completedAt?.getTime() === challengeEntry.completed_at?.getTime()
  ) {
    return challengeEntry;
  }

  return prisma.userChallenge.update({
    where: {
      user_id_challenge_id: {
        user_id: userId,
        challenge_id: challengeId,
      },
    },
    data: {
      status,
      progress,
      completed_at: completedAt,
    },
    include: {
      Challenge: true,
    },
  });
};

export const applyRewards = async (
  userId: number,
  xpAwarded: number,
  reason = "Quiz attempt",
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp_total: true },
  });

  if (!user) {
    throw new Error("User not found while applying rewards");
  }

  const xpBeforeAttempt = Math.max(0, user.xp_total - xpAwarded);
  const previousBadge = await checkBadge(xpBeforeAttempt);

  if (xpAwarded > 0) {
    await recordXpChange(userId, xpAwarded, reason);
  }

  const newAchievements = await checkAchievements(userId);
  let updatedXpTotal = user.xp_total;
  let updatedLevel: number | undefined;

  const bonusAchievements = newAchievements.filter((achievement) => (achievement.xp_reward || 0) > 0);
  for (const achievement of bonusAchievements) {
    const reward = achievement.xp_reward || 0;
    updatedXpTotal += reward;
    await recordXpChange(userId, reward, `Achievement unlocked: ${achievement.name}`);
  }

  if (bonusAchievements.length > 0) {
    updatedLevel = getLevel(updatedXpTotal);
    await prisma.user.update({
      where: { id: userId },
      data: {
        xp_total: updatedXpTotal,
        level: updatedLevel,
      },
    });
  }

  const latestBadge = await checkBadge(updatedXpTotal);
  const newBadge =
    latestBadge && (!previousBadge || previousBadge.id !== latestBadge.id) ? latestBadge : null;

  return {
    newBadge,
    newAchievements,
  };
};
