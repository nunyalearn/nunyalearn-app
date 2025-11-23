import { Prisma, QuestionType } from "@prisma/client";
import prisma from "../../config/db";
import {
  mapLearnerPracticeTestAttemptDto,
  mapLearnerQuestionAttemptDto,
  mapLearnerQuizAttemptDto,
} from "../../utils/learnerDtoMappers";
import { getPracticeTestQuestions } from "./practiceTestV2Service";
import { getQuizQuestions } from "./quizV2Service";
import { recordPracticeTestXp, recordQuizAttemptXp } from "./xpTransactionService";
import { recordPracticeTestStreak, recordQuizStreak } from "./streakService";
import { recordTopicMastery } from "./masteryService";

type ResponsePayload = {
  questionId: number;
  selectedOption?: string | undefined;
  selectedOptions?: string[] | undefined;
};

type SubmitPayload = {
  responses: ResponsePayload[];
  durationSeconds?: number | undefined;
  timeSpentSeconds?: number | undefined;
  metadata?: Record<string, any> | undefined;
};

const buildMetadata = (
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  const merged = { ...(base ?? {}), ...extra };
  return Object.keys(merged).length ? (merged as Prisma.InputJsonValue) : Prisma.DbNull;
};

const toStringArray = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
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
  }
  return [];
};

const normalizeOption = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const evaluateResponse = (
  question: {
    id: number;
    questionType: QuestionType;
    correctOption?: string | null;
    correctAnswers?: Prisma.JsonValue | null;
  },
  payload?: ResponsePayload,
) => {
  const correctOption = question.correctOption ? normalizeOption(question.correctOption) : undefined;
  const correctAnswers = toStringArray(question.correctAnswers);

  if (!payload) {
    return { isCorrect: false, selectedOption: null, selectedOptions: null };
  }

  if (question.questionType === QuestionType.MULTIPLE_CHOICE || question.questionType === QuestionType.TRUE_FALSE) {
    const selected = normalizeOption(payload.selectedOption ?? payload.selectedOptions?.[0]);
    return {
      isCorrect: correctOption ? selected === normalizeOption(correctOption) : false,
      selectedOption: payload.selectedOption ?? null,
      selectedOptions: payload.selectedOptions ?? null,
    };
  }

  if (question.questionType === QuestionType.FILL_IN_THE_BLANK || question.questionType === QuestionType.SHORT_ANSWER) {
    const answers = payload.selectedOptions?.length ? payload.selectedOptions : payload.selectedOption ? [payload.selectedOption] : [];
    const normalized = answers.map((entry) => normalizeOption(entry));
    const isCorrect =
      normalized.length > 0 &&
      normalized.every((candidate) =>
        correctAnswers.some((answer) => normalizeOption(answer) === candidate || candidate.includes(normalizeOption(answer))),
      );
    return {
      isCorrect,
      selectedOption: payload.selectedOption ?? null,
      selectedOptions: answers,
    };
  }

  const selectedList = payload.selectedOptions ?? (payload.selectedOption ? [payload.selectedOption] : []);
  const normalizedSelection = selectedList.map((entry) => normalizeOption(entry));
  const normalizedCorrect = correctAnswers.map((answer) => normalizeOption(answer));
  const isCorrect =
    normalizedCorrect.length > 0 &&
    normalizedCorrect.length === normalizedSelection.length &&
    normalizedCorrect.every((answer) => normalizedSelection.includes(answer));

  return {
    isCorrect,
    selectedOption: payload.selectedOption ?? null,
    selectedOptions: payload.selectedOptions ?? null,
  };
};

export const startQuizAttempt = async (userId: number, quizId: number) => {
  const context = await getQuizQuestions(quizId);
  if (!context) {
    throw new Error("Quiz not found or inactive");
  }
  return prisma.quizAttemptV2.create({
    data: {
      quizId,
      userId,
      totalQuestions: context.questions.length,
      status: "in_progress",
    },
  });
};

export const startPracticeTestAttempt = async (userId: number, practiceTestId: number) => {
  const context = await getPracticeTestQuestions(practiceTestId);
  if (!context) {
    throw new Error("Practice test not found or inactive");
  }
  return prisma.practiceTestAttemptV2.create({
    data: {
      practiceTestId,
      userId,
      totalQuestions: context.questions.length,
      status: "in_progress",
    },
  });
};

const persistQuestionAttempts = async (params: {
  attemptId: number;
  userId: number;
  rows: Array<{
    questionId: number;
    isCorrect: boolean;
    selectedOption: string | null;
    selectedOptions: string[] | null;
    quizAttemptId?: number;
    practiceTestAttemptId?: number;
    topicId?: number | null;
  }>;
  isQuiz: boolean;
  applyMastery?: boolean;
}) => {
  const { attemptId, rows, userId, isQuiz, applyMastery = true } = params;
  const createRows: Prisma.QuestionAttemptV2CreateManyInput[] = rows.map((row) => ({
    questionId: row.questionId,
    isCorrect: row.isCorrect,
    selectedOption: row.selectedOption,
    selectedOptions: row.selectedOptions ?? Prisma.DbNull,
    userId,
    quizAttemptId: isQuiz ? attemptId : null,
    practiceTestAttemptId: isQuiz ? null : attemptId,
    score: row.isCorrect ? 1 : 0,
    responseMetadata: row.topicId ? ({ topicId: row.topicId } as Prisma.InputJsonValue) : Prisma.DbNull,
  }));

  await prisma.questionAttemptV2.createMany({
    data: createRows,
  });

  if (applyMastery) {
    await Promise.all(
      rows.map((row) => {
        if (!row.topicId) {
          return Promise.resolve();
        }
        return recordTopicMastery({ userId, topicId: row.topicId, isCorrect: row.isCorrect });
      }),
    );
  }
};

export const submitQuizAttempt = async (
  userId: number,
  attemptId: number,
  payload: SubmitPayload,
): Promise<{ attempt: ReturnType<typeof mapLearnerQuizAttemptDto> | null; message?: string }> => {
  const attempt = await prisma.quizAttemptV2.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    throw new Error("Attempt not found");
  }
  if (attempt.status === "completed") {
    return { attempt: await getQuizAttempt(attemptId, userId) };
  }

  const context = await getQuizQuestions(attempt.quizId);
  if (!context) {
    throw new Error("Quiz not available");
  }

  const validQuestionIds = new Set(context.questions.map((entry) => entry.questionId));
  payload.responses.forEach((response) => {
    if (!validQuestionIds.has(response.questionId)) {
      const error = new Error("Invalid question submission: question does not belong to this quiz.");
      (error as { statusCode?: number }).statusCode = 400;
      throw error;
    }
  });

  const submittedTime = payload.timeSpentSeconds ?? payload.durationSeconds ?? null;
  const timeLimitSeconds =
    (context.quiz as { timeLimitSeconds?: number | null })?.timeLimitSeconds ??
    (context.quiz as { timeLimit?: number | null })?.timeLimit ??
    null;
  const timeLimitExceeded =
    typeof timeLimitSeconds === "number" &&
    timeLimitSeconds > 0 &&
    typeof submittedTime === "number" &&
    submittedTime > timeLimitSeconds;

  const responseMap = new Map(payload.responses.map((entry) => [entry.questionId, entry]));
  let rows: Array<{
    questionId: number;
    isCorrect: boolean;
    selectedOption: string | null;
    selectedOptions: string[] | null;
    topicId?: number | null;
  }> = [];
  let correct = 0;

  context.questions.forEach((entry) => {
    const questionId = entry.questionId;
    const question = entry.Question;
    const response = responseMap.get(questionId);
    const evaluation = evaluateResponse(
      {
        id: questionId,
        questionType: question?.questionType ?? QuestionType.MULTIPLE_CHOICE,
        correctOption: question?.correctOption ?? null,
        correctAnswers: question?.correctAnswers ?? null,
      },
      response,
    );
    if (evaluation.isCorrect) {
      correct += 1;
    }
    rows.push({
      questionId,
      isCorrect: evaluation.isCorrect,
      selectedOption: evaluation.selectedOption,
      selectedOptions: evaluation.selectedOptions,
      topicId: question?.Topic?.id,
    });
  });

  if (timeLimitExceeded) {
    rows = rows.map((row) => ({
      ...row,
      isCorrect: false,
    }));
    correct = 0;
  }

  await prisma.questionAttemptV2.deleteMany({
    where: { quizAttemptId: attemptId },
  });
  await persistQuestionAttempts({
    attemptId,
    userId,
    rows,
    isQuiz: true,
    applyMastery: !timeLimitExceeded,
  });

  const totalQuestions = rows.length || attempt.totalQuestions || 0;
  const scorePercentage = totalQuestions === 0 ? 0 : Math.round((correct / totalQuestions) * 100);
  let xpAwarded = 0;
  let xpTransactionId: number | null = null;
  if (!timeLimitExceeded) {
    const xpResult = await recordQuizAttemptXp({
      userId,
      quizId: attempt.quizId,
      difficulty: context.quiz.difficulty,
      scorePercentage,
    });
    xpAwarded = xpResult.xpAwarded;
    xpTransactionId = xpResult.transactionId ?? null;
    await recordQuizStreak(userId);
  }

  const durationSeconds = payload.durationSeconds ?? null;
  await prisma.quizAttemptV2.update({
    where: { id: attemptId },
    data: {
      status: "completed",
      score: timeLimitExceeded ? 0 : scorePercentage,
      correctCount: correct,
      incorrectCount: totalQuestions - correct,
      xpAwarded,
      completedAt: new Date(),
      durationSeconds,
      metadata: buildMetadata(payload.metadata, {
        xpTransactionId,
        timeLimitExceeded,
        timeLimitSeconds: timeLimitSeconds ?? null,
        timeSpentSeconds: submittedTime ?? null,
      }),
    },
  });

  const response: { attempt: ReturnType<typeof mapLearnerQuizAttemptDto> | null; message?: string } = {
    attempt: await getQuizAttempt(attemptId, userId),
  };
  if (timeLimitExceeded) {
    response.message = "Time limit exceeded";
  }
  return response;
};

export const submitPracticeTestAttempt = async (
  userId: number,
  attemptId: number,
  payload: SubmitPayload,
): Promise<{
  attempt: ReturnType<typeof mapLearnerPracticeTestAttemptDto> | null;
  message?: string;
}> => {
  const attempt = await prisma.practiceTestAttemptV2.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    throw new Error("Attempt not found");
  }
  if (attempt.status === "completed") {
    return { attempt: await getPracticeTestAttempt(attemptId, userId) };
  }

  const context = await getPracticeTestQuestions(attempt.practiceTestId);
  if (!context) {
    throw new Error("Practice test not available");
  }

  const validQuestionIds = new Set(context.questions.map((entry) => entry.questionId));
  payload.responses.forEach((response) => {
    if (!validQuestionIds.has(response.questionId)) {
      const error = new Error("Invalid question submission: question does not belong to this quiz.");
      (error as { statusCode?: number }).statusCode = 400;
      throw error;
    }
  });

  const submittedTime = payload.timeSpentSeconds ?? payload.durationSeconds ?? null;
  const timeLimitSeconds =
    (context.practiceTest as { timeLimitSeconds?: number | null })?.timeLimitSeconds ??
    (context.practiceTest as { timeLimit?: number | null })?.timeLimit ??
    (context.practiceTest.durationMinutes ? context.practiceTest.durationMinutes * 60 : null);
  const timeLimitExceeded =
    typeof timeLimitSeconds === "number" &&
    timeLimitSeconds > 0 &&
    typeof submittedTime === "number" &&
    submittedTime > timeLimitSeconds;

  const responseMap = new Map(payload.responses.map((entry) => [entry.questionId, entry]));
  let rows: Array<{
    questionId: number;
    isCorrect: boolean;
    selectedOption: string | null;
    selectedOptions: string[] | null;
    topicId?: number | null;
  }> = [];
  let correct = 0;

  context.questions.forEach((entry) => {
    const questionId = entry.questionId;
    const question = entry.Question;
    const response = responseMap.get(questionId);
    const evaluation = evaluateResponse(
      {
        id: questionId,
        questionType: question?.questionType ?? QuestionType.MULTIPLE_CHOICE,
        correctOption: question?.correctOption ?? null,
        correctAnswers: question?.correctAnswers ?? null,
      },
      response,
    );
    if (evaluation.isCorrect) {
      correct += 1;
    }
    rows.push({
      questionId,
      isCorrect: evaluation.isCorrect,
      selectedOption: evaluation.selectedOption,
      selectedOptions: evaluation.selectedOptions,
      topicId: question?.Topic?.id,
    });
  });

  if (timeLimitExceeded) {
    rows = rows.map((row) => ({ ...row, isCorrect: false }));
    correct = 0;
  }

  await prisma.questionAttemptV2.deleteMany({
    where: { practiceTestAttemptId: attemptId },
  });
  await persistQuestionAttempts({
    attemptId,
    userId,
    rows,
    isQuiz: false,
    applyMastery: !timeLimitExceeded,
  });

  const totalQuestions = rows.length || attempt.totalQuestions || 0;
  const scorePercentage = totalQuestions === 0 ? 0 : Math.round((correct / totalQuestions) * 100);
  const baseXpReward = context.practiceTest.xpReward ?? 0;
  let xpAwarded = timeLimitExceeded ? 0 : baseXpReward;
  let xpTransactionId: number | null = null;
  if (!timeLimitExceeded && xpAwarded > 0) {
    const xpResult = await recordPracticeTestXp({
      userId,
      practiceTestId: attempt.practiceTestId,
      xpReward: xpAwarded,
    });
    xpTransactionId = xpResult.transactionId ?? null;
    await recordPracticeTestStreak(userId);
  }

  await prisma.practiceTestAttemptV2.update({
    where: { id: attemptId },
    data: {
      status: "completed",
      score: timeLimitExceeded ? 0 : scorePercentage,
      correctCount: correct,
      incorrectCount: totalQuestions - correct,
      xpAwarded,
      completedAt: new Date(),
      durationSeconds: payload.durationSeconds ?? null,
      metadata: buildMetadata(payload.metadata, {
        xpTransactionId,
        timeLimitExceeded,
        timeLimitSeconds: timeLimitSeconds ?? null,
        timeSpentSeconds: submittedTime ?? null,
      }),
    },
  });

  const response: {
    attempt: ReturnType<typeof mapLearnerPracticeTestAttemptDto> | null;
    message?: string;
  } = {
    attempt: await getPracticeTestAttempt(attemptId, userId),
  };
  if (timeLimitExceeded) {
    response.message = "Time limit exceeded";
  }
  return response;
};

export const getQuizAttempt = async (attemptId: number, userId: number) => {
  const attempt = await prisma.quizAttemptV2.findFirst({
    where: { id: attemptId, userId },
    include: {
      QuestionAttempts: {
        include: {
          Question: true,
        },
      },
    },
  });
  if (!attempt) {
    return null;
  }
  return mapLearnerQuizAttemptDto(attempt);
};

export const getPracticeTestAttempt = async (attemptId: number, userId: number) => {
  const attempt = await prisma.practiceTestAttemptV2.findFirst({
    where: { id: attemptId, userId },
    include: {
      QuestionAttempts: {
        include: {
          Question: true,
        },
      },
    },
  });
  if (!attempt) {
    return null;
  }
  return mapLearnerPracticeTestAttemptDto(attempt);
};

export const listAttempts = async (userId: number, limit = 20) => {
  const [quizAttempts, practiceAttempts] = await Promise.all([
    prisma.quizAttemptV2.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        QuestionAttempts: {
          include: {
            Question: true,
          },
        },
      },
    }),
    prisma.practiceTestAttemptV2.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        QuestionAttempts: {
          include: {
            Question: true,
          },
        },
      },
    }),
  ]);

  return {
    quizAttempts: quizAttempts.map((attempt) => mapLearnerQuizAttemptDto(attempt)),
    practiceTestAttempts: practiceAttempts.map((attempt) => mapLearnerPracticeTestAttemptDto(attempt)),
  };
};
