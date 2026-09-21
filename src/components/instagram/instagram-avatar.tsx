"use client";

import { cn } from "@/lib/utils";
import { instagramAvatarUrl } from "@/app/actions/instagram";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";

interface Props {
  accountId: string;
  username: string;
  className?: string;
  textClassName?: string;
}

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
