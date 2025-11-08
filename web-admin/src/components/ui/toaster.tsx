"use client";

import { ToastViewport, Toast } from "./toast";
import { ToastProvider as InternalToastProvider, useToast } from "./use-toast";

const ToastRenderer = () => {
  const { toasts } = useToast();
  return (
    <ToastViewport>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </ToastViewport>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => (
  <InternalToastProvider>
    {children}
    <ToastRenderer />
  </InternalToastProvider>
);
