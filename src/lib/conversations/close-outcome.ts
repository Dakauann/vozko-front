import type { OutcomeCaptureSpec } from "@/lib/workspace/workspace-config/types";

// Closes that chose no outcome carry a reserved code (see close_meta.go).
const RESERVED_OUTCOMES = {
  _system_auto_close: "systemAutoClose",
  _ai_unspecified: "aiUnspecified",
  _workflow_unspecified: "workflowUnspecified",
} as const;

export type ReservedOutcomeKey =
  (typeof RESERVED_OUTCOMES)[keyof typeof RESERVED_OUTCOMES];

export function reservedOutcomeKey(code: string): ReservedOutcomeKey | null {
  return (RESERVED_OUTCOMES as Record<string, ReservedOutcomeKey>)[code] ?? null;
}

// closeOutcomeLabel is what a person reads for the outcome a close recorded:
// the catalogue label, a name for a reserved code, or the bare code when the
// catalogue no longer lists it.
export function closeOutcomeLabel(
  code: string | null | undefined,
  capture: OutcomeCaptureSpec | null,
  reservedLabel: (key: ReservedOutcomeKey) => string,
): string | null {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return null;
  const reserved = reservedOutcomeKey(trimmed);
  if (reserved) return reservedLabel(reserved);
  const listed = capture?.outcomes?.find((o) => o.code === trimmed);
  return listed?.label ?? trimmed;
}
