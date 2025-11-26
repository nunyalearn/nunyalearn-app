import { isAxiosError } from "axios";

import api from "./api";

type ApiResponse<T> = {
  data?: T;
  success?: boolean;
  message?: string;
};

const unwrap = <T,>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
};

export type Achievement = {
  id: number | string;
  title: string;
  description?: string | null;
  iconUrl?: string | null;
  xpReward?: number;
  progressPercent?: number;
  unlocked?: boolean;
  unlockedAt?: string | null;
};

const normalize = (payload: { achievements?: Achievement[] } | Achievement[] | undefined | null): Achievement[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if ("achievements" in payload) {
    return payload.achievements ?? [];
  }
  return [];
};

const fetchLegacy = async (): Promise<Achievement[]> => {
  const response = await api.get("/achievements");
  return normalize(unwrap(response.data));
};

export const fetchAchievements = async (): Promise<Achievement[]> => {
  try {
    const response = await api.get("/api/v2/achievements");
    return normalize(unwrap(response.data));
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return fetchLegacy();
    }
    throw error;
  }
};

export const achievementService = {
  fetchAchievements,
};

export default achievementService;
