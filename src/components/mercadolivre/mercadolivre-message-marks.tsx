"use client";

import { useTranslations } from "next-intl";

import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import type { ConversationMessage } from "@/lib/conversations/types";
import { refuseUnhandled } from "@/lib/exhaustive";
import {
  isFromMercadoLivreAgent,
  readMediaUnavailable,
  readModeration,
  type MercadoLivreModeration,
  type MercadoLivreModerationState,
} from "@/lib/mercadolivre/message-metadata";
import { cn } from "@/lib/utils";

type Metadata = Record<string, unknown> | null;

function metadataOf(message: ConversationMessage): Metadata {
  return (message.metadata ?? null) as Metadata;
}

function moderationTone(state: MercadoLivreModerationState): StatusChipTone {
  switch (state) {
    case "pending_review":
      return "warning";
    case "pending_translation":
      return "muted";
    case "blocked":
      return "fault";
    case "unknown":
      return "outline";
    default:
      return refuseUnhandled(state, "outline");
  }
}

function ModerationMark({ moderation }: { moderation: MercadoLivreModeration }) {
  const t = useTranslations("mercadolivre.thread");
  return (
    <div className="flex flex-col items-end gap-0.5">
      <StatusChip tone={moderationTone(moderation.state)} label={t(`moderation.${moderation.state}`)} className="text-2xs" />
      {moderation.reason ? (
        <p className="max-w-[16rem] text-right text-2xs text-muted-foreground">{t(`moderationReason.${moderation.reason}`)}</p>
      ) : null}
    </div>
  );
}

function AgentMark() {
  const t = useTranslations("mercadolivre.thread");
  return (
    <span title={t("fromAgentHint")} className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
      {t("fromAgent")}
    </span>
  );
}

export function MercadoLivreMessageMarks({ message, outgoing }: { message: ConversationMessage; outgoing: boolean }) {
  const metadata = metadataOf(message);
  const moderation = outgoing ? readModeration(metadata) : null;
  const fromAgent = !outgoing && isFromMercadoLivreAgent(metadata);
  if (!moderation && !fromAgent) return null;
  return (
    <div className={cn("mt-1 flex", outgoing ? "justify-end" : "justify-start")}>
      {moderation ? <ModerationMark moderation={moderation} /> : <AgentMark />}
    </div>
  );
}

export function isMercadoLivreMediaUnavailable(message: ConversationMessage): boolean {
  return message.channel === "mercadolivre" && readMediaUnavailable(metadataOf(message)) !== null;
}

export function MercadoLivreMediaUnavailable({ message }: { message: ConversationMessage }) {
  const t = useTranslations("mercadolivre.thread");
  const unavailable = readMediaUnavailable(metadataOf(message));
  if (!unavailable) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-[--radius] bg-muted px-3 py-1.5 text-2xs text-muted-foreground">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
      {unavailable.fileName ? t("mediaUnavailableNamed", { name: unavailable.fileName }) : t("mediaUnavailable")}
    </div>
  );
}
