import { NextFunction, Request, Response } from "express";
import prisma from "../config/db";
import { getBadgeForXp } from "../services/xpService";

export const getLeaderboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [
        { xp_total: "desc" },
        { streak_days: "desc" },
      ],
      take: 10,
      select: {
        id: true,
        full_name: true,
        xp_total: true,
        level: true,
        streak_days: true,
      },
    });

    const leaderboard = await Promise.all(
      users.map(async (user) => {
        const badge = await getBadgeForXp(user.xp_total);
        return {
          id: user.id,
          fullName: user.full_name,
          xp_total: user.xp_total,
          level: user.level,
          streak_days: user.streak_days,
          badge: badge
            ? {
                id: badge.id,
                name: badge.name,
                xp_required: badge.xp_required,
                icon_url: badge.icon_url,
              }
            : null,
        };
      }),
    );

    return res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    next(error);
  }
};
