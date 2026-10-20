"use client";

import { PhoneCall } from "@/components/icons";
import { LikeSticker, StoryCard, UnsupportedNotice } from "@/components/crm/MetaMessageParts";
import { MercadoLivreMediaUnavailable, isMercadoLivreMediaUnavailable } from "@/components/mercadolivre/mercadolivre-message-marks";
import { messageTypeOf } from "@/lib/conversations/direction";
import { metaPrefix, readStory } from "@/lib/conversations/meta-metadata";
import type { ThreadRow } from "@/lib/conversations/thread-rows";
import { cn } from "@/lib/utils";

type EventRow<K extends ThreadRow["kind"]> = { row: Extract<ThreadRow, { kind: K }> };

export function SystemRow({ row }: EventRow<"system">) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-lg bg-warning px-3 py-1.5 text-2xs text-warning-foreground shadow-sm max-w-[80%] text-center">
        {row.message.text}
      </span>
    </div>
  );
}

export function CallEventRow({ row }: EventRow<"call">) {
  const missed = messageTypeOf(row.message) === "call_missed";
  return (
    <div className="flex justify-center my-2">
      <div className="flex items-center gap-1.5 rounded-[--radius] bg-muted px-3 py-1.5 text-2xs font-medium text-muted-foreground">
        <PhoneCall weight="fill" className={cn("h-3.5 w-3.5", missed && "text-destructive")} />
        <span>{row.message.text}</span>
      </div>
    </div>
  );
}

export function CallPermissionRow({ row }: EventRow<"call-permission">) {
  const messageType = messageTypeOf(row.message);
  const granted = messageType === "call_permission_granted";
  const rejected = messageType === "call_permission_rejected";
  return (
    <div className="flex justify-center my-2">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[--radius] px-3 py-1.5 text-2xs font-medium",
          granted
            ? "bg-healthy text-healthy-foreground"
            : rejected
              ? "bg-destructive text-destructive-foreground"
              : "bg-warning text-warning-foreground",
        )}
      >
        <PhoneCall weight="fill" className="h-3.5 w-3.5" />
        <span>{row.message.text}</span>
      </div>
    </div>
  );
}

export function StoryRow({ row }: EventRow<"story">) {
  const message = row.message;
  const prefix = metaPrefix(message.channel ?? message.entry_type);
  if (!prefix) return <UnsupportedRow row={{ ...row, kind: "unsupported" }} />;
  const metadata = (message.metadata ?? null) as Record<string, unknown> | null;
  return (
    <div className="flex justify-start my-1">
      <StoryCard
        prefix={prefix}
        mention={messageTypeOf(message) === "story_mention"}
        mediaUrl={readStory(metadata, prefix)}
        text={message.text}
      />
    </div>
  );
}

export function UnsupportedRow({ row }: EventRow<"unsupported">) {
  return (
    <div className="flex justify-center my-2">
      {isMercadoLivreMediaUnavailable(row.message) ? (
        <MercadoLivreMediaUnavailable message={row.message} />
      ) : (
        <UnsupportedNotice text={row.message.text} />
      )}
    </div>
  );
}

export function LikeStickerRow({ row }: EventRow<"like-sticker">) {
  return (
    <div data-msg-id={row.message.id} className="flex justify-start my-1 px-1">
      <LikeSticker />
    </div>
  );
}
