"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
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
import { cn } from "@/lib/utils";
import { PenSquare, Plus, RotateCw } from "lucide-react";

dayjs.extend(relativeTime);

type SubjectRecord = {
  id: number;
  subject_name: string;
  GradeLevel?: { name?: string | null };
};

type GradeRecord = {
  id: number;
  name: string;
};

type TopicRecord = {
  id: number;
  topic_name?: string;
  subject_id: number;
};

type PracticeTestQuestion = {
  id: number;
  questionId: number;
  orderIndex: number;
  questionText: string;
  difficulty: string;
  topicId: number;
  topicName: string | null;
};

type PracticeTestRecord = {
  id: number;
  title: string;
  description?: string | null;
  subject?: { id: number; name: string };
  gradeLevel?: { id: number; name: string };
  durationMinutes?: number | null;
  xpReward?: number;
  questionCount: number;
  isActive: boolean;
  difficultyMix: Record<string, number>;
  topicIds: number[];
  topics: Array<{ id: number; name: string }>;
  questions: PracticeTestQuestion[];
  updatedAt?: string;
};

type PracticeTestListResponse = {
  tests: PracticeTestRecord[];
};

type SubjectPayload = { subjects: SubjectRecord[] };
type GradePayload = { grades: GradeRecord[] };
type TopicPayload = { topics: TopicRecord[] };
type PracticeTestDetailResponse = { test: PracticeTestRecord };

type DifficultyField = "EASY" | "MEDIUM" | "HARD";

type FormState = {
  title: string;
  description: string;
  subjectId: string;
  gradeLevelId: string;
  durationMinutes: string;
  xpReward: string;
  questionCount: string;
  topicIds: string[];
  difficultyMix: Record<DifficultyField, string>;
};

const difficultyLabels: Record<DifficultyField, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
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

const ALL_GRADES_FILTER = "ALL_GRADES";
const UNASSIGNED_GRADE = "UNASSIGNED_GRADE";

const defaultFormState: FormState = {
  title: "",
  description: "",
  subjectId: "",
  gradeLevelId: UNASSIGNED_GRADE,
  durationMinutes: "",
  xpReward: "0",
  questionCount: "15",
  topicIds: [],
  difficultyMix: {
    EASY: "5",
    MEDIUM: "7",
    HARD: "3",
  },
};

const PracticeTestsPage = () => {
  const { toast } = useToast();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState(ALL_GRADES_FILTER);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const { data: subjectPayload, isLoading: subjectsLoading } = useSWR<SubjectPayload>(
    "/admin/subjects?limit=200&includeInactive=false",
    fetcher,
  );
  const { data: gradePayload } = useSWR<GradePayload>("/admin/curriculum/grades", fetcher);
  const { data: topicPayload } = useSWR<TopicPayload>(
    "/admin/topics?limit=500&includeInactive=false",
    fetcher,
  );

  useEffect(() => {
    if (!subjectFilter && subjectPayload?.subjects?.length) {
      setSubjectFilter(String(subjectPayload.subjects[0]?.id));
    }
  }, [subjectFilter, subjectPayload]);

  const subjectOptions = useMemo(
    () =>
      (subjectPayload?.subjects ?? []).map((subject) => ({
        id: subject.id,
        label: subject.subject_name,
      })),
    [subjectPayload],
  );

  const gradeOptions = useMemo(
    () =>
      (gradePayload?.grades ?? []).map((grade) => ({
        id: grade.id,
        label: grade.name,
      })),
    [gradePayload],
  );

  const topicsBySubject = useMemo(() => {
    const map = new Map<number, Array<{ id: number; label: string }>>();
    (topicPayload?.topics ?? []).forEach((topic) => {
      const key = topic.subject_id;
      const list = map.get(key) ?? [];
      list.push({ id: topic.id, label: topic.topic_name ?? `Topic ${topic.id}` });
      map.set(key, list);
    });
    return map;
  }, [topicPayload]);

  const listKey = useMemo(() => {
    if (!subjectFilter) {
      return null;
    }
    const params = new URLSearchParams({
      subjectId: subjectFilter,
      includeInactive: includeInactive ? "true" : "false",
    });
    if (gradeFilter && gradeFilter !== ALL_GRADES_FILTER) {
      params.set("gradeLevelId", gradeFilter);
    }
    return `/admin/practice-tests?${params.toString()}`;
  }, [gradeFilter, includeInactive, subjectFilter]);

  const {
    data: testPayload,
    isLoading: testsLoading,
    mutate: mutateTests,
  } = useSWR<PracticeTestListResponse>(listKey, fetcher);

  const tests = testPayload?.tests ?? [];

  const availableTopics = useMemo(() => {
    if (!formState.subjectId) {
      return subjectFilter ? topicsBySubject.get(Number(subjectFilter)) ?? [] : [];
    }
    return topicsBySubject.get(Number(formState.subjectId)) ?? [];
  }, [formState.subjectId, subjectFilter, topicsBySubject]);

  const difficultyTotal = useMemo(() => {
    return (Object.keys(formState.difficultyMix) as DifficultyField[]).reduce((sum, key) => {
      const value = Number(formState.difficultyMix[key]) || 0;
      return sum + value;
    }, 0);
  }, [formState.difficultyMix]);

  const questionCountValue = Number(formState.questionCount) || 0;
  const mixMatchesTarget = difficultyTotal === questionCountValue;

  const resetForm = useCallback(() => {
    setFormState((prev) => ({
      ...defaultFormState,
      subjectId: subjectFilter || prev.subjectId,
    }));
    setEditingId(null);
  }, [subjectFilter]);

  const openCreateModal = () => {
    if (!subjectFilter) {
      toast({
        variant: "destructive",
        title: "Select a subject",
        description: "Choose a subject before creating a practice test.",
      });
      return;
    }
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = async (testId: number) => {
    setLoadingDetail(true);
    try {
      const response = await api.get<PracticeTestDetailResponse>(`/admin/practice-tests/${testId}`);
      const test = response.data?.data?.test ?? response.data?.test;
      if (!test) {
        throw new Error("Unable to load practice test");
      }

      setEditingId(testId);
      setFormState({
        title: test.title,
        description: test.description ?? "",
        subjectId: test.subject?.id ? String(test.subject.id) : subjectFilter,
        gradeLevelId: test.gradeLevel?.id ? String(test.gradeLevel.id) : UNASSIGNED_GRADE,
        durationMinutes: test.durationMinutes ? String(test.durationMinutes) : "",
        xpReward: test.xpReward !== undefined ? String(test.xpReward) : "0",
        questionCount: String(test.questionCount ?? 0),
        topicIds: (test.topicIds ?? []).map(String),
        difficultyMix: {
          EASY: String(test.difficultyMix?.EASY ?? 0),
          MEDIUM: String(test.difficultyMix?.MEDIUM ?? 0),
          HARD: String(test.difficultyMix?.HARD ?? 0),
        },
      });
      setIsFormOpen(true);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to load practice test.");
      toast({ variant: "destructive", title: "Load failed", description: message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const toggleTopic = (topicId: number) => {
    setFormState((prev) => {
      const exists = prev.topicIds.includes(String(topicId));
      return {
        ...prev,
        topicIds: exists
          ? prev.topicIds.filter((id) => id !== String(topicId))
          : [...prev.topicIds, String(topicId)],
      };
    });
  };

  const handleSave = async () => {
    if (!formState.subjectId && !subjectFilter) {
      toast({
        variant: "destructive",
        title: "Select a subject",
        description: "A subject is required before saving.",
      });
      return;
    }
    if (formState.topicIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Select topics",
        description: "Pick at least one topic for this practice test.",
      });
      return;
    }
    if (!mixMatchesTarget) {
      toast({
        variant: "destructive",
        title: "Adjust difficulty mix",
        description: "Difficulty totals must equal the number of questions.",
      });
      return;
    }

    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      subjectId: Number(formState.subjectId || subjectFilter),
      gradeLevelId:
        formState.gradeLevelId === UNASSIGNED_GRADE ? undefined : Number(formState.gradeLevelId),
      durationMinutes: formState.durationMinutes ? Number(formState.durationMinutes) : undefined,
      xpReward: formState.xpReward ? Number(formState.xpReward) : 0,
      questionCount: questionCountValue,
      topicIds: formState.topicIds.map((id) => Number(id)),
      difficultyMix: {
        EASY: Number(formState.difficultyMix.EASY) || 0,
        MEDIUM: Number(formState.difficultyMix.MEDIUM) || 0,
        HARD: Number(formState.difficultyMix.HARD) || 0,
      },
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/practice-tests/${editingId}`, payload);
        toast({ title: "Practice test updated", description: payload.title });
      } else {
        await api.post("/admin/practice-tests", payload);
        toast({ title: "Practice test created", description: payload.title });
      }
      await mutateTests();
      closeForm();
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to save practice test. Please try again.");
      toast({ variant: "destructive", title: "Save failed", description: message });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (test: PracticeTestRecord) => {
    setTogglingId(test.id);
    try {
      await api.patch(`/admin/practice-tests/${test.id}/status`, {
        isActive: !test.isActive,
      });
      await mutateTests();
      toast({
        title: test.isActive ? "Practice test deactivated" : "Practice test reactivated",
        description: test.title,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to update status.");
      toast({ variant: "destructive", title: "Action failed", description: message });
    } finally {
      setTogglingId(null);
    }
  };

  const selectedSubjectLabel =
    subjectOptions.find((subject) => String(subject.id) === subjectFilter)?.label ?? "Subject";

  const renderDifficultySummary = (mix: Record<string, number>) => {
    return (
      <span className="text-xs text-muted-foreground">
        Mix: E{mix.EASY ?? 0} / M{mix.MEDIUM ?? 0} / H{mix.HARD ?? 0}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Practice Tests</h1>
          <p className="text-muted-foreground">
            Build subject-aligned, timed practice tests using ACTIVE Question Bank content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => mutateTests()}
            disabled={!listKey || testsLoading}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateModal} disabled={!subjectFilter}>
            <Plus className="mr-2 h-4 w-4" />
            New practice test
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Subject</label>
          <Select
            value={subjectFilter}
            onValueChange={(value) => {
              setSubjectFilter(value);
              setGradeFilter(ALL_GRADES_FILTER);
            }}
            disabled={subjectsLoading || subjectOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((subject) => (
                <SelectItem key={subject.id} value={String(subject.id)}>
                  {subject.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Grade</label>
          <Select value={gradeFilter} onValueChange={setGradeFilter} disabled={!subjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GRADES_FILTER}>All grades</SelectItem>
              {gradeOptions.map((grade) => (
                <SelectItem key={grade.id} value={String(grade.id)}>
                  {grade.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select
            value={includeInactive ? "all" : "active"}
            onValueChange={(value) => setIncludeInactive(value === "all")}
            disabled={!subjectFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="all">Include inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!subjectFilter ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Choose a subject to load practice tests.
        </div>
      ) : testsLoading ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          Loading practice tests...
        </div>
      ) : tests.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center text-muted-foreground">
          No practice tests found for {selectedSubjectLabel}. Create one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => (
            <div key={test.id} className="space-y-3 rounded-3xl border bg-card/60 p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{test.title}</h2>
                    <Badge variant={test.isActive ? "success" : "outline"}>
                      {test.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{test.questionCount} questions</Badge>
                    {test.durationMinutes ? (
                      <Badge variant="outline">{test.durationMinutes} min</Badge>
                    ) : null}
                    <Badge variant="outline">{test.xpReward ?? 0} XP</Badge>
                  </div>
                  {test.description ? (
                    <p className="text-sm text-muted-foreground">{test.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {test.subject ? <span>{test.subject.name}</span> : null}
                    {test.gradeLevel ? <span>· {test.gradeLevel.name}</span> : null}
                    <span>
                      Updated {test.updatedAt ? dayjs(test.updatedAt).fromNow() : "recently"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(test.id)}
                    disabled={loadingDetail && editingId === test.id}
                  >
                    <PenSquare className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant={test.isActive ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => toggleStatus(test)}
                    disabled={togglingId === test.id}
                  >
                    {test.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border bg-background/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Topics & mix</p>
                  {renderDifficultySummary(test.difficultyMix ?? {})}
                </div>
                <div className="flex flex-wrap gap-2">
                  {test.topics.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No topic metadata.</span>
                  ) : (
                    test.topics.map((topic) => (
                      <Badge key={topic.id} variant="outline">
                        {topic.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border bg-background/60 p-4">
                <p className="text-sm font-medium text-muted-foreground">Question preview</p>
                {test.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions attached.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {test.questions.slice(0, 5).map((question) => (
                      <li key={question.id} className="rounded-xl bg-card/70 p-3">
                        <p className="font-medium">
                          {question.orderIndex + 1}. {question.questionText}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{question.difficulty}</Badge>
                          {question.topicName ? (
                            <Badge variant="outline">{question.topicName}</Badge>
                          ) : null}
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

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          } else {
            setIsFormOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-3xl space-y-4">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit practice test" : "Create practice test"}</DialogTitle>
            <DialogDescription>
              {formState.subjectId
                ? `Subject: ${
                    subjectOptions.find((subject) => String(subject.id) === formState.subjectId)?.label ??
                    selectedSubjectLabel
                  }`
                : `Subject: ${selectedSubjectLabel}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <Select
                value={formState.subjectId || subjectFilter}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    subjectId: value,
                    topicIds: [],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Grade</label>
              <Select
                value={formState.gradeLevelId}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    gradeLevelId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_GRADE}>Not specified</SelectItem>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade.id} value={String(grade.id)}>
                      {grade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Practice test title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional summary shown in admin tools"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Duration (minutes)</label>
                <Input
                  type="number"
                  min={5}
                  value={formState.durationMinutes}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, durationMinutes: event.target.value }))
                  }
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">XP reward</label>
                <Input
                  type="number"
                  min={0}
                  value={formState.xpReward}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, xpReward: event.target.value }))
                  }
                  placeholder="75"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Question count
                </label>
                <Input
                  type="number"
                  min={1}
                  value={formState.questionCount}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, questionCount: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Difficulty mix totals
                </label>
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    mixMatchesTarget ? "border-muted text-muted-foreground" : "border-destructive text-destructive",
                  )}
                >
                  {mixMatchesTarget
                    ? "Mix matches question count."
                    : `Currently ${difficultyTotal} of ${questionCountValue} questions allocated.`}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Difficulty mix</label>
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(difficultyLabels) as DifficultyField[]).map((key) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{difficultyLabels[key]}</p>
                    <Input
                      type="number"
                      min={0}
                      value={formState.difficultyMix[key]}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          difficultyMix: {
                            ...prev.difficultyMix,
                            [key]: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <p>
                  Topics ({formState.topicIds.length}
                  {formState.topicIds.length === 1 ? " selected" : " selected"})
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormState((prev) => ({ ...prev, topicIds: [] }))}
                  disabled={formState.topicIds.length === 0}
                >
                  Clear
                </Button>
              </div>
              {availableTopics.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Select a subject to load available topics.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTopics.map((topic) => {
                    const active = formState.topicIds.includes(String(topic.id));
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted-foreground/30 text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {topic.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !mixMatchesTarget || formState.topicIds.length === 0}
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Create practice test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PracticeTestsPage;
