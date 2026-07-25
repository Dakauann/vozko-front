"use client";

/**
 * Browser -> API auth flows. These call the Go API directly with
 * `credentials: 'include'`; on login/register/refresh they send
 * `X-Auth-Mode: cookie` so the API sets the httpOnly session cookies and omits
 * the tokens from the JSON body. No tokens ever pass through JavaScript and there
 * is no Next.js server action in the path.
 *
 * Requires the API to run with COOKIE_DOMAIN set (parent domain in prod,
 * `localhost` in dev) so it can write the cookies.
 */

import type { AuthResponse, User } from "@/lib/auth/types";
import { REF_COOKIE_NAME } from "@/lib/affiliate/ref-cookie.client";
import { getApiBaseUrl } from "@/lib/api/browser-client";

export type RegisterPayload =
  | {
      name: string;
      email: string;
      password: string;
      customerType: "individual";
      cpf: string;
      verificationToken: string;
    }
  | {
      name: string;
      email: string;
      password: string;
      customerType: "company";
      cnpj: string;
      verificationToken: string;
    };

export interface AuthResult {
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

function readReferralCode(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${REF_COOKIE_NAME}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
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

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const referralCode = readReferralCode();
  const body = referralCode ? { ...payload, referralCode } : payload;
  const { data, error, status } = await postAuth<AuthResponse>(
    "/auth/register",
    body,
    true,
  );
  if (error) return { error: error.message, code: error.code, statusCode: status };
  return { success: true, user: mapUser(data!) };
}

export async function logout(): Promise<void> {
  // Best-effort: the API revokes the session and clears the cookies. The caller
  // still clears client-readable cookies and navigates regardless.
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

export async function sendEmailVerification(email: string): Promise<AuthResult> {
  const { data, error, status } = await postAuth<{ success: boolean }>(
    "/auth/send-email-verification",
    { email },
    false,
  );
  if (error) return { error: error.message, code: error.code, statusCode: status };
  return { success: data?.success ?? true };
}
