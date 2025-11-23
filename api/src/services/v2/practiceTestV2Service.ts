import prisma from "../../config/db";
import { mapLearnerPracticeTestDto } from "../../utils/learnerDtoMappers";
import { Prisma } from "@prisma/client";

const practiceTestInclude = {
  Subject: {
    select: {
      id: true,
      subject_name: true,
      GradeLevel: {
        select: { id: true, name: true },
      },
    },
  },
  GradeLevel: {
    select: { id: true, name: true },
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
} satisfies Prisma.PracticeTestInclude;

export type PracticeTestFilters = {
  subjectId?: number | undefined;
  gradeLevelId?: number | undefined;
  includeInactive?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export const listPracticeTests = async (filters: PracticeTestFilters) => {
  const { subjectId, gradeLevelId, includeInactive, page, limit } = filters;
  const where: Prisma.PracticeTestWhereInput = {
    ...(includeInactive ? {} : { isActive: true }),
  };

  if (subjectId) {
    where.subjectId = subjectId;
  }
  if (gradeLevelId) {
    where.gradeLevelId = gradeLevelId;
  }

  const pageNumber = page && page > 0 ? page : 1;
  const perPage = limit && limit > 0 ? Math.min(limit, 50) : 20;

  const [total, practiceTests] = await Promise.all([
    prisma.practiceTest.count({ where }),
    prisma.practiceTest.findMany({
      where,
      include: practiceTestInclude,
      orderBy: { updatedAt: "desc" },
      skip: (pageNumber - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: practiceTests.map((practiceTest) => mapLearnerPracticeTestDto(practiceTest)),
    meta: {
      page: pageNumber,
      limit: perPage,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
};

export const getPracticeTestById = async (id: number) => {
  const practiceTest = await prisma.practiceTest.findUnique({
    where: { id },
    include: practiceTestInclude,
  });
  if (!practiceTest || !practiceTest.isActive) {
    return null;
  }
  return mapLearnerPracticeTestDto(practiceTest);
};

export const getPracticeTestRecord = async (id: number) => {
  return prisma.practiceTest.findUnique({
    where: { id },
    include: practiceTestInclude,
  });
};

export const getPracticeTestQuestions = async (id: number) => {
  const practiceTest = await getPracticeTestRecord(id);
  if (!practiceTest || !practiceTest.isActive) {
    return null;
  }

  return {
    practiceTest,
    questions: practiceTest.questions.map((entry) => ({
      questionId: entry.questionId,
      orderIndex: entry.orderIndex,
      Question: entry.Question,
    })),
  };
};
