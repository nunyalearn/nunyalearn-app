import { QuestionAttemptV2, QuizAttemptV2, PracticeTestAttemptV2, TopicMastery, XpTransaction } from "@prisma/client";
import { mapPracticeTestDto, mapQuestionDto, mapQuizDto } from "./dtoMappers";

type AnyQuestion = Record<string, any>;

const coalesce = <T>(...values: Array<T | null | undefined>) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry === null || entry === undefined) {
        return "";
      }
      return String(entry);
    })
    .filter((entry) => entry.length > 0);
};

const parseMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
};

export const mapLearnerQuestionDto = (question: AnyQuestion) => {
  const base = mapQuestionDto(question);
  if (!base) {
    return null;
  }
  const questionId = base.questionId ?? base.id ?? question.id;
  const options =
    Array.isArray(question.options) && question.options.length
      ? question.options
      : Array.isArray(base.options)
        ? base.options
        : toStringArray(question.options);
  return {
    ...base,
    questionId,
    question_id: question.question_id ?? questionId,
    prompt: base.questionText ?? question.questionText,
    prompt_text: base.questionText ?? question.questionText,
    options,
    choices: options,
  };
};

export const mapLearnerQuizDto = (quiz: Record<string, any>) => {
  const base = mapQuizDto(quiz);
  const questions = Array.isArray(quiz.questions)
    ? quiz.questions.map((entry) => {
        const payload = entry.Question ?? entry;
        return mapLearnerQuestionDto({
          ...payload,
          questionId: payload.questionId ?? payload.id,
          topicId: payload.topicId ?? quiz.topicId,
        });
      })
    : undefined;
  const totalQuestions = coalesce(base.questionCount, questions?.length, quiz.questionCount) ?? 0;
  return {
    ...base,
    questions: questions ?? base.questions,
    questions_list: questions ?? base.questions,
    totalQuestions,
    total_questions: totalQuestions,
  };
};

export const mapLearnerPracticeTestDto = (practiceTest: Record<string, any>) => {
  const base = mapPracticeTestDto(practiceTest);
  const questions = Array.isArray(practiceTest.questions)
    ? practiceTest.questions.map((entry) => {
        const payload = entry.Question ?? entry;
        return mapLearnerQuestionDto(payload);
      })
    : undefined;
  const totalQuestions = coalesce(base.questionCount, questions?.length, practiceTest.questionCount) ?? 0;
  return {
    ...base,
    questions: questions ?? base.questions,
    questions_list: questions ?? base.questions,
    totalQuestions,
    total_questions: totalQuestions,
  };
};

export const mapLearnerQuestionAttemptDto = (attempt: QuestionAttemptV2 & { Question?: AnyQuestion | null }) => {
  const questionPayload = attempt.Question ? mapLearnerQuestionDto(attempt.Question) : undefined;
  return {
    questionAttemptId: attempt.id,
    question_attempt_id: attempt.id,
    questionId: attempt.questionId,
    question_id: attempt.questionId,
    userId: attempt.userId,
    user_id: attempt.userId,
    quizAttemptId: attempt.quizAttemptId ?? undefined,
    quiz_attempt_id: attempt.quizAttemptId ?? undefined,
    practiceTestAttemptId: attempt.practiceTestAttemptId ?? undefined,
    practice_test_attempt_id: attempt.practiceTestAttemptId ?? undefined,
    selectedOption: attempt.selectedOption ?? undefined,
    selected_option: attempt.selectedOption ?? undefined,
    selectedOptions: attempt.selectedOptions ?? undefined,
    selected_options: attempt.selectedOptions ?? undefined,
    isCorrect: attempt.isCorrect,
    is_correct: attempt.isCorrect,
    score: attempt.score,
    responseMetadata: attempt.responseMetadata ?? undefined,
    response_metadata: attempt.responseMetadata ?? undefined,
    createdAt: attempt.createdAt,
    created_at: attempt.createdAt,
    question: questionPayload ?? null,
  };
};

export const mapLearnerQuizAttemptDto = (
  attempt: QuizAttemptV2 & { QuestionAttempts?: Array<QuestionAttemptV2 & { Question?: AnyQuestion | null }> },
) => {
  const questions =
    attempt.QuestionAttempts?.map((questionAttempt) => mapLearnerQuestionAttemptDto(questionAttempt)) ?? [];
  const metadata = parseMetadata(attempt.metadata);
  const xpTransactionId =
    metadata && metadata.xpTransactionId !== undefined
      ? Number(metadata.xpTransactionId as number | string) || null
      : null;
  return {
    attemptId: attempt.id,
    attempt_id: attempt.id,
    quizId: attempt.quizId,
    quiz_id: attempt.quizId,
    userId: attempt.userId,
    user_id: attempt.userId,
    status: attempt.status,
    score: attempt.score ?? 0,
    totalQuestions: attempt.totalQuestions ?? questions.length,
    total_questions: attempt.totalQuestions ?? questions.length,
    correctCount: attempt.correctCount ?? 0,
    correct_count: attempt.correctCount ?? 0,
    incorrectCount: attempt.incorrectCount ?? 0,
    incorrect_count: attempt.incorrectCount ?? 0,
    xpAwarded: attempt.xpAwarded ?? 0,
    xp_awarded: attempt.xpAwarded ?? 0,
    durationSeconds: attempt.durationSeconds ?? null,
    duration_seconds: attempt.durationSeconds ?? null,
    startedAt: attempt.startedAt,
    started_at: attempt.startedAt,
    completedAt: attempt.completedAt,
    completed_at: attempt.completedAt,
    xpTransactionId,
    xp_transaction_id: xpTransactionId,
    questions,
  };
};

export const mapLearnerPracticeTestAttemptDto = (
  attempt: PracticeTestAttemptV2 & { QuestionAttempts?: Array<QuestionAttemptV2 & { Question?: AnyQuestion | null }> },
) => {
  const questions =
    attempt.QuestionAttempts?.map((questionAttempt) => mapLearnerQuestionAttemptDto(questionAttempt)) ?? [];
  const metadata = parseMetadata(attempt.metadata);
  const xpTransactionId =
    metadata && metadata.xpTransactionId !== undefined
      ? Number(metadata.xpTransactionId as number | string) || null
      : null;
  return {
    attemptId: attempt.id,
    attempt_id: attempt.id,
    practiceTestId: attempt.practiceTestId,
    practice_test_id: attempt.practiceTestId,
    userId: attempt.userId,
    user_id: attempt.userId,
    status: attempt.status,
    score: attempt.score ?? 0,
    totalQuestions: attempt.totalQuestions ?? questions.length,
    total_questions: attempt.totalQuestions ?? questions.length,
    correctCount: attempt.correctCount ?? 0,
    correct_count: attempt.correctCount ?? 0,
    incorrectCount: attempt.incorrectCount ?? 0,
    incorrect_count: attempt.incorrectCount ?? 0,
    xpAwarded: attempt.xpAwarded ?? 0,
    xp_awarded: attempt.xpAwarded ?? 0,
    durationSeconds: attempt.durationSeconds ?? null,
    duration_seconds: attempt.durationSeconds ?? null,
    startedAt: attempt.startedAt,
    started_at: attempt.startedAt,
    completedAt: attempt.completedAt,
    completed_at: attempt.completedAt,
    xpTransactionId,
    xp_transaction_id: xpTransactionId,
    questions,
  };
};

export const mapTopicMasteryDto = (mastery: TopicMastery & { Topic?: AnyQuestion | null }) => {
  return {
    masteryId: mastery.id,
    mastery_id: mastery.id,
    userId: mastery.userId,
    user_id: mastery.userId,
    topicId: mastery.topicId,
    topic_id: mastery.topicId,
    correctAttempts: mastery.correctAttempts,
    correct_attempts: mastery.correctAttempts,
    totalAttempts: mastery.totalAttempts,
    total_attempts: mastery.totalAttempts,
    accuracy: mastery.accuracy,
    updatedAt: mastery.updatedAt,
    updated_at: mastery.updatedAt,
    topic: mastery.Topic
      ? {
          id: mastery.Topic.id,
          topicName: mastery.Topic.topic_name,
          topic_name: mastery.Topic.topic_name,
          subjectId: mastery.Topic.subject_id,
          subject_id: mastery.Topic.subject_id,
        }
      : undefined,
  };
};

export const mapXpTransactionDto = (transaction: XpTransaction) => ({
  transactionId: transaction.id,
  transaction_id: transaction.id,
  userId: transaction.userId,
  user_id: transaction.userId,
  amount: transaction.amount,
  source: transaction.source ?? null,
  reason: transaction.reason ?? null,
  metadata: transaction.metadata ?? null,
  createdAt: transaction.createdAt,
  created_at: transaction.createdAt,
});
