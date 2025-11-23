"use client";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

const ErrorState = ({ message, onRetry, className }: ErrorStateProps) => (
  <div className={className ?? "rounded-3xl border border-dashed p-6 text-center text-muted-foreground"}>
    <p>{message}</p>
    {onRetry ? (
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    ) : null}
  </div>
);

export default ErrorState;
