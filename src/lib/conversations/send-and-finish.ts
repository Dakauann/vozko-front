import type { Outbox } from "./outbox";
import type { EntryType } from "./types";

export interface FinishWatch {
  entryId: string;
  entryType: EntryType;
  requestIds: readonly string[];
}

export type FinishDecision = "wait" | "finish" | "abandon";

export function watchFinish(outbox: Outbox, entryId: string, entryType: EntryType): FinishWatch {
  const requestIds = outbox
    .filter((item) => item.entryId === entryId && item.entryType === entryType)
    .filter((item) => item.state === "pending" && item.payload.kind !== "resend")
    .map((item) => item.requestId);
  return { entryId, entryType, requestIds };
}

export function finishDecision(outbox: Outbox, watch: FinishWatch): FinishDecision {
  if (watch.requestIds.length === 0) return "abandon";
  const watched = outbox.filter((item) => watch.requestIds.includes(item.requestId));
  if (watched.some((item) => item.state === "failed")) return "abandon";
  return watched.length === 0 ? "finish" : "wait";
}
