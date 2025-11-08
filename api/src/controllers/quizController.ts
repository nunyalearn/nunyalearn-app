import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { getLevel, getXp, updateStreak } from "../services/xpService";

const booleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true"))
  .optional()
  .default(false);

const quizQuerySchema = z.object({
  topic_id: z.coerce.number().int().positive(),
  difficulty: z.enum(["easy", "med", "medium", "hard"]).optional(),
  random: booleanQuery,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const attemptSchema = z.object({
  quizId: z.number().int().positive(),
  selectedOption: z.string().min(1),
});

const normalizeOption = (option: string) => option.trim().toLowerCase();
const normalizeDifficulty = (difficulty?: string | null) => {
  if (!difficulty) return undefined;
  return difficulty === "medium" ? "med" : difficulty;
};

const shuffleInPlace = <T>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
  return items;
};

export const getQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = quizQuerySchema.parse(req.query);
    const { topic_id, page, limit, random } = query;

    const where: Prisma.QuizWhereInput = {
      topic_id,
    };

    const difficulty = normalizeDifficulty(query.difficulty);
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const [total, quizzes] = await Promise.all([
      prisma.quiz.count({ where }),
      prisma.quiz.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        ...(random ? {} : { orderBy: { created_at: "desc" } }),
        include: {
          _count: {
            select: { attempts: true },
          },
        },
      }),
    ]);

    let sanitized = quizzes.map(({ correct_option, _count, ...quiz }) => ({
      ...quiz,
      attemptCount: _count.attempts,
    }));

    if (random) {
      sanitized = shuffleInPlace(sanitized);
    }

    return res.json({
      success: true,
      data: { quizzes: sanitized },
      pagination: { page, limit, total },
    });
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

    const score = isCorrect ? 1 : 0;
    const xpEarned = getXp(quiz.difficulty, isCorrect);

    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: req.user!.id },
        select: { xp_total: true },
      });

      if (!existingUser) {
        throw new Error("User context lost during attempt");
      }

      await tx.attempt.create({
        data: {
          quiz_id: quiz.id,
          user_id: req.user!.id,
          selected_option: payload.selectedOption,
          is_correct: isCorrect,
          score,
        },
      });

      const newXpTotal = existingUser.xp_total + xpEarned;
      const newLevel = getLevel(newXpTotal);

      await tx.user.update({
        where: { id: req.user!.id },
        data: {
          xp_total: newXpTotal,
          level: newLevel,
        },
      });

      const totalQuizzes = await tx.quiz.count({
        where: { topic_id: quiz.topic_id },
      });

      const completedQuizzes = await tx.attempt.count({
        where: {
          user_id: req.user!.id,
          is_correct: true,
          Quiz: { topic_id: quiz.topic_id },
        },
      });

      const completionPercent =
        totalQuizzes === 0 ? 0 : Math.round((completedQuizzes / totalQuizzes) * 100);

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
          completion_percent: completionPercent,
          xp_earned: xpEarned,
        },
        update: {
          completion_percent: completionPercent,
          xp_earned: { increment: xpEarned },
          last_updated: new Date(),
        },
      });
    });

    await updateStreak(req.user.id);

    return res.status(201).json({
      success: true,
      data: {
        score,
        xp_awarded: xpEarned,
      },
    });
  } catch (error) {
    next(error);
  }
};
