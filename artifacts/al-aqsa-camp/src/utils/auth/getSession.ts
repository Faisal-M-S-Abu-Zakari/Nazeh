import { SESSION_STORAGE_TOKEN_KEY } from "@/constants/sessionKey";

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    // Web sessions are deliberately tab-scoped. Do not fall back to
    // localStorage: a persistent bearer token is needlessly exposed to every
    // tab and survives browser restarts.
    return window.sessionStorage.getItem(SESSION_STORAGE_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, token);
  } catch {
    // Do not fall back to localStorage or cookies: failed session storage
    // must leave the user unauthenticated rather than widen token exposure.
  }
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
};

/** @deprecated User identity is now verified with GET /api/auth/me. */
export const getSession = () => {
  const token = getAuthToken();
  return token ? { token } : null;
};
