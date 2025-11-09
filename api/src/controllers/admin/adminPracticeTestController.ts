import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  subjectId: z.coerce.number().int().positive().optional(),
  difficulty: z.string().optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
  search: z.string().optional(),
});

const practiceTestIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  difficulty: z.string().default("med"),
  xpReward: z.coerce.number().int().nonnegative().default(0),
  durationMinutes: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  quizIds: z.array(z.coerce.number().int().positive()).min(1),
});

const createSchema = baseSchema;
const updateSchema = baseSchema
  .partial()
  .extend({ quizIds: z.array(z.coerce.number().int().positive()).optional() })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const includeRelations = {
  Subject: { select: { id: true, subject_name: true } },
  quizzes: {
    select: {
      quiz_id: true,
      order_index: true,
      Quiz: {
        select: {
          id: true,
          question_text: true,
          difficulty: true,
          xp_reward: true,
        },
      },
    },
    orderBy: { order_index: "asc" as const },
  },
};

const mapPracticeTest = (test: any) => ({
  id: test.id,
  title: test.title,
  description: test.description,
  difficulty: test.difficulty,
  xp_reward: test.xp_reward,
  duration_minutes: test.duration_minutes,
  is_active: test.is_active,
  subject: test.Subject
    ? { id: test.Subject.id, name: test.Subject.subject_name }
    : null,
  quizIds: test.quizzes?.map((item: any) => item.quiz_id) ?? [],
  quizCount: test.quizzes?.length ?? 0,
});

export const listPracticeTests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, subjectId, difficulty, isActive, search } = listQuerySchema.parse(
      req.query,
    );

    const where: Prisma.PracticeTestWhereInput = {};
    if (subjectId) where.subject_id = subjectId;
    if (difficulty) where.difficulty = difficulty;
    if (isActive !== undefined) where.is_active = isActive;
    if (search) {
      where.title = { contains: search.trim(), mode: "insensitive" };
    }

    const [total, tests] = await Promise.all([
      prisma.practiceTest.count({ where }),
      prisma.practiceTest.findMany({
        where,
        include: includeRelations,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { tests: tests.map(mapPracticeTest) },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getPracticeTestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const test = await prisma.practiceTest.findUnique({
      where: { id },
      include: includeRelations,
    });

    if (!test) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }

    return res.json({ success: true, data: { test: mapPracticeTest(test) } });
  } catch (error) {
    next(error);
  }
};

const ensureQuizIds = async (quizIds: number[]) => {
  if (!quizIds?.length) {
    throw new Error("At least one quiz is required");
  }

  const uniqueIds = Array.from(new Set(quizIds));
  const found = await prisma.quiz.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    throw new Error("One or more quizIds are invalid");
  }

  return uniqueIds;
};

export const createPracticeTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body);
    const quizIds = await ensureQuizIds(payload.quizIds);

    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.practiceTest.create({
        data: {
          title: payload.title,
          description: payload.description ?? null,
          subject_id: payload.subjectId ?? null,
          difficulty: payload.difficulty,
          xp_reward: payload.xpReward ?? 0,
          duration_minutes: payload.durationMinutes ?? null,
          is_active: payload.isActive ?? true,
        },
      });

      await tx.practiceTestQuiz.createMany({
        data: quizIds.map((quizId, index) => ({
          practice_test_id: created.id,
          quiz_id: quizId,
          order_index: index,
        })),
      });

      return created;
    });

    const full = await prisma.practiceTest.findUnique({
      where: { id: test.id },
      include: includeRelations,
    });

    await recordAdminAction(req.user?.id, "PracticeTest", "CREATE", test.id, test.title);

    return res.status(201).json({
      success: true,
      data: { test: mapPracticeTest(full) },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePracticeTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    const quizIds = payload.quizIds ? await ensureQuizIds(payload.quizIds) : undefined;

    await prisma.$transaction(async (tx) => {
      const data: Prisma.PracticeTestUncheckedUpdateInput = {};
      if (payload.title !== undefined) data.title = payload.title;
      if (payload.description !== undefined) data.description = payload.description ?? null;
      if (payload.subjectId !== undefined) data.subject_id = payload.subjectId;
      if (payload.difficulty !== undefined) data.difficulty = payload.difficulty;
      if (payload.xpReward !== undefined) data.xp_reward = payload.xpReward;
      if (payload.durationMinutes !== undefined)
        data.duration_minutes = payload.durationMinutes ?? null;
      if (payload.isActive !== undefined) data.is_active = payload.isActive;

      await tx.practiceTest.update({
        where: { id },
        data,
      });

      if (quizIds) {
        await tx.practiceTestQuiz.deleteMany({ where: { practice_test_id: id } });
        await tx.practiceTestQuiz.createMany({
          data: quizIds.map((quizId, index) => ({
            practice_test_id: id,
            quiz_id: quizId,
            order_index: index,
          })),
        });
      }
    });

    const updated = await prisma.practiceTest.findUnique({
      where: { id },
      include: includeRelations,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Practice test not found" });
    }

    await recordAdminAction(req.user?.id, "PracticeTest", "UPDATE", id, updated.title);

    return res.json({ success: true, data: { test: mapPracticeTest(updated) } });
  } catch (error) {
    next(error);
  }
};

export const deletePracticeTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = practiceTestIdSchema.parse(req.params);
    const deleted = await prisma.practiceTest.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "PracticeTest", "DELETE", id, deleted.title);
    return res.json({ success: true, message: "Practice test deleted" });
  } catch (error) {
    next(error);
  }
};
