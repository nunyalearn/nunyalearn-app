import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getPracticeTestById, listPracticeTests } from "../../services/v2/practiceTestV2Service";
import {
  getPracticeTestAttempt,
  startPracticeTestAttempt,
  submitPracticeTestAttempt,
} from "../../services/v2/attemptV2Service";

const listQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
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

export const listPracticeTestsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await listPracticeTests(query);
    return res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getPracticeTestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const practiceTest = await getPracticeTestById(id);
    if (!practiceTest) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }
    return res.json({ success: true, data: practiceTest });
  } catch (error) {
    next(error);
  }
};

export const startPracticeTestAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const attempt = await startPracticeTestAttempt(req.user!.id, id);
    return res.status(201).json({
      success: true,
      data: { attemptId: attempt.id, attempt_id: attempt.id, status: attempt.status },
    });
  } catch (error) {
    next(error);
  }
};

export const submitPracticeTestAttemptHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const practiceTestId = z.coerce.number().int().positive().parse(req.params.id);
    const payload = submitSchema.parse(req.body);
    const result = await submitPracticeTestAttempt(req.user!.id, payload.attemptId, payload);
    if (!result.attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    if (result.attempt.practiceTestId !== practiceTestId) {
      return res
        .status(400)
        .json({ success: false, message: "Attempt does not belong to the selected practice test" });
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

export const reviewPracticeTestAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = z.coerce.number().int().positive().parse(req.params.id);
    const attempt = await getPracticeTestAttempt(attemptId, req.user!.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    return res.json({ success: true, data: attempt });
  } catch (error) {
    next(error);
  }
};
