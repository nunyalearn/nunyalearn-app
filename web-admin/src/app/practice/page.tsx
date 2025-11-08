"use client";

import useSWR from "swr";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/button";

type PracticeTest = {
  id: number;
  title: string;
  subject?: string;
  difficulty?: string;
  xp_reward?: number;
};

const PracticePage = () => {
  const { data, isLoading, mutate } = useSWR<PracticeTest[] | { tests?: PracticeTest[]; items?: PracticeTest[] }>(
    "/admin/practice-tests",
    fetcher,
  );
  const tests =
    Array.isArray(data) ? data : data?.tests ?? (data as any)?.practiceTests ?? (data as any)?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Practice Tests</h1>
          <p className="text-muted-foreground">Manage adaptive practice exams and XP rewards.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Button>Create Test</Button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "title", label: "Title" },
          { key: "subject", label: "Subject" },
          { key: "difficulty", label: "Difficulty" },
          { key: "xp_reward", label: "XP" },
        ]}
        data={tests}
        isLoading={isLoading}
      />
    </div>
  );
};

export default PracticePage;
