import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import { mapGradeDto, mapSubjectDto } from "../../utils/dtoMappers";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional()
    .default(false),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field must be provided",
);

export const listGradeLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, includeInactive } = listQuerySchema.parse(req.query);

    const where: Prisma.GradeLevelWhereInput = {};
    if (search) {
      where.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }
    if (!includeInactive) {
      where.is_active = true;
    }

    const totalPromise = prisma.gradeLevel.count({ where });
    const gradeLevelsPromise = prisma.gradeLevel.findMany({
      where,
      orderBy: [{ order_index: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { subjects: true } },
      },
    });

    const [total, gradeLevels] = await Promise.all([totalPromise, gradeLevelsPromise] as const);

    const normalized = gradeLevels.map((level) =>
      mapGradeDto({
        ...level,
        subjectCount: level._count.subjects,
      }),
    );

    return res.json({
      success: true,
      data: {
        gradeLevels: normalized,
        pagination: { page, limit, total },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getGradeLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id },
      include: {
        subjects: {
          where: { is_active: true },
          select: {
            id: true,
            subject_name: true,
            grade_level: true,
            description: true,
            is_active: true,
          },
        },
      },
    });

    if (!gradeLevel) {
      return res.status(404).json({ success: false, message: "Grade level not found" });
    }

    return res.json({
      success: true,
      data: {
        gradeLevel: {
          ...mapGradeDto(gradeLevel),
          subjects: gradeLevel.subjects?.map((subject) => mapSubjectDto(subject)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createGradeLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body);

    const gradeLevel = await prisma.gradeLevel.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        order_index: payload.orderIndex ?? null,
        is_active: payload.isActive ?? true,
      },
    });

    await recordAdminAction(req.user?.id, "GradeLevel", "CREATE", gradeLevel.id, gradeLevel.name);

    return res.status(201).json({
      success: true,
      data: { gradeLevel: mapGradeDto(gradeLevel) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateGradeLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    const data: Record<string, unknown> = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.orderIndex !== undefined) data.order_index = payload.orderIndex ?? null;
    if (payload.isActive !== undefined) data.is_active = payload.isActive;

    const gradeLevel = await prisma.gradeLevel.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "GradeLevel", "UPDATE", id, payload.name);

    return res.json({
      success: true,
      data: { gradeLevel: mapGradeDto(gradeLevel) },
    });
  } catch (error) {
    next(error);
  }
};

export const archiveGradeLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const gradeLevel = await prisma.gradeLevel.update({
      where: { id },
      data: { is_active: false },
    });

    await recordAdminAction(req.user?.id, "GradeLevel", "ARCHIVE", id, gradeLevel.name);

    return res.json({
      success: true,
      data: null,
      message: "Grade level archived",
    });
  } catch (error) {
    next(error);
  }
};

export const restoreGradeLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const gradeLevel = await prisma.gradeLevel.update({
      where: { id },
      data: { is_active: true },
    });

    await recordAdminAction(req.user?.id, "GradeLevel", "RESTORE", id, gradeLevel.name);

    return res.json({
      success: true,
      data: null,
      message: "Grade level restored",
    });
  } catch (error) {
    next(error);
  }
};
