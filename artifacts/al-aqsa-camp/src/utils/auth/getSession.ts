import { SESSION_STORAGE_TOKEN_KEY } from "@/constants/sessionKey";
import type { User } from "@workspace/api-client-react";

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

const SESSION_ROLE_KEY = "aqsa-session-role";
/** @deprecated User identity is now verified with GET /api/auth/me. */
export const getSession = () => {
  const token = getAuthToken();
  return token ? { token } : null;
};

export const getAuthRole = (): string | null =>
  typeof window === "undefined" ? null : sessionStorage.getItem(SESSION_ROLE_KEY);

export const clearAuthRole = () => sessionStorage.removeItem(SESSION_ROLE_KEY);

export const getAuthUser = (): User | null => {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(SESSION_USER_KEY);
  if (!value) return null;
  try { return JSON.parse(value) as User; } catch { return null; }
};

export const clearAuthUser = () => sessionStorage.removeItem(SESSION_USER_KEY);

export const setAuthRole = (role: string) => sessionStorage.setItem(SESSION_ROLE_KEY, role);

export const setAuthUser = (user: User) => sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));

const SESSION_USER_KEY = "aqsa-session-user";
