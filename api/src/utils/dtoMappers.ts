type Nullable<T> = T | null | undefined;

const coalesce = <T>(...values: Nullable<T>[]): T | undefined => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const normalizeDifficultyValue = (value?: string | null) => {
  if (!value) return undefined;
  return value === "medium" ? "med" : value;
};

export const mapGradeDto = <T extends Record<string, any>>(grade?: T | null) => {
  if (!grade) {
    return grade ?? null;
  }

  const gradeId = grade.gradeId ?? grade.grade_id ?? grade.id;
  const name =
    grade.gradeLevelName ??
    grade.grade_level_name ??
    grade.grade_level ??
    grade.name ??
    null;
  const orderIndex = coalesce(grade.orderIndex, grade.order_index);
  const isActive = grade.isActive ?? grade.is_active ?? true;

  return {
    ...grade,
    gradeId,
    grade_id: grade.grade_id ?? gradeId,
    gradeLevelName: name ?? undefined,
    grade_level_name: name ?? undefined,
    orderIndex,
    order_index: orderIndex,
    isActive,
    is_active: isActive,
  };
};

export const mapGradeLevelDto = <T extends Record<string, any>>(grade?: T | null) => {
  if (!grade) {
    return grade ?? null;
  }

  const mapped = mapGradeDto(grade);
  if (!mapped) {
    return null;
  }

  return {
    ...mapped,
    gradeLevelId: mapped.gradeLevelId ?? mapped.grade_level_id ?? mapped.gradeId,
    gradeName: mapped.gradeName ?? mapped.grade_level_name ?? mapped.gradeLevelName,
  };
};

export const mapSubjectDto = <T extends Record<string, any>>(subject?: T | null) => {
  if (!subject) {
    return subject ?? null;
  }

  const subjectId = subject.subjectId ?? subject.id ?? subject.subject_id;
  const subjectName =
    subject.subjectName ??
    subject.subject_name ??
    subject.name ??
    subject.title ??
    null;
  const description = coalesce(subject.description, subject.subject_description);
  const gradeLevelId =
    subject.gradeLevelId ??
    subject.grade_level_id ??
    subject.GradeLevel?.id ??
    subject.grade?.id ??
    null;
  const isActive =
    subject.isActive ?? subject.is_active ?? subject.isArchived ? false : true;

  return {
    ...subject,
    subjectId,
    subject_id: subject.subject_id ?? subjectId,
    subjectName: subjectName ?? undefined,
    subject_name: subject.subject_name ?? subjectName ?? undefined,
    description,
    gradeLevelId,
    grade_level_id: subject.grade_level_id ?? gradeLevelId ?? undefined,
    gradeLevelName:
      subject.gradeLevelName ??
      subject.grade_level ??
      subject.GradeLevel?.name ??
      undefined,
    gradeLevel: subject.gradeLevel ?? mapGradeDto(subject.GradeLevel) ?? subject.gradeLevel,
    isActive,
    is_active: subject.is_active ?? isActive,
    topicCount: subject.topicCount ?? subject.TopicCount ?? subject._count?.topics,
  };
};

export const mapTopicDto = <T extends Record<string, any>>(topic?: T | null) => {
  if (!topic) {
    return topic ?? null;
  }

  const topicId = topic.topicId ?? topic.id ?? topic.topic_id;
  const topicName = topic.topicName ?? topic.topic_name ?? topic.name ?? null;
  const difficulty =
    topic.difficulty ??
    normalizeDifficultyValue(topic.topic_difficulty ?? topic.difficulty_level);
  const isActive =
    topic.isActive ?? topic.is_active ?? topic.isArchived ? false : true;

  return {
    ...topic,
    topicId,
    topic_id: topic.topic_id ?? topicId,
    topicName: topicName ?? undefined,
    topic_name: topic.topic_name ?? topicName ?? undefined,
    difficulty,
    isActive,
    is_active: topic.is_active ?? isActive,
    subjectId:
      topic.subjectId ??
      topic.subject_id ??
      topic.Subject?.id ??
      topic.subject?.id,
    gradeLevelId:
      topic.gradeLevelId ??
      topic.grade_level_id ??
      topic.Subject?.grade_level_id ??
      topic.Subject?.GradeLevel?.id,
    Subject: topic.Subject ? mapSubjectDto(topic.Subject) : topic.Subject,
  };
};

export const mapQuestionDto = <T extends Record<string, any>>(question: T) => {
  return {
    ...question,
    questionId: question.questionId ?? question.id,
    topicId: coalesce(question.topicId, question.topic_id, question.Topic?.id),
    topicName:
      question.topicName ??
      question.topic_name ??
      question.Topic?.topic_name ??
      question.Topic?.name,
    subjectId:
      question.subjectId ??
      question.subject_id ??
      question.Topic?.Subject?.id,
    subjectName:
      question.subjectName ??
      question.subject_name ??
      question.Topic?.Subject?.subject_name,
    gradeId:
      question.gradeId ??
      question.grade_id ??
      question.Topic?.Subject?.GradeLevel?.id,
    gradeName:
      question.gradeName ??
      question.grade_name ??
      question.Topic?.Subject?.GradeLevel?.name,
  };
};

export const mapQuizDto = <T extends Record<string, any>>(quiz: T) => {
  if (!quiz) {
    return quiz ?? null;
  }

  const quizId = quiz.quizId ?? quiz.id;
  const topicId = quiz.topicId ?? quiz.topic_id ?? quiz.Topic?.id ?? null;
  const topicName = quiz.topicName ?? quiz.topic_name ?? quiz.Topic?.topic_name ?? null;
  const title = quiz.title ?? quiz.quiz_title ?? null;
  const description = quiz.description ?? quiz.quiz_description ?? null;
  const difficulty = quiz.difficulty ?? quiz.quiz_difficulty ?? null;
  const isActive = quiz.isActive ?? quiz.is_active ?? true;
  const createdAt = quiz.createdAt ?? quiz.created_at ?? null;
  const updatedAt = quiz.updatedAt ?? quiz.updated_at ?? null;
  const questionCount = quiz.questionCount ?? quiz.questions?.length ?? 0;
  const questions = Array.isArray(quiz.questions)
    ? quiz.questions.map((entry) => mapQuestionDto(entry))
    : quiz.questions;

  return {
    ...quiz,
    quizId,
    id: quiz.id ?? quizId,
    topicId,
    topic_id: quiz.topic_id ?? topicId ?? undefined,
    topicName,
    topic_name: quiz.topic_name ?? topicName ?? undefined,
    title,
    description,
    difficulty,
    isActive,
    is_active: quiz.is_active ?? isActive,
    createdAt,
    created_at: quiz.created_at ?? createdAt ?? undefined,
    updatedAt,
    updated_at: quiz.updated_at ?? updatedAt ?? undefined,
    questionCount,
    question_count: quiz.question_count ?? questionCount ?? undefined,
    questions,
  };
};

export const mapPracticeTestDto = <T extends Record<string, any>>(test: T) => {
  if (!test) {
    return test ?? null;
  }

  const practiceTestId = test.practiceTestId ?? test.id;
  const subjectId =
    test.subjectId ??
    test.subject_id ??
    test.Subject?.id ??
    test.subject?.id ??
    null;
  const subjectName =
    test.subjectName ??
    test.subject?.name ??
    test.Subject?.subject_name ??
    null;
  const gradeLevelId =
    test.gradeLevelId ??
    test.grade_level_id ??
    test.GradeLevel?.id ??
    test.gradeLevel?.id ??
    null;
  const gradeLevelName =
    test.gradeLevelName ??
    test.grade_level_name ??
    test.GradeLevel?.name ??
    test.gradeLevel?.name ??
    null;
  const title = test.title ?? null;
  const description = test.description ?? null;
  const durationMinutes = test.durationMinutes ?? test.duration_minutes ?? null;
  const xpReward = test.xpReward ?? test.xp_reward ?? 0;
  const questionCount = test.questionCount ?? test.question_count ?? test.questions?.length ?? 0;
  const isActive = test.isActive ?? test.is_active ?? true;
  const difficultyMix = test.difficultyMix ?? test.difficulty_mix ?? {};
  const topicIds = test.topicIds ?? test.topic_ids ?? [];
  const topics = test.topics ?? test.topic_list ?? [];
  const createdAt = test.createdAt ?? test.created_at ?? null;
  const updatedAt = test.updatedAt ?? test.updated_at ?? null;
  const gradeLevel = test.gradeLevel ?? (test.GradeLevel ? mapGradeDto(test.GradeLevel) : null);
  const subject = test.subject ?? (test.Subject ? mapSubjectDto(test.Subject) : null);
  const questions = Array.isArray(test.questions)
    ? test.questions.map((entry) => mapQuestionDto(entry))
    : test.questions;

  return {
    ...test,
    practiceTestId,
    id: test.id ?? practiceTestId,
    title,
    description,
    subjectId,
    subject_id: test.subject_id ?? subjectId ?? undefined,
    subjectName,
    subject_name: test.subject_name ?? subjectName ?? undefined,
    subject,
    gradeLevelId,
    grade_level_id: test.grade_level_id ?? gradeLevelId ?? undefined,
    gradeLevelName,
    grade_level_name: test.grade_level_name ?? gradeLevelName ?? undefined,
    gradeLevel,
    durationMinutes,
    duration_minutes: test.duration_minutes ?? durationMinutes ?? undefined,
    xpReward,
    xp_reward: test.xp_reward ?? xpReward ?? undefined,
    questionCount,
    question_count: test.question_count ?? questionCount ?? undefined,
    isActive,
    is_active: test.is_active ?? isActive,
    difficultyMix,
    difficulty_mix: test.difficulty_mix ?? difficultyMix ?? undefined,
    topicIds,
    topic_ids: test.topic_ids ?? topicIds ?? undefined,
    topics,
    createdAt,
    created_at: test.created_at ?? createdAt ?? undefined,
    updatedAt,
    updated_at: test.updated_at ?? updatedAt ?? undefined,
    questions,
  };
};

export const mapUserDto = <T extends Record<string, any>>(user: T) => {
  if (!user) {
    return user ?? null;
  }

  const userId = user.userId ?? user.id;
  const email = user.email ?? user.Email ?? null;
  const fullName = user.fullName ?? user.full_name ?? user.name ?? null;
  const isPremium = user.isPremium ?? user.is_premium ?? false;
  const isActive = user.isActive ?? user.is_active ?? true;
  const joinDate = user.joinDate ?? user.join_date ?? user.joined_at ?? null;
  const createdAt = user.createdAt ?? user.created_at ?? joinDate ?? null;
  const updatedAt = user.updatedAt ?? user.updated_at ?? null;
  const xpTotal = user.xpTotal ?? user.xp_total ?? 0;
  const streakDays = user.streakDays ?? user.streak_days ?? null;
  const lastLoginAt = user.lastLoginAt ?? user.last_login_at ?? null;

  return {
    ...user,
    userId,
    id: user.id ?? userId,
    email,
    fullName,
    full_name: user.full_name ?? fullName ?? undefined,
    isPremium,
    is_premium: user.is_premium ?? isPremium,
    isActive,
    is_active: user.is_active ?? isActive,
    joinDate,
    join_date: user.join_date ?? joinDate ?? undefined,
    createdAt,
    created_at: user.created_at ?? createdAt ?? undefined,
    updatedAt,
    updated_at: user.updated_at ?? updatedAt ?? undefined,
    xpTotal,
    xp_total: user.xp_total ?? xpTotal,
    level: user.level ?? user.user_level ?? null,
    streakDays,
    streak_days: user.streak_days ?? streakDays ?? undefined,
    lastLoginAt,
    last_login_at: user.last_login_at ?? lastLoginAt ?? undefined,
    role: user.role,
  };
};

export const mapBadgeDto = <T extends Record<string, any>>(badge: T) => {
  if (!badge) {
    return badge ?? null;
  }

  const xpRequired = badge.xpRequired ?? badge.xp_required ?? 0;
  const iconUrl = badge.iconUrl ?? badge.icon_url ?? null;

  return {
    ...badge,
    xpRequired,
    xp_required: xpRequired,
    iconUrl,
    icon_url: iconUrl,
  };
};

export const mapAchievementDto = <T extends Record<string, any>>(achievement: T) => {
  if (!achievement) {
    return achievement ?? null;
  }

  const xpReward = achievement.xpReward ?? achievement.xp_reward ?? 0;
  const iconUrl = achievement.iconUrl ?? achievement.icon_url ?? null;

  return {
    ...achievement,
    xpReward,
    xp_reward: xpReward,
    iconUrl,
    icon_url: iconUrl,
  };
};

export const mapChallengeDto = <T extends Record<string, any>>(challenge: T) => {
  if (!challenge) {
    return challenge ?? null;
  }

  const xpReward = challenge.xpReward ?? challenge.xp_reward ?? 0;
  const startDate = challenge.startDate ?? challenge.start_date ?? null;
  const endDate = challenge.endDate ?? challenge.end_date ?? null;
  const iconUrl = challenge.iconUrl ?? challenge.icon_url ?? null;
  const createdAt = challenge.createdAt ?? challenge.created_at ?? null;

  return {
    ...challenge,
    xpReward,
    xp_reward: xpReward,
    startDate,
    start_date: startDate,
    endDate,
    end_date: endDate,
    iconUrl,
    icon_url: iconUrl,
    createdAt,
    created_at: createdAt,
  };
};

export const mapChallengeParticipantDto = <T extends Record<string, any>>(participant: T) => {
  if (!participant) {
    return participant ?? null;
  }

  const xpTotal = participant.xpTotal ?? participant.xp_total ?? 0;
  const streakDays = participant.streakDays ?? participant.streak_days ?? 0;

  return {
    ...participant,
    xpTotal,
    xp_total: xpTotal,
    streakDays,
    streak_days: streakDays,
  };
};

export const mapFlashcardDto = <T extends Record<string, any>>(flashcard?: T | null) => {
  if (!flashcard) {
    return flashcard ?? null;
  }

  const flashcardId = flashcard.flashcardId ?? flashcard.id;
  const topicId =
    flashcard.topicId ??
    flashcard.topic_id ??
    flashcard.Topic?.topicId ??
    flashcard.Topic?.id ??
    null;
  const frontText =
    flashcard.frontText ?? flashcard.front_text ?? flashcard.question ?? "";
  const backText =
    flashcard.backText ?? flashcard.back_text ?? flashcard.answer ?? "";
  const language = (flashcard.language ?? flashcard.lang ?? flashcard.languageCode ?? "en").toLowerCase();

  const topicDetails = flashcard.Topic
    ? {
        ...mapTopicDto(flashcard.Topic),
        Subject: flashcard.Topic.Subject
          ? {
              ...mapSubjectDto(flashcard.Topic.Subject),
              GradeLevel: flashcard.Topic.Subject.GradeLevel
                ? mapGradeDto(flashcard.Topic.Subject.GradeLevel)
                : flashcard.Topic.Subject.GradeLevel,
            }
          : null,
      }
    : flashcard.Topic ?? null;

  return {
    ...flashcard,
    flashcardId,
    topicId,
    topic_id: flashcard.topic_id ?? topicId ?? undefined,
    frontText,
    front_text: frontText,
    backText,
    back_text: backText,
    language,
    Topic: topicDetails,
  };
};
