import prisma from "../config/db";

const difficultyXpMap: Record<string, number> = {
  easy: 5,
  med: 10,
  medium: 10,
  hard: 15,
};

const normalizeDifficulty = (difficulty: string): string => {
  const value = difficulty.toLowerCase();
  return value === "medium" ? "med" : value;
};

export const calculateXp = (scorePercentage: number, difficulty: string): number => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const baseXp = difficultyXpMap[normalizedDifficulty] ?? 10;
  const multiplier = Math.max(0, Math.min(scorePercentage, 100)) / 100;
  return Math.round(baseXp * multiplier);
};

export const getXp = (difficulty: string, isCorrect: boolean): number => {
  if (!isCorrect) {
    return 0;
  }
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  return difficultyXpMap[normalizedDifficulty] ?? 0;
};

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 4, xp: 500 },
  { level: 5, xp: 800 },
  { level: 6, xp: 1200 },
  { level: 7, xp: 1700 },
  { level: 8, xp: 2300 },
  { level: 9, xp: 3000 },
  { level: 10, xp: 3800 },
];

export const getLevel = (xpTotal: number): number => {
  let currentLevel = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xpTotal >= threshold.xp) {
      currentLevel = threshold.level;
    } else {
      break;
    }
  }
  return currentLevel;
};

export const getXpToNextLevel = (xpTotal: number): number => {
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xpTotal < threshold.xp) {
      return threshold.xp - xpTotal;
    }
  }
  return 0;
};

const STREAK_WINDOW_MS = 24 * 60 * 60 * 1000;

export const updateStreak = async (userId: number): Promise<number> => {
  const [user, attempts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streak_days: true } }),
    prisma.attempt.findMany({
      where: { user_id: userId },
      orderBy: { attempt_date: "desc" },
      take: 2,
      select: { attempt_date: true },
    }),
  ]);

  if (!user) {
    throw new Error("User not found while updating streak");
  }

  let newStreak = 1;
  if (attempts.length >= 2) {
    const latest = attempts[0]?.attempt_date;
    const previous = attempts[1]?.attempt_date;
    if (latest && previous) {
      const diff = latest.getTime() - previous.getTime();
      const sameDay = latest.toDateString() === previous.toDateString();

      if (sameDay) {
        newStreak = user.streak_days || 1;
      } else if (diff <= STREAK_WINDOW_MS) {
        newStreak = (user.streak_days || 0) + 1;
      } else {
        newStreak = 1;
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { streak_days: newStreak },
    select: { streak_days: true },
  });

  return updated.streak_days;
};

export const getBadgeForXp = async (xpTotal: number) => {
  return prisma.badge.findFirst({
    where: { xp_required: { lte: xpTotal } },
    orderBy: { xp_required: "desc" },
  });
};
