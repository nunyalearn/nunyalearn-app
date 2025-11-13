"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ArrowDown, ArrowUp, PenSquare, Plus, RotateCw, Trash2 } from "lucide-react";
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

type TopicRecord = {
  id: number;
  topic_name?: string;
  name?: string;
  Subject?: { subject_name?: string | null };
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

type QuestionBankRow = {
  id: number;
  questionText: string;
  difficulty: string;
  questionType: string;
};

type QuestionPayload = {
  questions: QuestionBankRow[];
};

type SelectedQuestion = {
  questionId: number;
  orderIndex: number;
  questionText: string;
  questionDifficulty?: string;
  questionType?: string;
};

type QuestionPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionBankRow[];
  loading: boolean;
  selection: SelectedQuestion[];
  onSelectionChange: React.Dispatch<React.SetStateAction<SelectedQuestion[]>>;
  onApply: (selection: SelectedQuestion[]) => void;
  topicLabel?: string;
};

const difficultyOptions = [
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

const defaultFormState: { title: string; description: string; difficulty: string; questions: SelectedQuestion[] } = {
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

const QuestionPickerDialog = ({
  open,
  onOpenChange,
  questions,
  loading,
  selection,
  onSelectionChange,
  onApply,
  topicLabel,
}: QuestionPickerDialogProps) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => setSearch(""));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const isSelected = useCallback(
    (questionId: number) => selection.some((question) => question.questionId === questionId),
    [selection],
  );

  const filteredQuestions = useMemo(() => {
    if (!search.trim()) {
      return questions;
    }
    const term = search.toLowerCase();
    return questions.filter((question) => question.questionText.toLowerCase().includes(term));
  }, [questions, search]);

  const selectedList = useMemo(
    () => selection.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [selection],
  );

  const toggleQuestion = (question: QuestionBankRow) => {
    onSelectionChange((current) => {
      const exists = current.some((entry) => entry.questionId === question.id);
      if (exists) {
        return current
          .filter((entry) => entry.questionId !== question.id)
          .map((entry, index) => ({ ...entry, orderIndex: index }));
      }
      return [
        ...current,
        {
          questionId: question.id,
          questionText: question.questionText,
          questionDifficulty: question.difficulty,
          questionType: question.questionType,
          orderIndex: current.length,
        },
      ];
    });
  };

  const clearSelection = () => onSelectionChange([]);

  const handleApply = () => {
    onApply(selectedList);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl space-y-4">
        <DialogHeader>
          <DialogTitle>Select questions</DialogTitle>
          <DialogDescription>
            Only ACTIVE Question Bank items can be attached to quizzes. {topicLabel ? `Topic: ${topicLabel}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Search active questions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span className="text-sm text-muted-foreground">{questions.length} available</span>
            </div>

            <div className="h-72 space-y-2 overflow-y-auto rounded-2xl border p-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading questions...</p>
              ) : filteredQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions match the current search.</p>
              ) : (
                filteredQuestions.map((question) => {
                  const active = isSelected(question.id);
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => toggleQuestion(question)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">{question.questionText}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{formatQuestionType(question.questionType)}</Badge>
                        <Badge variant="outline">{formatDifficulty(question.difficulty)}</Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Selected ({selectedList.length})
              </p>
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedList.length === 0}>
                Clear
              </Button>
            </div>
            <div className="h-72 space-y-2 overflow-y-auto rounded-2xl border p-3">
              {selectedList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions selected yet.</p>
              ) : (
                selectedList.map((question, index) => (
                  <div
                    key={question.questionId}
                    className="flex items-start justify-between gap-3 rounded-2xl border bg-card/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {question.questionText}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{formatQuestionType(question.questionType)}</Badge>
                        <Badge variant="outline">{formatDifficulty(question.questionDifficulty ?? "MEDIUM")}</Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleQuestion({ id: question.questionId, questionText: question.questionText, difficulty: question.questionDifficulty ?? "MEDIUM", questionType: question.questionType ?? "MULTIPLE_CHOICE" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedList.length === 0}>
            Use {selectedList.length} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

dayjs.extend(relativeTime);

const QuizzesPage = () => {
  const { toast } = useToast();
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<SelectedQuestion[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<QuizRecord | null>(null);
  const [formState, setFormState] = useState(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const { data: topicPayload, isLoading: topicsLoading } = useSWR<TopicPayload>(
    "/admin/topics?limit=200&includeInactive=true",
    fetcher,
  );

  const topicOptions = useMemo(() => {
    return (topicPayload?.topics ?? []).map((topic) => ({
      id: topic.id,
      label: `${topic.topic_name ?? topic.name ?? `Topic ${topic.id}`}${
        topic.Subject?.subject_name ? ` · ${topic.Subject.subject_name}` : ""
      }`,
    }));
  }, [topicPayload]);

  const quizKey = selectedTopicId
    ? `/admin/quizzes?topicId=${selectedTopicId}&includeInactive=${includeInactive}`
    : null;
  const {
    data: quizPayload,
    isLoading: quizzesLoading,
    mutate: mutateQuizzes,
  } = useSWR<QuizListResponse>(quizKey, fetcher);

  const questionKey =
    selectedTopicId && isQuestionPickerOpen
      ? `/admin/questionbank?topicId=${selectedTopicId}&status=ACTIVE&isActive=true&limit=200`
      : null;
  const {
    data: questionPayload,
    isLoading: questionLoading,
  } = useSWR<QuestionPayload>(questionKey, fetcher);

  const quizzes = quizPayload?.quizzes ?? [];
  const selectedTopicLabel =
    topicOptions.find((topic) => String(topic.id) === selectedTopicId)?.label ?? quizPayload?.topic?.name;

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingQuiz(null);
  };

  const openCreateModal = () => {
    if (!selectedTopicId) {
      toast({
        variant: "destructive",
        title: "Select a topic",
        description: "Pick a topic before creating a quiz.",
      });
      return;
    }
    resetForm();
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
      title: quiz.title,
      description: quiz.description ?? "",
      difficulty: quiz.difficulty,
      questions,
    });
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    if (!open) {
      setIsFormOpen(false);
      resetForm();
    } else {
      setIsFormOpen(true);
    }
  };

  const applyQuestionSelection = (selection: SelectedQuestion[]) => {
    setFormState((prev) => ({
      ...prev,
      questions: selection.map((question, index) => ({ ...question, orderIndex: index })),
    }));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    setFormState((prev) => {
      const next = [...prev.questions];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return {
        ...prev,
        questions: next.map((question, idx) => ({ ...question, orderIndex: idx })),
      };
    });
  };

  const removeQuestion = (questionId: number) => {
    setFormState((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((question) => question.questionId !== questionId)
        .map((question, index) => ({ ...question, orderIndex: index })),
    }));
  };

  const handleSubmit = async () => {
    if (!selectedTopicId) {
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
    };

    try {
      setSaving(true);
      if (editingQuiz) {
        await api.put(`/admin/quizzes/${editingQuiz.id}`, payload);
        toast({ title: "Quiz updated", description: "Changes saved successfully." });
      } else {
        await api.post("/admin/quizzes", {
          ...payload,
          topicId: Number(selectedTopicId),
        });
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
      await api.patch(`/admin/quizzes/${quiz.id}/status`, { isActive: !quiz.isActive });
      await mutateQuizzes();
      toast({
        title: quiz.isActive ? "Quiz deactivated" : "Quiz reactivated",
        description: quiz.title,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to update quiz status.");
      toast({ variant: "destructive", title: "Action failed", description: message });
    } finally {
      setTogglingId(null);
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
            New quiz
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Topic</label>
          <Select value={selectedTopicId} onValueChange={(value) => setSelectedTopicId(value)}>
            <SelectTrigger disabled={topicsLoading}>
              <SelectValue placeholder={topicsLoading ? "Loading topics..." : "Select a topic"} />
            </SelectTrigger>
            <SelectContent>
              {topicOptions.map((topic) => (
                <SelectItem key={topic.id} value={String(topic.id)}>
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

      {!selectedTopicId ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Select a topic to view its quizzes.
        </div>
      ) : quizzesLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading quizzes...
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          No quizzes found for this topic yet. Be the first to create one.
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
            <DialogTitle>{editingQuiz ? "Edit quiz" : "Create quiz"}</DialogTitle>
            <DialogDescription>
              {selectedTopicLabel ? `Topic: ${selectedTopicLabel}` : "Pick a topic to continue."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                  Questions ({formState.questions.length})
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!selectedTopicId) {
                      toast({
                        variant: "destructive",
                        title: "Select a topic",
                        description: "Choose a topic before picking questions.",
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

      <QuestionPickerDialog
        open={isQuestionPickerOpen}
        onOpenChange={(open) => setIsQuestionPickerOpen(open)}
        questions={questionPayload?.questions ?? []}
        loading={questionLoading}
        selection={pickerSelection}
        onSelectionChange={setPickerSelection}
        onApply={applyQuestionSelection}
        topicLabel={selectedTopicLabel}
      />
    </div>
  );
};

export default QuizzesPage;
