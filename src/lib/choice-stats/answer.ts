import type { ApiResult } from "@/lib/api/browser-client";

export type ChoiceStatsAnswer<T> =
  | { status: "ready"; stats: T }
  | { status: "unreadable" }
  | { status: "failed"; message: string; code?: string; httpStatus?: number };

export function choiceStatsAnswer<T>(response: ApiResult<unknown>, read: (raw: unknown) => T | null): ChoiceStatsAnswer<T> {
  if (response.error) {
    const { message, code, status } = response.error;
    return { status: "failed", message, ...(code ? { code } : {}), ...(status !== undefined ? { httpStatus: status } : {}) };
  }
  const stats = read(response.data);
  return stats ? { status: "ready", stats } : { status: "unreadable" };
}
