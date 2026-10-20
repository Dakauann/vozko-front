import type { StatusChipTone } from "@/components/elevated-design/status-chip";

import type { PublicationStatus, SendStatus } from "./types";

const PUBLICATION_TONE: Record<PublicationStatus, StatusChipTone> = {
  creating: "muted",
  draft: "muted",
  published: "healthy",
  throttled: "warning",
  blocked: "fault",
  deprecated: "outline",
  failed: "fault",
};

const PUBLICATION_DOT: Record<PublicationStatus, string> = {
  creating: "bg-muted-foreground",
  draft: "bg-muted-foreground",
  published: "bg-healthy",
  throttled: "bg-warning",
  blocked: "bg-destructive",
  deprecated: "bg-border-strong",
  failed: "bg-destructive",
};

const SEND_TONE: Record<SendStatus, StatusChipTone> = {
  prepared: "muted",
  sent: "outline",
  failed: "fault",
  responded: "healthy",
};

export function publicationTone(status: PublicationStatus): StatusChipTone {
  return PUBLICATION_TONE[status];
}

export function publicationDot(status: PublicationStatus): string {
  return PUBLICATION_DOT[status];
}

export function sendTone(status: SendStatus): StatusChipTone {
  return SEND_TONE[status];
}
