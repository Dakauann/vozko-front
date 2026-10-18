import { guardedResult, settleResult, type ActionResult } from "@/app/actions/action-result";
import { apiClient } from "@/lib/api/browser-client";

type Guard<T> = (value: unknown) => value is T;

export async function getChecked<T>(path: string, guard: Guard<T>, what: string, signal?: AbortSignal): Promise<ActionResult<T>> {
  return guardedResult(settleResult(await apiClient<unknown>(path, { method: "GET", signal })), guard, what);
}

export async function sendChecked<T>(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  guard: Guard<T>,
  what: string,
  signal?: AbortSignal,
): Promise<ActionResult<T>> {
  const payload = body instanceof FormData ? body : JSON.stringify(body);
  return guardedResult(settleResult(await apiClient<unknown>(path, { method, body: payload, signal })), guard, what);
}
