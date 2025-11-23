-- Rename legacy practice test tables to match Prisma models
ALTER TABLE "PracticeTest" RENAME TO "LegacyPracticeTest";
ALTER SEQUENCE IF EXISTS "PracticeTest_id_seq" RENAME TO "LegacyPracticeTest_id_seq";
ALTER TABLE "LegacyPracticeTest" RENAME CONSTRAINT "PracticeTest_pkey" TO "LegacyPracticeTest_pkey";

ALTER TABLE "PracticeTestQuiz" RENAME TO "LegacyPracticeTestQuiz";
ALTER TABLE "LegacyPracticeTestQuiz" RENAME CONSTRAINT "PracticeTestQuiz_pkey" TO "LegacyPracticeTestQuiz_pkey";

-- Ensure the renamed id column keeps using the renamed sequence
ALTER TABLE "LegacyPracticeTest" ALTER COLUMN "id" SET DEFAULT nextval('"LegacyPracticeTest_id_seq"'::regclass);

-- Create new quiz builder tables
CREATE TABLE "TopicQuiz" (
    "id" SERIAL PRIMARY KEY,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "TopicQuiz"
    ADD CONSTRAINT "TopicQuiz_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuizQuestion" (
    "id" SERIAL PRIMARY KEY,
    "quizId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "QuizQuestion"
    ADD CONSTRAINT "QuizQuestion_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "TopicQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizQuestion"
    ADD CONSTRAINT "QuizQuestion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "QuestionBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "QuizQuestion_quizId_questionId_key" ON "QuizQuestion" ("quizId", "questionId");
CREATE INDEX "QuizQuestion_questionId_idx" ON "QuizQuestion" ("questionId");

-- Create new practice test tables backed by Question Bank
CREATE TABLE "PracticeTest" (
    "id" SERIAL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" INTEGER,
    "gradeLevelId" INTEGER,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "difficultyMix" JSONB,
    "topicFilters" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "PracticeTest"
    ADD CONSTRAINT "PracticeTest_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PracticeTest"
    ADD CONSTRAINT "PracticeTest_gradeLevelId_fkey"
    FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PracticeTestQuestion" (
    "id" SERIAL PRIMARY KEY,
    "practiceTestId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "PracticeTestQuestion"
    ADD CONSTRAINT "PracticeTestQuestion_practiceTestId_fkey"
    FOREIGN KEY ("practiceTestId") REFERENCES "PracticeTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeTestQuestion"
    ADD CONSTRAINT "PracticeTestQuestion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "QuestionBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PracticeTestQuestion_practiceTestId_questionId_key"
    ON "PracticeTestQuestion" ("practiceTestId", "questionId");
CREATE INDEX "PracticeTestQuestion_questionId_idx" ON "PracticeTestQuestion" ("questionId");
