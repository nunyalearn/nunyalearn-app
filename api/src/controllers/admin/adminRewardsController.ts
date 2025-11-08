import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { applyXpChange } from "../../services/xpService";

const grantRewardSchema = z.object({
  userId: z.coerce.number().int().positive(),
  xp: z.coerce.number().int(),
  reason: z.string().optional(),
});

export const grantReward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = grantRewardSchema.parse(req.body);

    const userExists = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true },
    });

    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedUser = await applyXpChange(payload.userId, payload.xp, payload.reason ?? "Admin reward");

    return res.json({
      success: true,
      message: "Reward applied",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};
