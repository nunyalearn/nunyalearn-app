import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  topicId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  language: z.string().min(2).max(5).optional(),
  search: z.string().optional(),
});

const flashcardIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createFlashcardSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  frontText: z.string().min(1),
  backText: z.string().min(1),
  language: z.string().min(2).max(5).default("en"),
  imageUrl: z.string().url().optional(),
  isPremium: z.boolean().optional(),
});

const updateFlashcardSchema = createFlashcardSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

export const listAdminFlashcards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, topicId, subjectId, language, search } = listQuerySchema.parse(
      req.query,
    );

    const where: Prisma.FlashcardWhereInput = {};

    if (topicId) {
      where.topic_id = topicId;
    }

    if (subjectId) {
      where.Topic = { is: { subject_id: subjectId } };
    }

    if (language) {
      where.language = { equals: language.toLowerCase(), mode: "insensitive" };
    }

    if (search) {
      const term = search.trim();
      where.OR = [
        { front_text: { contains: term, mode: "insensitive" } },
        { back_text: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, flashcards] = await Promise.all([
      prisma.flashcard.count({ where }),
      prisma.flashcard.findMany({
        where,
        include: {
          Topic: {
            select: {
              id: true,
              topic_name: true,
              Subject: { select: { id: true, subject_name: true } },
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const normalized = flashcards.map((flashcard) => ({
      ...flashcard,
      Topic: flashcard.Topic
        ? {
            id: flashcard.Topic.id,
            name: flashcard.Topic.topic_name,
            subject: flashcard.Topic.Subject
              ? {
                  id: flashcard.Topic.Subject.id,
                  name: flashcard.Topic.Subject.subject_name,
                }
              : null,
          }
        : null,
    }));

    return res.json({
      success: true,
      data: { flashcards: normalized },
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = flashcardIdSchema.parse(req.params);

    const flashcard = await prisma.flashcard.findUnique({
      where: { id },
      include: {
        Topic: {
          select: {
            id: true,
            topic_name: true,
            Subject: { select: { id: true, subject_name: true } },
          },
        },
      },
    });

    if (!flashcard) {
      return res.status(404).json({ success: false, message: "Flashcard not found" });
    }

    return res.json({ success: true, data: { flashcard } });
  } catch (error) {
    next(error);
  }
};

export const createAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createFlashcardSchema.parse(req.body);

    const flashcard = await prisma.flashcard.create({
      data: {
        topic_id: payload.topicId,
        front_text: payload.frontText,
        back_text: payload.backText,
        language: payload.language.toLowerCase(),
        image_url: payload.imageUrl ?? null,
        is_premium: payload.isPremium ?? false,
      },
    });

    await recordAdminAction(req.user?.id, "Flashcard", "CREATE", flashcard.id, flashcard.front_text);

    return res.status(201).json({ success: true, data: { flashcard } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = flashcardIdSchema.parse(req.params);
    const payload = updateFlashcardSchema.parse(req.body);

    const data: Prisma.FlashcardUncheckedUpdateInput = {};
    if (payload.topicId !== undefined) data.topic_id = payload.topicId;
    if (payload.frontText !== undefined) data.front_text = payload.frontText;
    if (payload.backText !== undefined) data.back_text = payload.backText;
    if (payload.language !== undefined) data.language = payload.language.toLowerCase();
    if (payload.imageUrl !== undefined) data.image_url = payload.imageUrl ?? null;
    if (payload.isPremium !== undefined) data.is_premium = payload.isPremium;

    const flashcard = await prisma.flashcard.update({
      where: { id },
      data,
    });

    await recordAdminAction(req.user?.id, "Flashcard", "UPDATE", id, flashcard.front_text);

    return res.json({ success: true, data: { flashcard } });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = flashcardIdSchema.parse(req.params);
    await prisma.flashcard.delete({ where: { id } });

    await recordAdminAction(req.user?.id, "Flashcard", "DELETE", id);

    return res.json({ success: true, message: "Flashcard deleted" });
  } catch (error) {
    next(error);
  }
};
