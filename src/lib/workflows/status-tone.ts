import type { StatusChipTone } from "@/components/elevated-design/status-chip";

export interface StatusTone {
  tone: StatusChipTone;
  dot?: string;
}

const STATUS_TONES: Record<string, StatusTone> = {
  running: { tone: "outline", dot: "bg-primary" },
  waiting: { tone: "warning" },
  completed: { tone: "healthy" },
  error: { tone: "fault" },
  cancelled: { tone: "muted" },
  paused: { tone: "warning" },
  waiting_reply: { tone: "warning" },
  waiting_form: { tone: "warning" },
  waiting_key: { tone: "warning" },
  confirming: { tone: "warning" },
  connecting: { tone: "warning" },
  ready: { tone: "muted" },
  waiting_trigger: { tone: "muted" },
};

const UNKNOWN: StatusTone = { tone: "muted" };

export function statusTone(status: string): StatusTone {
  return Object.hasOwn(STATUS_TONES, status) ? STATUS_TONES[status] : UNKNOWN;
}
