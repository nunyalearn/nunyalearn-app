import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import { mapAchievementDto } from "../../utils/dtoMappers";

const achievementBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  xp_reward: z.coerce.number().int().nonnegative().default(0),
  criteria: z.string().optional(),
  icon_url: z.string().url().optional(),
});

const updateAchievementSchema = achievementBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const createAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = achievementBodySchema.parse(req.body);

    const achievement = await prisma.achievement.create({
      data: {
        ...payload,
        description: payload.description ?? null,
        criteria: payload.criteria ?? null,
        icon_url: payload.icon_url ?? null,
      },
    });

    await recordAdminAction(req.user?.id, "Achievement", "CREATE", achievement.id, achievement.name);

    return res.status(201).json({
      success: true,
      data: { achievement: mapAchievementDto(achievement) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const payload = updateAchievementSchema.parse(req.body);

    const data: Record<string, unknown> = {};

    if (payload.name !== undefined) data.name = payload.name;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.xp_reward !== undefined) data.xp_reward = payload.xp_reward;
    if (payload.criteria !== undefined) data.criteria = payload.criteria ?? null;
    if (payload.icon_url !== undefined) data.icon_url = payload.icon_url ?? null;

    const achievement = await prisma.achievement.update({
      where: { id: params.id },
      data,
    });

    await recordAdminAction(req.user?.id, "Achievement", "UPDATE", params.id, achievement.name);

    return res.json({
      success: true,
      data: { achievement: mapAchievementDto(achievement) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);

    const deleted = await prisma.achievement.delete({
      where: { id: params.id },
    });

    await recordAdminAction(req.user?.id, "Achievement", "DELETE", params.id, deleted.name);

    return res.json({
      success: true,
      data: null,
      message: "Achievement deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const listAchievements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);

    const [total, achievements] = await Promise.all([
      prisma.achievement.count(),
      prisma.achievement.findMany({
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        achievements: achievements.map((achievement) => mapAchievementDto(achievement)),
        pagination: { page, limit, total },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAchievement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const achievement = await prisma.achievement.findUnique({
      where: { id: params.id },
    });

    if (!achievement) {
      return res.status(404).json({ success: false, message: "Achievement not found" });
    }

    return res.json({
      success: true,
      data: { achievement: mapAchievementDto(achievement) },
    });
  } catch (error) {
    next(error);
  }
};
