import { Difficulty, QuestionStatus, QuestionType } from "@prisma/client";
import { z } from "zod";

const collapseInlineWhitespace = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const stringOrArraySchema = z.union([z.array(z.string()), z.string()]);

const languageSchema = z
  .string()
  .max(5)
  .refine((value) => value.length === 0 || value.length >= 2, {
    message: "Language must be between 2 and 5 characters",
  });

const normalizeList = (value?: string[] | string | null) => {
  if (Array.isArray(value)) {
    const normalizedList = value
      .map((item) => {
        if (item === undefined || item === null) {
          return "";
        }
        return collapseInlineWhitespace(item.toString());
      })
      .filter((item) => item.length);
    return normalizedList.length ? normalizedList : undefined;
  }

  if (typeof value === "string") {
    const normalizedList = value
      .split(/[,|;]/)
      .map((item) => collapseInlineWhitespace(item))
      .filter((item) => item.length);
    return normalizedList.length ? normalizedList : undefined;
  }

  return undefined;
};

const normalizeLanguage = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toUpperCase();
};

const normalizeScalar = (value?: string | null) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = collapseInlineWhitespace(value);
  return normalized.length ? normalized : undefined;
};

export const questionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  topicId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .optional(),
  type: z.nativeEnum(QuestionType).optional(),
  language: languageSchema.optional(),
  search: z.string().optional(),
});

export const baseQuestionSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  questionText: z.string().min(5, "Question text must be at least 5 characters"),
  questionType: z.nativeEnum(QuestionType).default(QuestionType.MULTIPLE_CHOICE),
  options: stringOrArraySchema.optional(),
  correctOption: z
    .string()
    .optional(),
  correctAnswers: stringOrArraySchema.optional(),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.EASY),
  language: languageSchema.optional(),
  imageUrl: z.string().url().optional(),
  explanation: z.string().optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  isActive: z.boolean().optional(),
});

export const createQuestionSchema = baseQuestionSchema;

export const updateQuestionSchema = baseQuestionSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be supplied for update",
  });

export const importQuestionRowSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  questionText: z.string().min(5),
  questionType: z.nativeEnum(QuestionType).default(QuestionType.MULTIPLE_CHOICE),
  options: stringOrArraySchema.optional(),
  correctOption: z.string().optional(),
  correctAnswers: stringOrArraySchema.optional(),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.EASY),
  language: z.string().min(2).max(5).optional(),
  explanation: z.string().optional(),
});

export type QuestionCreateInput = z.infer<typeof createQuestionSchema>;
export type QuestionUpdateInput = z.infer<typeof updateQuestionSchema>;

export type NormalizedQuestionInput = {
  topicId?: number;
  subjectId?: number;
  gradeId?: number;
  questionText?: string;
  questionType?: QuestionType;
  options?: string[];
  correctOption?: string;
  correctAnswers?: string[];
  difficulty?: Difficulty;
  language?: string;
  imageUrl?: string;
  explanation?: string;
  status?: QuestionStatus;
  isActive?: boolean;
};

export const normalizeQuestionPayload = <T extends QuestionCreateInput | QuestionUpdateInput>(
  payload: T,
): NormalizedQuestionInput => {
  const normalized: NormalizedQuestionInput = {};

  if (payload.topicId !== undefined) {
    normalized.topicId = payload.topicId;
  }

  if (payload.subjectId !== undefined) {
    normalized.subjectId = payload.subjectId;
  }

  if (payload.gradeId !== undefined) {
    normalized.gradeId = payload.gradeId;
  }

  if (payload.questionText !== undefined) {
    const questionText = normalizeScalar(payload.questionText);
    if (questionText !== undefined) {
      normalized.questionText = questionText;
    }
  }

  if (payload.questionType !== undefined) {
    normalized.questionType = payload.questionType;
  }

  const options = normalizeList(payload.options);
  if (options !== undefined) {
    normalized.options = options;
  }

  if (payload.correctOption !== undefined) {
    const option = normalizeScalar(payload.correctOption);
    if (option !== undefined) {
      normalized.correctOption = option;
    }
  }

  const answers = normalizeList(payload.correctAnswers);
  if (answers !== undefined) {
    normalized.correctAnswers = answers;
  }

  if (payload.difficulty !== undefined) {
    normalized.difficulty = payload.difficulty;
  }

  if (payload.language !== undefined) {
    const language = normalizeLanguage(payload.language);
    normalized.language = language ?? "EN";
  }

  if (payload.imageUrl !== undefined) {
    normalized.imageUrl = payload.imageUrl;
  }

  if (payload.explanation !== undefined) {
    normalized.explanation = payload.explanation;
  }

  if (payload.status !== undefined) {
    normalized.status = payload.status;
  }

  if (payload.isActive !== undefined) {
    normalized.isActive = payload.isActive;
  }

  return normalized;
};

const normalizedQuestionSchema = z
  .object({
    questionType: z.nativeEnum(QuestionType),
    options: z.array(z.string().min(1)).optional(),
    correctOption: z.string().min(1).optional(),
    correctAnswers: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.questionType === QuestionType.MULTIPLE_CHOICE) {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice questions require at least two options",
          path: ["options"],
        });
      }
      if (!data.correctOption) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice questions require correctOption",
          path: ["correctOption"],
        });
      } else if (!data.options?.some((option) => option === data.correctOption)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctOption must be one of the provided options",
          path: ["correctOption"],
        });
      }
    }

    if (data.questionType === QuestionType.TRUE_FALSE) {
      const validAnswers = ["TRUE", "FALSE"];
      if (!data.correctOption) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "True/False questions require correctOption",
          path: ["correctOption"],
        });
      } else if (!validAnswers.includes(data.correctOption.toUpperCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "correctOption must be TRUE or FALSE for True/False questions",
          path: ["correctOption"],
        });
      }
    }

    if (
      data.questionType === QuestionType.FILL_IN_THE_BLANK ||
      data.questionType === QuestionType.SHORT_ANSWER
    ) {
      if (!data.correctAnswers || !data.correctAnswers.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one correct answer is required for this question type",
          path: ["correctAnswers"],
        });
      }
    }
  });

export const validateNormalizedQuestion = (
  payload: Pick<
    NormalizedQuestionInput,
    "questionType" | "options" | "correctOption" | "correctAnswers"
  >,
) => normalizedQuestionSchema.parse(payload);
