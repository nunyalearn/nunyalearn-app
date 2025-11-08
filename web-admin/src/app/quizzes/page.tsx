"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type Quiz = {
  id: number;
  question_text: string;
  difficulty?: string;
  xp_reward?: number;
  topic_id?: number;
};

const QuizzesPage = () => {
  const [filter, setFilter] = useState("");
  const { data, isLoading, mutate } = useSWR<Quiz[] | { quizzes?: Quiz[] }>("/admin/quizzes", fetcher);
  const quizzes = Array.isArray(data) ? data : data?.quizzes ?? [];

  const filtered = quizzes.filter((quiz) =>
    quiz.question_text.toLowerCase().includes(filter.toLowerCase()) ||
    (quiz.difficulty ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Quizzes</h1>
          <p className="text-muted-foreground">Configure quizzes, difficulty, and XP payouts.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Filter by topic or difficulty" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Button>New Quiz</Button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "question_text", label: "Question" },
          { key: "difficulty", label: "Difficulty" },
          { key: "xp_reward", label: "XP" },
        ]}
        data={filtered}
        isLoading={isLoading}
      />
    </div>
  );
};

export default QuizzesPage;
