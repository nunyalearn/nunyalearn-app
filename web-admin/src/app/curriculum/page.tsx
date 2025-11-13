"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import CurriculumCard, { CurriculumCardItem } from "@/components/CurriculumCard";
import CurriculumModal from "@/components/CurriculumModal";
import Loader from "@/components/Loader";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type EntityType = "grade" | "subject" | "topic";

type GradeLevel = {
  id: number;
  name: string;
  subjectCount?: number;
  topicCount?: number;
  optimistic?: boolean;
};

type Subject = {
  id: number;
  name: string;
  gradeLevelId: number;
  topicCount?: number;
  optimistic?: boolean;
};

type Topic = {
  id: number;
  name: string;
  subjectId: number;
  optimistic?: boolean;
};

type DeleteContext =
  | { type: "grade"; entity: GradeLevel }
  | { type: "subject"; entity: Subject }
  | { type: "topic"; entity: Topic };

type GradeLike = Partial<{
  id: number | string;
  name: string;
  grade_level: string;
  subjectCount: number;
  subjects_count: number;
  _count: { subjects?: number; topics?: number };
  subjects: unknown[];
  topics_count: number;
  topicCount: number;
}>;

type SubjectLike = Partial<{
  id: number | string;
  name: string;
  subject_name: string;
  gradeLevelId: number | string;
  grade_level_id: number | string;
  GradeLevel: { id?: number | string };
  grade: { id?: number | string };
  topicCount: number;
  topics_count: number;
  _count: { topics?: number };
}>;

type TopicLike = Partial<{
  id: number | string;
  name: string;
  topic_name: string;
  subjectId: number | string;
  subject_id: number | string;
  Subject: { id?: number | string };
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const digData = (payload: unknown): unknown => {
  let current = payload;
  const visited = new Set<unknown>();
  while (isRecord(current) && "data" in current && current.data !== current && !visited.has(current)) {
    visited.add(current);
    current = current.data;
  }
  return current;
};

const extractArray = <T,>(payload: unknown, keys: string[]): T[] => {
  const root = digData(payload);
  if (Array.isArray(root)) {
    return root as T[];
  }
  if (isRecord(root)) {
    for (const key of keys) {
      const candidate = root[key];
      if (Array.isArray(candidate)) {
        return candidate as T[];
      }
    }
  }
  return [];
};

const extractEntity = <T,>(payload: unknown, keys: string[]): T => {
  const root = digData(payload);
  if (isRecord(root)) {
    for (const key of keys) {
      if (root[key] !== undefined) {
        return root[key] as T;
      }
    }
  }
  return root as T;
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const coerceCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeGradeLevel = (grade?: GradeLike): GradeLevel => {
  const id = toNumber(grade?.id ?? Date.now(), Date.now());
  return {
    id,
    name: grade?.name ?? grade?.grade_level ?? `Grade ${id}`,
    subjectCount:
      coerceCount(
        grade?.subjectCount ??
          grade?.subjects_count ??
          grade?._count?.subjects ??
          (Array.isArray(grade?.subjects) ? grade?.subjects.length : undefined),
      ),
    topicCount: coerceCount(grade?.topicCount ?? grade?.topics_count ?? grade?._count?.topics),
  };
};

const normalizeSubject = (subject?: SubjectLike, fallbackGradeId?: number): Subject => {
  const id = toNumber(subject?.id ?? Date.now(), Date.now());
  const gradeLevelId =
    subject?.gradeLevelId ??
    subject?.grade_level_id ??
    subject?.GradeLevel?.id ??
    subject?.grade?.id ??
    fallbackGradeId ??
    0;
  return {
    id,
    name: subject?.name ?? subject?.subject_name ?? `Subject ${id}`,
    gradeLevelId,
    topicCount: subject?.topicCount ?? subject?.topics_count ?? subject?._count?.topics ?? 0,
  };
};

const normalizeTopic = (topic?: TopicLike, fallbackSubjectId?: number): Topic => {
  const id = toNumber(topic?.id ?? Date.now(), Date.now());
  const subjectId = topic?.subjectId ?? topic?.subject_id ?? topic?.Subject?.id ?? fallbackSubjectId ?? 0;
  return {
    id,
    name: topic?.name ?? topic?.topic_name ?? `Topic ${id}`,
    subjectId,
  };
};

const fetchGrades = async (): Promise<GradeLevel[]> => {
  const response = await api.get("/admin/curriculum/grades");
  const list = extractArray<GradeLike>(response.data, ["gradeLevels", "grades", "items"]);
  return list.map(normalizeGradeLevel);
};

const fetchSubjects = async (gradeId: number): Promise<Subject[]> => {
  const response = await api.get("/admin/curriculum/subjects", {
    params: { gradeLevelId: gradeId },
  });
  const list = extractArray<SubjectLike>(response.data, ["subjects", "items"]);
  return list.map((subject) => normalizeSubject(subject, gradeId));
};

const fetchTopics = async (subjectId: number): Promise<Topic[]> => {
  const response = await api.get("/admin/curriculum/topics", {
    params: { subjectId },
  });
  const list = extractArray<TopicLike>(response.data, ["topics", "items"]);
  return list.map((topic) => normalizeTopic(topic, subjectId));
};

const pluralize = (label: string, count: number) => (count === 1 ? label : `${label}s`);

const formatList = (items: string[]) => {
  if (items.length <= 1) {
    return items[0];
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

const getErrorMessage = (error: unknown) => {
  if (!error) {
    return "Please try again.";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (isRecord(responseData)) {
    const message = responseData.message ?? responseData.error;
    if (typeof message === "string") {
      return message;
    }
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "Please try again.";
};

const CurriculumPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [activeCreate, setActiveCreate] = useState<EntityType | null>(null);
  const [deleteContext, setDeleteContext] = useState<DeleteContext | null>(null);
  const [creatingType, setCreatingType] = useState<EntityType | null>(null);
  const [deletingType, setDeletingType] = useState<EntityType | null>(null);
  const [subjectCache, setSubjectCache] = useState<Record<number, Subject[]>>({});
  const [topicCache, setTopicCache] = useState<Record<number, Topic[]>>({});

  useEffect(() => {
    if (!authLoading && user && user.role !== "ADMIN") {
      router.replace("/auth/login");
    }
  }, [authLoading, router, user]);

  const {
    data: gradesData,
    isLoading: loadingGrades,
    mutate: mutateGrades,
    error: gradesError,
  } = useSWR<GradeLevel[]>("/admin/curriculum/grades", fetchGrades, {
    revalidateOnFocus: false,
  });
  const grades = useMemo(() => gradesData ?? [], [gradesData]);

  const gradeIdForFetch = selectedGradeId;
  const subjectKey = gradeIdForFetch ? `/admin/curriculum/subjects?gradeLevelId=${gradeIdForFetch}` : null;
  const subjectsResponse = useSWR<Subject[]>(
    subjectKey,
    gradeIdForFetch ? () => fetchSubjects(gradeIdForFetch) : null,
    {
      revalidateOnFocus: false,
    },
  );
  const subjects = useMemo(() => subjectsResponse.data ?? [], [subjectsResponse.data]);
  const loadingSubjects = Boolean(gradeIdForFetch) && subjectsResponse.isLoading;
  const subjectsError = subjectsResponse.error;

  const subjectIdForFetch = selectedSubjectId;
  const topicKey = subjectIdForFetch ? `/admin/curriculum/topics?subjectId=${subjectIdForFetch}` : null;
  const topicsResponse = useSWR<Topic[]>(
    topicKey,
    subjectIdForFetch ? () => fetchTopics(subjectIdForFetch) : null,
    {
      revalidateOnFocus: false,
    },
  );
  const topics = useMemo(() => topicsResponse.data ?? [], [topicsResponse.data]);
  const loadingTopics = Boolean(subjectIdForFetch) && topicsResponse.isLoading;
  const topicsError = topicsResponse.error;

  useEffect(() => {
    if (!grades.length) {
      setSelectedGradeId(null);
      return;
    }
    if (selectedGradeId === null || !grades.some((grade) => grade.id === selectedGradeId)) {
      setSelectedGradeId(grades[0].id);
    }
  }, [grades, selectedGradeId]);

  useEffect(() => {
    if (!subjects.length) {
      setSelectedSubjectId(null);
      return;
    }
    if (selectedSubjectId === null || !subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (selectedGradeId && subjects.length) {
      setSubjectCache((prev) => ({
        ...prev,
        [selectedGradeId]: subjects,
      }));
    }
  }, [selectedGradeId, subjects]);

  useEffect(() => {
    if (selectedSubjectId && topics.length) {
      setTopicCache((prev) => ({
        ...prev,
        [selectedSubjectId]: topics,
      }));
    }
  }, [selectedSubjectId, topics]);

  const selectedGrade = grades.find((grade) => grade.id === selectedGradeId) ?? null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const subjectsForModal = selectedGradeId ? subjectCache[selectedGradeId] ?? subjects : [];

  const gradeItems: CurriculumCardItem[] = useMemo(
    () =>
      grades.map((grade) => ({
        id: grade.id,
        name: grade.name,
        badges: [
          {
            label: `${grade.subjectCount ?? 0} ${pluralize("subject", grade.subjectCount ?? 0)}`,
            tone: "green",
          },
          {
            label: `${grade.topicCount ?? 0} ${pluralize("topic", grade.topicCount ?? 0)}`,
            tone: "blue",
          },
        ],
      })),
    [grades],
  );

  const subjectItems: CurriculumCardItem[] = useMemo(
    () =>
      subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        subtitle: selectedGrade ? `Grade: ${selectedGrade.name}` : undefined,
        badges: [
          {
            label: `${subject.topicCount ?? 0} ${pluralize("topic", subject.topicCount ?? 0)}`,
            tone: "blue",
          },
        ],
      })),
    [selectedGrade, subjects],
  );

  const topicItems: CurriculumCardItem[] = useMemo(
    () =>
      topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        subtitle: selectedSubject ? `Subject: ${selectedSubject.name}` : undefined,
      })),
    [selectedSubject, topics],
  );

  const requireAuthLoading = authLoading || !user;
  const userIsAdmin = user?.role === "ADMIN";

  const gradeErrorMessage = gradesError ? getErrorMessage(gradesError) : null;
  const subjectsErrorMessage = subjectsError ? getErrorMessage(subjectsError) : null;
  const topicsErrorMessage = topicsError ? getErrorMessage(topicsError) : null;

  const ensureGradeSelection = () => {
    if (!selectedGradeId && grades.length > 0) {
      setSelectedGradeId(grades[0].id);
    }
  };

  const handleCreateGrade = async ({ name }: { name: string }) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Grade name is required." });
      return;
    }
    if (grades.some((grade) => grade.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ variant: "destructive", title: "This grade already exists." });
      return;
    }
    setCreatingType("grade");
    const optimisticGrade: GradeLevel = {
      id: Date.now(),
      name: trimmed,
      subjectCount: 0,
      topicCount: 0,
      optimistic: true,
    };
    try {
      await mutateGrades(
        async (current) => {
          const response = await api.post("/admin/curriculum/grades", { name: trimmed });
          const created = normalizeGradeLevel(extractEntity(response.data, ["gradeLevel", "grade"]));
          return [...(current ?? []).filter((grade) => !grade.optimistic), created];
        },
        {
          optimisticData: [...grades, optimisticGrade],
          rollbackOnError: true,
        },
      );
      await mutateGrades();
      toast({ title: "Grade created successfully." });
      setActiveCreate(null);
      ensureGradeSelection();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to create grade",
        description: getErrorMessage(error),
      });
    } finally {
      setCreatingType((current) => (current === "grade" ? null : current));
    }
  };

  const resolveSubjectsForGrade = async (gradeId: number) => {
    if (subjectCache[gradeId]) {
      return subjectCache[gradeId];
    }
    const fetched = await fetchSubjects(gradeId);
    setSubjectCache((prev) => ({ ...prev, [gradeId]: fetched }));
    return fetched;
  };

  const resolveTopicsForSubject = async (subjectId: number) => {
    if (topicCache[subjectId]) {
      return topicCache[subjectId];
    }
    const fetched = await fetchTopics(subjectId);
    setTopicCache((prev) => ({ ...prev, [subjectId]: fetched }));
    return fetched;
  };

  const handleCreateSubject = async ({ name, parentId }: { name: string; parentId?: number | null }) => {
    const trimmed = name.trim();
    const gradeId = parentId ?? selectedGradeId;
    if (!trimmed) {
      toast({ variant: "destructive", title: "Subject name is required." });
      return;
    }
    if (!gradeId) {
      toast({ variant: "destructive", title: "Select a grade level first." });
      return;
    }
    const subjectsForGrade = await resolveSubjectsForGrade(gradeId);
    if (subjectsForGrade.some((subject) => subject.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ variant: "destructive", title: "This subject already exists for the selected grade." });
      return;
    }
    setCreatingType("subject");
    const optimisticSubject: Subject = {
      id: Date.now(),
      name: trimmed,
      gradeLevelId: gradeId,
      topicCount: 0,
      optimistic: true,
    };
    try {
      if (gradeId === selectedGradeId) {
        await subjectsResponse.mutate(
          async (current) => {
            const response = await api.post("/admin/curriculum/subjects", {
              name: trimmed,
              gradeLevelId: gradeId,
            });
            const created = normalizeSubject(extractEntity(response.data, ["subject"]), gradeId);
            return [...(current ?? []).filter((subject) => !subject.optimistic), created];
          },
          {
            optimisticData: [...subjects, optimisticSubject],
            rollbackOnError: true,
          },
        );
        await subjectsResponse.mutate();
      } else {
        await api.post("/admin/curriculum/subjects", { name: trimmed, gradeLevelId: gradeId });
      }
      await mutateGrades();
      setActiveCreate(null);
      setSelectedGradeId(gradeId);
      toast({ title: "Subject created successfully." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to create subject",
        description: getErrorMessage(error),
      });
    } finally {
      setCreatingType((current) => (current === "subject" ? null : current));
    }
  };

  const handleCreateTopic = async ({ name, parentId }: { name: string; parentId?: number | null }) => {
    const trimmed = name.trim();
    const subjectId = parentId ?? selectedSubjectId;
    if (!trimmed) {
      toast({ variant: "destructive", title: "Topic name is required." });
      return;
    }
    if (!subjectId) {
      toast({ variant: "destructive", title: "Select a subject first." });
      return;
    }
    let topicsForSubject = subjectId === selectedSubjectId ? topics : topicCache[subjectId];
    if (!topicsForSubject) {
      topicsForSubject = await resolveTopicsForSubject(subjectId);
    }
    if (topicsForSubject.some((topic) => topic.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ variant: "destructive", title: "This topic already exists for the selected subject." });
      return;
    }
    setCreatingType("topic");
    const optimisticTopic: Topic = {
      id: Date.now(),
      name: trimmed,
      subjectId,
      optimistic: true,
    };
    try {
      if (subjectId === selectedSubjectId) {
        await topicsResponse.mutate(
          async (current) => {
            const response = await api.post("/admin/curriculum/topics", { name: trimmed, subjectId });
            const created = normalizeTopic(extractEntity(response.data, ["topic"]), subjectId);
            return [...(current ?? []).filter((topic) => !topic.optimistic), created];
          },
          {
            optimisticData: [...topics, optimisticTopic],
            rollbackOnError: true,
          },
        );
        await topicsResponse.mutate();
      } else {
        await api.post("/admin/curriculum/topics", { name: trimmed, subjectId });
      }
      if (selectedGradeId) {
        await subjectsResponse.mutate();
      }
      await mutateGrades();
      setActiveCreate(null);
      setSelectedSubjectId(subjectId);
      toast({ title: "Topic created successfully." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to create topic",
        description: getErrorMessage(error),
      });
    } finally {
      setCreatingType((current) => (current === "topic" ? null : current));
    }
  };

  const deleteGrade = async (grade: GradeLevel) => {
    setDeletingType("grade");
    try {
      await mutateGrades(
        async (current) => {
          await api.delete(`/admin/curriculum/grades/${grade.id}`);
          return (current ?? []).filter((item) => item.id !== grade.id);
        },
        {
          optimisticData: grades.filter((item) => item.id !== grade.id),
          rollbackOnError: true,
        },
      );
      await mutateGrades();
      if (selectedGradeId === grade.id) {
        setSelectedGradeId(null);
        setSelectedSubjectId(null);
      }
      toast({ title: `${grade.name} deleted.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete grade",
        description: getErrorMessage(error),
      });
    } finally {
      setDeletingType(null);
      setDeleteContext(null);
    }
  };

  const deleteSubject = async (subject: Subject) => {
    setDeletingType("subject");
    try {
      await subjectsResponse.mutate(
        async (current) => {
          await api.delete(`/admin/curriculum/subjects/${subject.id}`);
          return (current ?? []).filter((item) => item.id !== subject.id);
        },
        {
          optimisticData: subjects.filter((item) => item.id !== subject.id),
          rollbackOnError: true,
        },
      );
      await subjectsResponse.mutate();
      await mutateGrades();
      if (selectedSubjectId === subject.id) {
        setSelectedSubjectId(null);
      }
      toast({ title: `${subject.name} deleted.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete subject",
        description: getErrorMessage(error),
      });
    } finally {
      setDeletingType(null);
      setDeleteContext(null);
    }
  };

  const deleteTopic = async (topic: Topic) => {
    setDeletingType("topic");
    try {
      await topicsResponse.mutate(
        async (current) => {
          await api.delete(`/admin/curriculum/topics/${topic.id}`);
          return (current ?? []).filter((item) => item.id !== topic.id);
        },
        {
          optimisticData: topics.filter((item) => item.id !== topic.id),
          rollbackOnError: true,
        },
      );
      await topicsResponse.mutate();
      await subjectsResponse.mutate();
      await mutateGrades();
      toast({ title: `${topic.name} deleted.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete topic",
        description: getErrorMessage(error),
      });
    } finally {
      setDeletingType(null);
      setDeleteContext(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteContext) {
      return;
    }
    if (deleteContext.type === "grade") {
      await deleteGrade(deleteContext.entity);
    } else if (deleteContext.type === "subject") {
      await deleteSubject(deleteContext.entity);
    } else {
      await deleteTopic(deleteContext.entity);
    }
  };

  const cascadeSummary = (context: DeleteContext | null) => {
    if (!context) {
      return undefined;
    }
    if (context.type === "grade") {
      const parts: string[] = [];
      const subjectTotal = context.entity.subjectCount ?? 0;
      const topicTotal = context.entity.topicCount ?? 0;
      if (subjectTotal) {
        parts.push(`${subjectTotal} ${pluralize("subject", subjectTotal)}`);
      }
      if (topicTotal) {
        parts.push(`${topicTotal} ${pluralize("topic", topicTotal)}`);
      }
      if (!parts.length) {
        return "This action cannot be undone.";
      }
      return `Deleting ${context.entity.name} will also remove ${formatList(parts)}.`;
    }
    if (context.type === "subject") {
      const topicTotal = context.entity.topicCount ?? 0;
      if (!topicTotal) {
        return "This action cannot be undone.";
      }
      return `Deleting ${context.entity.name} will remove ${topicTotal} ${pluralize("topic", topicTotal)}.`;
    }
    return "Deleting this topic cannot be undone.";
  };

  const deleteTitle = deleteContext
    ? {
        grade: `Delete ${deleteContext.entity.name}?`,
        subject: `Delete ${deleteContext.entity.name}?`,
        topic: `Delete ${deleteContext.entity.name}?`,
      }[deleteContext.type]
    : "";

  const deleteDescription = deleteContext
    ? {
        grade: "Removing a grade deletes every subject and topic beneath it.",
        subject: "Removing a subject deletes every topic beneath it.",
        topic: "This topic will be permanently removed from the subject.",
      }[deleteContext.type]
    : "";

  if (requireAuthLoading) {
    return <Loader fullscreen message="Loading your admin workspace..." />;
  }

  if (!userIsAdmin) {
    return <Loader fullscreen message="Redirecting to login..." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-[#004976]">Curriculum Management</h1>
        <p className="text-sm text-[#505759]">
          Create and curate Nunyalearn&apos;s learning hierarchy. Grades feed subjects, subjects feed topics, and every change
          is validated before it reaches learners.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CurriculumCard
          title="Grade Levels"
          description="Organize the entire learning ladder from Early Years to Exams."
          items={gradeItems}
          selectedId={selectedGradeId ?? undefined}
          loading={loadingGrades}
          onSelect={(item) => {
            setSelectedGradeId(item.id);
            setSelectedSubjectId(null);
          }}
          onAddClick={() => setActiveCreate("grade")}
          onDeleteClick={(item) => {
            const target = grades.find((grade) => grade.id === item.id);
            if (target) {
              setDeleteContext({ type: "grade", entity: target });
            }
          }}
          emptyLabel="No grade levels yet. Add the first one to begin."
          footerSlot={
            gradeErrorMessage ? (
              <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Unable to load grades: {gradeErrorMessage}
              </p>
            ) : undefined
          }
        />

        <CurriculumCard
          title="Subjects"
          description={
            selectedGrade
              ? `Mapped to ${selectedGrade.name}.`
              : "Select a grade level to view its subjects."
          }
          items={subjectItems}
          loading={loadingSubjects}
          selectedId={selectedSubjectId ?? undefined}
          emptyLabel={
            selectedGrade
              ? "No subjects found for this grade."
              : "Select a grade level to view its subjects."
          }
          addDisabled={!grades.length}
          addDisabledReason={!grades.length ? "Create a grade before adding subjects." : undefined}
          onSelect={(item) => setSelectedSubjectId(item.id)}
          onAddClick={() => setActiveCreate("subject")}
          onDeleteClick={(item) => {
            const target = subjects.find((subject) => subject.id === item.id);
            if (target) {
              setDeleteContext({ type: "subject", entity: target });
            }
          }}
          footerSlot={
            subjectsErrorMessage ? (
              <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Unable to load subjects: {subjectsErrorMessage}
              </p>
            ) : undefined
          }
        />

        <CurriculumCard
          title="Topics"
          description={
            selectedSubject
              ? `Focused concepts under ${selectedSubject.name}.`
              : "Select a subject to view topics."
          }
          items={topicItems}
          loading={loadingTopics}
          emptyLabel={
            selectedSubject
              ? "No topics yet. Add the first learning objective."
              : "Select a subject to drill into its topics."
          }
          addDisabled={!selectedGradeId || !subjects.length}
          addDisabledReason={!selectedGradeId ? "Select a grade and subject first." : undefined}
          onAddClick={() => setActiveCreate("topic")}
          onDeleteClick={(item) => {
            const target = topics.find((topic) => topic.id === item.id);
            if (target) {
              setDeleteContext({ type: "topic", entity: target });
            }
          }}
          footerSlot={
            topicsErrorMessage ? (
              <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Unable to load topics: {topicsErrorMessage}
              </p>
            ) : undefined
          }
        />
      </div>

      <CurriculumModal
        mode="create"
        open={activeCreate === "grade"}
        onOpenChange={(open) => setActiveCreate(open ? "grade" : null)}
        title="Create Grade Level"
        description="Add a new grade to the hierarchy. Names must be unique (e.g. Grade 6)."
        entityLabel="Grade"
        submitting={creatingType === "grade"}
        onSubmit={handleCreateGrade}
      />

      <CurriculumModal
        mode="create"
        open={activeCreate === "subject"}
        onOpenChange={(open) => setActiveCreate(open ? "subject" : null)}
        title="Create Subject"
        description="Subjects live inside a grade level. Use the dropdown to confirm the correct parent."
        entityLabel="Subject"
        parentLabel="Grade Level"
        parentOptions={grades.map((grade) => ({ id: grade.id, label: grade.name }))}
        defaultParentId={selectedGradeId ?? undefined}
        submitting={creatingType === "subject"}
        onSubmit={handleCreateSubject}
      />

      <CurriculumModal
        mode="create"
        open={activeCreate === "topic"}
        onOpenChange={(open) => setActiveCreate(open ? "topic" : null)}
        title="Create Topic"
        description="Topics represent the most granular skills. Attach them to a subject."
        entityLabel="Topic"
        parentLabel="Subject"
        parentOptions={subjectsForModal.map((subject) => ({ id: subject.id, label: subject.name }))}
        defaultParentId={selectedSubjectId ?? undefined}
        submitting={creatingType === "topic"}
        onSubmit={handleCreateTopic}
      />

      <CurriculumModal
        mode="delete"
        open={Boolean(deleteContext)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteContext(null);
          }
        }}
        title={deleteTitle}
        description={deleteDescription}
        destructiveNote={cascadeSummary(deleteContext)}
        deleting={Boolean(deletingType)}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default CurriculumPage;
