import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  subject_id: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["easy", "med", "medium", "hard"]).optional(),
  q: z.string().optional(),
});

const createTopicSchema = z.object({
  subjectId: z.number().int().positive(),
  topicName: z.string().min(1),
  difficulty: z.enum(["easy", "med", "medium", "hard"]).optional().default("med"),
});

const normalizeDifficulty = (value?: string | null) => {
  if (!value) return undefined;
  return value === "medium" ? "med" : value;
};

export const getTopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    const { page, limit } = query;

    const where: Prisma.TopicWhereInput = {};

    if (query.subject_id) {
      where.subject_id = query.subject_id;
    }

    const difficulty = normalizeDifficulty(query.difficulty);
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const searchTerm = query.q?.trim();
    if (searchTerm) {
      where.OR = [
        {
          topic_name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          Subject: {
            subject_name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const [total, topics] = await Promise.all([
      prisma.topic.count({ where }),
      prisma.topic.findMany({
        where,
        orderBy: { topic_name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          Subject: {
            select: { id: true, subject_name: true, grade_level: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: { topics },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const createTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createTopicSchema.parse(req.body);

    const difficulty = normalizeDifficulty(payload.difficulty) ?? "med";

    const topic = await prisma.topic.create({
      data: {
        subject_id: payload.subjectId,
        topic_name: payload.topicName,
        difficulty,
      },
    });

    return res.status(201).json({ success: true, data: { topic } });
  } catch (error) {
    next(error);
  }
};
