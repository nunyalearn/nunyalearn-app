export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type LearnStackParamList = {
  Grades: undefined;
  Subjects: { gradeId: number };
  Topics: { subjectId: number; subjectName?: string };
  QuizList: { topicId: number; topicName?: string; subjectName?: string };
  PracticeTestList: { topicId: number };
  QuizPlayer: { quizId: number; topicId?: number; topicName?: string };
  QuizResult: { attemptId: number };
  TestPlayer: { testId: number; topicId?: number; mode?: "practice" | "exam" };
  TestResult: { attemptId: number };
};

export type ProfileStackParamList = {
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};
