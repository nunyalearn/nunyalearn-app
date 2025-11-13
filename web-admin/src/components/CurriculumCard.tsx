import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ReactNode } from "react";

export type CurriculumCardBadgeTone = "green" | "blue" | "slate";

export type CurriculumCardItem = {
  id: number;
  name: string;
  subtitle?: string;
  description?: ReactNode;
  badges?: Array<{ label: string; tone?: CurriculumCardBadgeTone }>;
};

type CurriculumCardProps<TItem extends CurriculumCardItem> = {
  title: string;
  description: string;
  items: TItem[];
  selectedId?: number | null;
  loading?: boolean;
  emptyLabel?: string;
  onSelect?: (item: TItem) => void;
  onAddClick: () => void;
  onDeleteClick?: (item: TItem) => void;
  addLabel?: string;
  addDisabled?: boolean;
  addDisabledReason?: string;
  footerSlot?: ReactNode;
};

const badgeToneClass: Record<CurriculumCardBadgeTone, string> = {
  green: "bg-[#007A3E]/15 text-[#007A3E] border-transparent",
  blue: "bg-[#004976]/10 text-[#004976] border-transparent",
  slate: "bg-[#505759]/10 text-[#505759] border-transparent",
};

const CurriculumCard = <TItem extends CurriculumCardItem>({
  title,
  description,
  items,
  selectedId,
  loading,
  emptyLabel = "Nothing to display yet.",
  onSelect,
  onAddClick,
  onDeleteClick,
  addLabel = "Add",
  addDisabled,
  addDisabledReason,
  footerSlot,
}: CurriculumCardProps<TItem>) => {
  return (
    <Card className="border border-[#919D9D]/30 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg text-[#004976]">{title}</CardTitle>
          <CardDescription className="text-sm text-[#505759]">{description}</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={onAddClick}
          disabled={addDisabled}
          title={addDisabled && addDisabledReason ? addDisabledReason : undefined}
          className="bg-[#00AD50] text-white hover:bg-[#007A3E]"
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-[#00AD50]" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-3">
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#919D9D]/60 p-6 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-start justify-between rounded-xl border border-transparent bg-muted/20 px-3 py-2 text-left transition hover:border-[#00AD50]/60 hover:bg-[#00AD50]/5",
                      selectedId === item.id && "border-[#00AD50] bg-[#00AD50]/10",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-1 flex-col text-left"
                      onClick={() => onSelect?.(item)}
                    >
                      <span className="text-sm font-semibold text-[#004976]">{item.name}</span>
                      {item.subtitle && (
                        <span className="text-xs text-[#505759]">{item.subtitle}</span>
                      )}
                      {item.description && (
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      )}
                      {item.badges && item.badges.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {item.badges.map((badge, index) => (
                            <Badge
                              key={`${item.id}-badge-${index}`}
                              className={cn(
                                "border text-[11px] font-medium uppercase tracking-wider",
                                badgeToneClass[badge.tone ?? "slate"],
                              )}
                            >
                              {badge.label}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </button>
                    {onDeleteClick && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteClick(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
        {footerSlot}
      </CardContent>
    </Card>
  );
};

export default CurriculumCard;
