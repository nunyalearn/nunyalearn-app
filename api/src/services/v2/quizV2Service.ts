import { Difficulty, Prisma } from "@prisma/client";
import prisma from "../../config/db";
import { mapLearnerQuizDto } from "../../utils/learnerDtoMappers";

const quizInclude = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
      Subject: {
        select: {
          id: true,
          subject_name: true,
          GradeLevel: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  questions: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      Question: {
        include: {
          Topic: {
            select: {
              id: true,
              topic_name: true,
              subject_id: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.QuizInclude;

export type QuizListFilters = {
  topicId?: number;
  difficulty?: Difficulty;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
};

export const listQuizzes = async (filters: QuizListFilters) => {
  const { topicId, difficulty, includeInactive, page, limit } = filters;
  const where: Prisma.QuizWhereInput = {
    ...(includeInactive ? {} : { isActive: true }),
  };

  if (topicId) {
    where.topicId = topicId;
  }
  if (difficulty) {
    where.difficulty = difficulty;
  }

  const pageNumber = page && page > 0 ? page : 1;
  const perPage = limit && limit > 0 ? Math.min(limit, 50) : 20;

  const [total, quizzes] = await Promise.all([
    prisma.quiz.count({ where }),
    prisma.quiz.findMany({
      where,
      include: quizInclude,
      orderBy: { updatedAt: "desc" },
      skip: (pageNumber - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: quizzes.map((quiz) => mapLearnerQuizDto(quiz)),
    meta: {
      page: pageNumber,
      limit: perPage,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
};

export const getQuizById = async (id: number) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: quizInclude,
  });
  if (!quiz || !quiz.isActive) {
    return null;
  }
  return mapLearnerQuizDto(quiz);
};

export const getQuizRecord = async (id: number) => {
  return prisma.quiz.findUnique({
    where: { id },
    include: quizInclude,
  });
};

export const getQuizQuestions = async (id: number) => {
  const quiz = await getQuizRecord(id);
  if (!quiz || !quiz.isActive) {
    return null;
  }

  return {
    quiz,
    questions: quiz.questions.map((entry) => ({
      questionId: entry.questionId,
      orderIndex: entry.orderIndex,
      Question: entry.Question,
    })),
  };
};
