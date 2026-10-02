import type { ApiResult } from "@/lib/api/browser-client";

export interface ActionError {
  error: string;
  code?: string;
  status?: number;
  expected?: Record<string, string>;
}

export type ActionResult<T> = { data: T } | ActionError;

export function isActionError<T>(result: ActionResult<T>): result is ActionError {
  return "error" in result;
}

export function settleResult<T>(result: ApiResult<T>, fallback?: T): ActionResult<T> {
  if (result.error) {
    return {
      error: result.error.message,
      code: result.error.code,
      status: result.error.status,
      expected: result.error.expected,
    };
  }
  if (result.data === undefined || result.data === null) {
    return fallback === undefined ? { error: "Empty response" } : { data: fallback };
  }
  return { data: result.data };
}
