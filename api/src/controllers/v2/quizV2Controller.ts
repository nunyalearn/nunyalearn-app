import { Difficulty } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getQuizById, listQuizzes, QuizListFilters } from "../../services/v2/quizV2Service";
import { startQuizAttempt, submitQuizAttempt, getQuizAttempt } from "../../services/v2/attemptV2Service";

const listQuerySchema = z.object({
  topicId: z.coerce.number().int().positive().optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const submitSchema = z.object({
  attemptId: z.number().int().positive(),
  responses: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        selectedOption: z.string().optional(),
        selectedOptions: z.array(z.string()).optional(),
      }),
    )
    .nonempty(),
  durationSeconds: z.number().int().nonnegative().optional(),
  timeSpentSeconds: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const listQuizzesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const filters: QuizListFilters = {};
    if (typeof query.topicId === "number") {
      filters.topicId = query.topicId;
    }
    if (query.difficulty) {
      filters.difficulty = query.difficulty;
    }
    if (typeof query.includeInactive === "boolean") {
      filters.includeInactive = query.includeInactive;
    }
    if (typeof query.page === "number") {
      filters.page = query.page;
    }
    if (typeof query.limit === "number") {
      filters.limit = query.limit;
    }
    const result = await listQuizzes(filters);
    return res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getQuizHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const quiz = await getQuizById(id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }
    return res.json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
};

export const startQuizAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const attempt = await startQuizAttempt(req.user!.id, id);
    return res.status(201).json({
      success: true,
      data: { attemptId: attempt.id, attempt_id: attempt.id, status: attempt.status },
    });
  } catch (error) {
    next(error);
  }
};

export const submitQuizAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = z.coerce.number().int().positive().parse(req.params.id);
    const payload = submitSchema.parse(req.body);
    const result = await submitQuizAttempt(req.user!.id, payload.attemptId, payload);
    if (!result.attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    if (result.attempt.quizId !== quizId) {
      return res.status(400).json({ success: false, message: "Attempt does not belong to quiz" });
    }
    return res.json({
      success: true,
      data: result.attempt,
      ...(result.message ? { message: result.message } : {}),
    });
  } catch (error) {
    next(error);
  }
};

export const reviewQuizAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = z.coerce.number().int().positive().parse(req.params.id);
    const attempt = await getQuizAttempt(attemptId, req.user!.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    return res.json({ success: true, data: attempt });
  } catch (error) {
    next(error);
  }
};
