import { login as loginRequest } from "@workspace/api-client-react";

export interface loginProps {
    password: string;
    email: string
}

export const login = async ({ email, password }: loginProps) =>
  loginRequest({ email, password });
