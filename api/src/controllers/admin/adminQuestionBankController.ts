import { Difficulty, Prisma, QuestionStatus, QuestionType } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import {
  NormalizedQuestionInput,
  createQuestionSchema,
  importQuestionRowSchema,
  normalizeQuestionPayload,
  questionIdSchema,
  questionListQuerySchema,
  updateQuestionSchema,
  validateNormalizedQuestion,
} from "../../validation/questionSchema";
import { mapQuestionDto } from "../../utils/dtoMappers";

const exportQuerySchema = questionListQuerySchema
  .omit({ page: true, limit: true })
  .extend({
    format: z.enum(["csv", "xlsx"]).default("xlsx"),
  });

const booleanQueryParam = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.undefined()])
  .transform((value) => {
    if (value === undefined) {
      return false;
    }
    return value === true || value === "true";
  });

const templateQuerySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
  includeSamples: booleanQueryParam,
});

const questionTemplateHeaders = [
  "questionText",
  "questionType",
  "options",
  "correctOption",
  "correctAnswers",
  "topicId",
  "difficulty",
  "language",
  "explanation",
];

const topicMappingHeaders = ["gradeName", "subjectName", "topicName", "topicId"] as const;

type TemplateRow = Record<(typeof questionTemplateHeaders)[number], string>;

const sampleTemplateRows: TemplateRow[] = [
  {
    questionText: "Which planet is known as the Red Planet?",
    questionType: QuestionType.MULTIPLE_CHOICE,
    options: "Mercury|Venus|Earth|Mars",
    correctOption: "Mars",
    correctAnswers: "",
    topicId: "1001",
    difficulty: Difficulty.EASY,
    language: "EN",
    explanation: "Mars appears red because of iron oxide on its surface.",
  },
  {
    questionText: "Water boils at 100°C at sea level.",
    questionType: QuestionType.TRUE_FALSE,
    options: "",
    correctOption: "TRUE",
    correctAnswers: "",
    topicId: "1002",
    difficulty: Difficulty.EASY,
    language: "EN",
    explanation: "Standard boiling point of water is 100°C.",
  },
  {
    questionText: "_______ is the process where liquid water changes into vapor.",
    questionType: QuestionType.FILL_IN_THE_BLANK,
    options: "",
    correctOption: "",
    correctAnswers: "evaporation",
    topicId: "1003",
    difficulty: Difficulty.MEDIUM,
    language: "EN",
    explanation: "Evaporation turns liquid water into gas.",
  },
  {
    questionText: "Name the force that keeps the planets in orbit around the sun.",
    questionType: QuestionType.SHORT_ANSWER,
    options: "",
    correctOption: "",
    correctAnswers: "gravity|gravitational force",
    topicId: "1004",
    difficulty: Difficulty.MEDIUM,
    language: "EN",
    explanation: "Gravity pulls the planets toward the sun.",
  },
];

const templateRowToArray = (row: TemplateRow) =>
  questionTemplateHeaders.map((header) => row[header] ?? "");

const questionInclude = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
      Subject: {
        select: {
          id: true,
          subject_name: true,
          GradeLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.QuestionBankInclude;

type QuestionWithRelations = Prisma.QuestionBankGetPayload<{
  include: typeof questionInclude;
}> & {
  _count?: {
    quizQuestions?: number | null;
    practiceTestQuestions?: number | null;
  } | null;
};

type QuestionUsageSummary = {
  quizzes: number;
  practiceTests: number;
};

type QuestionDraft = {
  topicId: number;
  subjectId?: number;
  gradeId?: number;
  questionText: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  language: string;
  status: QuestionStatus;
  isActive: boolean;
  options?: string[];
  correctOption?: string;
  correctAnswers?: string[];
  explanation?: string | null;
  imageUrl?: string | null;
};

class QuestionValidationError extends Error {}

const isRelationTableMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";

export const getQuestionUsage = async (questionId: number): Promise<QuestionUsageSummary> => {
  try {
    const [quizzes, practiceTests] = await Promise.all([
      prisma.quizQuestion.count({ where: { questionId } }),
      prisma.practiceTestQuestion.count({ where: { questionId } }),
    ]);

    return { quizzes, practiceTests };
  } catch (error) {
    if (isRelationTableMissingError(error)) {
      return { quizzes: 0, practiceTests: 0 };
    }
    throw error;
  }
};

const resolveQuestionUsage = (
  question: QuestionWithRelations,
  override?: QuestionUsageSummary,
): QuestionUsageSummary => {
  if (override) {
    return override;
  }

  if (question._count) {
    return {
      quizzes: question._count.quizQuestions ?? 0,
      practiceTests: question._count.practiceTestQuestions ?? 0,
    };
  }

  return { quizzes: 0, practiceTests: 0 };
};

const toStringArray = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      if (entry === null || entry === undefined) {
        return "";
      }
      return String(entry).trim();
    })
    .filter((entry) => entry.length > 0);
};

const buildQuestionResponse = (question: QuestionWithRelations, usage?: QuestionUsageSummary) =>
  mapQuestionDto({
    id: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    difficulty: question.difficulty,
    language: question.language,
    topicId: question.topicId,
    topicName: question.Topic?.topic_name ?? null,
    subjectId: question.Topic?.Subject?.id ?? null,
    subjectName: question.Topic?.Subject?.subject_name ?? null,
    gradeId: question.Topic?.Subject?.GradeLevel?.id ?? null,
    gradeName: question.Topic?.Subject?.GradeLevel?.name ?? null,
    status: question.status,
    isActive: question.isActive,
    options: toStringArray(question.options) ?? [],
    correctOption: question.correctOption,
    correctAnswers: toStringArray(question.correctAnswers) ?? [],
    explanation: question.explanation,
    imageUrl: question.imageUrl,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    usage: resolveQuestionUsage(question, usage),
  });

type SubjectBreakdownEntry = {
  subjectId: number;
  subjectName: string;
  count: number;
};

const cloneWhereWithoutIsActive = (where: Prisma.QuestionBankWhereInput) => {
  const cloned: Prisma.QuestionBankWhereInput = { ...where };
  if ("isActive" in cloned) {
    delete cloned.isActive;
  }
  return cloned;
};

const buildSubjectBreakdown = async (
  where: Prisma.QuestionBankWhereInput,
): Promise<SubjectBreakdownEntry[]> => {
  const groupedByTopic = await prisma.questionBank.groupBy({
    where,
    by: ["topicId"],
    _count: { _all: true },
  });

  if (!groupedByTopic.length) {
    return [];
  }

  const topics = await prisma.topic.findMany({
    where: { id: { in: groupedByTopic.map((entry) => entry.topicId) } },
    select: {
      id: true,
      Subject: {
        select: {
          id: true,
          subject_name: true,
        },
      },
    },
  });

  const topicToSubject = new Map<number, { subjectId: number; subjectName: string }>();
  topics.forEach((topic) => {
    if (!topic.Subject) {
      return;
    }
    topicToSubject.set(topic.id, {
      subjectId: topic.Subject.id,
      subjectName: topic.Subject.subject_name,
    });
  });

  const subjectCounts = new Map<number, SubjectBreakdownEntry>();

  groupedByTopic.forEach((group) => {
    const subject = topicToSubject.get(group.topicId);
    if (!subject) {
      return;
    }
    const current = subjectCounts.get(subject.subjectId) ?? {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      count: 0,
    };
    current.count += group._count._all;
    subjectCounts.set(subject.subjectId, current);
  });

  return Array.from(subjectCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

const getQuestionAnalytics = async (where: Prisma.QuestionBankWhereInput) => {
  const [activeCount, difficultyGroups, subjects] = await Promise.all([
    prisma.questionBank.count({
      where: { ...cloneWhereWithoutIsActive(where), isActive: true },
    }),
    prisma.questionBank.groupBy({
      where,
      by: ["difficulty"],
      _count: { _all: true },
    }),
    buildSubjectBreakdown(where),
  ]);

  const difficulty: Record<Difficulty, number> = {
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 0,
  };

  difficultyGroups.forEach((entry) => {
    difficulty[entry.difficulty] = entry._count._all;
  });

  return {
    active: activeCount,
    difficulty,
    subjects,
  };
};

const buildQuestionWhere = (
  filters: Omit<z.infer<typeof questionListQuerySchema>, "page" | "limit">,
): Prisma.QuestionBankWhereInput => {
  const where: Prisma.QuestionBankWhereInput = {};
  const topicWhere: Prisma.TopicWhereInput = {};

  if (filters.topicId) {
    where.topicId = filters.topicId;
  }

  if (filters.subjectId) {
    topicWhere.subject_id = filters.subjectId;
  }

  if (filters.gradeId) {
    topicWhere.Subject = {
      is: {
        grade_level_id: filters.gradeId,
      },
    };
  }

  if (Object.keys(topicWhere).length) {
    where.Topic = { is: topicWhere };
  }

  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (typeof filters.isActive === "boolean") {
    where.isActive = filters.isActive;
  }

  if (filters.type) {
    where.questionType = filters.type;
  }

  if (filters.language) {
    where.language = filters.language.toUpperCase();
  }

  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [
      { questionText: { contains: term, mode: "insensitive" } },
      { explanation: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
};

const serializeJsonField = (value?: string[]) =>
  value !== undefined ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;

const cleanImportValue = (value: string) =>
  value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const sanitizeImportCells = (row: Record<string, string>) => {
  const sanitized: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (!key) {
      return;
    }
    const normalizedKey = key.trim();
    if (!normalizedKey.length) {
      return;
    }
    const textValue = typeof value === "string" ? value : String(value ?? "");
    sanitized[normalizedKey] = cleanImportValue(textValue);
  });
  return sanitized;
};

const resolveImportField = (...candidates: (string | undefined)[]) => {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
};

const ensureQuestionStructure = (
  payload: NormalizedQuestionInput,
  existing?: QuestionWithRelations,
): QuestionDraft => {
  const currentOptions = existing ? toStringArray(existing.options) : undefined;
  const currentAnswers = existing ? toStringArray(existing.correctAnswers) : undefined;

  const questionType = payload.questionType ?? existing?.questionType ?? QuestionType.MULTIPLE_CHOICE;
  const baseOptions =
    payload.options ??
    currentOptions ??
    (questionType === QuestionType.TRUE_FALSE ? ["True", "False"] : undefined);
  const baseCorrectOption =
    payload.correctOption ??
    existing?.correctOption ??
    (questionType === QuestionType.TRUE_FALSE ? "TRUE" : undefined);
  const baseCorrectAnswers = payload.correctAnswers ?? currentAnswers;

  const normalizedCorrectOption =
    questionType === QuestionType.FILL_IN_THE_BLANK || questionType === QuestionType.SHORT_ANSWER
      ? undefined
      : questionType === QuestionType.TRUE_FALSE
        ? baseCorrectOption?.toUpperCase()
        : baseCorrectOption;

  const normalizedCorrectAnswers =
    questionType === QuestionType.FILL_IN_THE_BLANK || questionType === QuestionType.SHORT_ANSWER
      ? baseCorrectAnswers
      : undefined;

  const draft: QuestionDraft = {
    topicId: payload.topicId ?? existing?.topicId ?? 0,
    questionText: payload.questionText ?? existing?.questionText ?? "",
    questionType,
    difficulty: payload.difficulty ?? existing?.difficulty ?? Difficulty.EASY,
    language: (payload.language ?? existing?.language ?? "EN").toUpperCase(),
    explanation:
      payload.explanation !== undefined ? payload.explanation : existing?.explanation ?? null,
    imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : existing?.imageUrl ?? null,
    status: payload.status ?? existing?.status ?? QuestionStatus.ACTIVE,
    isActive: payload.isActive ?? existing?.isActive ?? true,
  };

  if (payload.subjectId !== undefined) {
    draft.subjectId = payload.subjectId;
  }

  if (payload.gradeId !== undefined) {
    draft.gradeId = payload.gradeId;
  }

  if (baseOptions !== undefined) {
    draft.options = baseOptions;
  }

  if (normalizedCorrectOption !== undefined) {
    draft.correctOption = normalizedCorrectOption;
  }

  if (normalizedCorrectAnswers !== undefined) {
    draft.correctAnswers = normalizedCorrectAnswers;
  }

  if (!draft.topicId) {
    throw new QuestionValidationError("Topic is required");
  }

  if (!draft.questionText?.length) {
    throw new QuestionValidationError("Question text is required");
  }

  const validationPayload: NormalizedQuestionInput = {
    questionType: draft.questionType,
  };
  if (draft.options !== undefined) {
    validationPayload.options = draft.options;
  }
  if (draft.correctOption !== undefined) {
    validationPayload.correctOption = draft.correctOption;
  }
  if (draft.correctAnswers !== undefined) {
    validationPayload.correctAnswers = draft.correctAnswers;
  }

  validateNormalizedQuestion(validationPayload);

  return draft;
};

const assertTopicHierarchy = async (params: {
  topicId: number;
  subjectId?: number;
  gradeId?: number;
}) => {
  const { topicId, subjectId, gradeId } = params;
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      subject_id: true,
      Subject: {
        select: {
          id: true,
          grade_level_id: true,
        },
      },
    },
  });

  if (!topic) {
    throw new QuestionValidationError("Topic not found");
  }

  if (subjectId && topic.subject_id !== subjectId) {
    throw new QuestionValidationError("Topic does not belong to the selected subject");
  }

  if (gradeId) {
    const topicGradeId = topic.Subject?.grade_level_id ?? null;
    if (!topicGradeId || topicGradeId !== gradeId) {
      throw new QuestionValidationError("Topic does not belong to the selected grade");
    }
  }

  return topic;
};

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, ...filters } = questionListQuerySchema.parse(req.query);
    const where = buildQuestionWhere(filters);

    const [total, questions, analytics] = await Promise.all([
      prisma.questionBank.count({ where }),
      prisma.questionBank.findMany({
        where,
        include: questionInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      getQuestionAnalytics(where),
    ]);

    return res.json({
      success: true,
      data: {
        questions: questions.map((question) => buildQuestionResponse(question)),
        analytics: {
          total,
          active: analytics.active,
          difficulty: analytics.difficulty,
          subjects: analytics.subjects,
        },
      },
      pagination: { page, limit, total },
    });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const getQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const question = await prisma.questionBank.findUnique({
      where: { id },
      include: questionInclude,
    });

    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const usage = await getQuestionUsage(id);
    return res.json({
      success: true,
      data: { question: buildQuestionResponse(question, usage) },
    });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createQuestionSchema.parse(req.body);
    const normalized = normalizeQuestionPayload(parsed);
    const draft = ensureQuestionStructure({
      ...normalized,
      topicId: parsed.topicId,
      questionText: normalized.questionText ?? parsed.questionText,
    });

    const hierarchyPayload: { topicId: number; subjectId?: number; gradeId?: number } = {
      topicId: draft.topicId,
    };
    if (parsed.subjectId !== undefined) {
      hierarchyPayload.subjectId = parsed.subjectId;
    }
    if (parsed.gradeId !== undefined) {
      hierarchyPayload.gradeId = parsed.gradeId;
    }
    await assertTopicHierarchy(hierarchyPayload);

    const createdQuestion = await prisma.questionBank.create({
      data: {
        topicId: draft.topicId,
        questionText: draft.questionText,
        questionType: draft.questionType,
        options: serializeJsonField(draft.options),
        correctOption: draft.correctOption ?? null,
        correctAnswers: serializeJsonField(draft.correctAnswers),
        difficulty: draft.difficulty,
        language: draft.language,
        explanation: draft.explanation ?? null,
        imageUrl: draft.imageUrl ?? null,
        isActive: draft.isActive,
        status: draft.status,
        createdById: req.user?.id ?? null,
      },
    });

    await recordAdminAction(
      req.user?.id,
      "QuestionBank",
      "CREATE",
      createdQuestion.id,
      createdQuestion.questionText,
    );

    const question = await prisma.questionBank.findUnique({
      where: { id: createdQuestion.id },
      include: questionInclude,
    });

    if (!question) {
      throw new QuestionValidationError("Question could not be loaded after creation");
    }

    return res.status(201).json({ success: true, data: { question: buildQuestionResponse(question) } });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const payload = updateQuestionSchema.parse(req.body);
    const normalized = normalizeQuestionPayload(payload);

    const existing = await prisma.questionBank.findUnique({
      where: { id },
      include: questionInclude,
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    const draft = ensureQuestionStructure(normalized, existing);

    const updatedQuestion = await prisma.questionBank.update({
      where: { id },
      data: {
        topicId: draft.topicId,
        questionText: draft.questionText,
        questionType: draft.questionType,
        options: serializeJsonField(draft.options),
        correctOption: draft.correctOption ?? null,
        correctAnswers: serializeJsonField(draft.correctAnswers),
        difficulty: draft.difficulty,
        language: draft.language,
        explanation: draft.explanation ?? null,
        imageUrl: draft.imageUrl ?? null,
        isActive: draft.isActive,
        status: draft.status,
      },
    });

    await recordAdminAction(req.user?.id, "QuestionBank", "UPDATE", id, draft.questionText);

    const question = await prisma.questionBank.findUnique({
      where: { id },
      include: questionInclude,
    });

    if (!question) {
      throw new QuestionValidationError("Question could not be loaded after update");
    }

    return res.json({ success: true, data: { question: buildQuestionResponse(question) } });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const deactivateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const question = await prisma.questionBank.update({
      where: { id },
      data: { isActive: false, status: QuestionStatus.INACTIVE },
    });

    await recordAdminAction(req.user?.id, "QuestionBank", "DEACTIVATE", id, question.questionText);

    return res.json({
      success: true,
      data: null,
      message: "Question deactivated",
    });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const reactivateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = questionIdSchema.parse(req.params);
    const question = await prisma.questionBank.update({
      where: { id },
      data: { isActive: true, status: QuestionStatus.ACTIVE },
    });

    await recordAdminAction(req.user?.id, "QuestionBank", "REACTIVATE", id, question.questionText);

    return res.json({
      success: true,
      data: null,
      message: "Question reactivated",
    });
  } catch (error) {
    next(error);
  }
};

const parseCsvBuffer = (buffer: Buffer) => {
  const parsed = Papa.parse(buffer.toString("utf-8"), {
    header: true,
    skipEmptyLines: true,
  });

  return (parsed.data as Record<string, string>[]) ?? [];
};

const parseXlsxBuffer = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return [];
  }

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.value;
    const header = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (header.length) {
      headers[colNumber - 1] = header;
    }
  });

  const rows: Record<string, string>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }
      const cell = row.getCell(index + 1);
      const cellValue = cell.value;
      record[header] = typeof cellValue === "string" ? cellValue : String(cellValue ?? "");
    });
    rows.push(record);
  });

  return rows;
};

const normalizeImportRow = (rawRow: Record<string, string>) => {
  const row = sanitizeImportCells(rawRow);
  const optionKeys = ["optionA", "optionB", "optionC", "optionD", "optionE", "optionF"];
  const inlineOptions = optionKeys
    .map((key) => resolveImportField(row[key], row[key.toLowerCase()]))
    .filter((value): value is string => Boolean(value));
  const optionsValue =
    resolveImportField(row.options) ??
    (inlineOptions.length ? inlineOptions.join("|") : undefined);
  const questionTypeValue =
    resolveImportField(row.questionType, row.question_type) ?? QuestionType.MULTIPLE_CHOICE;
  const difficultyValue = resolveImportField(row.difficulty) ?? Difficulty.EASY;

  return {
    topicId: resolveImportField(row.topicId, row.topic_id),
    subjectId: resolveImportField(row.subjectId, row.subject_id),
    gradeId: resolveImportField(row.gradeId, row.grade_id),
    questionText: resolveImportField(row.questionText, row.question, row.question_text),
    questionType: questionTypeValue.toUpperCase().replace(/-/g, "_"),
    options: optionsValue,
    correctOption: resolveImportField(row.correctOption, row.correct_option),
    correctAnswers: resolveImportField(row.correctAnswers, row.correct_answers),
    difficulty: difficultyValue.toUpperCase(),
    language: resolveImportField(row.language),
    explanation: resolveImportField(row.explanation, row.rationale),
  };
};

export const importQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Upload a CSV or XLSX file" });
    }

    const extension = req.file.originalname.split(".").pop()?.toLowerCase();
    const isXlsx = extension === "xlsx";

    const rawRows = isXlsx
      ? await parseXlsxBuffer(req.file.buffer)
      : parseCsvBuffer(req.file.buffer);

    if (!rawRows.length) {
      return res.status(400).json({ success: false, message: "Import file is empty" });
    }

    let failed = 0;
    const parsedRows: QuestionDraft[] = [];

    rawRows.forEach((row) => {
      const normalizedRow = normalizeImportRow(row);
      const parsed = importQuestionRowSchema.safeParse(normalizedRow);
      if (!parsed.success) {
        failed += 1;
        return;
      }

      try {
        const normalized = normalizeQuestionPayload(parsed.data);
        const draft = ensureQuestionStructure({
          ...normalized,
          topicId: parsed.data.topicId,
          questionText: normalized.questionText ?? parsed.data.questionText,
        });
        if (parsed.data.subjectId !== undefined) {
          draft.subjectId = parsed.data.subjectId;
        }
        if (parsed.data.gradeId !== undefined) {
          draft.gradeId = parsed.data.gradeId;
        }
        parsedRows.push(draft);
      } catch {
        failed += 1;
      }
    });

    if (!parsedRows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows detected after validation",
        data: { imported: 0, skipped: 0, failed },
      });
    }

    const topicIds = Array.from(new Set(parsedRows.map((row) => row.topicId)));
    const topics = await prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: {
        id: true,
        subject_id: true,
        Subject: {
          select: { grade_level_id: true },
        },
      },
    });
    const topicMeta = new Map<
      number,
      { subjectId: number | null; gradeLevelId: number | null }
    >();
    topics.forEach((topic) => {
      topicMeta.set(topic.id, {
        subjectId: topic.subject_id,
        gradeLevelId: topic.Subject?.grade_level_id ?? null,
      });
    });

    const deduped: typeof parsedRows = [];
    const seen = new Set<string>();
    let skipped = 0;

    parsedRows.forEach((row) => {
      const meta = topicMeta.get(row.topicId!);
      if (!meta) {
        failed += 1;
        return;
      }

      if (row.subjectId && meta.subjectId !== row.subjectId) {
        failed += 1;
        return;
      }

      if (row.gradeId) {
        if (!meta.gradeLevelId || meta.gradeLevelId !== row.gradeId) {
          failed += 1;
          return;
        }
      }

      const key = `${row.topicId}|${row.questionText?.toLowerCase()}`;
      if (seen.has(key)) {
        skipped += 1;
        return;
      }

      seen.add(key);
      deduped.push(row);
    });

    if (!deduped.length) {
      return res.json({
        success: true,
        message: "Import completed",
        data: { imported: 0, skipped, failed },
      });
    }

    const duplicates = await prisma.questionBank.findMany({
      where: {
        OR: deduped.map((row) => ({
          topicId: row.topicId!,
          questionText: { equals: row.questionText!, mode: "insensitive" },
        })),
      },
      select: { topicId: true, questionText: true },
    });

    const duplicateKeys = new Set(
      duplicates.map((record) => `${record.topicId}|${record.questionText.toLowerCase()}`),
    );

    const rowsToInsert = deduped.filter((row) => {
      const key = `${row.topicId}|${row.questionText?.toLowerCase()}`;
      if (duplicateKeys.has(key)) {
        skipped += 1;
        return false;
      }
      return true;
    });

    if (!rowsToInsert.length) {
      return res.json({
        success: true,
        message: "Import completed",
        data: { imported: 0, skipped, failed },
      });
    }

    const createResult = await prisma.questionBank.createMany({
      data: rowsToInsert.map((row) => ({
        topicId: row.topicId!,
        questionText: row.questionText!,
        questionType: row.questionType,
        options: serializeJsonField(row.options),
        correctOption: row.correctOption ?? null,
        correctAnswers: serializeJsonField(row.correctAnswers),
        difficulty: row.difficulty,
        language: row.language,
        explanation: row.explanation ?? null,
        imageUrl: row.imageUrl ?? null,
        isActive: row.isActive,
        status: row.status,
        createdById: req.user?.id ?? null,
      })),
    });

    await recordAdminAction(
      req.user?.id,
      "QuestionBank",
      "IMPORT",
      undefined,
      `Imported ${createResult.count} questions`,
    );

    return res.json({
      success: true,
      message: "Question import completed",
      data: { imported: createResult.count, skipped, failed },
    });
  } catch (error) {
    next(error);
  }
};

const exportColumns = [
  { header: "ID", key: "id", width: 10 },
  { header: "Question", key: "question", width: 60 },
  { header: "Type", key: "type", width: 20 },
  { header: "Difficulty", key: "difficulty", width: 14 },
  { header: "Language", key: "language", width: 12 },
  { header: "Topic ID", key: "topicId", width: 12 },
  { header: "Topic", key: "topic", width: 32 },
  { header: "Subject", key: "subject", width: 32 },
  { header: "Active", key: "active", width: 10 },
  { header: "Status", key: "status", width: 14 },
  { header: "Options", key: "options", width: 40 },
  { header: "Correct Option", key: "correctOption", width: 18 },
  { header: "Correct Answers", key: "correctAnswers", width: 28 },
  { header: "Explanation", key: "explanation", width: 50 },
];

const exportHeaders = exportColumns.map((column) => column.header);

const formatQuestionRow = (question: QuestionWithRelations) => ({
  id: question.id,
  question: question.questionText,
  type: question.questionType,
  difficulty: question.difficulty,
  language: question.language,
  topicId: question.topicId,
  topic: question.Topic?.topic_name ?? "",
  subject: question.Topic?.Subject?.subject_name ?? "",
  active: question.isActive ? "Yes" : "No",
  status: question.status,
  options: (toStringArray(question.options) ?? []).join(" | "),
  correctOption: question.correctOption ?? "",
  correctAnswers: (toStringArray(question.correctAnswers) ?? []).join(" | "),
  explanation: question.explanation ?? "",
});

export const exportQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = exportQuerySchema.parse(req.query);
    const where = buildQuestionWhere(params);

    const questions = await prisma.questionBank.findMany({
      where,
      include: questionInclude,
      orderBy: { updatedAt: "desc" },
    });

    const rows = questions.map(formatQuestionRow);

    if (params.format === "csv") {
      const csv = Papa.unparse({
        fields: exportHeaders,
        data: rows.map((row) =>
          exportColumns.map((column) => row[column.key as keyof typeof row] ?? ""),
        ),
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="question-bank.csv"');
      return res.status(200).send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("QuestionBank");
    sheet.columns = exportColumns;
    rows.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="question-bank.xlsx"');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};

export const downloadQuestionTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { format, includeSamples } = templateQuerySchema.parse(req.query);
    const rows = includeSamples ? sampleTemplateRows : [];

    if (format === "csv") {
      const csv = Papa.unparse({
        fields: questionTemplateHeaders,
        data: rows.map((row) => templateRowToArray(row)),
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="question-bank-template${includeSamples ? "-sample" : ""}.csv"`,
      );
      return res.status(200).send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    sheet.addRow(questionTemplateHeaders);
    rows.forEach((row) => sheet.addRow(templateRowToArray(row)));

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="question-bank-template${includeSamples ? "-sample" : ""}.xlsx"`,
    );
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};

export const downloadTopicMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format } = templateQuerySchema.parse(req.query);
    const topics = await prisma.topic.findMany({
      select: {
        id: true,
        topic_name: true,
        Subject: {
          select: {
            subject_name: true,
            GradeLevel: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const rows = topics
      .map((topic) => ({
        gradeName: topic.Subject?.GradeLevel?.name ?? "",
        subjectName: topic.Subject?.subject_name ?? "",
        topicName: topic.topic_name,
        topicId: topic.id,
      }))
      .sort((a, b) => {
        if (a.gradeName !== b.gradeName) {
          return a.gradeName.localeCompare(b.gradeName);
        }
        if (a.subjectName !== b.subjectName) {
          return a.subjectName.localeCompare(b.subjectName);
        }
        return a.topicName.localeCompare(b.topicName);
      });

    if (format === "csv") {
      const csv = Papa.unparse({
        fields: [...topicMappingHeaders],
        data: rows.map((row) =>
          topicMappingHeaders.map((header) => String(row[header] ?? "")),
        ),
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="question-topic-mapping.csv"',
      );
      return res.status(200).send(csv);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("TopicMapping");
    sheet.addRow([...topicMappingHeaders]);
    rows.forEach((row) => {
      sheet.addRow(topicMappingHeaders.map((header) => row[header]));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="question-topic-mapping.xlsx"',
    );
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
};
