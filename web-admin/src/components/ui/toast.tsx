"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useToast } from "./use-toast";

type ToastProps = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
};

const variantStyles: Record<NonNullable<ToastProps["variant"]>, string> = {
  default: "border-border bg-card text-card-foreground",
  success: "border-green-400/70 bg-green-50 text-green-950",
  destructive: "border-red-400/70 bg-red-50 text-red-900",
};

export const ToastViewport = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3">{children}</div>
);

export const Toast = ({ id, title, description, variant = "default" }: ToastProps) => {
  const { dismiss } = useToast();
  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-xl transition", variantStyles[variant])}>
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <button
          aria-label="Close"
          onClick={() => dismiss(id)}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
