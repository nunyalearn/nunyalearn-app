import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const difficultyEnum = z.enum(["easy", "med", "medium", "hard"]);

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  subjectId: z.coerce.number().int().positive().optional(),
  difficulty: difficultyEnum.optional(),
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

const createSchema = z.object({
  subjectId: z.number().int().positive(),
  name: z.string().min(1),
  difficulty: difficultyEnum.optional().default("med"),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field must be provided",
);

const normalizeDifficulty = (value?: string | null) => {
  if (!value) return undefined;
  return value === "medium" ? "med" : value;
};

export const listAdminTopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, subjectId, difficulty, search, includeInactive } =
      listQuerySchema.parse(req.query);

    const where: Prisma.TopicWhereInput = {
      ...(includeInactive ? {} : { is_active: true }),
    };

    if (subjectId) {
      where.subject_id = subjectId;
    }

    const normalizedDifficulty = normalizeDifficulty(difficulty);
    if (normalizedDifficulty) {
      where.difficulty = normalizedDifficulty;
    }

    if (search) {
      const term = search.trim();
      where.OR = [
        { topic_name: { contains: term, mode: "insensitive" } },
        {
          Subject: {
            subject_name: { contains: term, mode: "insensitive" },
          },
        },
      ];
    }

    const [total, topics] = await Promise.all([
      prisma.topic.count({ where }),
      prisma.topic.findMany({
        where,
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          Subject: {
            select: { id: true, subject_name: true, grade_level: true, is_active: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: { topics },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        Subject: true,
      },
    });

    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found" });
    }

    return res.json({ success: true, data: { topic } });
  } catch (error) {
    next(error);
  }
};

export const createAdminTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body);
    const subject = await prisma.subject.findUnique({
      where: { id: payload.subjectId },
    });

    if (!subject || !subject.is_active) {
      return res.status(400).json({ success: false, message: "Subject not available" });
    }

    const topic = await prisma.topic.create({
      data: {
        subject_id: payload.subjectId,
        topic_name: payload.name,
        difficulty: normalizeDifficulty(payload.difficulty) ?? "med",
        is_active: payload.isActive ?? true,
      },
      include: { Subject: true },
    });

    await recordAdminAction(req.user?.id, "Topic", "CREATE", topic.id, topic.topic_name);

    return res.status(201).json({ success: true, data: { topic } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);

    const data: Prisma.TopicUpdateInput = {};
    if (payload.name !== undefined) data.topic_name = payload.name;
    if (payload.subjectId !== undefined) {
      data.Subject = {
        connect: { id: payload.subjectId },
      };
    }
    if (payload.difficulty !== undefined) {
      data.difficulty = normalizeDifficulty(payload.difficulty) ?? "med";
    }
    if (payload.isActive !== undefined) {
      data.is_active = payload.isActive;
    }

    const topic = await prisma.topic.update({
      where: { id },
      data,
      include: { Subject: true },
    });

    await recordAdminAction(req.user?.id, "Topic", "UPDATE", id, topic.topic_name);

    return res.json({ success: true, data: { topic } });
  } catch (error) {
    next(error);
  }
};

export const archiveAdminTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const topic = await prisma.topic.update({
      where: { id },
      data: { is_active: false },
    });

    await recordAdminAction(req.user?.id, "Topic", "ARCHIVE", id, topic.topic_name);

    return res.json({ success: true, message: "Topic archived" });
  } catch (error) {
    next(error);
  }
};

export const restoreAdminTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const topic = await prisma.topic.update({
      where: { id },
      data: { is_active: true },
    });

    await recordAdminAction(req.user?.id, "Topic", "RESTORE", id, topic.topic_name);

    return res.json({ success: true, message: "Topic restored" });
  } catch (error) {
    next(error);
  }
};
