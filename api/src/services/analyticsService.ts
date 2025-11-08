import dayjs from "dayjs";
import prisma from "../config/db";
import { Prisma } from "@prisma/client";

export type DateRange = "7d" | "30d" | "all";

type AttemptFilter = {
  page?: number;
  limit?: number;
  userId?: number | undefined;
  subjectId?: number | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
};

type ProgressFilter = {
  subjectId?: number | undefined;
  difficulty?: string | undefined;
  dateRange?: DateRange | undefined;
};

export type AttemptExportFilter = {
  subjectId?: number | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
};

export type ProgressExportFilter = {
  subjectId?: number | undefined;
  dateRange?: DateRange | undefined;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const resolveRangeStart = (range: DateRange): Date | undefined => {
  if (range === "all") {
    return undefined;
  }

  const amount = range === "7d" ? 7 : 30;
  return dayjs().subtract(amount, "day").startOf("day").toDate();
};

export const getQuizAttempts = async (filter: AttemptFilter = {}) => {
  const page = filter.page ?? DEFAULT_PAGE;
  const limit = filter.limit ?? DEFAULT_LIMIT;

  const where: Prisma.AttemptWhereInput = {};

  if (filter.userId) {
    where.user_id = filter.userId;
  }

  if (filter.subjectId) {
    where.Quiz = {
      is: {
        Topic: {
          subject_id: filter.subjectId,
        },
      },
    };
  }

  if (filter.startDate || filter.endDate) {
    where.attempt_date = {
      ...(filter.startDate ? { gte: filter.startDate } : {}),
      ...(filter.endDate ? { lte: filter.endDate } : {}),
    };
  }

  const [attempts, total] = await Promise.all([
    prisma.attempt.findMany({
      where,
      orderBy: { attempt_date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        User: {
          select: { id: true, full_name: true, email: true },
        },
        Quiz: {
          select: {
            id: true,
            question_text: true,
            Topic: {
              select: {
                id: true,
                topic_name: true,
                Subject: {
                  select: { id: true, subject_name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.attempt.count({ where }),
  ]);

  const formatted = attempts.map((attempt) => ({
    id: attempt.id,
    score: attempt.score,
    isCorrect: attempt.is_correct,
    attemptDate: attempt.attempt_date,
    user: attempt.User,
    quiz: {
      id: attempt.Quiz.id,
      question: attempt.Quiz.question_text,
    },
    topic: attempt.Quiz.Topic
      ? {
        id: attempt.Quiz.Topic.id,
        name: attempt.Quiz.Topic.topic_name,
      }
      : null,
    subject: attempt.Quiz.Topic?.Subject
      ? {
        id: attempt.Quiz.Topic.Subject.id,
        name: attempt.Quiz.Topic.Subject.subject_name,
      }
      : null,
  }));

  return {
    attempts: formatted,
    pagination: { page, limit, total },
  };
};

export const getProgressSummary = async (filter: ProgressFilter = {}) => {
  const where: Prisma.ProgressWhereInput = {};

  const topicFilter: Prisma.TopicWhereInput = {};
  if (filter.subjectId) {
    topicFilter.subject_id = filter.subjectId;
  }
  if (filter.difficulty) {
    topicFilter.difficulty = filter.difficulty;
  }

  if (Object.keys(topicFilter).length > 0) {
    where.Topic = { is: topicFilter };
  }

  const startDate = resolveRangeStart(filter.dateRange ?? "all");
  if (startDate) {
    where.last_updated = { gte: startDate };
  }

  const [progressGroups, completedGroups] = await Promise.all([
    prisma.progress.groupBy({
      by: ["topic_id"],
      where,
      _sum: { completion_percent: true, xp_earned: true },
      _count: { _all: true },
    }),
    prisma.progress.groupBy({
      by: ["topic_id"],
      where: {
        ...where,
        completion_percent: { gte: 100 },
      },
      _count: { _all: true },
    }),
  ]);

  if (progressGroups.length === 0) {
    return [];
  }

  const topicIds = progressGroups.map((group) => group.topic_id);
  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: {
      id: true,
      topic_name: true,
      subject_id: true,
      Subject: {
        select: { id: true, subject_name: true },
      },
    },
  });

  const topicLookup = new Map(topics.map((topic) => [topic.id, topic]));
  const completedLookup = new Map(
    completedGroups.map((group) => [group.topic_id, group._count._all]),
  );

  const subjectSummary = new Map<
    number,
    {
      subjectId: number;
      subjectName: string;
      totalCompletion: number;
      totalXp: number;
      totalEntries: number;
      quizzesCompleted: number;
    }
  >();

  for (const group of progressGroups) {
    const topic = topicLookup.get(group.topic_id);
    if (!topic) {
      continue;
    }

    const subjectId = topic.Subject?.id ?? topic.subject_id;
    const subjectName = topic.Subject?.subject_name ?? "Unknown";
    const summary = subjectSummary.get(subjectId) ?? {
      subjectId,
      subjectName,
      totalCompletion: 0,
      totalXp: 0,
      totalEntries: 0,
      quizzesCompleted: 0,
    };

    summary.totalCompletion += group._sum.completion_percent ?? 0;
    summary.totalXp += group._sum.xp_earned ?? 0;
    summary.totalEntries += group._count._all;
    summary.quizzesCompleted += completedLookup.get(group.topic_id) ?? 0;

    subjectSummary.set(subjectId, summary);
  }

  return Array.from(subjectSummary.values()).map((summary) => ({
    subjectId: summary.subjectId,
    subjectName: summary.subjectName,
    averageCompletion: summary.totalEntries
      ? summary.totalCompletion / summary.totalEntries
      : 0,
    averageXp: summary.totalEntries ? summary.totalXp / summary.totalEntries : 0,
    quizzesCompleted: summary.quizzesCompleted,
  }));
};

export const getEngagementSummary = async (range: DateRange) => {
  const startDate = resolveRangeStart(range);
  const attemptWhere: Prisma.AttemptWhereInput = {};

  if (startDate) {
    attemptWhere.attempt_date = { gte: startDate };
  }

  const attemptGroups = await prisma.attempt.groupBy({
    by: ["user_id"],
    where: attemptWhere,
    _count: { _all: true },
  });

  const activeUserIds = attemptGroups.map((group) => group.user_id);

  const [quizCount, xpAggregate, streakAggregate] = await Promise.all([
    prisma.attempt.count({ where: attemptWhere }),
    activeUserIds.length
      ? prisma.user.aggregate({
        where: { id: { in: activeUserIds } },
        _avg: { xp_total: true },
      })
      : Promise.resolve({ _avg: { xp_total: null } }),
    activeUserIds.length
      ? prisma.user.aggregate({
        where: { id: { in: activeUserIds } },
        _avg: { streak_days: true },
      })
      : Promise.resolve({ _avg: { streak_days: null } }),
  ]);

  return {
    activeUsers: activeUserIds.length,
    quizzesCompleted: quizCount,
    averageXp: xpAggregate._avg.xp_total ?? 0,
    averageStreak: streakAggregate._avg.streak_days ?? 0,
  };
};

export const getLeaderboardSummary = async (
  limit: number,
  sortBy: "xp" | "completion",
) => {
  if (sortBy === "completion") {
    const completionLeaders = await prisma.progress.groupBy({
      by: ["user_id"],
      _avg: { completion_percent: true },
      _count: { _all: true },
      orderBy: {
        _avg: { completion_percent: "desc" },
      },
      take: limit,
    });

    const userIds = completionLeaders.map((leader) => leader.user_id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true, email: true, xp_total: true, level: true },
    });
    const userLookup = new Map(users.map((user) => [user.id, user]));

    return completionLeaders
      .map((leader) => {
        const user = userLookup.get(leader.user_id);
        if (!user) {
          return null;
        }

        return {
          userId: user.id,
          fullName: user.full_name,
          email: user.email,
          xp: user.xp_total,
          level: user.level,
          completionPercent: leader._avg.completion_percent ?? 0,
          quizzesTracked: leader._count._all,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  const xpLeaders = await prisma.user.groupBy({
    by: ["id", "full_name", "email", "level"],
    _sum: { xp_total: true },
    orderBy: {
      _sum: { xp_total: "desc" },
    },
    take: limit,
  });

  return xpLeaders.map((leader) => ({
    userId: leader.id,
    fullName: leader.full_name,
    email: leader.email,
    xp: leader._sum.xp_total ?? 0,
    level: leader.level,
    completionPercent: null,
    quizzesTracked: null,
  }));
};

export const getAttemptsForExport = async (filter: AttemptExportFilter = {}) => {
  const where: Prisma.AttemptWhereInput = {};

  if (filter.subjectId) {
    where.Quiz = {
      is: {
        Topic: {
          subject_id: filter.subjectId,
        },
      },
    };
  }

  if (filter.startDate || filter.endDate) {
    where.attempt_date = {
      ...(filter.startDate ? { gte: filter.startDate } : {}),
      ...(filter.endDate ? { lte: filter.endDate } : {}),
    };
  }

  const limit = Math.min(filter.limit ?? 1000, 5000);

  const attempts = await prisma.attempt.findMany({
    where,
    orderBy: { attempt_date: "desc" },
    take: limit,
    select: {
      id: true,
      quiz_id: true,
      user_id: true,
      score: true,
      attempt_date: true,
    },
  });

  return attempts.map((attempt) => ({
    attemptId: attempt.id,
    quizId: attempt.quiz_id,
    userId: attempt.user_id,
    score: attempt.score,
    attemptDate: attempt.attempt_date,
  }));
};

export const getProgressForExport = async (filter: ProgressExportFilter = {}) => {
  const where: Prisma.ProgressWhereInput = {};

  if (filter.subjectId) {
    where.Topic = {
      is: {
        subject_id: filter.subjectId,
      },
    };
  }

  const startDate = resolveRangeStart(filter.dateRange ?? "all");
  if (startDate) {
    where.last_updated = { gte: startDate };
  }

  const progressRecords = await prisma.progress.findMany({
    where,
    orderBy: { last_updated: "desc" },
    select: {
      user_id: true,
      topic_id: true,
      completion_percent: true,
      xp_earned: true,
      last_updated: true,
      Topic: {
        select: {
          topic_name: true,
          Subject: {
            select: { id: true, subject_name: true },
          },
        },
      },
    },
  });

  return progressRecords.map((record) => ({
    userId: record.user_id,
    topicId: record.topic_id,
    topicName: record.Topic?.topic_name ?? "Unknown Topic",
    subjectId: record.Topic?.Subject?.id ?? null,
    subjectName: record.Topic?.Subject?.subject_name ?? "Unknown Subject",
    completionPercent: record.completion_percent,
    xpEarned: record.xp_earned,
    lastUpdated: record.last_updated,
  }));
};

export const getKpiTotals = async () => {
  const [totalUsers, totalBadges, totalChallenges, totalQuizzes] = await Promise.all([
    prisma.user.count(),
    prisma.badge.count(),
    prisma.challenge.count(),
    prisma.quiz.count(),
  ]);

  return {
    totalUsers,
    totalBadges,
    totalChallenges,
    totalQuizzes,
  };
};
