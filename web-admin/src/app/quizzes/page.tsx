"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowDown, ArrowUp, Copy, PenSquare, Plus, RotateCw, Trash2 } from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import api, { fetcher } from "@/lib/api";
import QuestionPicker, { QuestionBankRow, SelectedQuestion } from "@/components/QuestionPicker";

type GradeRecord = {
  id: number;
  name?: string;
  grade_level?: string;
};

type SubjectRecord = {
  id: number;
  name?: string;
  subject_name?: string;
  gradeLevelId?: number;
  grade_level_id?: number;
};

type TopicRecord = {
  id: number;
  topic_name?: string;
  name?: string;
  subjectId?: number;
  subject_id?: number;
  gradeLevelId?: number;
  grade_level_id?: number;
};

type GradePayload = {
  grades: GradeRecord[];
};

type SubjectPayload = {
  subjects: SubjectRecord[];
};

type TopicPayload = {
  topics: TopicRecord[];
};

type QuizQuestion = {
  quizQuestionId?: number;
  questionId: number;
  orderIndex: number;
  questionText: string;
  questionDifficulty?: string;
  questionType?: string;
  questionStatus?: string;
};

type QuizRecord = {
  id: number;
  topicId: number;
  title: string;
  description?: string | null;
  difficulty: string;
  isActive: boolean;
  questionCount: number;
  updatedAt?: string;
  questions: QuizQuestion[];
};

type QuizListResponse = {
  topic: { id: number; name: string };
  quizzes: QuizRecord[];
};

type QuestionPayload = {
  questions: QuestionBankRow[];
};

const difficultyOptions = [
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const QUESTION_BANK_PAGE_SIZE = 100; // API enforces a maximum of 100 records per request

const questionPickerDifficultyOptions = [
  { label: "All difficulties", value: "ALL" },
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const formatDifficulty = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "hard") return "Hard";
  return "Medium";
};

const formatQuestionType = (value?: string) =>
  value ? value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase()) : "Unknown";

type QuizFormState = {
  gradeId: string;
  subjectId: string;
  topicId: string;
  title: string;
  description: string;
  difficulty: string;
  questions: SelectedQuestion[];
};

const defaultFormState: QuizFormState = {
  gradeId: "",
  subjectId: "",
  topicId: "",
  title: "",
  description: "",
  difficulty: "MEDIUM",
  questions: [],
};

const getErrorMessage = (error: unknown, fallback = "Please try again.") => {
  if (!error) {
    return fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (responseData && typeof responseData === "object") {
    const { message, error: nestedError } = responseData as { message?: unknown; error?: unknown };
    if (typeof message === "string") {
      return message;
    }
    if (typeof nestedError === "string") {
      return nestedError;
    }
  }
  const fallbackMessage = (error as { message?: unknown }).message;
  return typeof fallbackMessage === "string" ? fallbackMessage : fallback;
};

dayjs.extend(relativeTime);

const QuizzesPage = () => {
  const { toast } = useToast();
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<SelectedQuestion[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<QuizRecord | null>(null);
  const [formState, setFormState] = useState<QuizFormState>(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const { data: gradePayload, isLoading: gradesLoading } = useSWR<GradePayload>(
    "/admin/curriculum/grades",
    fetcher,
  );

  const subjectKey = selectedGradeId ? `/admin/curriculum/subjects?gradeLevelId=${selectedGradeId}` : null;
  const { data: subjectPayload, isLoading: subjectsLoading } = useSWR<SubjectPayload>(subjectKey, fetcher);

  const topicKeyForFilters = selectedSubjectId ? `/admin/curriculum/topics?subjectId=${selectedSubjectId}` : null;
  const { data: topicPayload, isLoading: topicsLoading } = useSWR<TopicPayload>(topicKeyForFilters, fetcher);

  const gradeOptions = useMemo(
    () =>
      (gradePayload?.grades ?? []).map((grade) => ({
        value: String(grade.id),
        label: grade.name ?? grade.grade_level ?? `Grade ${grade.id}`,
      })),
    [gradePayload],
  );

  const subjectOptions = useMemo(
    () =>
      (subjectPayload?.subjects ?? []).map((subject) => ({
        value: String(subject.id),
        label: subject.subject_name ?? subject.name ?? `Subject ${subject.id}`,
      })),
    [subjectPayload],
  );

  const topicOptions = useMemo(
    () =>
      (topicPayload?.topics ?? []).map((topic) => ({
        value: String(topic.id),
        label: topic.topic_name ?? topic.name ?? `Topic ${topic.id}`,
      })),
    [topicPayload],
  );

  useEffect(() => {
    if (!gradeOptions.length) {
      setSelectedGradeId("");
      return;
    }
    if (!selectedGradeId || !gradeOptions.some((grade) => grade.value === selectedGradeId)) {
      setSelectedGradeId(gradeOptions[0].value);
    }
  }, [gradeOptions, selectedGradeId]);

  useEffect(() => {
    if (!selectedGradeId) {
      setSelectedSubjectId("");
      setSelectedTopicId("");
      return;
    }
    if (!subjectOptions.length) {
      setSelectedSubjectId("");
      setSelectedTopicId("");
      return;
    }
    if (!selectedSubjectId || !subjectOptions.some((subject) => subject.value === selectedSubjectId)) {
      setSelectedSubjectId(subjectOptions[0].value);
    }
  }, [selectedGradeId, selectedSubjectId, subjectOptions]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setSelectedTopicId("");
      return;
    }
    if (!topicOptions.length) {
      setSelectedTopicId("");
      return;
    }
    if (!selectedTopicId || !topicOptions.some((topic) => topic.value === selectedTopicId)) {
      setSelectedTopicId(topicOptions[0].value);
    }
  }, [selectedSubjectId, selectedTopicId, topicOptions]);

  const builderSubjectKey = formState.gradeId ? `/admin/curriculum/subjects?gradeLevelId=${formState.gradeId}` : null;
  const { data: builderSubjectPayload, isLoading: builderSubjectsLoading } = useSWR<SubjectPayload>(
    builderSubjectKey,
    fetcher,
  );

  const builderTopicKey = formState.subjectId ? `/admin/curriculum/topics?subjectId=${formState.subjectId}` : null;
  const { data: builderTopicPayload, isLoading: builderTopicsLoading } = useSWR<TopicPayload>(
    builderTopicKey,
    fetcher,
  );

  const builderSubjectOptions = useMemo(
    () =>
      (builderSubjectPayload?.subjects ?? []).map((subject) => ({
        value: String(subject.id),
        label: subject.subject_name ?? subject.name ?? `Subject ${subject.id}`,
      })),
    [builderSubjectPayload],
  );

  const builderTopicOptions = useMemo(
    () =>
      (builderTopicPayload?.topics ?? []).map((topic) => ({
        value: String(topic.id),
        label: topic.topic_name ?? topic.name ?? `Topic ${topic.id}`,
      })),
    [builderTopicPayload],
  );

  const formSubjectOptions = builderSubjectOptions.length ? builderSubjectOptions : subjectOptions;
  const formTopicOptions = builderTopicOptions.length ? builderTopicOptions : topicOptions;

  const quizKey = selectedTopicId
    ? `/admin/quizzes?topicId=${selectedTopicId}&includeInactive=${includeInactive}`
    : null;
  const {
    data: quizPayload,
    isLoading: quizzesLoading,
    mutate: mutateQuizzes,
  } = useSWR<QuizListResponse>(quizKey, fetcher);

  const pickerTopicId = formState.topicId || selectedTopicId;
  const questionKey =
    pickerTopicId && isQuestionPickerOpen
      ? `/admin/questionbank?topicId=${pickerTopicId}&status=ACTIVE&isActive=true&page=1&limit=${QUESTION_BANK_PAGE_SIZE}`
      : null;
  const {
    data: questionPayload,
    isLoading: questionLoading,
  } = useSWR<QuestionPayload>(questionKey, fetcher);

  const quizzes = quizPayload?.quizzes ?? [];
  const filterTopicLabel =
    topicOptions.find((topic) => topic.value === selectedTopicId)?.label ?? quizPayload?.topic?.name;
  const formGradeLabel = gradeOptions.find((grade) => grade.value === formState.gradeId)?.label;
  const formSubjectLabel =
    builderSubjectOptions.find((subject) => subject.value === formState.subjectId)?.label ??
    subjectOptions.find((subject) => subject.value === formState.subjectId)?.label;
  const formTopicLabel =
    builderTopicOptions.find((topic) => topic.value === formState.topicId)?.label ??
    topicOptions.find((topic) => topic.value === formState.topicId)?.label ??
    filterTopicLabel;

  const resetForm = useCallback((overrides?: Partial<QuizFormState>) => {
    setFormState({ ...defaultFormState, ...overrides });
    setEditingQuiz(null);
    setPickerSelection([]);
  }, []);

  const syncFiltersFromForm = useCallback(
    (updates: { gradeId?: string; subjectId?: string; topicId?: string }) => {
      if (editingQuiz) {
        return;
      }
      if (updates.gradeId !== undefined) {
        setSelectedGradeId(updates.gradeId);
        setSelectedSubjectId("");
        setSelectedTopicId("");
      }
      if (updates.subjectId !== undefined) {
        setSelectedSubjectId(updates.subjectId);
        setSelectedTopicId("");
      }
      if (updates.topicId !== undefined) {
        setSelectedTopicId(updates.topicId);
      }
    },
    [editingQuiz],
  );

  const openCreateModal = () => {
    if (!selectedGradeId || !selectedSubjectId || !selectedTopicId) {
      toast({
        variant: "destructive",
        title: "Choose a topic first",
        description: "Select grade, subject, and topic before creating a quiz.",
      });
      return;
    }
    resetForm({
      gradeId: selectedGradeId,
      subjectId: selectedSubjectId,
      topicId: selectedTopicId,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (quiz: QuizRecord) => {
    setEditingQuiz(quiz);
    const questions = quiz.questions
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((question, index) => ({
        questionId: question.questionId,
        questionText: question.questionText,
        questionDifficulty: question.questionDifficulty,
        questionType: question.questionType,
        orderIndex: index,
      }));
    setFormState({
      gradeId: selectedGradeId,
      subjectId: selectedSubjectId,
      topicId: String(quiz.topicId),
      title: quiz.title,
      description: quiz.description ?? "",
      difficulty: quiz.difficulty,
      questions,
    });
    setPickerSelection(questions);
    setIsFormOpen(true);
  };

  const handleGradeFilterChange = (value: string) => {
    setSelectedGradeId(value);
    setSelectedSubjectId("");
    setSelectedTopicId("");
  };

  const handleSubjectFilterChange = (value: string) => {
    setSelectedSubjectId(value);
    setSelectedTopicId("");
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      setIsFormOpen(false);
      setIsQuestionPickerOpen(false);
      resetForm();
    } else {
      setIsFormOpen(true);
    }
  };

  const handleFormGradeChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      gradeId: value,
      subjectId: "",
      topicId: "",
      questions: [],
    }));
    setPickerSelection([]);
    setIsQuestionPickerOpen(false);
    syncFiltersFromForm({ gradeId: value });
  };

  const handleFormSubjectChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      subjectId: value,
      topicId: "",
      questions: [],
    }));
    setPickerSelection([]);
    setIsQuestionPickerOpen(false);
    syncFiltersFromForm({ subjectId: value });
  };

  const handleFormTopicChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      topicId: value,
      questions: [],
    }));
    setPickerSelection([]);
    setIsQuestionPickerOpen(false);
    syncFiltersFromForm({ topicId: value });
  };

  const applyQuestionSelection = (selection: SelectedQuestion[]) => {
    const ordered = selection.map((question, index) => ({ ...question, orderIndex: index }));
    setFormState((prev) => ({
      ...prev,
      questions: ordered,
    }));
    setPickerSelection(ordered);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    setFormState((prev) => {
      const next = [...prev.questions];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      const normalized = next.map((question, idx) => ({ ...question, orderIndex: idx }));
      setPickerSelection(normalized);
      return {
        ...prev,
        questions: normalized,
      };
    });
  };

  const removeQuestion = (questionId: number) => {
    setFormState((prev) => {
      const normalized = prev.questions
        .filter((question) => question.questionId !== questionId)
        .map((question, index) => ({ ...question, orderIndex: index }));
      setPickerSelection(normalized);
      return {
        ...prev,
        questions: normalized,
      };
    });
  };

  const handleSubmit = async () => {
    if (!formState.topicId) {
      toast({
        variant: "destructive",
        title: "Select a topic",
        description: "Pick a topic before saving.",
      });
      return;
    }
    if (!formState.title.trim()) {
      toast({ variant: "destructive", title: "Title required", description: "Give the quiz a title." });
      return;
    }
    if (formState.questions.length === 0) {
      toast({
        variant: "destructive",
        title: "Add questions",
        description: "A quiz needs at least one question.",
      });
      return;
    }

    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      difficulty: formState.difficulty,
      questionIds: formState.questions.map((question) => question.questionId),
      topicId: Number(formState.topicId),
    };

    try {
      setSaving(true);
      if (editingQuiz) {
        await api.put(`/admin/quizzes/${editingQuiz.id}`, payload);
        toast({ title: "Quiz updated", description: "Changes saved successfully." });
      } else {
        await api.post("/admin/quizzes", payload);
        toast({ title: "Quiz created", description: "New quiz added to the topic." });
      }
      await mutateQuizzes();
      handleFormClose(false);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "Unable to save quiz. Please review the details and try again.",
      );
      toast({ variant: "destructive", title: "Save failed", description: message });
    } finally {
      setSaving(false);
    }
  };

  const toggleQuizStatus = async (quiz: QuizRecord) => {
    setTogglingId(quiz.id);
    try {
      const nextStatus = !quiz.isActive;
      await api.patch(`/admin/quizzes/${quiz.id}/status`, { isActive: nextStatus });
      await mutateQuizzes();
      toast({
        title: nextStatus ? "Quiz reactivated" : "Quiz deactivated",
        description: quiz.title,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to update quiz status.");
      toast({ variant: "destructive", title: "Action failed", description: message });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDuplicate = async (quiz: QuizRecord) => {
    setDuplicatingId(quiz.id);
    try {
      const payload = {
        title: `${quiz.title} Copy`,
        description: quiz.description ?? undefined,
        difficulty: quiz.difficulty,
        questionIds: quiz.questions.map((question) => question.questionId),
        topicId: quiz.topicId,
      };
      await api.post("/admin/quizzes", payload);
      await mutateQuizzes();
      toast({
        title: "Quiz duplicated",
        description: payload.title,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to duplicate quiz.");
      toast({ variant: "destructive", title: "Duplicate failed", description: message });
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Quizzes</h1>
          <p className="text-muted-foreground">
            Curate topic-specific quiz sets from the ACTIVE Question Bank inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => mutateQuizzes()}
            disabled={!selectedTopicId || quizzesLoading}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateModal} disabled={!selectedTopicId}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Quiz
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Grade</label>
          <Select
            value={selectedGradeId}
            onValueChange={handleGradeFilterChange}
            disabled={gradesLoading || gradeOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={gradesLoading ? "Loading grades..." : "Select grade"} />
            </SelectTrigger>
            <SelectContent>
              {gradeOptions.map((grade) => (
                <SelectItem key={grade.value} value={grade.value}>
                  {grade.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Subject</label>
          <Select
            value={selectedSubjectId}
            onValueChange={handleSubjectFilterChange}
            disabled={!selectedGradeId || subjectsLoading || subjectOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !selectedGradeId ? "Select a grade first" : subjectsLoading ? "Loading subjects..." : "Select subject"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((subject) => (
                <SelectItem key={subject.value} value={subject.value}>
                  {subject.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Topic</label>
          <Select
            value={selectedTopicId}
            onValueChange={(value) => setSelectedTopicId(value)}
            disabled={!selectedSubjectId || topicsLoading || topicOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !selectedSubjectId ? "Select a subject first" : topicsLoading ? "Loading topics..." : "Select topic"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {topicOptions.map((topic) => (
                <SelectItem key={topic.value} value={topic.value}>
                  {topic.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Visibility</label>
          <Select
            value={includeInactive ? "all" : "active"}
            onValueChange={(value) => setIncludeInactive(value === "all")}
            disabled={!selectedTopicId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="all">Show active + inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {gradesLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading grades...
        </div>
      ) : !selectedGradeId ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Select a grade to load available subjects.
        </div>
      ) : subjectsLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading subjects...
        </div>
      ) : !selectedSubjectId ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Select a subject to view its topics.
        </div>
      ) : topicsLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading topics...
        </div>
      ) : !selectedTopicId ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Select a topic to view its quizzes.
        </div>
      ) : quizzesLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading quizzes...
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          No quizzes found for {filterTopicLabel ?? "this topic"} yet. Be the first to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="space-y-3 rounded-3xl border bg-card/60 p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{quiz.title}</h2>
                    <Badge variant={quiz.isActive ? "success" : "outline"}>
                      {quiz.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{formatDifficulty(quiz.difficulty)}</Badge>
                  </div>
                  {quiz.description ? (
                    <p className="text-sm text-muted-foreground">{quiz.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"} · Updated{" "}
                    {quiz.updatedAt ? dayjs(quiz.updatedAt).fromNow() : "recently"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditModal(quiz)}>
                    <PenSquare className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDuplicate(quiz)}
                    disabled={duplicatingId === quiz.id || quiz.questions.length === 0}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button
                    variant={quiz.isActive ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => toggleQuizStatus(quiz)}
                    disabled={togglingId === quiz.id}
                  >
                    {quiz.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border bg-background/60 p-4">
                <p className="text-sm font-medium text-muted-foreground">Question order</p>
                {quiz.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions attached.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {quiz.questions
                      .slice()
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((question) => (
                        <li key={question.quizQuestionId ?? question.questionId} className="flex flex-col gap-1">
                          <span className="font-medium">{question.questionText}</span>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{formatQuestionType(question.questionType)}</Badge>
                            <Badge variant="outline">
                              {question.questionStatus === "ACTIVE" ? "Active" : question.questionStatus}
                            </Badge>
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl space-y-4">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? "Edit quiz" : "Quiz builder"}</DialogTitle>
            <DialogDescription>
              {formState.topicId
                ? `Scope: ${[formGradeLabel, formSubjectLabel, formTopicLabel].filter(Boolean).join(" · ")}`
                : "Select grade, subject, and topic to continue."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Grade</label>
                <Select
                  value={formState.gradeId}
                  onValueChange={handleFormGradeChange}
                  disabled={gradesLoading || gradeOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={gradesLoading ? "Loading grades..." : "Select grade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((grade) => (
                      <SelectItem key={grade.value} value={grade.value}>
                        {grade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Subject</label>
                <Select
                  value={formState.subjectId}
                  onValueChange={handleFormSubjectChange}
                  disabled={!formState.gradeId || builderSubjectsLoading || formSubjectOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !formState.gradeId
                          ? "Select grade first"
                          : builderSubjectsLoading
                            ? "Loading subjects..."
                            : "Select subject"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formSubjectOptions.map((subject) => (
                      <SelectItem key={subject.value} value={subject.value}>
                        {subject.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Topic</label>
                <Select
                  value={formState.topicId}
                  onValueChange={handleFormTopicChange}
                  disabled={!formState.subjectId || builderTopicsLoading || formTopicOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !formState.subjectId
                          ? "Select subject first"
                          : builderTopicsLoading
                            ? "Loading topics..."
                            : "Select topic"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formTopicOptions.map((topic) => (
                      <SelectItem key={topic.value} value={topic.value}>
                        {topic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <Input
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Quiz title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Short description (optional)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Difficulty</label>
              <Select
                value={formState.difficulty}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, difficulty: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {difficultyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">
                  Questions ({formState.questions.length}
                  {formTopicLabel ? ` · ${formTopicLabel}` : ""})
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!formState.topicId}
                  onClick={() => {
                    if (!formState.topicId) {
                      toast({
                        variant: "destructive",
                        title: "Select a topic",
                        description: "Choose a topic in the quiz builder before picking questions.",
                      });
                      return;
                    }
                    setPickerSelection(formState.questions);
                    setIsQuestionPickerOpen(true);
                  }}
                >
                  Choose questions
                </Button>
              </div>
              {formState.questions.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No questions selected yet.
                </p>
              ) : (
                <ol className="space-y-2">
                  {formState.questions
                    .slice()
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((question, index) => (
                      <li
                        key={question.questionId}
                        className="flex flex-col gap-2 rounded-2xl border bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {index + 1}. {question.questionText}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{formatQuestionType(question.questionType)}</Badge>
                            <Badge variant="outline">
                              {formatDifficulty(question.questionDifficulty ?? "MEDIUM")}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveQuestion(index, "up")}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveQuestion(index, "down")}
                            disabled={index === formState.questions.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeQuestion(question.questionId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleFormClose(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingQuiz ? "Save changes" : "Create quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionPicker
        open={isQuestionPickerOpen}
        onOpenChange={(open) => setIsQuestionPickerOpen(open)}
        questions={questionPayload?.questions ?? []}
        loading={questionLoading}
        selection={pickerSelection}
        onSelectionChange={setPickerSelection}
        onApply={applyQuestionSelection}
        topicLabel={formTopicLabel}
      />
    </div>
  );
};

export default QuizzesPage;

