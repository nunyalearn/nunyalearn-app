"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { fetcher } from "@/lib/api";

type Flashcard = {
  id: number;
  front_text: string;
  back_text: string;
  language?: string;
  is_premium?: boolean;
};

const FlashcardsPage = () => {
  const { data, isLoading, mutate } = useSWR<Flashcard[] | { flashcards?: Flashcard[] }>("/admin/flashcards", fetcher);
  const flashcards = Array.isArray(data) ? data : data?.flashcards ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Flashcards</h1>
          <p className="text-muted-foreground">Manage adaptive flashcard decks per topic & language.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
          <Button>Add Flashcard</Button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "front_text", label: "Prompt" },
          { key: "back_text", label: "Answer" },
          { key: "language", label: "Language" },
          {
            key: "is_premium",
            label: "Premium",
            render: (row) => (row.is_premium ? "Yes" : "No"),
          },
        ]}
        data={flashcards}
        isLoading={isLoading}
      />
    </div>
  );
};

export default FlashcardsPage;
