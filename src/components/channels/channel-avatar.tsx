"use client";

import { useState } from "react";

import { ChannelLogo, hasChannelMark } from "@/components/icons/channel-logos";
import type { EntryType } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

/**
 * A contact's avatar, marked with the channel it came in on.
 *
 * Every surface that lists conversations had solved this differently: the inbox
 * rendered a channel glyph INSTEAD of the person (so you saw which network but
 * never who), the board rendered initials only (so you saw who but never which
 * network), and neither handled a channel it had not been updated for,
 * Telegram showed a telephone icon in one place and a bare initial in another.
 *
 * Both facts matter and they are not alternatives, so the photo owns the circle
 * and the channel becomes a badge on it. That also makes the composition
 * stable: a channel added later gets a badge for free instead of falling
 * through an if-chain to whatever the last branch happened to be.
 */

/**
 * Solid tone, white ink, the same rule CardTile and CardPill follow. A tinted
 * fill under same-hue text washes out at small sizes and against the tinted
 * surfaces these sit on; a solid tone holds its contrast anywhere.
 */
const TINTS = [
  "bg-chart-4 text-white",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
  "bg-healthy text-healthy-foreground",
  "bg-warning text-warning-foreground",
  "bg-destructive text-destructive-foreground",
];

/**
 * A deterministic tint per contact.
 *
 * Derived from the name rather than list position, so the same person keeps the
 * same colour between the inbox, the board and the conversation header, which
 * is what makes it a recognition cue rather than decoration.
 */
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

const SIZES = {
  sm: { circle: "size-8", badge: "size-3.5", text: "text-[11px]" },
  md: { circle: "size-10", badge: "size-4", text: "text-xs" },
  lg: { circle: "size-12", badge: "size-5", text: "text-sm" },
} as const;

export function ChannelAvatar({
  name,
  pictureUrl,
  entryType,
  size = "md",
  className,
}: {
  name?: string | null;
  pictureUrl?: string | null;
  entryType?: EntryType | string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
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
          // A plain img, not next/image: these are provider CDN URLs that
          // expire, and a failed load must fall back to the initial rather than
          // leave a broken frame.
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

      {hasChannelMark(entryType) && (
        // The ring is load-bearing: without it the mark disappears into a busy
        // profile photo at these sizes.
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-card ring-2 ring-card",
            s.badge,
          )}
        >
          <ChannelLogo channel={entryType as string} className="h-full w-full" />
        </span>
      )}
    </div>
  );
}
