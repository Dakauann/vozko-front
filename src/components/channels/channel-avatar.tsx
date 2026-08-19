"use client";

import { ChannelLogo, hasChannelMark } from "@/components/icons/channel-logos";

import type { EntryType } from "@/lib/conversations/types";
import { UsersThree } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";

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
  sm: { circle: "size-8", badge: "size-3.5", text: "text-2xs" },
  md: { circle: "size-10", badge: "size-4", text: "text-xs" },
  lg: { circle: "size-12", badge: "size-5", text: "text-sm" },
} as const;

/**
 * The two badges are siblings and must read as a matched pair: same plate, same
 * ring, same offset, opposite corners. Only what they carry differs — the
 * channel one a brand mark in its real colours, this one a neutral glyph.
 *
 * That asymmetry is the system's rule, not an oversight. A channel mark is a
 * brand and keeps its own colour; "this is a group" is a fact about the
 * conversation, and facts live in one neutral ground with the meaning in the
 * mark. Giving it a coloured plate would put a second competing colour chip on
 * a 32px avatar and read as a status it is not.
 */
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
  /**
   * A group chat rather than a person.
   *
   * Draws a badge on the bottom-LEFT, opposite the channel mark, and never
   * touches the circle itself: a group with a picture shows it, a group without
   * one shows its initial like anybody else.
   *
   * It used to replace the initial with a group glyph instead, because reading
   * "T" for "Time Comercial" in a list of people is genuinely ambiguous. The
   * badge removes that ambiguity outright and does it at every avatar rather
   * than only the ones missing a photo — which is the case that actually
   * mattered, since a group WITH a picture had no marker at all before.
   */
  isGroup?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const t = useTranslations("common");
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  // The badge is a glyph, so the fact it states has to reach a screen reader
  // some other way. `common` rather than a CRM namespace: this primitive is
  // rendered by the inbox, the board, the funnel and the conversation header,
  // and a shared component that reaches into one caller's namespace breaks the
  // moment a fifth surface uses it.
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
          // The initial, for a group too. It used to be replaced by a group
          // glyph here, because reading "T" for "Time Comercial" in a list of
          // people was genuinely ambiguous — but the badge below now says
          // "group" outright, and saying it twice in one 32px composition made
          // the large glyph and the small one fight for the same job. Each
          // element states one thing: the circle is WHICH conversation, the
          // badges are what KIND.
          <span aria-hidden>{initial}</span>
        )}
      </div>

      {isGroup && (
        // Bottom-LEFT, opposite the channel mark. Two corners rather than one
        // stack: at 32px a badge on a badge is a smudge, and these answer
        // different questions — which network, and how many people.
        <span
          className={cn(BADGE_PLATE, "-left-0.5", s.badge)}
          title={groupLabel}
        >
          <UsersThree
            // Inset rather than full-bleed. The channel mark is artwork drawn
            // to its own edge; this is a stroked glyph, and at 14px it needs
            // the plate's white around it to stay legible on a photo.
            className="h-[72%] w-[72%] text-foreground"
            aria-hidden
          />
          <span className="sr-only">{groupLabel}</span>
        </span>
      )}

      {hasChannelMark(entryType) && (
        // The ring is load-bearing: without it the mark disappears into a busy
        // profile photo at these sizes.
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
