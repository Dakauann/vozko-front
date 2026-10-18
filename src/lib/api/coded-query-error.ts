import { SectionError } from "@/lib/analytics/section-query";

import type { CodedError } from "./coded-error";

export function codedQueryError(error: unknown): CodedError | null {
  if (!error) return null;
  if (error instanceof SectionError) return { message: error.message, code: error.code, status: error.status };
  return { message: error instanceof Error ? error.message : String(error) };
}
