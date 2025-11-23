import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import { mapBadgeDto } from "../../utils/dtoMappers";

const badgeBodySchema = z.object({
  name: z.string().min(1),
  xp_required: z.coerce.number().int().nonnegative(),
  icon_url: z.string().url().optional(),
});

const updateBadgeSchema = badgeBodySchema.partial().refine(
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

export const createBadge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = badgeBodySchema.parse(req.body);

    const badge = await prisma.badge.create({
      data: {
        name: payload.name,
        xp_required: payload.xp_required,
        icon_url: payload.icon_url ?? null,
      },
    });

    await recordAdminAction(req.user?.id, "Badge", "CREATE", badge.id, badge.name);

    return res.status(201).json({
      success: true,
      data: { badge: mapBadgeDto(badge) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBadge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const payload = updateBadgeSchema.parse(req.body);

    const data: Record<string, unknown> = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.xp_required !== undefined) data.xp_required = payload.xp_required;
    if (payload.icon_url !== undefined) data.icon_url = payload.icon_url ?? null;

    const badge = await prisma.badge.update({
      where: { id: params.id },
      data,
    });

    await recordAdminAction(req.user?.id, "Badge", "UPDATE", params.id, badge.name);

    return res.json({
      success: true,
      data: { badge: mapBadgeDto(badge) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBadge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);

    const deleted = await prisma.badge.delete({
      where: { id: params.id },
    });

    await recordAdminAction(req.user?.id, "Badge", "DELETE", params.id, deleted.name);

    return res.json({
      success: true,
      data: null,
      message: "Badge deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const listBadges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);

    const [total, badges] = await Promise.all([
      prisma.badge.count(),
      prisma.badge.findMany({
        orderBy: { xp_required: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        badges: badges.map((badge) => mapBadgeDto(badge)),
        pagination: { page, limit, total },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBadge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const badge = await prisma.badge.findUnique({ where: { id: params.id } });

    if (!badge) {
      return res.status(404).json({ success: false, message: "Badge not found" });
    }

    return res.json({
      success: true,
      data: { badge: mapBadgeDto(badge) },
    });
  } catch (error) {
    next(error);
  }
};
