import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getPracticeTestAttempt, getQuizAttempt, listAttempts } from "../../services/v2/attemptV2Service";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const listLearnerAttemptsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const attempts = await listAttempts(req.user!.id, query.limit);
    return res.json({ success: true, data: attempts });
  } catch (error) {
    next(error);
  }
};

export const getLearnerAttemptHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attemptId = z.coerce.number().int().positive().parse(req.params.id);
    const type = z.enum(["quiz", "practice"]).parse(
      (req.query.type as string | undefined)?.toLowerCase() ?? "quiz",
    );
    const attempt =
      type === "quiz"
        ? await getQuizAttempt(attemptId, req.user!.id)
        : await getPracticeTestAttempt(attemptId, req.user!.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    return res.json({ success: true, data: attempt });
  } catch (error) {
    next(error);
  }
};
