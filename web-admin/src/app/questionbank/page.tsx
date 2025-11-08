"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import ExportButton from "@/components/ExportButton";
import { fetcher } from "@/lib/api";

type Question = {
  id: number;
  question_text: string;
  subject?: string;
  competency?: string;
  type?: string;
};

const QuestionBankPage = () => {
  const { data, isLoading, mutate } = useSWR<Question[] | { questions?: Question[] }>(
    "/admin/questionbank",
    fetcher,
  );
  const questions = Array.isArray(data) ? data : data?.questions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Question Bank</h1>
          <p className="text-muted-foreground">Curate Nunyalearn question pools and upload spreadsheets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Reload
          </Button>
          <Button>Upload Sheet</Button>
          <ExportButton label="Attempts CSV" endpoint="/admin/export/attempts.csv" filename="attempts.csv" />
        </div>
      </div>

      <DataTable
        columns={[
          { key: "question_text", label: "Question" },
          { key: "subject", label: "Subject" },
          { key: "competency", label: "Competency" },
          { key: "type", label: "Type" },
        ]}
        data={questions}
        isLoading={isLoading}
      />
    </div>
  );
};

export default QuestionBankPage;
