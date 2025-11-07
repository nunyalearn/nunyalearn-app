import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const updateProgressSchema = z.object({
  topicId: z.number().int().positive(),
  completionPercent: z.number().min(0).max(100),
  xpEarned: z.number().int().min(0).optional(),
});

export const getProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const progress = await prisma.progress.findMany({
      where: { user_id: req.user.id },
      include: {
        Topic: {
          select: {
            id: true,
            topic_name: true,
            difficulty: true,
            subject_id: true,
          },
        },
      },
    });

    return res.json({ success: true, data: { progress } });
  } catch (error) {
    next(error);
  }
};

export const updateProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = updateProgressSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: {
        completion_percent: number;
        xp_earned?: { increment: number };
        last_updated: Date;
      } = {
        completion_percent: payload.completionPercent,
        last_updated: new Date(),
      };

      if (payload.xpEarned && payload.xpEarned > 0) {
        updateData.xp_earned = { increment: payload.xpEarned };
      }

      const progressRecord = await tx.progress.upsert({
        where: {
          user_id_topic_id: {
            user_id: req.user!.id,
            topic_id: payload.topicId,
          },
        },
        create: {
          user_id: req.user!.id,
          topic_id: payload.topicId,
          completion_percent: payload.completionPercent,
          xp_earned: payload.xpEarned ?? 0,
        },
        update: updateData,
      });

      if (payload.xpEarned && payload.xpEarned > 0) {
        await tx.user.update({
          where: { id: req.user!.id },
          data: { xp_total: { increment: payload.xpEarned } },
        });
      }

      return progressRecord;
    });

    return res.json({ success: true, data: { progress: updated } });
  } catch (error) {
    next(error);
  }
};
