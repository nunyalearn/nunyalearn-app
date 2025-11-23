import api from "./api";

type ApiResponse<T> = {
  data?: T;
  success?: boolean;
  message?: string;
};

const extract = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === "object" && "data" in response) {
    return (response as ApiResponse<T>).data as T;
  }
  return response as T;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type Profile = {
  id: number;
  fullName?: string;
  email?: string;
  [key: string]: unknown;
};

export const authService = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const response = await api.post("/auth/login", { email, password });
    return extract<AuthTokens>(response.data);
  },

  async register(fullName: string, email: string, password: string): Promise<AuthTokens> {
    const response = await api.post("/auth/register", {
      fullName,
      email,
      password,
    });
    return extract<AuthTokens>(response.data);
  },

  async profile(): Promise<Profile> {
    const response = await api.get("/auth/profile");
    return extract<Profile>(response.data);
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const response = await api.post("/auth/refresh", { refreshToken });
    return extract<AuthTokens>(response.data);
  },
};

export default authService;

