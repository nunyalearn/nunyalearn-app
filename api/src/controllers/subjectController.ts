import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";

const createSubjectSchema = z.object({
  subjectName: z.string().min(1),
  gradeLevel: z.string().min(1),
  description: z.string().optional(),
});

const subjectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  q: z.string().optional(),
  grade_level: z.string().optional(),
});

export const getSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = subjectQuerySchema.parse(req.query);
    const { page, limit } = query;
    const searchTerm = query.q?.trim();
    const gradeLevel = query.grade_level?.trim();

    const where: Prisma.SubjectWhereInput = {};

    if (gradeLevel) {
      where.grade_level = {
        equals: gradeLevel,
        mode: "insensitive",
      };
    }

    if (searchTerm) {
      where.OR = [
        {
          subject_name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          topics: {
            some: {
              topic_name: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const [total, subjects] = await Promise.all([
      prisma.subject.count({ where }),
      prisma.subject.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { topics: true } },
        },
      }),
    ]);

    const normalizedSubjects = subjects.map(({ _count, ...subject }) => ({
      ...subject,
      topicCount: _count.topics,
    }));

    return res.json({
      success: true,
      data: { subjects: normalizedSubjects },
      pagination: { page, limit, total },
    });
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
