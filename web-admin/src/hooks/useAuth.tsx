"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api, { fetcher, persistToken, TOKEN_STORAGE_KEY } from "@/lib/api";

type AuthUser = {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadProfile = useCallback(
    async (overrideToken?: string | null) => {
      const currentToken =
        overrideToken ?? (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null);
      if (!currentToken) {
        setUser(null);
        return;
      }

      setToken(currentToken);
      try {
        const profile = await fetcher<{ user: AuthUser } | AuthUser>("/auth/profile");
        const parsed = (profile as any).user ? (profile as any).user : profile;
        setUser(parsed);
      } catch (error) {
        console.error("Failed to fetch profile", error);
        persistToken(null);
        setUser(null);
        setToken(null);
      }
    },
    [],
  );

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const response = await api.post("/auth/login", { email, password });
        const newToken = response.data?.token ?? response.data?.data?.token;
        if (!newToken) {
          throw new Error("Missing token in response");
        }
        persistToken(newToken);
        await loadProfile(newToken);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    },
    [loadProfile, router],
  );

  const logout = useCallback(() => {
    persistToken(null);
    setToken(null);
    setUser(null);
    router.replace("/auth/login");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [user, token, loading, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
