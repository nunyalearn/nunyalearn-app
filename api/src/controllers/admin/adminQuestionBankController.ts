import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  subjectId: z.coerce.number().int().positive().optional(),
  topicId: z.coerce.number().int().positive().optional(),
  difficulty: z.string().optional(),
  search: z.string().optional(),
});

const questionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const questionSchema = z.object({
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

const updateSchema = questionSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "At least one field required" },
);

const bulkSchema = z.object({
  questions: z.array(questionSchema),
});

const includeTopic = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
      Subject: { select: { id: true, subject_name: true } },
    },
  },
};

const mapQuestion = (quiz: any) => ({
  id: quiz.id,
  question_text: quiz.question_text,
  subject: quiz.Topic?.Subject?.subject_name ?? null,
  competency: quiz.competency ?? null,
  type: quiz.question_type ?? "multiple_choice",
  topic: quiz.Topic?.topic_name ?? null,
  difficulty: quiz.difficulty,
});

export const listQuestionBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, subjectId, topicId, difficulty, search } = listQuerySchema.parse(
      req.query,
    );

    const where: Prisma.QuizWhereInput = {};
    if (subjectId) where.Topic = { is: { subject_id: subjectId } };
    if (topicId) where.topic_id = topicId;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      const term = search.trim();
      where.OR = [
        { question_text: { contains: term, mode: "insensitive" } },
        { competency: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, questions] = await Promise.all([
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
      data: { questions: questions.map(mapQuestion) },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getQuestionBankItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: includeTopic,
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    return res.json({ success: true, data: { question: quiz } });
  } catch (error) {
    next(error);
  }
};

export const createQuestionBankItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = questionSchema.parse(req.body);

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
    });

    await recordAdminAction(req.user?.id, "Question", "CREATE", quiz.id, quiz.question_text);

    return res.status(201).json({ success: true, data: { question: quiz } });
  } catch (error) {
    next(error);
  }
};

export const updateQuestionBankItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

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
    });

    await recordAdminAction(req.user?.id, "Question", "UPDATE", id, quiz.question_text);

    return res.json({ success: true, data: { question: quiz } });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestionBankItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const deleted = await prisma.quiz.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "Question", "DELETE", id, deleted.question_text);
    return res.json({ success: true, message: "Question deleted" });
  } catch (error) {
    next(error);
  }
};

export const bulkImportQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { questions } = bulkSchema.parse(req.body);
    const data = questions.map((question) => ({
      topic_id: question.topicId,
      question_text: question.questionText,
      option_a: question.optionA,
      option_b: question.optionB,
      option_c: question.optionC,
      option_d: question.optionD,
      correct_option: question.correctOption,
      difficulty: question.difficulty,
      xp_reward: question.xpReward ?? 0,
      question_type: question.questionType ?? null,
      competency: question.competency ?? null,
      is_premium: question.isPremium ?? false,
    }));

    const result = await prisma.quiz.createMany({ data });

    await recordAdminAction(
      req.user?.id,
      "Question",
      "BULK_CREATE",
      undefined,
      `Imported ${result.count} questions`,
    );

    return res.status(201).json({
      success: true,
      data: { inserted: result.count },
      message: "Question bank import completed",
    });
  } catch (error) {
    next(error);
  }
};
