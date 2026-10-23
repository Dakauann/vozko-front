import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import type { RcsSenderStatus } from "@/lib/rcs/types";

export type SenderTrackStep = Exclude<RcsSenderStatus, "rejected">;

export const SENDER_TRACK: readonly SenderTrackStep[] = ["draft", "submitted", "awaiting_confirmation", "launched", "paused"];

export function senderTrackIndex(status: RcsSenderStatus): number {
  return status === "rejected" ? 0 : SENDER_TRACK.indexOf(status);
}

const TONE: Record<RcsSenderStatus, StatusChipTone> = {
  draft: "muted",
  submitted: "neutral",
  awaiting_confirmation: "neutral",
  launched: "healthy",
  paused: "warning",
  rejected: "fault",
};

export function senderStatusTone(status: RcsSenderStatus): StatusChipTone {
  return TONE[status];
}
