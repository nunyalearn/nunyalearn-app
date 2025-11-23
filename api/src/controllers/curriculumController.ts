import type { GradeLevel, Subject, Topic, Prisma } from "@prisma/client";
import { RequestHandler, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { GradeLevelInput, SubjectInput, TopicInput } from "../validation/curriculumSchema";
import { mapGradeDto, mapGradeLevelDto, mapSubjectDto, mapTopicDto } from "../utils/dtoMappers";

type SubjectWithTopics = Subject & { topics: Topic[] };
type GradeWithRelations = GradeLevel & { subjects: SubjectWithTopics[] };

const subjectInclude = {
  orderBy: { subject_name: "asc" as const },
  include: {
    topics: {
      orderBy: { topic_name: "asc" as const },
    },
  },
};

const gradeInclude = {
  orderBy: { name: "asc" as const },
  include: {
    subjects: subjectInclude,
  },
};

const formatTopic = (topic: Topic) =>
  mapTopicDto({
    ...topic,
    id: topic.id,
    name: topic.topic_name,
    topic_name: topic.topic_name,
    subjectId: topic.subject_id,
    subject_id: topic.subject_id,
  });

const formatSubject = (subject: SubjectWithTopics, includeTopics = false) => {
  const topicList = subject.topics ?? [];
  const base = mapSubjectDto({
    id: subject.id,
    name: subject.subject_name,
    gradeLevelId: subject.grade_level_id,
    topicCount: topicList.length,
    subject_name: subject.subject_name,
    grade_level_id: subject.grade_level_id,
  });

  if (includeTopics) {
    return {
      ...base,
      topics: topicList.map(formatTopic),
    };
  }

  return base;
};

const formatGrade = (grade: GradeWithRelations) => {
  const subjectList = grade.subjects ?? [];
  const topicCount = subjectList.reduce((total, subject) => total + (subject.topics?.length ?? 0), 0);
  return mapGradeLevelDto({
    id: grade.id,
    name: grade.name,
    subjectCount: subjectList.length,
    topicCount,
    subjects: subjectList.map((subject) => formatSubject(subject, true)),
  });
};

const gradeQuerySchema = z.object({
  gradeLevelId: z.coerce.number().int().positive(),
});

const subjectQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const respondBadRequest = (res: Response, message: string) =>
  res.status(400).json({ success: false, message });

const respondNotFound = (res: Response, message: string) =>
  res.status(404).json({ success: false, message });

export const createGradeLevel: RequestHandler<unknown, unknown, GradeLevelInput> = async (
  req,
  res,
  next,
) => {
  try {
    const payload = req.body;

    const duplicate = await prisma.gradeLevel.findFirst({
      where: {
        name: { equals: payload.name, mode: "insensitive" },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Grade level already exists",
        data: null,
      });
    }

    const gradeLevel = await prisma.gradeLevel.create({
      data: {
        name: payload.name,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Grade level created",
      data: { gradeLevel: mapGradeDto(gradeLevel) },
    });
  } catch (error) {
    next(error);
  }
};

export const createSubject: RequestHandler<unknown, unknown, SubjectInput> = async (
  req,
  res,
  next,
) => {
  try {
    const payload = req.body;

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: payload.gradeLevelId },
    });

    if (!gradeLevel) {
      return res.status(400).json({
        success: false,
        message: "Grade level not found",
        data: null,
      });
    }

    const duplicate = await prisma.subject.findFirst({
      where: {
        grade_level_id: gradeLevel.id,
        subject_name: { equals: payload.name, mode: "insensitive" },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Subject already exists for this grade level",
        data: null,
      });
    }

    const subject = await prisma.subject.create({
      data: {
        subject_name: payload.name,
        grade_level_id: gradeLevel.id,
        grade_level: gradeLevel.name,
      },
      include: {
        GradeLevel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Subject created",
      data: { subject: mapSubjectDto(subject) },
    });
  } catch (error) {
    next(error);
  }
};

export const createTopic: RequestHandler<unknown, unknown, TopicInput> = async (
  req,
  res,
  next,
) => {
  try {
    const payload = req.body;

    const subject = await prisma.subject.findUnique({
      where: { id: payload.subjectId },
      include: {
        GradeLevel: true,
      },
    });

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Subject not found",
        data: null,
      });
    }

    const duplicate = await prisma.topic.findFirst({
      where: {
        subject_id: subject.id,
        topic_name: { equals: payload.name, mode: "insensitive" },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Topic already exists for this subject",
        data: null,
      });
    }

    const topic = await prisma.topic.create({
      data: {
        topic_name: payload.name,
        subject_id: subject.id,
      },
      include: {
        Subject: {
          select: {
            id: true,
            subject_name: true,
            grade_level_id: true,
            grade_level: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Topic created",
      data: { topic: mapTopicDto(topic) },
    });
  } catch (error) {
    next(error);
  }
};

export const listGrades: RequestHandler = async (_req, res, next) => {
  try {
    const gradesRaw = await prisma.gradeLevel.findMany(gradeInclude);
    const grades = gradesRaw.map(formatGrade);
    return res.json({ success: true, data: { grades } });
  } catch (error) {
    next(error);
  }
};

export const listSubjects: RequestHandler = async (req, res, next) => {
  try {
    const { gradeLevelId } = gradeQuerySchema.parse(req.query);

    const grade = await prisma.gradeLevel.findUnique({
      where: { id: gradeLevelId },
    });

    if (!grade) {
      return respondNotFound(res, "Grade level not found");
    }

    const subjectsRaw = await prisma.subject.findMany({
      where: { grade_level_id: gradeLevelId },
      ...subjectInclude,
    });

    const subjects = subjectsRaw.map((subject) => formatSubject(subject, true));
    return res.json({ success: true, data: { subjects } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondBadRequest(res, "gradeLevelId must be a positive integer");
    }
    next(error);
  }
};

export const listTopics: RequestHandler = async (req, res, next) => {
  try {
    const { subjectId } = subjectQuerySchema.parse(req.query);

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return respondNotFound(res, "Subject not found");
    }

    const topicsRaw = await prisma.topic.findMany({
      where: { subject_id: subjectId },
      orderBy: { topic_name: "asc" },
    });

    const topics = topicsRaw.map(formatTopic);

    return res.json({ success: true, data: { topics } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondBadRequest(res, "subjectId must be a positive integer");
    }
    next(error);
  }
};

export const getCurriculumTree: RequestHandler = async (_req, res, next) => {
  try {
    const treeRaw = await prisma.gradeLevel.findMany(gradeInclude);
    const tree = treeRaw.map(formatGrade);
    return res.json({ success: true, data: { tree } });
  } catch (error) {
    next(error);
  }
};

export const deleteGrade: RequestHandler = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const grade = await prisma.gradeLevel.findUnique({
      where: { id },
      include: {
        subjects: {
          include: {
            topics: true,
          },
        },
      },
    });

    if (!grade) {
      return respondNotFound(res, "Grade level not found");
    }

    const subjectIds = grade.subjects.map((subject) => subject.id);

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (subjectIds.length) {
      operations.push(
        prisma.topic.deleteMany({
          where: { subject_id: { in: subjectIds } },
        }),
      );
      operations.push(
        prisma.subject.deleteMany({
          where: { id: { in: subjectIds } },
        }),
      );
    }
    operations.push(prisma.gradeLevel.delete({ where: { id } }));

    await prisma.$transaction(operations);

    return res.json({ success: true, data: null, message: "Grade deleted" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondBadRequest(res, "Invalid grade id");
    }
    next(error);
  }
};

export const deleteSubject: RequestHandler = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        topics: true,
      },
    });

    if (!subject) {
      return respondNotFound(res, "Subject not found");
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (subject.topics.length) {
      operations.push(prisma.topic.deleteMany({ where: { subject_id: id } }));
    }
    operations.push(prisma.subject.delete({ where: { id } }));

    await prisma.$transaction(operations);

    return res.json({ success: true, data: null, message: "Subject deleted" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondBadRequest(res, "Invalid subject id");
    }
    next(error);
  }
};

export const deleteTopic: RequestHandler = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    const topic = await prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      return respondNotFound(res, "Topic not found");
    }

    await prisma.topic.delete({ where: { id } });
    return res.json({ success: true, data: null, message: "Topic deleted" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respondBadRequest(res, "Invalid topic id");
    }
    next(error);
  }
};
