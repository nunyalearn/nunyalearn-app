const difficultyXpMap: Record<string, number> = {
  easy: 5,
  medium: 10,
  med: 10,
  hard: 15,
};

export const calculateXp = (scorePercentage: number, difficulty: string): number => {
  const normalizedDifficulty = difficulty.toLowerCase();
  const baseXp = difficultyXpMap[normalizedDifficulty] ?? 10;
  const multiplier = Math.max(0, Math.min(scorePercentage, 100)) / 100;
  return Math.round(baseXp * multiplier);
};
