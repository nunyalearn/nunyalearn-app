import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const xpHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const getXpHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const query = xpHistoryQuerySchema.parse(req.query);
    const { page, limit } = query;

    const [total, records] = await Promise.all([
      prisma.xpHistory.count({ where: { user_id: req.user.id } }),
      prisma.xpHistory.findMany({
        where: { user_id: req.user.id },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        history: records,
      },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};
