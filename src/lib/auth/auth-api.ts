"use client";


import type { AuthResponse, User } from "@/lib/auth/types";
import { getApiBaseUrl } from "@/lib/api/browser-client";

interface AuthResult {
  success?: boolean;
  user?: User;
  message?: string;
  error?: string;
  code?: string;
  statusCode?: number;
}

interface PostResult<T> {
  data?: T;
  status: number;
  error?: { message: string; code?: string };
}

async function postAuth<T>(
  path: string,
  body: unknown,
  cookieMode: boolean,
): Promise<PostResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookieMode) headers["X-Auth-Mode"] = "cookie";

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 0, error: { message: "Network error" } };
  }

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    return {
      status: res.status,
      error: {
        message: json.message || json.error || "Request failed",
        code: json.code,
      },
    };
  }
  return { data: json as T, status: res.status };
}

function mapUser(data: AuthResponse): User {
  return {
    id: data.userId,
    email: data.email,
    name: data.name,
    picture: data.picture,
    role: data.role,
    customerType: data.customerType,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error, status } = await postAuth<AuthResponse>(
    "/auth/login",
    { email, password },
    true,
  );
  if (error) return { error: error.message, code: error.code, statusCode: status };
  return { success: true, user: mapUser(data!) };
}

export async function logout(): Promise<void> {
  await postAuth("/auth/logout", {}, true).catch(() => undefined);
}

export async function forgotPassword(email: string): Promise<AuthResult> {
  const { data, error, status } = await postAuth<{ message: string }>(
    "/auth/forgot-password",
    { email },
    false,
  );
  if (error) return { error: error.message, statusCode: status };
  return { success: true, message: data?.message };
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<AuthResult> {
  const { data, error, status } = await postAuth<{ message: string }>(
    "/auth/reset-password",
    { email, token, newPassword },
    false,
  );
  if (error) return { error: error.message, statusCode: status };
  return { success: true, message: data?.message };
}
