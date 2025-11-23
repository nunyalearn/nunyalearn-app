import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

type LogoutHandler = (() => void) | null;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3333";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let tokens: {
  accessToken: string | null;
  refreshToken: string | null;
} = {
  accessToken: null,
  refreshToken: null,
};

let logoutHandler: LogoutHandler = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAuthTokens = (nextTokens: { accessToken?: string | null; refreshToken?: string | null }) => {
  tokens = {
    accessToken: nextTokens.accessToken ?? null,
    refreshToken: nextTokens.refreshToken ?? null,
  };
};

export const setLogoutHandler = (handler: (() => void) | null) => {
  logoutHandler = handler;
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (!tokens.refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken: tokens.refreshToken })
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        const nextAccessToken = payload?.accessToken ?? null;
        const nextRefreshToken = payload?.refreshToken ?? tokens.refreshToken ?? null;
        setAuthTokens({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        });
        return nextAccessToken;
      })
      .catch((error) => {
        setAuthTokens({ accessToken: null, refreshToken: null });
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (tokens.accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalConfig = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    if (status === 401 && !originalConfig._retry && tokens.refreshToken) {
      originalConfig._retry = true;
      try {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          originalConfig.headers = {
            ...originalConfig.headers,
            Authorization: `Bearer ${refreshedToken}`,
          };
          return api(originalConfig);
        }
      } catch {
        logoutHandler?.();
      }
    }

    return Promise.reject(error);
  },
);

export default api;

