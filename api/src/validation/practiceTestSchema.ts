import { z } from "zod";

const booleanParam = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"))
  .optional()
  .default(false);

const difficultyMixSchema = z
  .object({
    EASY: z.coerce.number().int().nonnegative().optional(),
    MEDIUM: z.coerce.number().int().nonnegative().optional(),
    HARD: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((mix) => Object.values(mix).some((value) => typeof value === "number"), {
    message: "Provide at least one difficulty allocation",
  });

export const practiceTestIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const practiceTestListQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  includeInactive: booleanParam,
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createPracticeTestSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevelId: z.coerce.number().int().positive().optional(),
  durationMinutes: z.coerce.number().int().positive().max(240).optional(),
  xpReward: z.coerce.number().int().nonnegative().default(0),
  questionCount: z.coerce.number().int().positive().max(200),
  topicIds: z.array(z.coerce.number().int().positive()).min(1),
  difficultyMix: difficultyMixSchema,
});

export const updatePracticeTestSchema = createPracticeTestSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

export const practiceTestStatusSchema = z.object({
  isActive: z.boolean(),
});
