import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const querySchema = z.object({
  topic_id: z.string().regex(/^\d+$/, "topic_id must be numeric"),
});

const createFlashcardSchema = z.object({
  topicId: z.number().int().positive(),
  frontText: z.string().min(1),
  backText: z.string().min(1),
  imageUrl: z.string().url().optional(),
  language: z.string().min(2).max(5).default("en"),
  isPremium: z.boolean().optional(),
});

export const getFlashcards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    const topicId = Number(query.topic_id);

    const flashcards = await prisma.flashcard.findMany({
      where: { topic_id: topicId },
      orderBy: { created_at: "desc" },
    });

    return res.json({ success: true, data: { flashcards } });
  } catch (error) {
    next(error);
  }
};

export const createFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createFlashcardSchema.parse(req.body);

    const flashcard = await prisma.flashcard.create({
      data: {
        topic_id: payload.topicId,
        front_text: payload.frontText,
        back_text: payload.backText,
        image_url: payload.imageUrl ?? null,
        language: payload.language,
        is_premium: payload.isPremium ?? false,
      },
    });

    return res.status(201).json({ success: true, data: { flashcard } });
  } catch (error) {
    next(error);
  }
};
