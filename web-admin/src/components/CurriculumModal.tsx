import { FormEvent, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ParentOption = {
  id: number;
  label: string;
};

type CreateModalProps = {
  mode: "create";
  open: boolean;
  title: string;
  description: string;
  entityLabel: string;
  parentLabel?: string;
  parentOptions?: ParentOption[];
  defaultParentId?: number | null;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { name: string; parentId?: number | null }) => Promise<void> | void;
};

type DeleteModalProps = {
  mode: "delete";
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructiveNote?: string;
  deleting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
};

export type CurriculumModalProps = CreateModalProps | DeleteModalProps;

const fieldClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00AD50]/30";

const CurriculumModal = (props: CurriculumModalProps) => {
  if (props.mode === "create") {
    return <CreateCurriculumModal {...props} />;
  }
  return <DeleteCurriculumModal {...props} />;
};

const CreateCurriculumModal = ({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  entityLabel,
  parentLabel,
  parentOptions,
  defaultParentId,
  submitting,
}: CreateModalProps) => {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      setName("");
      setError(null);
      setParentId(defaultParentId ? String(defaultParentId) : "");
    });
    return () => cancelAnimationFrame(frameId);
  }, [defaultParentId, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`${entityLabel} name is required.`);
      return;
    }
    if (parentOptions && parentOptions.length > 0 && !parentId) {
      setError(parentLabel ? `${parentLabel} is required.` : "Parent selection is required.");
      return;
    }
    setError(null);
    await onSubmit({
      name: trimmed,
      parentId: parentId ? Number(parentId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">{entityLabel} name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
          </div>
          {parentOptions && parentOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{parentLabel}</label>
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className={fieldClass}
                disabled={submitting}
              >
                <option value="">Select one</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#00AD50] text-white hover:bg-[#007A3E]" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteCurriculumModal = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  destructiveNote,
  confirmLabel = "Delete",
  deleting,
}: DeleteModalProps) => {
  const handleConfirm = async () => {
    await onConfirm();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {destructiveNote && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{destructiveNote}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={deleting} className="bg-[#B42318] text-white hover:bg-[#8A1A10]">
            {deleting ? "Deleting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CurriculumModal;
