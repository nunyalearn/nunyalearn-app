import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/db";
import { DateRange } from "../../services/analyticsService";
import { generateAttemptsCsv, generateProgressXlsx } from "../../services/exportService";

const attemptsExportSchema = z
  .object({
    subjectId: z.coerce.number().int().positive().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(5000).default(1000),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: "startDate must be before endDate" },
  );

const progressExportSchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  range: z.enum(["7d", "30d", "all"]).default("all"),
});

const recordDataExport = async (userId?: number) => {
  if (!userId) {
    return;
  }

  await prisma.xpHistory.create({
    data: {
      user_id: userId,
      xp_change: 0,
      reason: "data_export",
    },
  });
};

export const exportAttemptsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = attemptsExportSchema.parse(req.query);
    const buffer = await generateAttemptsCsv({
      subjectId: params.subjectId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
    });

    await recordDataExport(req.user?.id);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="attempts.csv"');
    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportProgressXlsx = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = progressExportSchema.parse(req.query);
    const buffer = await generateProgressXlsx({
      subjectId: params.subjectId,
      dateRange: params.range as DateRange,
    });

    await recordDataExport(req.user?.id);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="progress.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};
