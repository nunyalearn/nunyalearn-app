import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import authService, { Profile } from "../services/auth.service";
import { setAuthTokens, setLogoutHandler } from "../services/api";

export type AuthContextValue = {
  user: Profile | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

export const AuthContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const persistTokens = useCallback(async (nextAccessToken: string | null, nextRefreshToken: string | null) => {
    if (nextAccessToken) {
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken);
    } else {
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    if (nextRefreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    } else {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }

    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    setAuthTokens({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  }, []);

  const persistUser = useCallback(async (nextUser: Profile | null) => {
    if (nextUser) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
    setUser(nextUser);
  }, []);

  const consecutiveProfileErrors = useRef(0);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authService.profile();
      consecutiveProfileErrors.current = 0;
      await persistUser(profile);
    } catch {
      consecutiveProfileErrors.current += 1;
      if (consecutiveProfileErrors.current >= 2) {
        await persistTokens(null, null);
        await persistUser(null);
      }
      throw new Error("Profile refresh failed");
    }
  }, [persistTokens, persistUser]);

  const logout = useCallback(async () => {
    await persistTokens(null, null);
    await persistUser(null);
  }, [persistTokens, persistUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await authService.login(email, password);
        await persistTokens(result?.accessToken ?? null, result?.refreshToken ?? null);
        await refreshProfile();
      } catch (error) {
        await persistTokens(null, null);
        await persistUser(null);
        throw error;
      }
    },
    [persistTokens, refreshProfile, persistUser],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      try {
        const result = await authService.register(fullName, email, password);
        await persistTokens(result?.accessToken ?? null, result?.refreshToken ?? null);
        await refreshProfile();
      } catch (error) {
        await persistTokens(null, null);
        await persistUser(null);
        throw error;
      }
    },
    [persistTokens, refreshProfile, persistUser],
  );

  useEffect(() => {
    setLogoutHandler(() => {
      logout();
    });

    const bootstrap = async () => {
      try {
        const [storedAccessToken, storedRefreshToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(ACCESS_TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        await persistTokens(storedAccessToken, storedRefreshToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            await AsyncStorage.removeItem(USER_KEY);
          }
        }

        if (storedAccessToken && storedRefreshToken) {
          try {
            await refreshProfile();
          } catch {
            await persistTokens(null, null);
            await persistUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
    return () => setLogoutHandler(null);
  }, [logout, persistTokens, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, accessToken, refreshToken, loading, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
