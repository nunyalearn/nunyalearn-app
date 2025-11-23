import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import path from "path";
import { z } from "zod";
import prisma from "../../config/db";
import { recordAdminAction } from "../../services/auditService";
import { mapFlashcardDto } from "../../utils/dtoMappers";

interface FlashcardPayload {
  topicId: number;
  question?: string;
  frontText?: string;
  answer?: string;
  backText?: string;
  language?: string;
  imageUrl?: string;
  isPremium?: boolean;
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  topicId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeId: z.coerce.number().int().positive().optional(),
  language: z.string().min(2).max(5).optional(),
  search: z.string().optional(),
});

const flashcardIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const baseFlashcardSchema = z
  .object({
    topicId: z.coerce.number().int().positive().optional(),
    question: z.string().min(3, "Question must be at least 3 characters").optional(),
    frontText: z.string().min(3).optional(),
    answer: z.string().min(1).optional(),
    backText: z.string().min(1).optional(),
    language: z.string().min(2).max(5).optional(),
    imageUrl: z.string().url().optional(),
    isPremium: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.question && !data.frontText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question"],
        message: "Question is required",
      });
    }
    if (!data.answer && !data.backText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answer"],
        message: "Answer is required",
      });
    }
  });

const createFlashcardSchema = z.object({
  ...baseFlashcardSchema.shape,
  topicId: z.coerce.number().int().positive(),
});

const updateFlashcardSchema = baseFlashcardSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field is required" });

const importRowSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(1),
  topicId: z.coerce.number().int().positive(),
  language: z.string().min(2).max(5).default("en"),
});

const flashcardInclude = {
  Topic: {
    select: {
      id: true,
      topic_name: true,
      Subject: {
        select: {
          id: true,
          subject_name: true,
          grade_level_id: true,
          GradeLevel: { select: { id: true, name: true } },
        },
      },
    },
  },
};

const normalizeQuestion = (payload: { question?: string; frontText?: string } = {}) =>
  (payload.question ?? payload.frontText ?? "").trim();

const normalizeAnswer = (payload: { answer?: string; backText?: string } = {}) =>
  (payload.answer ?? payload.backText ?? "").trim();

export const listAdminFlashcards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, topicId, subjectId, gradeId, language, search } = listQuerySchema.parse(
      req.query,
    );

    const where: Prisma.FlashcardWhereInput = {};
    const topicFilter: Prisma.TopicWhereInput = {};

    if (topicId) {
      where.topic_id = topicId;
    }

    if (subjectId) {
      topicFilter.subject_id = subjectId;
    }

    if (gradeId) {
      topicFilter.Subject = { grade_level_id: gradeId };
    }

    if (Object.keys(topicFilter).length > 0) {
      where.Topic = { is: topicFilter };
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
        include: flashcardInclude,
        orderBy: { front_text: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      success: true,
      data: flashcards.map((flashcard) => mapFlashcardDto(flashcard)),
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
      include: flashcardInclude,
    });

    if (!flashcard) {
      return res.status(404).json({ success: false, message: "Flashcard not found" });
    }

    return res.json({
      success: true,
      data: { flashcard: mapFlashcardDto(flashcard) },
    });
  } catch (error) {
    next(error);
  }
};

export const createAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createFlashcardSchema.parse(req.body) as FlashcardPayload;
    const question = normalizeQuestion(payload);
    const answer = normalizeAnswer(payload);
    const language = (payload.language ?? "en").toLowerCase();

    const topic = await prisma.topic.findUnique({ where: { id: payload.topicId } });
    if (!topic) {
      return res.status(400).json({ success: false, message: "Topic not found" });
    }

    const duplicate = await prisma.flashcard.findFirst({
      where: {
        topic_id: payload.topicId,
        front_text: { equals: question, mode: "insensitive" },
      },
    });

    if (duplicate) {
      return res
        .status(400)
        .json({ success: false, message: "Flashcard with this question already exists for the topic" });
    }

    const flashcard = await prisma.flashcard.create({
      data: {
        topic_id: payload.topicId,
        front_text: question,
        back_text: answer,
        language,
        image_url: payload.imageUrl ?? null,
        is_premium: payload.isPremium ?? false,
      },
      include: flashcardInclude,
    });

    await recordAdminAction(req.user?.id, "Flashcard", "CREATE", flashcard.id, flashcard.front_text);

    return res.status(201).json({
      success: true,
      data: { flashcard: mapFlashcardDto(flashcard) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = flashcardIdSchema.parse(req.params);
    const payload = updateFlashcardSchema.parse(req.body) as FlashcardPayload;

    const existing = await prisma.flashcard.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Flashcard not found" });
    }

    const topicId = payload.topicId ?? existing.topic_id;
    const question = payload.question || payload.frontText ? normalizeQuestion(payload) : existing.front_text;
    const answer = payload.answer || payload.backText ? normalizeAnswer(payload) : existing.back_text;
    const language = payload.language ? payload.language.toLowerCase() : existing.language;

    if (payload.topicId !== undefined) {
      const topic = await prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic) {
        return res.status(400).json({ success: false, message: "Topic not found" });
      }
    }

    const duplicate = await prisma.flashcard.findFirst({
      where: {
        topic_id: topicId,
        front_text: { equals: question, mode: "insensitive" },
        id: { not: id },
      },
    });

    if (duplicate) {
      return res
        .status(400)
        .json({ success: false, message: "Flashcard with this question already exists for the topic" });
    }

    const flashcard = await prisma.flashcard.update({
      where: { id },
      data: {
        topic_id: topicId,
        front_text: question,
        back_text: answer,
        language,
        image_url: payload.imageUrl ?? existing.image_url,
        is_premium: payload.isPremium ?? existing.is_premium,
      },
      include: flashcardInclude,
    });

    await recordAdminAction(req.user?.id, "Flashcard", "UPDATE", id, flashcard.front_text);

    return res.json({
      success: true,
      data: { flashcard: mapFlashcardDto(flashcard) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminFlashcard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = flashcardIdSchema.parse(req.params);
    const flashcard = await prisma.flashcard.findUnique({ where: { id } });
    if (!flashcard) {
      return res.status(404).json({ success: false, message: "Flashcard not found" });
    }

    await prisma.flashcard.delete({ where: { id } });

    await recordAdminAction(req.user?.id, "Flashcard", "DELETE", id);

    return res.json({
      success: true,
      data: null,
      message: "Flashcard deleted",
    });
  } catch (error) {
    next(error);
  }
};

const parseCsv = (buffer: Buffer) => {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data ?? [];
};

const parseXlsx = async (buffer: ArrayBuffer) => {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = Buffer.from(new Uint8Array(buffer));
  await workbook.xlsx.load(workbookBuffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const rows: Record<string, string>[] = [];

  if (!sheet) {
    return rows;
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").toString();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      record[headers[colNumber - 1] ?? `col_${colNumber}`] = String(cell.value ?? "").trim();
    });
    if (Object.values(record).some((value) => Boolean(value?.length))) {
      rows.push(record);
    }
  });

  return rows;
};

export const importAdminFlashcards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const buffer = req.file.buffer;
    const arrayBuffer = Uint8Array.from(buffer).buffer;
    let rawRows: Record<string, string>[] = [];

    if (extension === ".xlsx" || extension === ".xls") {
      rawRows = await parseXlsx(arrayBuffer);
    } else {
      rawRows = parseCsv(buffer);
    }

    if (!rawRows.length) {
      return res.status(400).json({ success: false, message: "No rows detected in file" });
    }

    let failed = 0;
    let skipped = 0;

    const parsedRows: Array<z.infer<typeof importRowSchema>> = [];

    rawRows.forEach((row) => {
      const normalized = {
        question: row.question ?? row.frontText ?? row.front_text,
        answer: row.answer ?? row.backText ?? row.back_text,
        topicId: row.topicId ?? row.topic_id,
        language: row.language ?? row.lang ?? "en",
      };

      const result = importRowSchema.safeParse(normalized);
      if (!result.success) {
        failed += 1;
        return;
      }
      parsedRows.push(result.data);
    });

    if (!parsedRows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows found. Please verify the template headers.",
        data: { imported: 0, skipped, failed },
      });
    }

    const topicIds = Array.from(new Set(parsedRows.map((row) => row.topicId)));
    const topics = await prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: { id: true },
    });
    const validTopicIds = new Set(topics.map((topic) => topic.id));

    const filteredRows = parsedRows.filter((row) => {
      if (!validTopicIds.has(row.topicId)) {
        failed += 1;
        return false;
      }
      return true;
    });

    const seen = new Set<string>();
    const dedupedRows: typeof filteredRows = [];

    filteredRows.forEach((row) => {
      const key = `${row.topicId}|${row.question.toLowerCase()}`;
      if (seen.has(key)) {
        skipped += 1;
        return;
      }
      seen.add(key);
      dedupedRows.push(row);
    });

    if (!dedupedRows.length) {
      return res.json({
        success: true,
        message: "Import completed",
        data: { imported: 0, skipped, failed },
      });
    }

    const duplicates = await prisma.flashcard.findMany({
      where: {
        OR: dedupedRows.map((row) => ({
          topic_id: row.topicId,
          front_text: { equals: row.question, mode: "insensitive" },
        })),
      },
      select: { topic_id: true, front_text: true },
    });

    const duplicateKeys = new Set(
      duplicates.map((dup) => `${dup.topic_id}|${dup.front_text.toLowerCase()}`),
    );

    const rowsToInsert = dedupedRows.filter((row) => {
      const key = `${row.topicId}|${row.question.toLowerCase()}`;
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

    const createResult = await prisma.flashcard.createMany({
      data: rowsToInsert.map((row) => ({
        topic_id: row.topicId,
        front_text: row.question,
        back_text: row.answer,
        language: row.language.toLowerCase(),
      })),
    });

    await recordAdminAction(req.user?.id, "Flashcard", "IMPORT", undefined, undefined);

    return res.json({
      success: true,
      data: {
        imported: createResult.count,
        skipped,
        failed,
      },
    });
  } catch (error) {
    next(error);
  }
};
