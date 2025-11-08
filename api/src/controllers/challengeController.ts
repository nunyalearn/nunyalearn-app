import { ChallengeStatus, ChallengeType, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { applyRewards, expireStaleChallenges, validateChallenge } from "../services/gamificationService";
import { getLevel } from "../services/xpService";

const listChallengesSchema = z.object({
  type: z.nativeEnum(ChallengeType).optional(),
  date: z.coerce.date().optional(),
});

const challengeActionSchema = z.object({
  challengeId: z.number().int().positive(),
});

const normalizeChallengeResponse = (
  challenge: Prisma.ChallengeGetPayload<{ include: { participants: false } }>,
  userStatus?: {
    status: ChallengeStatus;
    progress: number | null;
    completed_at: Date | null;
  },
) => ({
  id: challenge.id,
  title: challenge.title,
  description: challenge.description,
  type: challenge.type,
  xp_reward: challenge.xp_reward,
  start_date: challenge.start_date,
  end_date: challenge.end_date,
  icon_url: challenge.icon_url,
  created_at: challenge.created_at,
  userStatus: userStatus
    ? {
        status: userStatus.status,
        progress: userStatus.progress ?? 0,
        completed_at: userStatus.completed_at,
      }
    : undefined,
});

const ensureActiveChallenge = (challenge: { start_date: Date; end_date: Date }) => {
  const now = new Date();
  return challenge.start_date <= now && challenge.end_date >= now;
};

export const getChallenges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await expireStaleChallenges(req.user?.id);
    const query = listChallengesSchema.parse(req.query);
    const date = query.date ?? new Date();

    const where: Prisma.ChallengeWhereInput = {
      start_date: { lte: date },
      end_date: { gte: date },
      ...(query.type ? { type: query.type } : {}),
    };

    const challenges = await prisma.challenge.findMany({
      where,
      orderBy: { start_date: "asc" },
    });

    let userStatuses: Record<
      number,
      { status: ChallengeStatus; progress: number | null; completed_at: Date | null }
    > = {};

    if (req.user && challenges.length > 0) {
      const challengeIds = challenges.map((challenge) => challenge.id);
      const participations = await prisma.userChallenge.findMany({
        where: {
          user_id: req.user.id,
          challenge_id: { in: challengeIds },
        },
      });

      userStatuses = participations.reduce(
        (acc, participation) => ({
          ...acc,
          [participation.challenge_id]: {
            status: participation.status,
            progress: participation.progress,
            completed_at: participation.completed_at,
          },
        }),
        {},
      );
    }

    const data = challenges.map((challenge) =>
      normalizeChallengeResponse(challenge, userStatuses[challenge.id]),
    );

    return res.json({ success: true, data: { challenges: data } });
  } catch (error) {
    next(error);
  }
};

export const joinChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await expireStaleChallenges(req.user.id);
    const payload = challengeActionSchema.parse(req.body);

    const challenge = await prisma.challenge.findUnique({
      where: { id: payload.challengeId },
    });

    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }

    if (!ensureActiveChallenge(challenge)) {
      return res.status(400).json({ success: false, message: "Challenge is not active" });
    }

    const existing = await prisma.userChallenge.findUnique({
      where: {
        user_id_challenge_id: {
          user_id: req.user.id,
          challenge_id: payload.challengeId,
        },
      },
    });

    if (existing) {
      if (existing.status === ChallengeStatus.completed) {
        return res
          .status(400)
          .json({ success: false, message: "Challenge already completed" });
      }
      if (existing.status === ChallengeStatus.expired) {
        return res.status(400).json({ success: false, message: "Challenge has expired" });
      }
      return res.json({
        success: true,
        message: "Challenge already joined",
      });
    }

    await prisma.userChallenge.create({
      data: {
        user_id: req.user.id,
        challenge_id: payload.challengeId,
      },
    });

    await validateChallenge(req.user.id, payload.challengeId);

    return res.json({
      success: true,
      message: "Challenge joined successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const completeChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await expireStaleChallenges(req.user.id);
    const payload = challengeActionSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.userChallenge.findUnique({
        where: {
          user_id_challenge_id: {
            user_id: req.user!.id,
            challenge_id: payload.challengeId,
          },
        },
        include: {
          Challenge: true,
        },
      });

      if (!participant) {
        throw new Error("Challenge not joined");
      }

      if (participant.status === ChallengeStatus.completed) {
        return { alreadyCompleted: true };
      }

      if (participant.status === ChallengeStatus.expired) {
        throw new Error("Challenge has expired");
      }

      if (!ensureActiveChallenge(participant.Challenge)) {
        await tx.userChallenge.update({
          where: {
            user_id_challenge_id: {
              user_id: req.user!.id,
              challenge_id: payload.challengeId,
            },
          },
          data: { status: ChallengeStatus.expired },
        });
        throw new Error("Challenge has expired");
      }

      const user = await tx.user.findUnique({
        where: { id: req.user!.id },
        select: { xp_total: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const xpReward = participant.Challenge.xp_reward;
      const newXpTotal = user.xp_total + xpReward;
      const newLevel = getLevel(newXpTotal);

      await tx.user.update({
        where: { id: req.user!.id },
        data: {
          xp_total: newXpTotal,
          level: newLevel,
        },
      });

      await tx.userChallenge.update({
        where: {
          user_id_challenge_id: {
            user_id: req.user!.id,
            challenge_id: payload.challengeId,
          },
        },
        data: {
          status: ChallengeStatus.completed,
          progress: 100,
          completed_at: new Date(),
        },
      });

      return {
        xpReward,
        challengeTitle: participant.Challenge.title,
      };
    });

    if ("alreadyCompleted" in result) {
      return res.json({
        success: true,
        message: "Challenge already completed",
      });
    }

    const rewards = await applyRewards(
      req.user.id,
      result.xpReward,
      `Challenge completion: ${result.challengeTitle}`,
    );

    await validateChallenge(req.user.id, payload.challengeId);

    return res.json({
      success: true,
      data: {
        xp_awarded: result.xpReward,
        newBadge: rewards.newBadge,
        newAchievements: rewards.newAchievements,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Challenge not joined") {
      return res.status(400).json({ success: false, message: "You must join the challenge first" });
    }
    if (error instanceof Error && error.message === "Challenge has expired") {
      return res.status(400).json({ success: false, message: "Challenge has expired" });
    }
    if (error instanceof Error && error.message === "User not found") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    next(error);
  }
};
