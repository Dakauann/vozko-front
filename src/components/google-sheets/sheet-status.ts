import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import type { SheetStatus } from "@/lib/google-sheets/types";

export const SHEET_STATUS_TONE: Record<SheetStatus, StatusChipTone> = {
  active: "healthy",
  needs_attention: "warning",
};
