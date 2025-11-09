import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  difficulty: z.string().optional(),
  topicId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  isPremium: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
  search: z.string().optional(),
});

const quizIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseQuizSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  questionText: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctOption: z.string().min(1),
  difficulty: z.string().default("med"),
  xpReward: z.coerce.number().int().nonnegative().default(0),
  questionType: z.string().optional(),
  competency: z.string().optional(),
  isPremium: z.boolean().optional(),
});

const createQuizSchema = baseQuizSchema;
const updateQuizSchema = baseQuizSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field required" },
);

const includeTopic = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
      Subject: { select: { id: true, subject_name: true } },
    },
  },
};

export const listAdminQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, difficulty, topicId, subjectId, isPremium, search } =
      listQuerySchema.parse(req.query);

    const where: Prisma.QuizWhereInput = {};

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (topicId) {
      where.topic_id = topicId;
    }

    if (subjectId) {
      where.Topic = { is: { subject_id: subjectId } };
    }

    if (isPremium !== undefined) {
      where.is_premium = isPremium;
    }

    if (search) {
      const term = search.trim();
      where.question_text = { contains: term, mode: "insensitive" };
    }

    const [total, quizzes] = await Promise.all([
      prisma.quiz.count({ where }),
      prisma.quiz.findMany({
        where,
        include: includeTopic,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { quizzes },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdSchema.parse(req.params);
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: includeTopic,
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    return res.json({ success: true, data: { quiz } });
  } catch (error) {
    next(error);
  }
};

export const createAdminQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createQuizSchema.parse(req.body);

    const quiz = await prisma.quiz.create({
      data: {
        topic_id: payload.topicId,
        question_text: payload.questionText,
        option_a: payload.optionA,
        option_b: payload.optionB,
        option_c: payload.optionC,
        option_d: payload.optionD,
        correct_option: payload.correctOption,
        difficulty: payload.difficulty,
        xp_reward: payload.xpReward ?? 0,
        question_type: payload.questionType ?? null,
        competency: payload.competency ?? null,
        is_premium: payload.isPremium ?? false,
      },
      include: includeTopic,
    });

    await recordAdminAction(req.user?.id, "Quiz", "CREATE", quiz.id, quiz.question_text);

    return res.status(201).json({ success: true, data: { quiz } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdSchema.parse(req.params);
    const payload = updateQuizSchema.parse(req.body);

    const data: Prisma.QuizUncheckedUpdateInput = {};
    if (payload.topicId !== undefined) data.topic_id = payload.topicId;
    if (payload.questionText !== undefined) data.question_text = payload.questionText;
    if (payload.optionA !== undefined) data.option_a = payload.optionA;
    if (payload.optionB !== undefined) data.option_b = payload.optionB;
    if (payload.optionC !== undefined) data.option_c = payload.optionC;
    if (payload.optionD !== undefined) data.option_d = payload.optionD;
    if (payload.correctOption !== undefined) data.correct_option = payload.correctOption;
    if (payload.difficulty !== undefined) data.difficulty = payload.difficulty;
    if (payload.xpReward !== undefined) data.xp_reward = payload.xpReward;
    if (payload.questionType !== undefined) data.question_type = payload.questionType ?? null;
    if (payload.competency !== undefined) data.competency = payload.competency ?? null;
    if (payload.isPremium !== undefined) data.is_premium = payload.isPremium;

    const quiz = await prisma.quiz.update({
      where: { id },
      data,
      include: includeTopic,
    });

    await recordAdminAction(req.user?.id, "Quiz", "UPDATE", id, quiz.question_text);

    return res.json({ success: true, data: { quiz } });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdSchema.parse(req.params);
    await prisma.quiz.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "Quiz", "DELETE", id);
    return res.json({ success: true, message: "Quiz deleted" });
  } catch (error) {
    next(error);
  }
};
