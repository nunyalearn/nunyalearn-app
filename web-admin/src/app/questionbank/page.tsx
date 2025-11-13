"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import NewQuestionModal from "./NewQuestionModal";

type QuestionRecord = {
  id: number;
  questionText: string;
  questionType: string;
  difficulty: string;
  language: string;
  topicId: number;
  topicName?: string | null;
  subjectName?: string | null;
  status: string;
  isActive: boolean;
  options: string[];
  correctOption?: string | null;
  correctAnswers: string[];
  explanation?: string | null;
  updatedAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

type QuestionPayload = {
  questions: QuestionRecord[];
  pagination?: Pagination;
};

type TopicPayload = {
  topics: Array<{
    id: number;
    topic_name?: string;
    name?: string;
    Subject?: { subject_name?: string | null };
  }>;
};

type TopicOption = {
  id: number;
  label: string;
};

const ALL_TOPICS = "ALL_TOPICS";
const ALL_DIFFICULTIES = "ALL_DIFFICULTIES";

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
  const [topicFilter, setTopicFilter] = useState(ALL_TOPICS);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL_DIFFICULTIES);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, topicFilter, difficultyFilter, statusFilter]);

  const listKey = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (searchTerm) {
      params.set("search", searchTerm);
    }
    if (topicFilter && topicFilter !== ALL_TOPICS) {
      params.set("topicId", topicFilter);
    }
    if (difficultyFilter && difficultyFilter !== ALL_DIFFICULTIES) {
      params.set("difficulty", difficultyFilter);
    }
    if (statusFilter !== "all") {
      params.set("isActive", statusFilter === "active" ? "true" : "false");
    }

    return `/admin/questionbank?${params.toString()}`;
  }, [difficultyFilter, limit, page, searchTerm, statusFilter, topicFilter]);

  const {
    data: questionPayload,
    isLoading,
    mutate,
  } = useSWR<QuestionPayload>(listKey, fetcher);

  const { data: topicPayload, isLoading: topicsLoading } = useSWR<TopicPayload>(
    "/admin/topics?limit=200&includeInactive=true",
    fetcher,
  );

  const questions = questionPayload?.questions ?? [];
  const pagination = questionPayload?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / limit) : 1;

  const topicOptions: TopicOption[] = useMemo(() => {
    return (topicPayload?.topics ?? []).map((topic) => ({
      id: topic.id,
      label: `${topic.topic_name ?? topic.name ?? `Topic ${topic.id}`}${
        topic.Subject?.subject_name ? ` • ${topic.Subject.subject_name}` : ""
      }`,
    }));
  }, [topicPayload]);

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "xlsx" });
      if (topicFilter && topicFilter !== ALL_TOPICS) {
        params.set("topicId", topicFilter);
      }
      if (difficultyFilter && difficultyFilter !== ALL_DIFFICULTIES) {
        params.set("difficulty", difficultyFilter);
      }
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      if (searchTerm) params.set("search", searchTerm);
      const query = params.toString();
      await downloadFile(
        `/admin/questionbank/export${query ? `?${query}` : ""}`,
        "question-bank.xlsx",
      );
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

  const columns: TableColumn<QuestionRecord>[] = useMemo(
    () => [
      {
        key: "questionText",
        label: "Question",
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.questionText}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{formatQuestionType(row.questionType)}</Badge>
              <span>{row.language}</span>
              {row.options?.length ? <span>{row.options.length} options</span> : null}
            </div>
          </div>
        ),
      },
      {
        key: "topic",
        label: "Topic",
        render: (row) => (
          <div className="space-y-1">
            <p className="font-medium">{row.topicName ?? "Unassigned"}</p>
            <p className="text-xs text-muted-foreground">{row.subjectName ?? ""}</p>
          </div>
        ),
      },
      {
        key: "difficulty",
        label: "Difficulty",
        render: (row) => <Badge variant="outline">{row.difficulty}</Badge>,
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
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
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
    [handleToggleQuestion, togglingId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Question Bank</h1>
          <p className="text-muted-foreground">
            Manage multi-format assessment items, import spreadsheets, and keep archived questions in sync.
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
          <Button onClick={() => setQuestionModalOpen(true)}>New Question</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Search</label>
          <Input
            placeholder="Search question text..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Topic</label>
          <Select value={topicFilter} onValueChange={setTopicFilter} disabled={topicsLoading}>
            <SelectTrigger>
              <SelectValue placeholder={topicsLoading ? "Loading topics..." : "All topics"} />
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Difficulty</label>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All difficulties" />
            </SelectTrigger>
            <SelectContent>
              {difficultyOptions.map((option) => (
                <SelectItem key={option.value || "all"} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
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
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleImportChange}
      />

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
        onOpenChange={setQuestionModalOpen}
        onCreated={async () => {
          await mutate();
        }}
      />
    </div>
  );
};

export default QuestionBankPage;
