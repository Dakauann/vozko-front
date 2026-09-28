"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";

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

interface AvatarProps {
  name: string;
  seed: string;
  className?: string;
  textClassName?: string;
}

function InitialAvatar({ name, seed, className, textClassName }: AvatarProps) {
  const label = name.trim();
  return (
    <span
      aria-label={name}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
        tintFor(label || seed),
        className,
      )}
    >
      <span className={textClassName}>{label.charAt(0) || "?"}</span>
    </span>
  );
}

function AuthenticatedAvatar({ url, ...props }: AvatarProps & { url: string }) {
  const { src, failed, onError } = useAuthenticatedImage(url);
  if (failed) return <InitialAvatar {...props} />;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={props.name} onError={onError} className={cn("shrink-0 rounded-full object-cover", props.className)} />
  );
}

function PublicAvatar({ url, ...props }: AvatarProps & { url: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url) return <InitialAvatar {...props} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={props.name}
      onError={() => setFailedUrl(url)}
      className={cn("shrink-0 rounded-full object-cover", props.className)}
    />
  );
}

export function ChannelAvatarImage({
  url,
  authenticated = false,
  ...props
}: AvatarProps & { url?: string | null; authenticated?: boolean }) {
  if (!url) return <InitialAvatar {...props} />;
  return authenticated ? <AuthenticatedAvatar url={url} {...props} /> : <PublicAvatar url={url} {...props} />;
}
