import type { StatusChipTone } from "@/components/elevated-design/status-chip";

export type SendRisk = "fault" | "warning";

export function sendRiskOf(...tones: StatusChipTone[]): SendRisk | null {
  if (tones.includes("fault")) return "fault";
  if (tones.includes("warning")) return "warning";
  return null;
}
