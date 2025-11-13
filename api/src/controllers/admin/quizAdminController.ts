import { Prisma, QuestionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import {
  createQuizSchema,
  quizIdParamSchema,
  quizListQuerySchema,
  quizStatusSchema,
  updateQuizSchema,
} from "../../validation/quizSchema";

const quizInclude = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
    },
  },
  questions: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      Question: {
        select: {
          id: true,
          questionText: true,
          difficulty: true,
          questionType: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.QuizInclude;

type QuizWithRelations = Prisma.QuizGetPayload<{
  include: typeof quizInclude;
}>;

const dedupePreserveOrder = (ids: number[]) => {
  const seen = new Set<number>();
  return ids.filter((id) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

const findActiveQuestionIds = async (topicId: number, questionIds: number[]) => {
  const normalized = dedupePreserveOrder(questionIds);
  const activeQuestions = await prisma.questionBank.findMany({
    where: {
      id: { in: normalized },
      topicId,
      status: QuestionStatus.ACTIVE,
      isActive: true,
    },
    select: { id: true },
  });

  const missing = normalized.filter(
    (questionId) => !activeQuestions.some((question) => question.id === questionId),
  );

  return { normalized, missing };
};

const buildQuizResponse = (quiz: QuizWithRelations) => ({
  id: quiz.id,
  topicId: quiz.topicId,
  topicName: quiz.Topic?.topic_name ?? null,
  title: quiz.title,
  description: quiz.description,
  difficulty: quiz.difficulty,
  isActive: quiz.isActive,
  createdAt: quiz.createdAt,
  updatedAt: quiz.updatedAt,
  questionCount: quiz.questions.length,
  questions: quiz.questions.map((entry) => ({
    quizQuestionId: entry.id,
    questionId: entry.questionId,
    orderIndex: entry.orderIndex,
    questionText: entry.Question.questionText,
    questionDifficulty: entry.Question.difficulty,
    questionType: entry.Question.questionType,
    questionStatus: entry.Question.status,
  })),
});

const getQuizWithRelations = async (id: number) => {
  return prisma.quiz.findUnique({
    where: { id },
    include: quizInclude,
  });
};

const respondInvalidQuestions = (res: Response, invalidIds: number[]) => {
  const plural = invalidIds.length > 1;
  return res.status(400).json({
    success: false,
    message: plural
      ? "One or more selected questions are inactive or belong to another topic"
      : "Selected question is inactive or belongs to another topic",
    details: { invalidQuestionIds: invalidIds },
  });
};

export const listQuizzesByTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topicId, includeInactive } = quizListQuerySchema.parse(req.query);

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, topic_name: true },
    });

    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        topicId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: quizInclude,
      orderBy: { updatedAt: "desc" },
    });

    return res.json({
      success: true,
      data: {
        topic: { id: topic.id, name: topic.topic_name },
        quizzes: quizzes.map(buildQuizResponse),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getQuizDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdParamSchema.parse(req.params);
    const quiz = await getQuizWithRelations(id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    return res.json({ success: true, data: { quiz: buildQuizResponse(quiz) } });
  } catch (error) {
    next(error);
  }
};

export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createQuizSchema.parse(req.body);

    const topic = await prisma.topic.findUnique({
      where: { id: payload.topicId },
      select: { id: true, topic_name: true, is_active: true },
    });

    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    if (!topic.is_active) {
      return res.status(400).json({
        success: false,
        message: "Cannot attach quizzes to an inactive topic",
      });
    }

    const { normalized, missing } = await findActiveQuestionIds(
      payload.topicId,
      payload.questionIds,
    );

    if (missing.length > 0) {
      return respondInvalidQuestions(res, missing);
    }

    const created = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          topicId: payload.topicId,
          title: payload.title,
          description: payload.description ?? null,
          difficulty: payload.difficulty,
          isActive: true,
        },
      });

      await tx.quizQuestion.createMany({
        data: normalized.map((questionId, index) => ({
          quizId: quiz.id,
          questionId,
          orderIndex: index,
        })),
      });

      return quiz;
    });

    const full = await getQuizWithRelations(created.id);
    if (!full) {
      throw new Error("Failed to load quiz after creation");
    }

    await recordAdminAction(req.user?.id, "Quiz", "CREATE", created.id, created.title);

    return res.status(201).json({
      success: true,
      data: { quiz: buildQuizResponse(full) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdParamSchema.parse(req.params);
    const payload = updateQuizSchema.parse(req.body);

    const existing = await prisma.quiz.findUnique({
      where: { id },
      select: { id: true, topicId: true, title: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const data: Prisma.QuizUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.difficulty !== undefined) data.difficulty = payload.difficulty;

    let normalizedQuestions: number[] | undefined;
    if (payload.questionIds) {
      const validate = await findActiveQuestionIds(existing.topicId, payload.questionIds);
      if (validate.missing.length > 0) {
        return respondInvalidQuestions(res, validate.missing);
      }
      normalizedQuestions = validate.normalized;
    }

    const updateData =
      Object.keys(data).length > 0
        ? data
        : normalizedQuestions
          ? { updatedAt: new Date() }
          : undefined;

    await prisma.$transaction(async (tx) => {
      if (updateData) {
        await tx.quiz.update({
          where: { id },
          data: updateData,
        });
      }

      if (normalizedQuestions) {
        await tx.quizQuestion.deleteMany({ where: { quizId: id } });
        await tx.quizQuestion.createMany({
          data: normalizedQuestions.map((questionId, index) => ({
            quizId: id,
            questionId,
            orderIndex: index,
          })),
        });
      }
    });

    const updated = await getQuizWithRelations(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    if (payload.questionIds) {
      await recordAdminAction(req.user?.id, "Quiz", "UPDATE_QUESTIONS", id, updated.title);
    }
    if (Object.keys(data).length > 0) {
      await recordAdminAction(req.user?.id, "Quiz", "UPDATE", id, updated.title);
    }

    return res.json({ success: true, data: { quiz: buildQuizResponse(updated) } });
  } catch (error) {
    next(error);
  }
};

export const updateQuizStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quizIdParamSchema.parse(req.params);
    const { isActive } = quizStatusSchema.parse(req.body);

    const quiz = await prisma.quiz.update({
      where: { id },
      data: { isActive },
      include: quizInclude,
    });

    await recordAdminAction(req.user?.id, "Quiz", isActive ? "REACTIVATE" : "DEACTIVATE", id, quiz.title);

    return res.json({
      success: true,
      data: { quiz: buildQuizResponse(quiz) },
    });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError)?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }
    next(error);
  }
};
