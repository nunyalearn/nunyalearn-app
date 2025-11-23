"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export type QuestionBankRow = {
  id: number;
  questionText: string;
  difficulty: string;
  questionType: string;
};

export type SelectedQuestion = {
  questionId: number;
  orderIndex: number;
  questionText: string;
  questionDifficulty?: string;
  questionType?: string;
};

type QuestionPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: QuestionBankRow[];
  loading: boolean;
  selection: SelectedQuestion[];
  onSelectionChange: React.Dispatch<React.SetStateAction<SelectedQuestion[]>>;
  onApply: (selection: SelectedQuestion[]) => void;
  topicLabel?: string;
};

const QUESTION_PICKER_PAGE_SIZE = 10;

const questionPickerDifficultyOptions = [
  { label: "All difficulties", value: "ALL" },
  { label: "Easy", value: "EASY" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Hard", value: "HARD" },
];

const QuestionPicker = ({
  open,
  onOpenChange,
  questions,
  loading,
  selection,
  onSelectionChange,
  onApply,
  topicLabel,
}: QuestionPickerProps) => {
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => {
      setSearch("");
      setDifficultyFilter("ALL");
      setPage(1);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const isSelected = useCallback(
    (questionId: number) => selection.some((question) => question.questionId === questionId),
    [selection],
  );

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesSearch = term ? question.questionText.toLowerCase().includes(term) : true;
      const matchesDifficulty =
        difficultyFilter === "ALL" ? true : question.difficulty === difficultyFilter;
      return matchesSearch && matchesDifficulty;
    });
  }, [difficultyFilter, questions, search]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTION_PICKER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * QUESTION_PICKER_PAGE_SIZE;
    return filteredQuestions.slice(start, start + QUESTION_PICKER_PAGE_SIZE);
  }, [currentPage, filteredQuestions]);

  const selectedList = useMemo(
    () => selection.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [selection],
  );

  const toggleQuestion = (question: QuestionBankRow) => {
    onSelectionChange((current) => {
      const exists = current.some((entry) => entry.questionId === question.id);
      if (exists) {
        return current
          .filter((entry) => entry.questionId !== question.id)
          .map((entry, index) => ({ ...entry, orderIndex: index }));
      }
      return [
        ...current,
        {
          questionId: question.id,
          questionText: question.questionText,
          questionDifficulty: question.difficulty,
          questionType: question.questionType,
          orderIndex: current.length,
        },
      ];
    });
  };

  const clearSelection = () => onSelectionChange([]);

  const handleApply = () => {
    onApply(selectedList);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl space-y-4">
        <DialogHeader>
          <DialogTitle>Select questions</DialogTitle>
          <DialogDescription>
            Only ACTIVE Question Bank items can be attached to quizzes.{" "}
            {topicLabel ? `Topic: ${topicLabel}.` : "Choose a topic to filter the bank."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <Input
                  className="flex-1"
                  placeholder="Search active questions..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
                <span className="hidden text-sm text-muted-foreground lg:inline">
                  {filteredQuestions.length === questions.length
                    ? `${questions.length} available`
                    : `${filteredQuestions.length} of ${questions.length} match`}
                </span>
              </div>
              <Select
                value={difficultyFilter}
                onValueChange={(value) => {
                  setDifficultyFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="lg:w-48">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {questionPickerDifficultyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground lg:hidden">
              {filteredQuestions.length === questions.length
                ? `${questions.length} available`
                : `${filteredQuestions.length} of ${questions.length} match`}
            </div>

            <div className="h-72 space-y-2 overflow-y-auto rounded-2xl border p-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading questions...</p>
              ) : paginatedQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions match the current filters.</p>
              ) : (
                paginatedQuestions.map((question) => {
                  const active = isSelected(question.id);
                  return (
                    <label
                      key={question.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        active ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-muted-foreground/40 text-primary"
                        checked={active}
                        onChange={() => toggleQuestion(question)}
                      />
                      <div>
                        <p className="font-medium">{question.questionText}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{question.questionType}</Badge>
                          <Badge variant="outline">{question.difficulty}</Badge>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Selected ({selectedList.length})</p>
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedList.length === 0}>
                Clear
              </Button>
            </div>
            <div className="h-72 space-y-2 overflow-y-auto rounded-2xl border p-3">
              {selectedList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions selected yet.</p>
              ) : (
                selectedList.map((question, index) => (
                  <div
                    key={question.questionId}
                    className="flex items-start justify-between gap-3 rounded-2xl border bg-card/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {question.questionText}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{question.questionType}</Badge>
                        <Badge variant="outline">{question.questionDifficulty ?? "MEDIUM"}</Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        toggleQuestion({
                          id: question.questionId,
                          questionText: question.questionText,
                          difficulty: question.questionDifficulty ?? "MEDIUM",
                          questionType: question.questionType ?? "MULTIPLE_CHOICE",
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedList.length === 0}>
            Use {selectedList.length} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionPicker;
