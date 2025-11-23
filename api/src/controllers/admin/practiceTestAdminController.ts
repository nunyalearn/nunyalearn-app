import { Difficulty, Prisma, QuestionStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import {
  createPracticeTestSchema,
  practiceTestIdSchema,
  practiceTestListQuerySchema,
  practiceTestStatusSchema,
  updatePracticeTestSchema,
} from "../../validation/practiceTestSchema";
import { mapPracticeTestDto, mapQuestionDto } from "../../utils/dtoMappers";

type DifficultyMix = Partial<Record<Difficulty, number>>;

const difficultyOrder: Difficulty[] = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];

const practiceTestInclude = {
  Subject: { select: { id: true, subject_name: true } },
  GradeLevel: { select: { id: true, name: true } },
  questions: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      Question: {
        select: {
          id: true,
          questionText: true,
          difficulty: true,
          topicId: true,
          Topic: { select: { id: true, topic_name: true } },
        },
      },
    },
  },
} satisfies Prisma.PracticeTestInclude;

type PracticeTestPayload = Prisma.PracticeTestGetPayload<{ include: typeof practiceTestInclude }>;

const parseDifficultyMix = (raw: Prisma.JsonValue | null | undefined): DifficultyMix => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record: DifficultyMix = {};
    for (const key of difficultyOrder) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "number") {
        record[key] = value;
      }
    }
    return record;
  }
  return {};
};

const parseTopicFilters = (
  raw: Prisma.JsonValue | null | undefined,
): { topicIds: number[] } => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const topicIds = (raw as Record<string, unknown>).topicIds;
    if (Array.isArray(topicIds)) {
      return {
        topicIds: topicIds
          .map((value) => (typeof value === "number" ? value : Number(value)))
          .filter((value) => Number.isFinite(value) && value > 0),
      };
    }
  }
  return { topicIds: [] };
};

const sumDifficultyMix = (mix: DifficultyMix): number =>
  difficultyOrder.reduce((total, key) => total + (mix[key] ?? 0), 0);

const buildPracticeTestResponse = (test: PracticeTestPayload) => {
  const difficultyMix = parseDifficultyMix(test.difficultyMix);
  const topicFilters = parseTopicFilters(test.topicFilters);
  const topicMap = new Map<number, string>();
  test.questions.forEach((entry) => {
    const topicId = entry.Question.Topic?.id;
    if (topicId) {
      topicMap.set(topicId, entry.Question.Topic.topic_name);
    }
  });

  return mapPracticeTestDto({
    ...test,
    subject: test.Subject ? { id: test.Subject.id, name: test.Subject.subject_name } : null,
    gradeLevel: test.GradeLevel ? { id: test.GradeLevel.id, name: test.GradeLevel.name } : null,
    difficultyMix,
    topicIds: topicFilters.topicIds,
    topics: Array.from(topicMap.entries()).map(([id, name]) => ({ id, name })),
    questions: test.questions.map((entry) =>
      mapQuestionDto({
        id: entry.id,
        questionId: entry.Question.id,
        orderIndex: entry.orderIndex,
        questionText: entry.Question.questionText,
        difficulty: entry.Question.difficulty,
        topicId: entry.Question.topicId,
        topicName: entry.Question.Topic?.topic_name ?? null,
      }),
    ),
  });
};

const ensureTopics = async (topicIds: number[], subjectId?: number) => {
  const uniqueIds = Array.from(new Set(topicIds));

  const where: Prisma.TopicWhereInput = { id: { in: uniqueIds } };
  if (subjectId) {
    where.subject_id = subjectId;
  }

  const topics = await prisma.topic.findMany({
    where,
    select: { id: true },
  });

  if (topics.length !== uniqueIds.length) {
    throw new Error("One or more topics are invalid or outside the selected subject");
  }

  return uniqueIds;
};

const generateQuestionSelection = async (
  topicIds: number[],
  difficultyMix: DifficultyMix,
  questionCount: number,
) => {
  const selections = [];

  for (const difficulty of difficultyOrder) {
    const required = difficultyMix[difficulty] ?? 0;
    if (required === 0) {
      continue;
    }

    const pool = await prisma.questionBank.findMany({
      where: {
        topicId: { in: topicIds },
        difficulty,
        status: QuestionStatus.ACTIVE,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      take: required * 3,
    });

    const uniquePool = pool.filter(
      (entry, index, array) =>
        array.findIndex((candidate) => candidate.id === entry.id) === index,
    );

    if (uniquePool.length < required) {
      throw new Error(
        `Not enough ${difficulty.toLowerCase()} questions available for the selected topics`,
      );
    }

    selections.push(...uniquePool.slice(0, required));
  }

  if (selections.length !== questionCount) {
    throw new Error("Question mix does not match the requested total");
  }

  return selections;
};

export const listPracticeTests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId, gradeLevelId, includeInactive, search, page, limit } =
      practiceTestListQuerySchema.parse(req.query);

    const where: Prisma.PracticeTestWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }
    if (subjectId) {
      where.subjectId = subjectId;
    }
    if (gradeLevelId) {
      where.gradeLevelId = gradeLevelId;
    }
    if (search) {
      where.title = { contains: search.trim(), mode: "insensitive" };
    }

    if (!page || !limit) {
      const tests = await prisma.practiceTest.findMany({
        where,
        include: practiceTestInclude,
        orderBy: { updatedAt: "desc" },
      });

      return res.json({
        success: true,
        data: { tests: tests.map(buildPracticeTestResponse) },
      });
    }

    const [total, tests] = await Promise.all([
      prisma.practiceTest.count({ where }),
      prisma.practiceTest.findMany({
        where,
        include: practiceTestInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { tests: tests.map(buildPracticeTestResponse) },
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPracticeTestDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const test = await prisma.practiceTest.findUnique({
      where: { id },
      include: practiceTestInclude,
    });

    if (!test) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }

    return res.json({ success: true, data: { test: buildPracticeTestResponse(test) } });
  } catch (error) {
    next(error);
  }
};

const ensureQuestionMix = (mix: DifficultyMix, questionCount: number) => {
  const total = sumDifficultyMix(mix);
  if (total !== questionCount) {
    throw new Error("Difficulty mix must sum to total question count");
  }
};

export const createPracticeTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createPracticeTestSchema.parse(req.body);
    const difficultyMix = Object.fromEntries(
      difficultyOrder.map((key) => [key, payload.difficultyMix[key] ?? 0]),
    ) as DifficultyMix;

    ensureQuestionMix(difficultyMix, payload.questionCount);

    const topicIds = await ensureTopics(payload.topicIds, payload.subjectId);
    const questions = await generateQuestionSelection(topicIds, difficultyMix, payload.questionCount);

    const created = await prisma.$transaction(async (tx) => {
      const test = await tx.practiceTest.create({
        data: {
          title: payload.title,
          description: payload.description ?? null,
          subjectId: payload.subjectId ?? null,
          gradeLevelId: payload.gradeLevelId ?? null,
          durationMinutes: payload.durationMinutes ?? null,
          xpReward: payload.xpReward ?? 0,
          questionCount: payload.questionCount,
          difficultyMix: difficultyMix as Prisma.InputJsonValue,
          topicFilters: { topicIds } as Prisma.InputJsonValue,
          isActive: true,
        },
      });

      await tx.practiceTestQuestion.createMany({
        data: questions.map((question, index) => ({
          practiceTestId: test.id,
          questionId: question.id,
          orderIndex: index,
        })),
      });

      return test;
    });

    const full = await prisma.practiceTest.findUnique({
      where: { id: created.id },
      include: practiceTestInclude,
    });

    if (!full) {
      throw new Error("Unable to load practice test after creation");
    }

    await recordAdminAction(req.user?.id, "PracticeTest", "CREATE", full.id, full.title);

    return res.status(201).json({
      success: true,
      data: { test: buildPracticeTestResponse(full) },
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updatePracticeTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const payload = updatePracticeTestSchema.parse(req.body);

    const existing = await prisma.practiceTest.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        subjectId: true,
        difficultyMix: true,
        topicFilters: true,
        questionCount: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }

    const currentMix = parseDifficultyMix(existing.difficultyMix);
    const currentFilters = parseTopicFilters(existing.topicFilters);

    const nextMix: DifficultyMix = {
      ...currentMix,
      ...(payload.difficultyMix
        ? Object.fromEntries(
            difficultyOrder.map((key) => [key, payload.difficultyMix?.[key] ?? currentMix[key] ?? 0]),
          )
        : {}),
    };

    const nextQuestionCount = payload.questionCount ?? existing.questionCount;
    const nextTopicIds = payload.topicIds
      ? await ensureTopics(payload.topicIds, payload.subjectId ?? existing.subjectId ?? undefined)
      : currentFilters.topicIds;

    if (payload.questionCount || payload.difficultyMix || payload.topicIds) {
      ensureQuestionMix(nextMix, nextQuestionCount);
    }

    const data: Prisma.PracticeTestUncheckedUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.subjectId !== undefined) data.subjectId = payload.subjectId;
    if (payload.gradeLevelId !== undefined) data.gradeLevelId = payload.gradeLevelId;
    if (payload.durationMinutes !== undefined) data.durationMinutes = payload.durationMinutes ?? null;
    if (payload.xpReward !== undefined) data.xpReward = payload.xpReward;
    if (payload.questionCount !== undefined) data.questionCount = payload.questionCount;
    if (payload.difficultyMix !== undefined)
      data.difficultyMix = nextMix as Prisma.InputJsonValue;
    if (payload.topicIds !== undefined)
      data.topicFilters = { topicIds: nextTopicIds } as Prisma.InputJsonValue;

    const shouldRegenerate =
      payload.questionCount !== undefined ||
      payload.difficultyMix !== undefined ||
      payload.topicIds !== undefined;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.practiceTest.update({
          where: { id },
          data,
        });
      }

      if (shouldRegenerate) {
        const questions = await generateQuestionSelection(nextTopicIds, nextMix, nextQuestionCount);
        await tx.practiceTestQuestion.deleteMany({ where: { practiceTestId: id } });
        await tx.practiceTestQuestion.createMany({
          data: questions.map((question, index) => ({
            practiceTestId: id,
            questionId: question.id,
            orderIndex: index,
          })),
        });
      }
    });

    const updated = await prisma.practiceTest.findUnique({
      where: { id },
      include: practiceTestInclude,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }

    await recordAdminAction(req.user?.id, "PracticeTest", "UPDATE", id, updated.title);

    return res.json({ success: true, data: { test: buildPracticeTestResponse(updated) } });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updatePracticeTestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const { isActive } = practiceTestStatusSchema.parse(req.body);

    const test = await prisma.practiceTest.update({
      where: { id },
      data: { isActive },
      include: practiceTestInclude,
    });

    await recordAdminAction(
      req.user?.id,
      "PracticeTest",
      isActive ? "REACTIVATE" : "DEACTIVATE",
      id,
      test.title,
    );

    return res.json({
      success: true,
      data: null,
      message: isActive ? "Practice test reactivated" : "Practice test deactivated",
    });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError)?.code === "P2025") {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }
    next(error);
  }
};
