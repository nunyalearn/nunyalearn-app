import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const progressQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  topic_id: z.coerce.number().int().positive().optional(),
  subject_id: z.coerce.number().int().positive().optional(),
});

const recalcSchema = z.object({
  topicId: z.number().int().positive(),
});

const calculateCompletionPercent = (completed: number, total: number): number => {
  if (total === 0) {
    return 0;
  }
  return Math.round((completed / total) * 100);
};

const buildProgressWhere = (
  userId: number,
  filters: { topicId?: number; subjectId?: number },
): Prisma.ProgressWhereInput => {
  const where: Prisma.ProgressWhereInput = { user_id: userId };
  if (filters.topicId) {
    where.topic_id = filters.topicId;
  }
  if (filters.subjectId) {
    where.Topic = { subject_id: filters.subjectId };
  }
  return where;
};

const createTopicSummary = async (userId: number, topicId: number) => {
  const [totalQuizzes, completedQuizzes] = await Promise.all([
    prisma.legacyQuiz.count({ where: { topic_id: topicId } }),
    prisma.attempt.count({
      where: { user_id: userId, is_correct: true, LegacyQuiz: { topic_id: topicId } },
    }),
  ]);

  return {
    totalQuizzes,
    completedQuizzes,
    completionPercent: calculateCompletionPercent(completedQuizzes, totalQuizzes),
  };
};

export const getProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const query = progressQuerySchema.parse(req.query);
    const { page, limit } = query;

    const where = buildProgressWhere(req.user.id, {
      ...(query.topic_id ? { topicId: query.topic_id } : {}),
      ...(query.subject_id ? { subjectId: query.subject_id } : {}),
    });

    const [total, progressRecords] = await Promise.all([
      prisma.progress.count({ where }),
      prisma.progress.findMany({
        where,
        include: {
          Topic: {
            select: {
              id: true,
              topic_name: true,
              subject_id: true,
            },
          },
        },
        orderBy: { last_updated: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const progress = await Promise.all(
      progressRecords.map(async (record) => {
        const stats = await createTopicSummary(req.user!.id, record.topic_id);
        return {
          topic_id: record.topic_id,
          topic_name: record.Topic.topic_name,
          completed_quizzes: stats.completedQuizzes,
          total_quizzes: stats.totalQuizzes,
          xp_earned: record.xp_earned,
          last_activity: record.last_updated,
          completion_percent: stats.completionPercent,
        };
      }),
    );

    return res.json({
      success: true,
      data: { progress },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = recalcSchema.parse(req.body);

    const [stats, existing] = await Promise.all([
      createTopicSummary(req.user.id, payload.topicId),
      prisma.progress.findUnique({
        where: {
          user_id_topic_id: {
            user_id: req.user.id,
            topic_id: payload.topicId,
          },
        },
      }),
    ]);

    const progressRecord = await prisma.progress.upsert({
      where: {
        user_id_topic_id: {
          user_id: req.user.id,
          topic_id: payload.topicId,
        },
      },
      create: {
        user_id: req.user.id,
        topic_id: payload.topicId,
        completion_percent: stats.completionPercent,
        xp_earned: existing?.xp_earned ?? 0,
        last_updated: new Date(),
      },
      update: {
        completion_percent: stats.completionPercent,
        last_updated: new Date(),
      },
    });

    return res.json({
      success: true,
      data: {
        progress: {
          topic_id: progressRecord.topic_id,
          completion_percent: stats.completionPercent,
          xp_earned: progressRecord.xp_earned,
          last_activity: progressRecord.last_updated,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
