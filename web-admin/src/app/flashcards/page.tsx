"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, TableColumn } from "@/components/DataTable";
import Loader from "@/components/Loader";
import api, { fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type GradeNode = {
  id: number;
  name: string;
  subjects: Array<{
    id: number;
    name: string;
    topics: Array<{ id: number; name: string }>;
  }>;
};

type FlashcardRecord = {
  id: number;
  front_text: string;
  back_text: string;
  language: string;
  Topic?: {
    id: number;
    name: string;
    subject: {
      id: number;
      name: string;
      gradeLevel: { id: number; name: string } | null;
    } | null;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

const languageOptions = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
];

const defaultForm = {
  question: "",
  answer: "",
  language: "en",
  topicId: "",
};

const ALL_GRADES_VALUE = "__all_grades__";
const ALL_SUBJECTS_VALUE = "__all_subjects__";
const ALL_TOPICS_VALUE = "__all_topics__";
const ALL_LANGUAGES_VALUE = "__all_languages__";

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

const FlashcardsPage = () => {
  const { toast } = useToast();
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [languageFilter, setLanguageFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [formState, setFormState] = useState(defaultForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingFlashcard, setEditingFlashcard] = useState<FlashcardRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const {
    data: curriculumData,
    isLoading: loadingCurriculum,
    error: curriculumError,
  } = useSWR<{ tree: GradeNode[] }>("/admin/curriculum/tree", fetcher);

  const gradeOptions = useMemo(() => curriculumData?.tree ?? [], [curriculumData]);
  const selectedGrade = gradeOptions.find((grade) => String(grade.id) === selectedGradeId);
  const subjectOptions = selectedGrade?.subjects ?? [];
  const selectedSubject = subjectOptions.find((subject) => String(subject.id) === selectedSubjectId);

  const allTopics = useMemo(
    () => gradeOptions.flatMap((grade) => grade.subjects.flatMap((subject) => subject.topics)),
    [gradeOptions],
  );

  const topicOptions =
    selectedSubject?.topics ??
    (selectedGrade ? selectedGrade.subjects.flatMap((subject) => subject.topics) : allTopics);

  const flashcardKey = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    }
    if (languageFilter) {
      params.set("language", languageFilter);
    }
    if (selectedTopicId) {
      params.set("topicId", selectedTopicId);
    } else if (selectedSubjectId) {
      params.set("subjectId", selectedSubjectId);
    } else if (selectedGradeId) {
      params.set("gradeId", selectedGradeId);
    }
    return `/admin/flashcards?${params.toString()}`;
  }, [languageFilter, limit, page, searchTerm, selectedGradeId, selectedSubjectId, selectedTopicId]);

  const {
    data: flashcardPayload,
    isLoading: loadingFlashcards,
    mutate: mutateFlashcards,
  } = useSWR<{ flashcards: FlashcardRecord[]; pagination: Pagination }>(flashcardKey, fetcher);

  const flashcards = flashcardPayload?.flashcards ?? [];
  const pagination = flashcardPayload?.pagination;

  const columns: TableColumn<FlashcardRecord>[] = useMemo(
    () => [
      {
        key: "front_text",
        label: "Question",
        render: (row) => <span className="font-medium text-[#004976]">{row.front_text}</span>,
      },
      {
        key: "back_text",
        label: "Answer",
        render: (row) => <span className="text-[#505759]">{row.back_text}</span>,
      },
      {
        key: "topic",
        label: "Topic",
        render: (row) =>
          row.Topic ? (
            <div className="flex flex-col text-sm">
              <span className="font-semibold">{row.Topic.name}</span>
              {row.Topic.subject ? (
                <span className="text-xs text-muted-foreground">
                  {row.Topic.subject.gradeLevel ? `${row.Topic.subject.gradeLevel.name} - ` : ""}
                  {row.Topic.subject.name}
                </span>
              ) : null}
            </div>
          ) : (
            <span>—</span>
          ),
      },
      {
        key: "language",
        label: "Language",
        render: (row) => row.language.toUpperCase(),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(row)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingFlashcard(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (flashcard: FlashcardRecord) => {
    setEditingFlashcard(flashcard);
    setFormState({
      question: flashcard.front_text,
      answer: flashcard.back_text,
      language: flashcard.language ?? "en",
      topicId: flashcard.Topic ? String(flashcard.Topic.id) : "",
    });
    setModalOpen(true);
  };

  const handleDelete = (flashcard: FlashcardRecord) => {
    setDeletingId(flashcard.id);
  };

  const submitFlashcard = async () => {
    if (!formState.question.trim() || !formState.answer.trim() || !formState.topicId) {
      toast({
        variant: "destructive",
        title: "All fields are required",
        description: "Please provide question, answer, and topic.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        question: formState.question.trim(),
        answer: formState.answer.trim(),
        topicId: Number(formState.topicId),
        language: formState.language,
      };

      if (editingFlashcard) {
        await api.put(`/admin/flashcards/${editingFlashcard.id}`, payload);
        toast({ title: "Flashcard updated" });
      } else {
        await api.post("/admin/flashcards", payload);
        toast({ title: "Flashcard created" });
      }

      setModalOpen(false);
      resetForm();
      mutateFlashcards();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to save flashcard",
        description: getErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/admin/flashcards/${deletingId}`);
      toast({ title: "Flashcard deleted" });
      setDeletingId(null);
      mutateFlashcards();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete flashcard",
        description: getErrorMessage(error),
      });
    }
  };

  const downloadTemplate = () => {
    const rows = ["question,answer,topicId,language", '"What is 2+2?","4",1,EN'];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "flashcards_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!uploadFile) {
      toast({ variant: "destructive", title: "Select a CSV or XLSX file to import." });
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const response = await api.post("/admin/flashcards/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const summary = response.data?.data ?? {};
      toast({
        title: "Import completed",
        description: `Imported: ${summary.imported ?? 0}, Skipped: ${summary.skipped ?? 0}, Failed: ${summary.failed ?? 0}`,
      });
      setImportModalOpen(false);
      setUploadFile(null);
      mutateFlashcards();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: getErrorMessage(error, "Please verify the template and try again."),
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (loadingCurriculum && !curriculumData && !curriculumError) {
    return <Loader fullscreen message="Loading flashcard workspace..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[#004976]">Flashcards Management</h1>
          <p className="text-sm text-[#505759]">
            Create, edit, and bulk import flashcards tied to the curriculum hierarchy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => mutateFlashcards()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            Template
          </Button>
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            Import
          </Button>
          <Button className="bg-[#00AD50] text-white hover:bg-[#007A3E]" onClick={openCreateModal}>
            Create Flashcard
          </Button>
        </div>
      </div>

      {curriculumError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load the curriculum tree. Topic filter options may be incomplete until the data loads.
        </div>
      ) : null}

      <Card className="border border-[#919D9D]/30">
        <CardHeader>
          <CardTitle className="text-base text-[#004976]">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Grade</label>
              <Select
                value={selectedGradeId || ALL_GRADES_VALUE}
                onValueChange={(value) => {
                  const nextGradeId = value === ALL_GRADES_VALUE ? "" : value;
                  setSelectedGradeId(nextGradeId);
                  setSelectedSubjectId("");
                  setSelectedTopicId("");
                  setPage(1);
                }}
              >
              <SelectTrigger>
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GRADES_VALUE}>All grades</SelectItem>
                {gradeOptions
                  .filter((grade) => grade?.id != null)
                  .map((grade) => (
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
              value={selectedSubjectId || ALL_SUBJECTS_VALUE}
              onValueChange={(value) => {
                const nextSubjectId = value === ALL_SUBJECTS_VALUE ? "" : value;
                setSelectedSubjectId(nextSubjectId);
                setSelectedTopicId("");
                setPage(1);
              }}
              disabled={!selectedGradeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedGradeId ? "All subjects" : "Select a grade first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SUBJECTS_VALUE}>All subjects</SelectItem>
                {subjectOptions
                  .filter((subject) => subject?.id != null)
                  .map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Topic</label>
            <Select
              value={selectedTopicId || ALL_TOPICS_VALUE}
              onValueChange={(value) => {
                const nextTopicId = value === ALL_TOPICS_VALUE ? "" : value;
                setSelectedTopicId(nextTopicId);
                setPage(1);
              }}
              disabled={!selectedSubjectId && !selectedGradeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedSubjectId || selectedGradeId ? "All topics" : "Select grade/subject"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOPICS_VALUE}>All topics</SelectItem>
                {topicOptions
                  .filter((topic) => topic?.id != null)
                  .map((topic) => (
                    <SelectItem key={topic.id} value={String(topic.id)}>
                      {topic.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Language</label>
            <Select
              value={languageFilter || ALL_LANGUAGES_VALUE}
              onValueChange={(value) => {
                const nextLanguageFilter = value === ALL_LANGUAGES_VALUE ? "" : value;
                setLanguageFilter(nextLanguageFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LANGUAGES_VALUE}>All</SelectItem>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2 lg:col-span-4">
            <label className="text-sm text-muted-foreground">Search</label>
            <Input
              placeholder="Search by question or answer..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#919D9D]/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-[#004976]">Flashcards</CardTitle>
          {pagination ? (
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1}-
              {Math.min(page * limit, pagination.total)} of {pagination.total}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <DataTable
            columns={columns}
            data={flashcards}
            isLoading={loadingFlashcards}
            searchable={false}
            emptyLabel="No flashcards match your filters."
          />

          {pagination && pagination.total > limit ? (
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page * limit >= pagination.total}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span>Rows</span>
                <Select
                  value={String(limit)}
                  onValueChange={(value) => {
                    setLimit(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50].map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => (!isSaving ? setModalOpen(open) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFlashcard ? "Edit Flashcard" : "Create Flashcard"}</DialogTitle>
            <DialogDescription>All curriculum-aligned flashcards must link to a topic and language.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Question</label>
              <Input
                value={formState.question}
                onChange={(event) => setFormState((prev) => ({ ...prev, question: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Answer</label>
              <Textarea
                rows={3}
                value={formState.answer}
                onChange={(event) => setFormState((prev) => ({ ...prev, answer: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Language</label>
              <Select
                value={formState.language}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, language: value }))}
              >
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Topic</label>
              <Select
                value={formState.topicId}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, topicId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions
                    .filter((grade) => grade && grade.id != null)
                    .flatMap((grade) =>
                      grade.subjects
                        .filter((subject) => subject && subject.id != null)
                        .flatMap((subject) =>
                          subject.topics
                            .filter((topic) => topic && topic.id != null)
                            .map((topic) => (
                              <SelectItem key={topic.id} value={String(topic.id)}>
                                {grade.name} - {subject.name} - {topic.name}
                              </SelectItem>
                            )),
                        ),
                    )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="bg-[#00AD50] text-white hover:bg-[#007A3E]" onClick={submitFlashcard} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingId)} onOpenChange={(open) => (!open ? setDeletingId(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flashcard?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button className="bg-[#B42318] text-white hover:bg-[#8A1A10]" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importModalOpen} onOpenChange={(open) => (!isImporting ? setImportModalOpen(open) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Flashcards</DialogTitle>
            <DialogDescription>Upload the populated CSV/XLSX template to bulk create flashcards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            <p className="text-sm text-muted-foreground">
              Template headers: <code>question, answer, topicId, language</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlashcardsPage;
