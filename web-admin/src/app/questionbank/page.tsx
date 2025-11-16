"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DataTable, TableColumn } from "@/components/DataTable";
import api, { downloadFile, fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import NewQuestionModal, { QuestionModalPayload } from "./NewQuestionModal";

type QuestionUsage = {
  quizzes: number;
  practiceTests: number;
};

type QuestionRecord = {
  id: number;
  questionText: string;
  questionType: string;
  difficulty: string;
  language: string;
  topicId: number;
  topicName?: string | null;
  subjectId?: number | null;
  subjectName?: string | null;
  gradeId?: number | null;
  gradeName?: string | null;
  status: string;
  isActive: boolean;
  options: string[];
  correctOption?: string | null;
  correctAnswers: string[];
  explanation?: string | null;
  usage?: QuestionUsage;
  updatedAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

type SubjectBreakdown = {
  subjectId: number;
  subjectName: string;
  count: number;
};

type QuestionAnalytics = {
  total: number;
  active: number;
  difficulty: Record<string, number>;
  subjects: SubjectBreakdown[];
};

type QuestionPayload = {
  questions: QuestionRecord[];
  pagination?: Pagination;
  analytics?: QuestionAnalytics;
};

type GradeOption = {
  id: number;
  name: string;
};

type SubjectOption = {
  id: number;
  subject_name?: string;
  name?: string;
};

type TopicPayload = {
  topics: Array<{
    id: number;
    topic_name?: string;
    name?: string;
  }>;
};

type TopicOption = {
  id: number;
  label: string;
};

const ALL_GRADES = "ALL_GRADES";
const ALL_SUBJECTS = "ALL_SUBJECTS";
const ALL_TOPICS = "ALL_TOPICS";
const ALL_DIFFICULTIES = "ALL_DIFFICULTIES";
const ALL_TYPES = "ALL_TYPES";
const ALL_LANGUAGES = "ALL_LANGUAGES";

const difficultyOptions = [
  { label: "All difficulties", value: ALL_DIFFICULTIES },
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Active only", value: "active" },
  { label: "Inactive only", value: "inactive" },
];

const questionTypeFilterOptions = [
  { label: "All types", value: ALL_TYPES },
  { label: "MCQ", value: "MULTIPLE_CHOICE" },
  { label: "True / False", value: "TRUE_FALSE" },
  { label: "Fill in the Blank", value: "FILL_IN_THE_BLANK" },
  { label: "Short Answer", value: "SHORT_ANSWER" },
];

const languageFilterOptions = [
  { label: "All languages", value: ALL_LANGUAGES },
  { label: "English (EN)", value: "EN" },
  { label: "French (FR)", value: "FR" },
];

type TemplateGuideline = {
  type: string;
  title: string;
  rules: string[];
};

const templateGuidelines: TemplateGuideline[] = [
  {
    type: "MULTIPLE_CHOICE",
    title: "Multiple Choice",
    rules: [
      "Enter at least two answer choices in `options` separated by `|`, commas, or line breaks.",
      "`correctOption` must exactly match one of the values from `options`.",
      "Leave `correctAnswers` empty for this question type.",
    ],
  },
  {
    type: "TRUE_FALSE",
    title: "True / False",
    rules: [
      "Keep `options` empty (the system auto-uses TRUE/FALSE).",
      "`correctOption` must be either `TRUE` or `FALSE`.",
      "`correctAnswers` should stay empty.",
    ],
  },
  {
    type: "FILL_IN_THE_BLANK",
    title: "Fill in the Blank",
    rules: [
      "Leave `options` empty and add blanks (____) in `questionText`.",
      "List every accepted response inside `correctAnswers` separated by `|` or commas.",
      "Leave `correctOption` empty.",
    ],
  },
  {
    type: "SHORT_ANSWER",
    title: "Short Answer",
    rules: [
      "Leave `options` empty; prompts live in `questionText`.",
      "Populate `correctAnswers` with acceptable phrases separated by `|` or commas.",
      "Leave `correctOption` empty.",
    ],
  },
];

const difficultyBadgeClasses: Record<string, string> = {
  EASY: "border-emerald-100 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-100 bg-amber-50 text-amber-700",
  HARD: "border-rose-100 bg-rose-50 text-rose-700",
};

const formatQuestionType = (type: string) => type.replace(/_/g, " ");

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

const QuestionBankPage = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState(ALL_GRADES);
  const [subjectFilter, setSubjectFilter] = useState(ALL_SUBJECTS);
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL_DIFFICULTIES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [languageFilter, setLanguageFilter] = useState(ALL_LANGUAGES);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionModalPayload | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRecord | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    gradeFilter,
    subjectFilter,
    topicFilter,
    difficultyFilter,
    typeFilter,
    statusFilter,
    languageFilter,
  ]);

  const listKey = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (searchTerm) {
      params.set("search", searchTerm);
    }
    if (gradeFilter !== ALL_GRADES) {
      params.set("gradeId", gradeFilter);
    }
    if (subjectFilter !== ALL_SUBJECTS) {
      params.set("subjectId", subjectFilter);
    }
    if (topicFilter !== ALL_TOPICS) {
      params.set("topicId", topicFilter);
    }
    if (difficultyFilter !== ALL_DIFFICULTIES) {
      params.set("difficulty", difficultyFilter);
    }
    if (typeFilter !== ALL_TYPES) {
      params.set("type", typeFilter);
    }
    if (languageFilter !== ALL_LANGUAGES) {
      params.set("language", languageFilter);
    }
    if (statusFilter !== "all") {
      params.set("isActive", statusFilter === "active" ? "true" : "false");
    }

    return `/admin/questionbank?${params.toString()}`;
  }, [
    difficultyFilter,
    gradeFilter,
    languageFilter,
    limit,
    page,
    searchTerm,
    statusFilter,
    subjectFilter,
    topicFilter,
    typeFilter,
  ]);

  const { data: questionPayload, isLoading, mutate } = useSWR<QuestionPayload>(listKey, fetcher);
  const { data: gradePayload } = useSWR<{ grades: GradeOption[] }>("/admin/curriculum/grades", fetcher);

  const subjectKey =
    gradeFilter !== ALL_GRADES ? `/admin/curriculum/subjects?gradeLevelId=${gradeFilter}` : null;
  const { data: subjectPayload } = useSWR<{ subjects: SubjectOption[] }>(subjectKey, fetcher);

  const topicKey =
    subjectFilter !== ALL_SUBJECTS ? `/admin/curriculum/topics?subjectId=${subjectFilter}` : null;
  const { data: topicPayload, isLoading: topicsLoading } = useSWR<TopicPayload>(topicKey, fetcher);

  const gradeOptions = gradePayload?.grades ?? [];
  const subjectOptions = subjectPayload?.subjects ?? [];
  const topicOptions: TopicOption[] = useMemo(
    () =>
      (topicPayload?.topics ?? []).map((topic) => ({
        id: topic.id,
        label: topic.topic_name ?? topic.name ?? `Topic ${topic.id}`,
      })),
    [topicPayload],
  );

  const questions = questionPayload?.questions ?? [];
  const pagination = questionPayload?.pagination;
  const analytics = questionPayload?.analytics;
  const totalPages = pagination ? Math.ceil(pagination.total / limit) : 1;
  const totalCount = analytics?.total ?? pagination?.total ?? 0;
  const activeCount = analytics?.active ?? 0;
  const difficultyStats = {
    EASY: analytics?.difficulty?.EASY ?? 0,
    MEDIUM: analytics?.difficulty?.MEDIUM ?? 0,
    HARD: analytics?.difficulty?.HARD ?? 0,
  };
  const subjectStats = analytics?.subjects ?? [];

  const handleGradeFilterChange = (value: string) => {
    setGradeFilter(value);
    setSubjectFilter(ALL_SUBJECTS);
    setTopicFilter(ALL_TOPICS);
  };

  const handleSubjectFilterChange = (value: string) => {
    setSubjectFilter(value);
    setTopicFilter(ALL_TOPICS);
  };

  const handleToggleQuestion = useCallback(
    async (question: QuestionRecord) => {
      const endpoint = question.isActive
        ? `/admin/questionbank/${question.id}/deactivate`
        : `/admin/questionbank/${question.id}/reactivate`;
      setTogglingId(question.id);
      try {
        await api.patch(endpoint);
        toast({
          title: question.isActive ? "Question deactivated" : "Question reactivated",
          description: question.questionText,
        });
        await mutate();
      } catch (error: unknown) {
        const message = getErrorMessage(error, "Unable to update question status.");
        toast({ variant: "destructive", title: "Update failed", description: message });
      } finally {
        setTogglingId(null);
      }
    },
    [mutate, toast],
  );

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await api.post("/admin/questionbank/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const stats = response.data?.data ?? response.data ?? {};
      toast({
        title: "Import completed",
        description: `Imported ${stats.imported ?? 0}, skipped ${stats.skipped ?? 0}.`,
      });
      await mutate();
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Something went wrong while importing questions.");
      toast({ variant: "destructive", title: "Import failed", description: message });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams({ format: "xlsx" });
    if (gradeFilter !== ALL_GRADES) params.set("gradeId", gradeFilter);
    if (subjectFilter !== ALL_SUBJECTS) params.set("subjectId", subjectFilter);
    if (topicFilter !== ALL_TOPICS) params.set("topicId", topicFilter);
    if (difficultyFilter !== ALL_DIFFICULTIES) params.set("difficulty", difficultyFilter);
    if (typeFilter !== ALL_TYPES) params.set("type", typeFilter);
    if (languageFilter !== ALL_LANGUAGES) params.set("language", languageFilter);
    if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
    if (searchTerm) params.set("search", searchTerm);
    return params;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildQueryParams();
      await downloadFile(`/admin/questionbank/export?${params.toString()}`, "question-bank.xlsx");
      toast({ title: "Export ready", description: "Question bank export downloaded." });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Something went wrong while exporting questions.");
      toast({ variant: "destructive", title: "Export failed", description: message });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadFile("/admin/questionbank/template", "question-bank-template.xlsx");
      toast({ title: "Template downloaded", description: "Fill it out before your next import." });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to download the template.");
      toast({ variant: "destructive", title: "Download failed", description: message });
    }
  };

  const handleDownloadSampleTemplate = async () => {
    try {
      await downloadFile(
        "/admin/questionbank/template?includeSamples=true",
        "question-bank-template-sample.xlsx",
      );
      toast({
        title: "Sample template downloaded",
        description: "Use the example rows as a reference when preparing imports.",
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to download the sample template.");
      toast({ variant: "destructive", title: "Download failed", description: message });
    }
  };

  const handleDownloadTopicMapping = async () => {
    try {
      await downloadFile(
        "/admin/questionbank/topic-mapping?format=xlsx",
        "question-topic-mapping.xlsx",
      );
      toast({
        title: "Topic mapping ready",
        description: "Use it to match grade, subject, and topic IDs.",
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to download the topic mapping file.");
      toast({ variant: "destructive", title: "Download failed", description: message });
    }
  };

  const openCreateModal = () => {
    setEditingQuestion(null);
    setQuestionModalOpen(true);
  };

  const openEditModal = useCallback((question: QuestionRecord) => {
    setEditingQuestion(question);
    setQuestionModalOpen(true);
  }, []);

  const handleModalChange = (open: boolean) => {
    setQuestionModalOpen(open);
    if (!open) {
      setEditingQuestion(null);
    }
  };

  const columns: TableColumn<QuestionRecord>[] = useMemo(
    () => [
      {
        key: "questionText",
        label: "Question",
        render: (row) => (
          <div className="space-y-1">
            <p className="line-clamp-2 font-semibold text-[#004976]" title={row.questionText}>
              {row.questionText}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{formatQuestionType(row.questionType)}</Badge>
              <span>{row.language}</span>
            </div>
          </div>
        ),
      },
      {
        key: "questionType",
        label: "Type",
        render: (row) => (
          <Badge variant="outline" className="capitalize">
            {formatQuestionType(row.questionType)}
          </Badge>
        ),
      },
      {
        key: "difficulty",
        label: "Difficulty",
        render: (row) => (
          <Badge variant="outline" className={difficultyBadgeClasses[row.difficulty] ?? ""}>
            {row.difficulty}
          </Badge>
        ),
      },
      {
        key: "language",
        label: "Language",
        render: (row) => <span className="uppercase">{row.language}</span>,
      },
      {
        key: "grade",
        label: "Grade",
        render: (row) => row.gradeName ?? "—",
      },
      {
        key: "subject",
        label: "Subject",
        render: (row) => row.subjectName ?? "—",
      },
      {
        key: "topic",
        label: "Topic",
        render: (row) => row.topicName ?? "—",
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <div className="space-y-1">
            <Badge variant={row.isActive ? "success" : "outline"}>
              {row.isActive ? "Active" : "Inactive"}
            </Badge>
            <p className="text-xs text-muted-foreground">{row.status}</p>
          </div>
        ),
      },
      {
        key: "usage",
        label: "Used In",
        render: (row) => (
          <div className="text-sm text-muted-foreground">
            <p>{row.usage?.quizzes ?? 0} quizzes</p>
            <p>{row.usage?.practiceTests ?? 0} practice tests</p>
          </div>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreviewQuestion(row)}>
              View
            </Button>
            <Button size="sm" variant="outline" onClick={() => openEditModal(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggleQuestion(row)}
              disabled={togglingId === row.id}
            >
              {row.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        ),
      },
    ],
    [handleToggleQuestion, openEditModal, togglingId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#004976]">Question Bank</h1>
          <p className="text-sm text-muted-foreground">
            Manage multi-format questions, bulk imports, and performance insights for every topic.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export XLSX"}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? "Importing..." : "Import CSV/XLSX"}
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <Button variant="outline" onClick={handleDownloadSampleTemplate}>
            Download Sample Template
          </Button>
          <Button variant="outline" onClick={handleDownloadTopicMapping}>
            Topic Mapping
          </Button>
          <Button onClick={openCreateModal}>New Question</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-[#919D9D]/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#004976]">{totalCount}</p>
          </CardContent>
        </Card>
        <Card className="border border-[#919D9D]/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Active Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#00AD50]">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border border-[#919D9D]/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Difficulty Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Easy</span>
              <span className="font-semibold text-[#004976]">{difficultyStats.EASY}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Medium</span>
              <span className="font-semibold text-[#004976]">{difficultyStats.MEDIUM}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Hard</span>
              <span className="font-semibold text-[#004976]">{difficultyStats.HARD}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#919D9D]/30 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Top Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            {subjectStats.length ? (
              <ul className="space-y-2 text-sm">
                {subjectStats.map((subject) => (
                  <li
                    key={subject.subjectId}
                    className="flex items-center justify-between rounded-full border border-slate-200 px-3 py-1"
                  >
                    <span className="font-medium text-[#004976]">{subject.subjectName}</span>
                    <span className="text-muted-foreground">{subject.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Subject distribution will appear once data matches your filters.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[#919D9D]/30">
        <CardHeader>
          <CardTitle className="text-base text-[#004976]">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm text-muted-foreground">Search</label>
            <Input
              placeholder="Search question text..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Grade</label>
            <Select value={gradeFilter} onValueChange={handleGradeFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GRADES}>All grades</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade.id} value={String(grade.id)}>
                    {grade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Subject</label>
            <Select
              value={subjectFilter}
              onValueChange={handleSubjectFilterChange}
              disabled={gradeFilter === ALL_GRADES}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={gradeFilter === ALL_GRADES ? "Select a grade first" : "All subjects"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SUBJECTS}>All subjects</SelectItem>
                {subjectOptions.map((subject) => (
                  <SelectItem key={subject.id} value={String(subject.id)}>
                    {subject.subject_name ?? subject.name ?? `Subject ${subject.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Topic</label>
            <Select
              value={topicFilter}
              onValueChange={setTopicFilter}
              disabled={subjectFilter === ALL_SUBJECTS}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    subjectFilter === ALL_SUBJECTS
                      ? "Select a subject first"
                      : topicsLoading
                        ? "Loading..."
                        : "All topics"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOPICS}>All topics</SelectItem>
                {topicOptions.map((topic) => (
                  <SelectItem key={topic.id} value={String(topic.id)}>
                    {topic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Difficulty</label>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All difficulties" />
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
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {questionTypeFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Language</label>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                {languageFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleImportChange}
      />

      <div className="rounded-3xl border border-dashed border-[#919D9D]/50 bg-card/30 px-4 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-[#004976]">View Template Guidelines</p>
          <p className="text-xs text-muted-foreground">
            Each row needs a valid `topicId` from the Topic Mapping download. Leave `language` empty to default to EN.
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {templateGuidelines.map((guide) => (
            <div
              key={guide.type}
              className="rounded-2xl border border-[#919D9D]/40 bg-background/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00AD50]">
                {guide.type}
              </p>
              <p className="text-sm font-medium text-[#004976]">{guide.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {guide.rules.map((rule) => (
                  <li key={`${guide.type}-${rule}`}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={questions}
        isLoading={isLoading}
        searchable={false}
        emptyLabel="No questions match your filters."
      />

      {pagination ? (
        <div className="flex flex-col gap-2 rounded-3xl border bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min(page * limit, pagination.total)} of {pagination.total} questions
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <NewQuestionModal
        open={questionModalOpen}
        onOpenChange={handleModalChange}
        question={editingQuestion ?? undefined}
        onCreated={async () => {
          await mutate();
        }}
      />

      <Dialog open={Boolean(previewQuestion)} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
        <DialogContent className="max-w-2xl space-y-4">
          <DialogHeader>
            <DialogTitle>Question preview</DialogTitle>
            <DialogDescription>
              {previewQuestion?.topicName ?? "Unassigned topic"} · {previewQuestion?.subjectName ?? "No subject"}
            </DialogDescription>
          </DialogHeader>
          {previewQuestion ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Question</p>
                <p className="mt-1 whitespace-pre-line text-base font-semibold text-foreground">
                  {previewQuestion.questionText}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{formatQuestionType(previewQuestion.questionType)}</Badge>
                <Badge variant="outline" className={difficultyBadgeClasses[previewQuestion.difficulty] ?? ""}>
                  {previewQuestion.difficulty}
                </Badge>
                <Badge variant="outline" className="uppercase">
                  {previewQuestion.language}
                </Badge>
                <Badge variant={previewQuestion.isActive ? "success" : "outline"}>
                  {previewQuestion.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {previewQuestion.questionType === "MULTIPLE_CHOICE" ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Options</p>
                  <ul className="mt-2 space-y-2">
                    {previewQuestion.options.map((option, index) => (
                      <li
                        key={`${option}-${index}`}
                        className={`rounded-2xl border px-3 py-2 ${
                          previewQuestion.correctOption === option
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-border"
                        }`}
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {previewQuestion.questionType === "TRUE_FALSE" ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Correct answer</p>
                  <p className="mt-1 font-semibold text-[#004976]">
                    {previewQuestion.correctOption ?? "—"}
                  </p>
                </div>
              ) : null}
              {["FILL_IN_THE_BLANK", "SHORT_ANSWER"].includes(previewQuestion.questionType) ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Accepted answers</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {previewQuestion.correctAnswers.map((answer, index) => (
                      <li key={`${answer}-${index}`}>{answer}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {previewQuestion.explanation ? (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Explanation</p>
                  <p className="mt-1 text-muted-foreground">{previewQuestion.explanation}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-4 rounded-2xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {previewQuestion.usage?.quizzes ?? 0} quizzes · {previewQuestion.usage?.practiceTests ?? 0} practice tests
                </span>
                <span>
                  Updated {previewQuestion.updatedAt ? new Date(previewQuestion.updatedAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBankPage;

