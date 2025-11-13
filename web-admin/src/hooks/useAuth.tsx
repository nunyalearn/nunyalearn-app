"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api, { fetcher, getStoredToken, persistToken } from "@/lib/api";

type AuthUser = {
  id: number;
  email: string;
  fullName?: string;
  full_name?: string;
  role?: string;
  isPremium?: boolean;
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

  // Normalize token extraction so every caller honors the backend response contract.
  const resolveResponseToken = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const rootData = (payload as { data?: unknown }).data;

    const extractToken = (value: unknown): string | null => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const container = value as { token?: unknown; accessToken?: unknown; data?: unknown };
      const directToken =
        (typeof container.token === "string" && container.token) ||
        (typeof container.accessToken === "string" && container.accessToken) ||
        null;
      if (directToken) {
        return directToken;
      }
      return extractToken(container.data);
    };

    return extractToken(rootData ?? payload);
  };

  const loadProfile = useCallback(
    async (overrideToken?: string | null) => {
      const currentToken = overrideToken ?? getStoredToken();
      // No token means we must reset auth state and skip hitting protected endpoints.
      if (!currentToken) {
        setToken(null);
        setUser(null);
        return;
      }

      setToken(currentToken);
      try {
        const profile = await fetcher<{ user: AuthUser } | AuthUser>("/auth/profile");
        const parsed = (profile as { user?: AuthUser }).user ?? profile;
        setUser(parsed as AuthUser);
      } catch (error) {
        // Treat any failure (401, network, etc.) as an invalid token and clear persisted state.
        console.error("Failed to fetch profile", error);
        persistToken(null);
        setUser(null);
        setToken(null);
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    loadProfile()
      .catch((error) => {
        console.error("Initial profile load failed", error);
      })
      .finally(() => setLoading(false));
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const response = await api.post("/auth/login", { email, password });
        const newToken = resolveResponseToken(response);
        if (!newToken) {
          throw new Error("Login response did not include an authentication token");
        }
        persistToken(newToken);
        setToken(newToken);
        await loadProfile(newToken);
        router.replace("/");
      } catch (error) {
        // Ensure callers never keep a stale token when login or profile hydration fails.
        persistToken(null);
        setToken(null);
        setUser(null);
        throw error;
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
