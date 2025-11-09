import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../config/db";
import { applyXpChange } from "../../services/xpService";
import { recordAdminAction } from "../../services/auditService";

const rewardIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  active: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"))
    .optional(),
});

const rewardSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  xpValue: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().optional(),
});

const updateRewardSchema = rewardSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

const grantRewardSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    rewardId: z.coerce.number().int().positive().optional(),
    xp: z.coerce.number().int().optional(),
    reason: z.string().optional(),
  })
  .refine(
    (payload) => payload.rewardId !== undefined || payload.xp !== undefined,
    "Either rewardId or xp must be provided",
  );

export const listRewards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, active } = listQuerySchema.parse(req.query);

    const where: Prisma.RewardWhereInput = {};
    if (active !== undefined) {
      where.is_active = active;
    }

    const [total, rewards] = await Promise.all([
      prisma.reward.count({ where }),
      prisma.reward.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { rewards },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = rewardIdSchema.parse(req.params);
    const reward = await prisma.reward.findUnique({ where: { id } });

    if (!reward) {
      return res.status(404).json({ success: false, message: "Reward not found" });
    }

    return res.json({ success: true, data: { reward } });
  } catch (error) {
    next(error);
  }
};

export const createReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = rewardSchema.parse(req.body);
    const reward = await prisma.reward.create({
      data: {
        title: payload.title,
        description: payload.description ?? null,
        xp_value: payload.xpValue ?? 0,
        is_active: payload.isActive ?? true,
      },
    });

    await recordAdminAction(req.user?.id, "Reward", "CREATE", reward.id, reward.title);

    return res.status(201).json({ success: true, data: { reward } });
  } catch (error) {
    next(error);
  }
};

export const updateReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = rewardIdSchema.parse(req.params);
    const payload = updateRewardSchema.parse(req.body);

    const data: Prisma.RewardUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.xpValue !== undefined) data.xp_value = payload.xpValue;
    if (payload.isActive !== undefined) data.is_active = payload.isActive;

    const reward = await prisma.reward.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "Reward", "UPDATE", id, reward.title);

    return res.json({ success: true, data: { reward } });
  } catch (error) {
    next(error);
  }
};

export const deleteReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = rewardIdSchema.parse(req.params);
    const deleted = await prisma.reward.delete({ where: { id } });
    await recordAdminAction(req.user?.id, "Reward", "DELETE", id, deleted.title);
    return res.json({ success: true, message: "Reward deleted" });
  } catch (error) {
    next(error);
  }
};

export const grantReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = grantRewardSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let xpToApply = payload.xp ?? 0;
    let rewardRecord: Prisma.RewardGetPayload<{ select: { id: true; title: true; description: true; xp_value: true } }> | null =
      null;

    if (payload.rewardId) {
      rewardRecord = await prisma.reward.findUnique({
        where: { id: payload.rewardId },
        select: { id: true, title: true, description: true, xp_value: true },
      });

      if (!rewardRecord) {
        return res.status(404).json({ success: false, message: "Reward definition not found" });
      }

      xpToApply = payload.xp ?? rewardRecord.xp_value ?? 0;
    }

    const xpChange = xpToApply ?? 0;
    const updatedUser = await applyXpChange(
      payload.userId,
      xpChange,
      payload.reason ?? rewardRecord?.title ?? "Admin reward",
    );

    const grant = await prisma.rewardGrant.create({
      data: {
        reward_id: rewardRecord?.id ?? null,
        user_id: payload.userId,
        granted_by: req.user?.id ?? null,
        xp_awarded: xpChange,
        reason: payload.reason ?? rewardRecord?.description ?? null,
      },
    });

    await recordAdminAction(
      req.user?.id,
      "RewardGrant",
      "CREATE",
      grant.id,
      `User ${payload.userId} +${xpChange} XP`,
    );

    return res.json({
      success: true,
      message: "Reward applied",
      data: { user: updatedUser, xp: xpChange },
    });
  } catch (error) {
    next(error);
  }
};
