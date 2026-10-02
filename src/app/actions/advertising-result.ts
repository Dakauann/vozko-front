import type { ApiResult } from "@/lib/api/browser-client";

import type { AdsResult } from "./advertising";

export function settleAds<T>(result: ApiResult<T>, fallback?: T): AdsResult<T> {
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

export const withAccount = (path: string, accountId: string) => `${path}?${new URLSearchParams({ accountId }).toString()}`;
