import type { MemberClass, Verdict } from "@/lib/attendance/types";

import { ATTENDANCE_COLORS } from "@/components/dashboard/attendance/primitives";

export type VerdictTone = "healthy" | "warning" | "destructive" | "muted";

const VERDICT_TONES: Record<Verdict, VerdictTone> = {
  on_track: "healthy",
  at_risk: "warning",
  off_track: "destructive",
  no_target: "muted",
  not_projected: "muted",
  insufficient_data: "muted",
};

const CLASS_TONES: Record<MemberClass, VerdictTone> = {
  elite: "healthy",
  solid: "healthy",
  below: "warning",
  critical: "destructive",
  insufficient_data: "muted",
};

export function verdictTone(verdict: Verdict | "" | undefined): VerdictTone {
  if (!verdict) return "muted";
  return VERDICT_TONES[verdict] ?? "muted";
}

export function memberClassTone(value: MemberClass | undefined): VerdictTone {
  if (!value) return "muted";
  return CLASS_TONES[value] ?? "muted";
}

export function toneTextClass(tone: VerdictTone): string {
  switch (tone) {
    case "healthy":
      return "text-healthy-ink";
    case "warning":
      return "text-warning-ink";
    case "destructive":
      return "text-destructive-ink";
    default:
      return "text-muted-foreground";
  }
}

export function toneDotClass(tone: VerdictTone): string {
  switch (tone) {
    case "healthy":
      return "bg-healthy";
    case "warning":
      return "bg-warning";
    case "destructive":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/40";
  }
}

export function toneColor(tone: VerdictTone): string {
  switch (tone) {
    case "healthy":
      return ATTENDANCE_COLORS.onTrack;
    case "warning":
      return ATTENDANCE_COLORS.atRisk;
    case "destructive":
      return ATTENDANCE_COLORS.offTrack;
    default:
      return ATTENDANCE_COLORS.neutral;
  }
}
