import { customFetch, login as loginRequest, type LoginInput, type User } from "@workspace/api-client-react";

export interface loginProps {
    password: string;
    email: string
}

export const login = async ({ email, password }: loginProps) =>
  loginRequest({ email, password });

export type LegacyAuthSession = {
  user: User;
  token: string;
  expiresAt: string;
};

export const loginFamilyHead = async ({ email, password }: loginProps) =>
  customFetch<LegacyAuthSession>("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role: "displaced" } satisfies LoginInput),
  });
