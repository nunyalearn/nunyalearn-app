import { z } from "zod";

export const gradeLevelSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters long"),
});

export const subjectSchema = z.object({
  gradeLevelId: z.coerce.number().int().positive("gradeLevelId must be a positive integer"),
  name: z.string().trim().min(2, "name must be at least 2 characters long"),
});

export const topicSchema = z.object({
  subjectId: z.coerce.number().int().positive("subjectId must be a positive integer"),
  name: z.string().trim().min(2, "name must be at least 2 characters long"),
});

export type GradeLevelInput = z.infer<typeof gradeLevelSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
