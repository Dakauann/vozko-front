import type { User, UserPlan } from "@/lib/auth/types";
import { apiClient } from "@/lib/api/browser-client";

// The credential auth flows (login, register, logout, refresh, forgot/reset
// password, email verification) live in `@/lib/auth/auth-api`. These are the
// remaining user/session data helpers, now browser-direct via `apiClient`.

interface UserMeResponse {
  id: string;
  username: string;
  email: string;
  picture?: string;
  role: string;
  customerType: "company" | "individual";
  emailVerified?: boolean;
  hasDocument?: boolean;
  document?: string;
  plan?: UserPlan;
}

function mapUserMe(payload: UserMeResponse): User {
  return {
    id: payload.id,
    email: payload.email,
    name: payload.username,
    picture: payload.picture,
    role: payload.role,
    customerType: payload.customerType,
    emailVerified: payload.emailVerified,
    hasDocument: payload.hasDocument,
    document: payload.document,
    plan: payload.plan,
  };
}

export async function getCurrentUserAction(): Promise<{ user: User | null }> {
  const { data } = await apiClient<UserMeResponse>("/user/me");
  return { user: data ? mapUserMe(data) : null };
}

export async function getUserMeAction(): Promise<{
  plan?: UserPlan;
  picture?: string;
  error?: string;
}> {
  const { data, error } = await apiClient<UserMeResponse>("/user/me");
  if (error) {
    return { error: error.message };
  }
  return { plan: data?.plan, picture: data?.picture };
}

export async function isAuthenticatedAction(): Promise<boolean> {
  const { data } = await apiClient<UserMeResponse>("/user/me");
  return !!data;
}

export async function updateUserPictureAction(
  pictureUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await apiClient<UserMeResponse>("/user/me", {
    method: "PATCH",
    body: JSON.stringify({ picture: pictureUrl }),
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Sets the user's CPF/CNPJ (required before billing). The API validates and stores it set-once;
 * `errorCode` distinguishes an invalid document from an attempt to change an already-set one.
 */
export async function updateUserDocumentAction(
  document: string,
): Promise<{ user: User | null; error?: string; errorCode?: string | null }> {
  const { data, error } = await apiClient<UserMeResponse>("/user/me", {
    method: "PATCH",
    body: JSON.stringify({ document }),
  });
  if (error) {
    return { user: null, error: error.message, errorCode: error.code ?? null };
  }
  return { user: data ? mapUserMe(data) : null, error: undefined, errorCode: null };
}

/**
 * Renames the authenticated user. `username` is a display name only — login is by email and the
 * value is not unique-constrained — so this is a plain overwrite, unlike the set-once document.
 */
export async function updateUserNameAction(
  username: string,
): Promise<{ user: User | null; error?: string }> {
  const { data, error } = await apiClient<UserMeResponse>("/user/me", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
  if (error) {
    return { user: null, error: error.message };
  }
  return { user: data ? mapUserMe(data) : null };
}

export interface ActiveSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  location: string;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
}

export async function listSessionsAction(): Promise<{
  sessions: ActiveSession[];
  error?: string;
}> {
  const res = await apiClient<ActiveSession[]>("/auth/sessions");
  if (res.error) {
    return { sessions: [], error: res.error.message };
  }
  return { sessions: res.data ?? [] };
}

export async function revokeSessionAction(
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await apiClient<{ message: string }>(
    `/auth/sessions/${sessionId}`,
    { method: "DELETE" },
  );
  if (res.error) {
    return { success: false, error: res.error.message };
  }
  return { success: true };
}

export async function logoutAllSessionsAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const res = await apiClient<{ message: string }>("/auth/logout-all", {
    method: "POST",
  });
  if (res.error) {
    return { success: false, error: res.error.message };
  }
  return { success: true };
}
