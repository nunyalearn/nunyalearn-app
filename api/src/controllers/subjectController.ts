import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const createSubjectSchema = z.object({
  subjectName: z.string().min(1),
  gradeLevel: z.string().min(1),
  description: z.string().optional(),
});

export const getSubjects = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { created_at: "desc" },
      include: {
        topics: {
          select: {
            id: true,
            topic_name: true,
            difficulty: true,
          },
        },
      },
    });

    return res.json({ success: true, data: { subjects } });
  } catch (error) {
    next(error);
  }
};

export const createSubject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSubjectSchema.parse(req.body);

    const subject = await prisma.subject.create({
      data: {
        subject_name: payload.subjectName,
        grade_level: payload.gradeLevel,
        description: payload.description ?? null,
      },
    });

    return res.status(201).json({ success: true, data: { subject } });
  } catch (error) {
    next(error);
  }
};
