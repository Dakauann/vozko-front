import type { CodedRefusal } from "@/lib/api/coded-error";

import { parseProblems } from "./parse";
import type { Problem } from "./types";

export const STALE_DRAFT = "whatsapp_form_stale_draft";
export const OUTSIDE_WINDOW = "whatsapp_form_outside_window";
export const FORM_INVALID = "whatsapp_form_invalid";

export function isStaleDraft(error: CodedRefusal): boolean {
  return error.status === 409 && error.code === STALE_DRAFT;
}

export function isOutsideWindow(error: CodedRefusal): boolean {
  return error.code === OUTSIDE_WINDOW;
}

export function problemsOf(error: CodedRefusal): Problem[] {
  if (error.status !== 422 || !error.details) return [];
  return parseProblems(error.details) ?? [];
}
