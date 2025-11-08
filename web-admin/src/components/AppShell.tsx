"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Loader from "@/components/Loader";
import { useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/toaster";

const authRoutes = ["/auth/login"];

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { token, loading } = useAuth();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));

  useEffect(() => {
    if (!isAuthRoute && !loading && !token) {
      router.replace("/auth/login");
    }
  }, [isAuthRoute, loading, router, token]);

  if (isAuthRoute) {
    return (
      <ToastProvider>
        {children}
      </ToastProvider>
    );
  }

  if (loading || (!token && !isAuthRoute)) {
    return <Loader fullscreen />;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-muted/40 text-foreground antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Navbar />
            <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
};

export default AppShell;
