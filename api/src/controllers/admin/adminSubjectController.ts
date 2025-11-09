import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import { ensureGradeLevelContext } from "../../utils/gradeLevelHelper";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional()
    .default(false),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createSchema = z
  .object({
    name: z.string().min(1),
    gradeLevelId: z.coerce.number().int().positive().optional(),
    gradeLevelName: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((payload) => !!payload.gradeLevelId || !!payload.gradeLevelName, {
    message: "gradeLevelId or gradeLevelName is required",
    path: ["gradeLevelName"],
  });

const updateSchema = createSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field must be provided",
);

export const listAdminSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, gradeLevelId, includeInactive } = listQuerySchema.parse(req.query);

    const where: Prisma.SubjectWhereInput = {
      ...(includeInactive ? {} : { is_active: true }),
    };

    if (search) {
      const term = search.trim();
      where.OR = [
        { subject_name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        {
          topics: {
            some: {
              topic_name: { contains: term, mode: "insensitive" },
            },
          },
        },
      ];
    }

    if (gradeLevelId) {
      where.grade_level_id = gradeLevelId;
    }

    const [total, subjects] = await Promise.all([
      prisma.subject.count({ where }),
      prisma.subject.findMany({
        where,
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          GradeLevel: true,
          _count: { select: { topics: true } },
        },
      }),
    ]);

    const normalized = subjects.map(({ _count, ...subject }) => ({
      ...subject,
      gradeLevel: subject.GradeLevel
        ? { id: subject.GradeLevel.id, name: subject.GradeLevel.name }
        : null,
      topicCount: _count.topics,
    }));

    return res.json({
      success: true,
      data: { subjects: normalized },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        GradeLevel: true,
        topics: {
          orderBy: { topic_name: "asc" },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    return res.json({ success: true, data: { subject } });
  } catch (error) {
    next(error);
  }
};

export const createAdminSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body);
    const gradeInfo = await ensureGradeLevelContext(payload.gradeLevelId, payload.gradeLevelName);

    const subject = await prisma.subject.create({
      data: {
        subject_name: payload.name,
        grade_level: gradeInfo.gradeLevelName,
        grade_level_id: gradeInfo.gradeLevelId ?? null,
        description: payload.description ?? null,
        is_active: payload.isActive ?? true,
      },
      include: { GradeLevel: true },
    });

    await recordAdminAction(req.user?.id, "Subject", "CREATE", subject.id, subject.subject_name);

    return res.status(201).json({ success: true, data: { subject } });
  } catch (error) {
    if (error instanceof Error && error.message === "Grade level not found") {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateAdminSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    const data: Prisma.SubjectUncheckedUpdateInput = {};

    if (payload.name !== undefined) data.subject_name = payload.name;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.isActive !== undefined) data.is_active = payload.isActive;

    if (payload.gradeLevelId || payload.gradeLevelName) {
      const gradeInfo = await ensureGradeLevelContext(payload.gradeLevelId, payload.gradeLevelName);
      data.grade_level_id = gradeInfo.gradeLevelId ?? null;
      data.grade_level = gradeInfo.gradeLevelName;
    }

    const subject = await prisma.subject.update({
      where: { id },
      data,
      include: { GradeLevel: true },
    });

    await recordAdminAction(req.user?.id, "Subject", "UPDATE", id, subject.subject_name);

    return res.json({ success: true, data: { subject } });
  } catch (error) {
    if (error instanceof Error && error.message === "Grade level not found") {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const archiveAdminSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const subject = await prisma.subject.update({
      where: { id },
      data: { is_active: false },
    });

    await recordAdminAction(req.user?.id, "Subject", "ARCHIVE", id, subject.subject_name);

    return res.json({ success: true, message: "Subject archived" });
  } catch (error) {
    next(error);
  }
};

export const restoreAdminSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const subject = await prisma.subject.update({
      where: { id },
      data: { is_active: true },
    });

    await recordAdminAction(req.user?.id, "Subject", "RESTORE", id, subject.subject_name);

    return res.json({ success: true, message: "Subject restored" });
  } catch (error) {
    next(error);
  }
};
