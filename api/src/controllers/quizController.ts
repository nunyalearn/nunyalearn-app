import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { calculateXp } from "../services/xpService";

const quizQuerySchema = z.object({
  topic_id: z.string().regex(/^\d+$/, "topic_id must be numeric").optional(),
});

const attemptSchema = z.object({
  quizId: z.number().int().positive(),
  selectedOption: z.string().min(1),
});

const normalizeOption = (option: string) => option.trim().toLowerCase();

export const getQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = quizQuerySchema.parse(req.query);
    const topicId = query.topic_id ? Number(query.topic_id) : undefined;

    const quizzes = await prisma.quiz.findMany({
      ...(topicId ? { where: { topic_id: topicId } } : {}),
      orderBy: { created_at: "desc" },
    });

    return res.json({ success: true, data: { quizzes } });
  } catch (error) {
    next(error);
  }
};

export const submitAttempt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = attemptSchema.parse(req.body);

    const quiz = await prisma.quiz.findUnique({
      where: { id: payload.quizId },
      include: { Topic: true },
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const selected = normalizeOption(payload.selectedOption);
    const correctOption = normalizeOption(quiz.correct_option);
    const isCorrect =
      selected === correctOption ||
      (selected.length === 1 && `option_${selected}` === correctOption);

    const score = isCorrect ? 100 : 0;
    const xpEarned = calculateXp(score, quiz.difficulty);

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: req.user!.id },
        select: { xp_total: true, level: true },
      });

      if (!existingUser) {
        throw new Error("User context lost during attempt");
      }

      const attempt = await tx.attempt.create({
        data: {
          quiz_id: quiz.id,
          user_id: req.user!.id,
          selected_option: payload.selectedOption,
          is_correct: isCorrect,
          score,
        },
      });

      const newXpTotal = existingUser.xp_total + xpEarned;
      const newLevel = Math.floor(newXpTotal / 100) + 1;

      const updatedUser = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          xp_total: newXpTotal,
          level: newLevel,
        },
        select: {
          id: true,
          xp_total: true,
          level: true,
        },
      });

      const progressUpdateData: {
        completion_percent?: { set: number };
        xp_earned: { increment: number };
        last_updated: Date;
      } = {
        xp_earned: { increment: xpEarned },
        last_updated: new Date(),
      };

      if (isCorrect) {
        progressUpdateData.completion_percent = { set: 100 };
      }

      await tx.progress.upsert({
        where: {
          user_id_topic_id: {
            user_id: req.user!.id,
            topic_id: quiz.topic_id,
          },
        },
        create: {
          user_id: req.user!.id,
          topic_id: quiz.topic_id,
          completion_percent: isCorrect ? 100 : 50,
          xp_earned: xpEarned,
        },
        update: progressUpdateData,
      });

      return { attempt, updatedUser };
    });

    return res.status(201).json({
      success: true,
      data: {
        attempt: result.attempt,
        xpEarned,
        totalXp: result.updatedUser.xp_total,
        level: result.updatedUser.level,
      },
    });
  } catch (error) {
    next(error);
  }
};
