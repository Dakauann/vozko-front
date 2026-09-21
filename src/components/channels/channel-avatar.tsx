"use client";

import { ChannelLogo, hasChannelMark } from "@/components/icons/channel-logos";

import type { EntryType } from "@/lib/conversations/types";
import { UsersThree } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";


const TINTS = [
  "tile-4",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
  "bg-healthy text-healthy-foreground",
  "bg-warning text-warning-foreground",
  "bg-destructive text-destructive-foreground",
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

const SIZES = {
  sm: { circle: "size-8", badge: "size-3.5", text: "text-2xs" },
  md: { circle: "size-10", badge: "size-4", text: "text-xs" },
  lg: { circle: "size-12", badge: "size-5", text: "text-sm" },
} as const;

const BADGE_PLATE =
  "absolute -bottom-2 flex items-center justify-center rounded-full bg-card ring-2 ring-card";

export function ChannelAvatar({
  name,
  pictureUrl,
  entryType,
  isGroup = false,
  size = "md",
  className,
}: {
  name?: string | null;
  pictureUrl?: string | null;
  entryType?: EntryType | string | null;
  isGroup?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const t = useTranslations("common");
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  const groupLabel = t("groupConversation");
  const label = (name ?? "").trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  const showImage = Boolean(pictureUrl) && !failed;

  return (
    <div className={cn("relative shrink-0", s.circle, className)}>
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold",
          s.text,
          showImage ? "bg-muted" : tintFor(label || "?"),
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pictureUrl as string}
            alt={label}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            loading="lazy"
          />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
      </div>

      {isGroup && (
        <span
          className={cn(BADGE_PLATE, "-left-0.5", s.badge)}
          title={groupLabel}
        >
          <UsersThree
            className="h-[72%] w-[72%] text-foreground"
            aria-hidden
          />
          <span className="sr-only">{groupLabel}</span>
        </span>
      )}

      {hasChannelMark(entryType) && (
        <span className={cn(BADGE_PLATE, "-right-0.5", s.badge)}>
          <ChannelLogo
            channel={entryType as string}
            className="h-full w-full"
          />
        </span>
      )}
    </div>
  );
}
