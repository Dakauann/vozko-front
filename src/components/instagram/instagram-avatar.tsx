"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { instagramAvatarUrl } from "@/app/actions/instagram";

interface Props {
  accountId: string;
  username: string;
  /** Tailwind size classes, e.g. "size-7" or "size-20 sm:size-24". */
  className?: string;
  /** Text size for the fallback initial, e.g. "text-xs" or "text-3xl". */
  textClassName?: string;
}

/**
 * A deterministic tint per account.
 *
 * Derived from the handle rather than assigned by list position, so an account
 * keeps the same colour across the table, the profile header and the post dialog,
 * which is what makes it useful as a recognition cue instead of decoration.
 */
const TINTS = [
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
];

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

/**
 * An account's profile picture, falling back to its initial.
 *
 * The image is always attempted rather than gated on a stored profilePictureUrl,
 * because that stored value answers the wrong question. Instagram OMITS
 * profile_picture_url for an account that has never set a photo, so a blank field
 * can mean either "no photo" or "we simply have not refreshed", and the URL it
 * does return is a signed CDN link that expires, making any stored copy unreliable
 * over time. Asking the proxy and reacting to the outcome is the only version that
 * is right in both cases.
 *
 * The fallback is the account's initial, not the Instagram mark: every account here
 * is an Instagram account, so the logo would repeat information already carried by
 * the page and tell an operator nothing about WHICH account they are looking at.
 */
export function InstagramAvatar({ accountId, username, className, textClassName }: Props) {
  // The failure is remembered against the account it belongs to, rather than as a
  // bare boolean reset by an effect. A table row gets recycled for a different
  // account on pagination, and a plain boolean would carry one account's missing
  // photo over to the next, showing a placeholder for an account that has one.
  const [failedFor, setFailedFor] = useState<string | null>(null);

  if (failedFor === accountId) {
    const handle = username.trim();
    return (
      <span
        aria-label={username}
        className={cn(
          "flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
          tintFor(handle || accountId),
          className,
        )}
      >
        <span className={textClassName}>{handle.charAt(0) || "?"}</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={instagramAvatarUrl(accountId)}
      alt={username}
      onError={() => setFailedFor(accountId)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}
