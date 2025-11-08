import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";
export const TOKEN_STORAGE_KEY = "nunyalearn:admin-token";

export const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const persistToken = (token: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const fetcher = async <T>(url: string): Promise<T> => {
  const response = await api.get(url);
  const payload = response.data as { data?: T };
  return (payload?.data ?? response.data) as T;
};

export const downloadFile = async (url: string, filename: string) => {
  const response = await api.get(url, { responseType: "blob" });
  const blob = new Blob([response.data]);
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default api;
