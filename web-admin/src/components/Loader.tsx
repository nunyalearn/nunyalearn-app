"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoaderProps = {
  message?: string;
  fullscreen?: boolean;
};

const Loader = ({ message = "Loading Nunyalearn data...", fullscreen }: LoaderProps) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground", fullscreen && "min-h-[60vh]")}>
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm">{message}</span>
  </div>
);

export default Loader;
