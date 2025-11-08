import { ChallengeStatus, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { getBadgeForXp } from "../services/xpService";

const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  timeframe: z.enum(["daily", "weekly", "alltime"]).default("alltime"),
  region: z.string().optional(),
  subject_id: z.coerce.number().int().positive().optional(),
  challenge_id: z.coerce.number().int().positive().optional(),
});

const timeframeStartDate = (timeframe: "daily" | "weekly" | "alltime") => {
  if (timeframe === "alltime") {
    return undefined;
  }

  const now = Date.now();
  const delta = timeframe === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now - delta);
};

export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = leaderboardQuerySchema.parse(req.query);
    const { page, limit, timeframe } = query;

    const start = timeframeStartDate(timeframe);

    let filteredIds: number[] | null = null;
    const mergeIds = (ids: number[]) => {
      const uniqueIncoming = Array.from(new Set(ids));
      if (filteredIds === null) {
        filteredIds = uniqueIncoming;
      } else {
        const incomingSet = new Set(uniqueIncoming);
        const current = filteredIds ?? [];
        filteredIds = current.filter((id) => incomingSet.has(id));
      }
    };
    const respondEmpty = () =>
      res.json({
        success: true,
        data: { leaderboard: [] },
        pagination: { page, limit, total: 0 },
      });
    const hasNoResults = () => Array.isArray(filteredIds) && filteredIds.length === 0;

    if (start) {
      const attemptUsers = await prisma.attempt.findMany({
        where: { attempt_date: { gte: start } },
        select: { user_id: true },
        distinct: ["user_id"],
      });
      if (attemptUsers.length === 0) {
        return respondEmpty();
      }
      mergeIds(attemptUsers.map((item) => item.user_id));
      if (hasNoResults()) {
        return respondEmpty();
      }
    }

    if (query.subject_id) {
      const subjectUsers = await prisma.progress.findMany({
        where: {
          Topic: { subject_id: query.subject_id },
        },
        select: { user_id: true },
        distinct: ["user_id"],
      });
      if (subjectUsers.length === 0) {
        return respondEmpty();
      }
      mergeIds(subjectUsers.map((entry) => entry.user_id));
      if (hasNoResults()) {
        return respondEmpty();
      }
    }

    if (query.challenge_id) {
      const challengeUsers = await prisma.userChallenge.findMany({
        where: {
          challenge_id: query.challenge_id,
        },
        select: { user_id: true },
        distinct: ["user_id"],
      });
      if (challengeUsers.length === 0) {
        return respondEmpty();
      }
      mergeIds(challengeUsers.map((entry) => entry.user_id));
      if (hasNoResults()) {
        return respondEmpty();
      }
    }

    let userWhere: Prisma.UserWhereInput | undefined;
    if (filteredIds) {
      const ids = filteredIds as number[];
      if (ids.length === 0) {
        return respondEmpty();
      }
      userWhere = { id: { in: ids } };
    }

    const [total, users] = await Promise.all([
      userWhere ? prisma.user.count({ where: userWhere }) : prisma.user.count(),
      prisma.user.findMany({
        ...(userWhere ? { where: userWhere } : {}),
        orderBy: [
          { xp_total: "desc" },
          { streak_days: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          full_name: true,
          xp_total: true,
          level: true,
          streak_days: true,
        },
      }),
    ]);

    const leaderboard = await Promise.all(
      users.map(async (user) => {
        const badge = await getBadgeForXp(user.xp_total);
        const currentChallenge = await prisma.userChallenge.findFirst({
          where: {
            user_id: user.id,
            status: ChallengeStatus.joined,
          },
          orderBy: { joined_at: "desc" },
          include: { Challenge: true },
        });

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
          currentChallengeProgress: currentChallenge
            ? {
                challenge_id: currentChallenge.challenge_id,
                title: currentChallenge.Challenge.title,
                progress: currentChallenge.progress ?? 0,
                status: currentChallenge.status,
                ends_at: currentChallenge.Challenge.end_date,
              }
            : null,
        };
      }),
    );

    return res.json({
      success: true,
      data: { leaderboard },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};
