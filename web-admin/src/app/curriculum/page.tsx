"use client";

import { FormEvent, useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataTable, TableColumn } from "@/components/DataTable";
import api, { fetcher } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type GradeLevelRow = {
  id: number;
  name: string;
  description?: string | null;
  order_index?: number | null;
  is_active: boolean;
  subjectCount?: number;
};

type SubjectRow = {
  id: number;
  subject_name: string;
  grade_level: string;
  description?: string | null;
  is_active: boolean;
  topicCount?: number;
};

type TopicRow = {
  id: number;
  topic_name: string;
  difficulty: string;
  is_active: boolean;
  Subject?: {
    id: number;
    subject_name: string;
  };
};

const selectClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

const difficultyOptions = [
  { value: "easy", label: "Easy" },
  { value: "med", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const CurriculumPage = () => {
  const { toast } = useToast();
  const {
    data: gradePayload,
    isLoading: loadingGrades,
    mutate: mutateGrades,
  } = useSWR<{ gradeLevels: GradeLevelRow[] }>("/admin/grades", fetcher);
  const {
    data: subjectPayload,
    isLoading: loadingSubjects,
    mutate: mutateSubjects,
  } = useSWR<{ subjects: SubjectRow[] }>("/admin/subjects", fetcher);
  const {
    data: topicPayload,
    isLoading: loadingTopics,
    mutate: mutateTopics,
  } = useSWR<{ topics: TopicRow[] }>("/admin/topics", fetcher);

  const gradeLevels = gradePayload?.gradeLevels ?? [];
  const subjects = subjectPayload?.subjects ?? [];
  const topics = topicPayload?.topics ?? [];

  const [gradeForm, setGradeForm] = useState({ name: "", orderIndex: "", description: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", gradeLevelId: "", description: "" });
  const [topicForm, setTopicForm] = useState({ name: "", subjectId: "", difficulty: "med" });

  const getErrorMessage = (error: any) => {
    if (error?.response?.data?.message) {
      return error.response.data.message as string;
    }
    return "Please try again.";
  };

  const handleGradeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gradeForm.name.trim()) {
      toast({ variant: "destructive", title: "Name is required" });
      return;
    }
    try {
      await api.post("/admin/grades", {
        name: gradeForm.name.trim(),
        description: gradeForm.description?.trim() || undefined,
        orderIndex: gradeForm.orderIndex ? Number(gradeForm.orderIndex) : undefined,
      });
      toast({ title: "Grade level added" });
      setGradeForm({ name: "", orderIndex: "", description: "" });
      mutateGrades();
      mutateSubjects();
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to save grade level", description: getErrorMessage(error) });
    }
  };

  const handleSubjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.gradeLevelId) {
      toast({ variant: "destructive", title: "Subject name and grade level are required" });
      return;
    }
    try {
      await api.post("/admin/subjects", {
        name: subjectForm.name.trim(),
        gradeLevelId: Number(subjectForm.gradeLevelId),
        description: subjectForm.description?.trim() || undefined,
      });
      toast({ title: "Subject added" });
      setSubjectForm({ name: "", gradeLevelId: "", description: "" });
      mutateSubjects();
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to save subject", description: getErrorMessage(error) });
    }
  };

  const handleTopicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!topicForm.name.trim() || !topicForm.subjectId) {
      toast({ variant: "destructive", title: "Topic name and subject are required" });
      return;
    }
    try {
      await api.post("/admin/topics", {
        subjectId: Number(topicForm.subjectId),
        name: topicForm.name.trim(),
        difficulty: topicForm.difficulty,
      });
      toast({ title: "Topic added" });
      setTopicForm({ name: "", subjectId: "", difficulty: "med" });
      mutateTopics();
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to save topic", description: getErrorMessage(error) });
    }
  };

  const gradeColumns: TableColumn<GradeLevelRow>[] = useMemo(
    () => [
      { key: "name", label: "Grade Level" },
      {
        key: "description",
        label: "Description",
        render: (row) => row.description || "—",
      },
      {
        key: "subjectCount",
        label: "Subjects",
        render: (row) => row.subjectCount ?? 0,
      },
      {
        key: "is_active",
        label: "Status",
        render: (row) => (row.is_active ? "Active" : "Archived"),
      },
    ],
    [],
  );

  const subjectColumns: TableColumn<SubjectRow>[] = useMemo(
    () => [
      { key: "subject_name", label: "Subject" },
      { key: "grade_level", label: "Grade" },
      {
        key: "topicCount",
        label: "Topics",
        render: (row) => row.topicCount ?? 0,
      },
      {
        key: "is_active",
        label: "Status",
        render: (row) => (row.is_active ? "Active" : "Archived"),
      },
    ],
    [],
  );

  const topicColumns: TableColumn<TopicRow>[] = useMemo(
    () => [
      { key: "topic_name", label: "Topic" },
      {
        key: "Subject",
        label: "Subject",
        render: (row) => row.Subject?.subject_name ?? "—",
      },
      {
        key: "difficulty",
        label: "Difficulty",
        render: (row) => row.difficulty.toUpperCase(),
      },
      {
        key: "is_active",
        label: "Status",
        render: (row) => (row.is_active ? "Active" : "Archived"),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Curriculum Builder</h1>
        <p className="text-muted-foreground">Organize grade levels, subjects, and topics powering the learner catalog.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grade Levels</CardTitle>
          <CardDescription>Define the academic hierarchy before attaching subjects.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleGradeSubmit} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <Input value={gradeForm.name} onChange={(event) => setGradeForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Order</label>
              <Input
                type="number"
                value={gradeForm.orderIndex}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, orderIndex: event.target.value }))}
                min={0}
                placeholder="e.g. 6"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={gradeForm.description}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Add Grade Level</Button>
            </div>
          </form>

          <DataTable columns={gradeColumns} data={gradeLevels} isLoading={loadingGrades} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
          <CardDescription>Attach learning tracks to a grade level and provide helpful descriptions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubjectSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Subject Name</label>
              <Input
                value={subjectForm.name}
                onChange={(event) => setSubjectForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Grade Level</label>
              <select
                value={subjectForm.gradeLevelId}
                onChange={(event) => setSubjectForm((prev) => ({ ...prev, gradeLevelId: event.target.value }))}
                className={selectClass}
                required
              >
                <option value="">Select grade</option>
                {gradeLevels.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={subjectForm.description}
                onChange={(event) => setSubjectForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Add Subject</Button>
            </div>
          </form>

          <DataTable columns={subjectColumns} data={subjects} isLoading={loadingSubjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topics</CardTitle>
          <CardDescription>Break subjects into granular skills with difficulty tags.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleTopicSubmit} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium text-muted-foreground">Topic Name</label>
              <Input value={topicForm.name} onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <select
                value={topicForm.subjectId}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                className={selectClass}
                required
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Difficulty</label>
              <select
                value={topicForm.difficulty}
                onChange={(event) => setTopicForm((prev) => ({ ...prev, difficulty: event.target.value }))}
                className={selectClass}
              >
                {difficultyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Add Topic</Button>
            </div>
          </form>

          <DataTable columns={topicColumns} data={topics} isLoading={loadingTopics} />
        </CardContent>
      </Card>
    </div>
  );
};

export default CurriculumPage;
