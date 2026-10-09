import { codedErrorMessage, type CodedError, type CodedTranslator } from "@/lib/api/coded-error";

export const SELECTION_ERROR_CODES = [
  "forbidden",
  "unknown_action",
  "invalid_filter",
  "selection_unknown_mode",
  "selection_empty",
  "selection_ambiguous",
  "selection_too_many_ids",
  "selection_filter_required",
  "selection_limit_required",
  "selection_everyone_unconfirmed",
  "selection_fingerprint_mismatch",
  "selection_invalid_count",
  "selection_changed",
  "selection_mode_unsupported",
  "selection_unavailable",
  "selection_invalid_page",
  "selection_scope_denied",
  "selection_invalid_ids",
  "selection_unknown_sort",
  "selection_count_required",
] as const;

export const SELECTION_CHANGED = "selection_changed";

const BUSY_STATUSES = new Set([503, 504]);

export function selectionErrorMessage(t: CodedTranslator, error: CodedError): string {
  if (!error.code && error.status !== undefined && BUSY_STATUSES.has(error.status)) {
    return t("errors.busy");
  }
  return codedErrorMessage(t, error, t("errors.default"));
}
