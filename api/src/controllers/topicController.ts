import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const querySchema = z.object({
  subject_id: z
    .string()
    .regex(/^\d+$/, "subject_id must be a number")
    .optional(),
});

const createTopicSchema = z.object({
  subjectId: z.number().int().positive(),
  topicName: z.string().min(1),
  difficulty: z.enum(["easy", "med", "medium", "hard"]).optional().default("med"),
});

export const getTopics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    const subjectId = query.subject_id ? Number(query.subject_id) : undefined;

    const topics = await prisma.topic.findMany({
      ...(subjectId ? { where: { subject_id: subjectId } } : {}),
      orderBy: { created_at: "desc" },
      include: {
        Subject: {
          select: { id: true, subject_name: true, grade_level: true },
        },
      },
    });

    return res.json({ success: true, data: { topics } });
  } catch (error) {
    next(error);
  }
};

export const createTopic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createTopicSchema.parse(req.body);

    const difficulty = payload.difficulty === "medium" ? "med" : payload.difficulty;

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
