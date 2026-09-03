"use client";

import { cn } from "@/lib/utils";
import { instagramAvatarUrl } from "@/app/actions/instagram";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";

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
  "bg-muted text-chart-4-ink dark:text-chart-4",
  "bg-muted text-muted-foreground dark:text-chart-4",
  "bg-muted text-muted-foreground dark:text-info-ink",
  "bg-muted text-healthy-ink dark:text-healthy-ink",
  "bg-muted text-warning-ink dark:text-warning-ink",
  "bg-muted text-destructive-ink dark:text-destructive-ink",
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
  const { src, failed, onError } = useAuthenticatedImage(instagramAvatarUrl(accountId));

  if (failed) {
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

  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={username}
      onError={onError}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}
