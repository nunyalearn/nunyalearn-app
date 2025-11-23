"use client";

import { ReactNode } from "react";

type EmptyStateProps = {
  message: string;
  children?: ReactNode;
  className?: string;
};

const EmptyState = ({ message, children, className }: EmptyStateProps) => (
  <div className={className ?? "rounded-3xl border border-dashed p-6 text-center text-muted-foreground"}>
    <p>{message}</p>
    {children}
  </div>
);

export default EmptyState;
