"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import api, { fetcher } from "@/lib/api";

type GradeOption = {
  id: number;
  name: string;
};

type SubjectOption = {
  id: number;
  subject_name?: string;
  name?: string;
};

type TopicOption = {
  id: number;
  topic_name?: string;
  name?: string;
};

export type QuestionModalPayload = {
  id?: number;
  questionText?: string;
  questionType?: string;
  difficulty?: string;
  language?: string;
  explanation?: string | null;
  gradeId?: number | null;
  subjectId?: number | null;
  topicId?: number | null;
  options?: string[];
  correctOption?: string | null;
  correctAnswers?: string[];
};

type NewQuestionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
  question?: QuestionModalPayload | null;
};

const questionTypeOptions = [
  { label: "Multiple Choice", value: "MULTIPLE_CHOICE" },
  { label: "True / False", value: "TRUE_FALSE" },
  { label: "Fill in the Blank", value: "FILL_IN_THE_BLANK" },
  { label: "Short Answer", value: "SHORT_ANSWER" },
];

const difficultyOptions = [
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const languageOptions = [
  { label: "English", value: "EN" },
  { label: "French", value: "FR" },
];

const requiresTextAnswers = (type: string) =>
  type === "FILL_IN_THE_BLANK" || type === "SHORT_ANSWER";

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

const NewQuestionModal = ({ open, onOpenChange, onCreated, question }: NewQuestionModalProps) => {
  const { toast } = useToast();

  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = useState("EASY");
  const [language, setLanguage] = useState("EN");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", ""]);
  const [mcqCorrectOption, setMcqCorrectOption] = useState("");
  const [tfCorrectOption, setTfCorrectOption] = useState("TRUE");
  const [correctAnswersText, setCorrectAnswersText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(question?.id);

  const updateGradeSelection = useCallback(
    (value: string, resetDependents = true) => {
      setGradeId(value);
      if (resetDependents) {
        setSubjectId("");
        setTopicId("");
      }
    },
    [],
  );

  const updateSubjectSelection = useCallback(
    (value: string, resetTopic = true) => {
      setSubjectId(value);
      if (resetTopic) {
        setTopicId("");
      }
    },
    [],
  );

  const shouldLoadData = open;
  const { data: gradePayload } = useSWR<{ grades: GradeOption[] }>(
    shouldLoadData ? "/admin/curriculum/grades" : null,
    fetcher,
  );

  const gradeOptions = gradePayload?.grades ?? [];

  const subjectKey =
    shouldLoadData && gradeId
      ? `/admin/curriculum/subjects?gradeLevelId=${gradeId}`
      : null;
  const { data: subjectPayload } = useSWR<{ subjects: SubjectOption[] }>(subjectKey, fetcher);
  const subjectOptions = subjectPayload?.subjects ?? [];

  const topicKey =
    shouldLoadData && subjectId
      ? `/admin/curriculum/topics?subjectId=${subjectId}`
      : null;
  const { data: topicPayload } = useSWR<{ topics: TopicOption[] }>(topicKey, fetcher);
  const topicOptions = topicPayload?.topics ?? [];

  const resetForm = useCallback(() => {
    setQuestionText("");
    setQuestionType("MULTIPLE_CHOICE");
    setDifficulty("EASY");
    setLanguage("EN");
    updateGradeSelection("", true);
    setMcqOptions(["", ""]);
    setMcqCorrectOption("");
    setTfCorrectOption("TRUE");
    setCorrectAnswersText("");
    setExplanation("");
    setSaving(false);
  }, [updateGradeSelection]);

  const hydrateFromQuestion = useCallback(
    (record?: QuestionModalPayload | null) => {
      if (!record) {
        resetForm();
        return;
      }

      setQuestionText(record.questionText ?? "");
      const nextType = record.questionType ?? "MULTIPLE_CHOICE";
      setQuestionType(nextType);
      setDifficulty(record.difficulty ?? "EASY");
      setLanguage(record.language ?? "EN");
      updateGradeSelection(record.gradeId ? String(record.gradeId) : "", false);
      updateSubjectSelection(record.subjectId ? String(record.subjectId) : "", false);
      setTopicId(record.topicId ? String(record.topicId) : "");
      setMcqOptions(record.options?.length ? record.options : ["", ""]);
      setMcqCorrectOption(record.correctOption ?? "");
      setTfCorrectOption((record.correctOption ?? "TRUE").toUpperCase());
      setCorrectAnswersText(
        record.correctAnswers && record.correctAnswers.length ? record.correctAnswers.join("\n") : "",
      );
      setExplanation(record.explanation ?? "");
    },
    [resetForm, updateGradeSelection, updateSubjectSelection],
  );

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    hydrateFromQuestion(question);
  }, [hydrateFromQuestion, open, question, resetForm]);

  useEffect(() => {
    if (questionType !== "MULTIPLE_CHOICE") {
      setMcqCorrectOption("");
    }
    if (questionType !== "TRUE_FALSE") {
      setTfCorrectOption("TRUE");
    }
    if (!requiresTextAnswers(questionType)) {
      setCorrectAnswersText("");
    }
  }, [questionType]);

  const availableMcqOptions = useMemo(
    () =>
      mcqOptions
        .map((option, index) => ({
          key: `option-${index}`,
          label: option || `Option ${index + 1}`,
          value: option.trim(),
        }))
        .filter((option) => option.value.length),
    [mcqOptions],
  );

  const handleOptionChange = (index: number, value: string) => {
    setMcqOptions((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const addOption = () => {
    setMcqOptions((current) => [...current, ""]);
  };

  const removeOption = (index: number) => {
    setMcqOptions((current) => {
      if (current.length <= 2) {
        return current;
      }
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  };

  const handleSave = async () => {
    if (!topicId) {
      toast({
        variant: "destructive",
        title: "Select a topic",
        description: "Please choose grade, subject, and topic before saving.",
      });
      return;
    }

    if (questionText.trim().length < 5) {
      toast({
        variant: "destructive",
        title: "Question text too short",
        description: "Provide at least 5 characters of question text.",
      });
      return;
    }

    const payload: Record<string, unknown> = {
      topicId: Number(topicId),
      questionText: questionText.trim(),
      questionType,
      difficulty,
      language,
      explanation: explanation.trim() || undefined,
    };

    if (gradeId) {
      payload.gradeId = Number(gradeId);
    }
    if (subjectId) {
      payload.subjectId = Number(subjectId);
    }

    if (questionType === "MULTIPLE_CHOICE") {
      const sanitizedOptions = mcqOptions
        .map((option) => option.trim())
        .filter((option) => option.length);

      if (sanitizedOptions.length < 2) {
        toast({
          variant: "destructive",
          title: "Add more options",
          description: "Multiple choice questions require at least two options.",
        });
        return;
      }

      if (!sanitizedOptions.includes(mcqCorrectOption.trim())) {
        toast({
          variant: "destructive",
          title: "Select correct option",
          description: "Choose the correct option from the provided answers.",
        });
        return;
      }

      payload.options = sanitizedOptions;
      payload.correctOption = mcqCorrectOption.trim();
    } else if (questionType === "TRUE_FALSE") {
      payload.correctOption = tfCorrectOption.toUpperCase();
    } else if (requiresTextAnswers(questionType)) {
      const answers = correctAnswersText
        .split("\n")
        .map((answer) => answer.trim())
        .filter((answer) => answer.length);

      if (!answers.length) {
        toast({
          variant: "destructive",
          title: "Provide correct answers",
          description: "Add at least one acceptable answer.",
        });
        return;
      }

      payload.correctAnswers = answers;
    }

    try {
      setSaving(true);
      if (isEditing && question?.id) {
        await api.put(`/admin/questionbank/${question.id}`, payload);
      } else {
        await api.post("/admin/questionbank", payload);
      }
      toast({
        title: isEditing ? "Question updated" : "Question created",
        description: isEditing
          ? "Changes have been applied to this question."
          : "The question has been added to the bank.",
      });
      await Promise.resolve(onCreated?.());
      onOpenChange(false);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to save the question right now.");
      toast({ variant: "destructive", title: "Save failed", description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl space-y-4">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Question" : "New Question"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the prompt, mappings, or answer keys."
              : "Manually curate Question Bank 2.0 items."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Question text</label>
            <Textarea
              rows={4}
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="Enter the prompt shown to learners"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Question type</label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Difficulty</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Grade</label>
              <Select value={gradeId} onValueChange={(value) => updateGradeSelection(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade.id} value={String(grade.id)}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <Select
                value={subjectId}
                onValueChange={(value) => updateSubjectSelection(value)}
                disabled={!gradeId || subjectOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={gradeId ? "Select subject" : "Pick grade first"} />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.subject_name ?? subject.name ?? `Subject ${subject.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Topic</label>
              <Select
                value={topicId}
                onValueChange={setTopicId}
                disabled={!subjectId || topicOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={subjectId ? "Select topic" : "Pick subject first"} />
                </SelectTrigger>
                <SelectContent>
                  {topicOptions.map((topic) => (
                    <SelectItem key={topic.id} value={String(topic.id)}>
                      {topic.topic_name ?? topic.name ?? `Topic ${topic.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {questionType === "MULTIPLE_CHOICE" ? (
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Options</p>
                <Button variant="ghost" size="sm" onClick={addOption}>
                  Add option
                </Button>
              </div>
              <div className="space-y-2">
                {mcqOptions.map((option, index) => (
                  <div key={`option-${index}`} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {mcqOptions.length > 2 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        aria-label="Remove option"
                      >
                        ×
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Correct answer</label>
                <Select value={mcqCorrectOption} onValueChange={setMcqCorrectOption}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct option" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMcqOptions.map((option) => (
                      <SelectItem key={option.key} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {questionType === "TRUE_FALSE" ? (
            <div className="space-y-2 rounded-2xl border p-4">
              <label className="text-sm font-medium text-muted-foreground">Correct answer</label>
              <Select value={tfCorrectOption} onValueChange={setTfCorrectOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRUE">True</SelectItem>
                  <SelectItem value="FALSE">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {requiresTextAnswers(questionType) ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Accepted answers (one per line)
              </label>
              <Textarea
                rows={3}
                value={correctAnswersText}
                onChange={(event) => setCorrectAnswersText(event.target.value)}
                placeholder={"Answer A\nAnswer B"}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Explanation (optional)</label>
            <Textarea
              rows={3}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="Short rationale shown after learners answer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save question"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewQuestionModal;
