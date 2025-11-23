import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { mapFlashcardDto } from "../utils/dtoMappers";

const booleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true"))
  .optional()
  .default(false);

const querySchema = z.object({
  topic_id: z.coerce.number().int().positive().optional(),
  q: z.string().optional(),
  lang: z.string().min(2).max(5).optional(),
  random: booleanQuery,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const createFlashcardSchema = z.object({
  topicId: z.number().int().positive(),
  frontText: z.string().min(1),
  backText: z.string().min(1),
  imageUrl: z.string().url().optional(),
  language: z.string().min(2).max(5).default("en"),
  isPremium: z.boolean().optional(),
});

const shuffleInPlace = <T>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
  return items;
};

export const getFlashcards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    const { page, limit, random } = query;

    const where: Prisma.FlashcardWhereInput = {};

    if (query.topic_id) {
      where.topic_id = query.topic_id;
    }

    if (query.lang) {
      where.language = {
        equals: query.lang,
        mode: "insensitive",
      };
    }

    const searchTerm = query.q?.trim();
    if (searchTerm) {
      where.OR = [
        {
          front_text: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          back_text: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    const [total, flashcards] = await Promise.all([
      prisma.flashcard.count({ where }),
      prisma.flashcard.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const result = random ? shuffleInPlace([...flashcards]) : flashcards;

    return res.json({
      success: true,
      data: result.map((flashcard) => mapFlashcardDto(flashcard)),
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const createFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createFlashcardSchema.parse(req.body);
    const language = payload.language.toLowerCase();

    const flashcard = await prisma.flashcard.create({
      data: {
        topic_id: payload.topicId,
        front_text: payload.frontText,
        back_text: payload.backText,
        image_url: payload.imageUrl ?? null,
        language,
        is_premium: payload.isPremium ?? false,
      },
    });

    return res.status(201).json({
      success: true,
      data: { flashcard: mapFlashcardDto(flashcard) },
    });
  } catch (error) {
    next(error);
  }
};
