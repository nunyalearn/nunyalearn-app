import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  getEngagementSummary,
  getKpiTotals,
  getLeaderboardSummary,
  getProgressSummary,
  getQuizAttempts,
} from "../../services/analyticsService";

const attemptsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    userId: z.coerce.number().int().positive().optional(),
    subjectId: z.coerce.number().int().positive().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (params) => {
      if (params.startDate && params.endDate) {
        return params.startDate <= params.endDate;
      }
      return true;
    },
    { message: "startDate must be before endDate" },
  );

const progressQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  difficulty: z.string().min(1).optional(),
  dateRange: z.enum(["7d", "30d", "all"]).default("all"),
});

const engagementQuerySchema = z.object({
  range: z.enum(["7d", "30d", "all"]).default("7d"),
});

const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
  sortBy: z.enum(["xp", "completion"]).default("xp"),
});

export const getAttemptReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = attemptsQuerySchema.parse(req.query);
    const result = await getQuizAttempts({
      page: params.page,
      limit: params.limit,
      userId: params.userId,
      subjectId: params.subjectId,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    return res.json({
      success: true,
      data: { attempts: result.attempts },
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getProgressReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = progressQuerySchema.parse(req.query);
    const summary = await getProgressSummary({
      subjectId: params.subjectId,
      difficulty: params.difficulty,
      dateRange: params.dateRange,
    });

    return res.json({ success: true, data: { subjects: summary } });
  } catch (error) {
    next(error);
  }
};

export const getEngagementReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = engagementQuerySchema.parse(req.query);
    const engagement = await getEngagementSummary(params.range);

    return res.json({ success: true, data: engagement });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboardReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = leaderboardQuerySchema.parse(req.query);
    const leaderboard = await getLeaderboardSummary(params.limit, params.sortBy);

    return res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    next(error);
  }
};

export const getMetricReports = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await getKpiTotals();
    return res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
};
