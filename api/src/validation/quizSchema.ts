import { Difficulty } from "@prisma/client";
import { z } from "zod";

const booleanParam = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"))
  .optional()
  .default(false);

const questionIdArray = z.array(z.coerce.number().int().positive()).min(1);

export const quizIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const quizListQuerySchema = z.object({
  topicId: z.coerce.number().int().positive(),
  includeInactive: booleanParam,
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createQuizSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.MEDIUM),
  questionIds: questionIdArray,
});

export const updateQuizSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(500).optional(),
    difficulty: z.nativeEnum(Difficulty).optional(),
    questionIds: questionIdArray.optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required",
  });

export const quizStatusSchema = z.object({
  isActive: z.boolean(),
});
