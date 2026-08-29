import { SESSION_STORAGE_TOKEN_KEY } from "@/constants/sessionKey";

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_STORAGE_TOKEN_KEY);
};

export const setAuthToken = (token: string) =>
  sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, token);

export const clearAuthToken = () =>
  sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY);

/** @deprecated User identity is now verified with GET /api/auth/me. */
export const getSession = () => {
  const token = getAuthToken();
  return token ? { token } : null;
};
