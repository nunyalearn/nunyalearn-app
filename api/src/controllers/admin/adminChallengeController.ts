import { ChallengeStatus, ChallengeType, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const challengeBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(ChallengeType),
  xp_reward: z.coerce.number().int().nonnegative(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  icon_url: z.string().url().optional(),
});

const updateChallengeSchema = challengeBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  type: z.nativeEnum(ChallengeType).optional(),
  activeOnly: z.coerce.boolean().optional().default(false),
});

export const createChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = challengeBodySchema
      .refine((data) => data.end_date > data.start_date, {
        message: "end_date must be after start_date",
        path: ["end_date"],
      })
      .parse(req.body);

    const challenge = await prisma.challenge.create({
      data: {
        ...payload,
        description: payload.description ?? null,
        icon_url: payload.icon_url ?? null,
      },
    });

    await recordAdminAction(req.user?.id, "Challenge", "CREATE", challenge.id, challenge.title);

    return res.status(201).json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const getChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const challenge = await prisma.challenge.findUnique({
      where: { id: params.id },
    });

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    return res.json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const updateChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const payload = updateChallengeSchema.parse(req.body);

    if (payload.start_date && payload.end_date && payload.end_date <= payload.start_date) {
      return res
        .status(400)
        .json({ success: false, message: "end_date must be after start_date" });
    }

    const data: Record<string, unknown> = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.type !== undefined) data.type = payload.type;
    if (payload.xp_reward !== undefined) data.xp_reward = payload.xp_reward;
    if (payload.start_date !== undefined) data.start_date = payload.start_date;
    if (payload.end_date !== undefined) data.end_date = payload.end_date;
    if (payload.icon_url !== undefined) data.icon_url = payload.icon_url ?? null;

    const challenge = await prisma.challenge.update({
      where: { id: params.id },
      data,
    });

    await recordAdminAction(req.user?.id, "Challenge", "UPDATE", params.id, challenge.title);

    return res.json({ success: true, data: { challenge } });
  } catch (error) {
    next(error);
  }
};

export const deleteChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = idParamSchema.parse(req.params);
    const deleted = await prisma.challenge.delete({
      where: { id: params.id },
    });

    await recordAdminAction(req.user?.id, "Challenge", "DELETE", params.id, deleted.title);

    return res.json({ success: true, message: "Challenge deleted" });
  } catch (error) {
    next(error);
  }
};

export const listChallenges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);

    const where: Prisma.ChallengeWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.activeOnly
        ? {
            start_date: { lte: new Date() },
            end_date: { gte: new Date() },
          }
        : {}),
    };

    const [total, challenges] = await Promise.all([
      prisma.challenge.count({ where }),
      prisma.challenge.findMany({
        where,
        orderBy: { start_date: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return res.json({
      success: true,
      data: { challenges },
      pagination: { page: query.page, limit: query.limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getChallengeParticipants = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = idParamSchema.parse(req.params);

    const challenge = await prisma.challenge.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    const [joinedCount, completedCount, topParticipants] = await Promise.all([
      prisma.userChallenge.count({
        where: { challenge_id: params.id, status: ChallengeStatus.joined },
      }),
      prisma.userChallenge.count({
        where: { challenge_id: params.id, status: ChallengeStatus.completed },
      }),
      prisma.userChallenge.findMany({
        where: { challenge_id: params.id },
        orderBy: [
          { status: "asc" },
          {
            User: { xp_total: "desc" },
          },
          {
            User: { streak_days: "desc" },
          },
        ],
        take: 10,
        include: {
          User: {
            select: {
              id: true,
              full_name: true,
              xp_total: true,
              streak_days: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        joinedCount,
        completedCount,
        topParticipants: topParticipants
          .filter((participant) => participant.User)
          .map((participant) => ({
            userId: participant.User!.id,
            fullName: participant.User!.full_name,
            xp_total: participant.User!.xp_total,
            streak_days: participant.User!.streak_days,
            status: participant.status,
          })),
      },
    });
  } catch (error) {
    next(error);
  }
};
