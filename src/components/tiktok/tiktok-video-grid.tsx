"use client";

import { ChatCircle, Eye, Heart, Image as ImageIcon, ImageBroken, PlayCircle } from "@/components/icons";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { TiktokVideo } from "@/lib/tiktok/types";
import { cn } from "@/lib/utils";

export function TiktokVideoThumbnail({ video, className }: { video: TiktokVideo; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = video.thumbnailUrl;
  if (!url || failedUrl === url) {
    return (
      <div className={cn("grid size-full place-items-center bg-muted text-muted-foreground", className)}>
        <ImageBroken className="h-6 w-6" weight="duotone" />
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={video.caption.trim()}
      fill
      unoptimized
      sizes="(min-width: 640px) 220px, 50vw"
      onError={() => setFailedUrl(url)}
      className={cn("object-cover", className)}
    />
  );
}

function TileBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-black/55 p-1 text-2xs font-semibold text-white">{children}</span>;
}

function TileStat({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
      {icon}
      {value.toLocaleString()}
    </span>
  );
}

function VideoTile({ video, onSelect }: { video: TiktokVideo; onSelect: () => void }) {
  const t = useTranslations("tiktok.videos");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={video.caption.trim() || t("open")}
      className={cn(
        "group relative aspect-[9/16] overflow-hidden rounded-[--radius] bg-muted",
        "ring-1 ring-border/60 transition-all duration-200",
        "hover:shadow-lg hover:ring-2 hover:ring-ring",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <TiktokVideoThumbnail video={video} className="transition-transform duration-300 group-hover:scale-[1.04]" />

      <div className="absolute right-2 top-2 flex gap-1">
        {video.isAd ? <TileBadge>{t("ad")}</TileBadge> : null}
        <TileBadge>
          {video.mediaType === "PHOTO" ? (
            <ImageIcon className="h-3.5 w-3.5" weight="fill" aria-label={t("photo")} />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" weight="fill" aria-label={t("video")} />
          )}
        </TileBadge>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
        <TileStat icon={<Eye className="h-4 w-4" weight="fill" />} value={video.views} />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-5",
          "bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        <TileStat icon={<Heart className="h-4 w-4" weight="fill" />} value={video.likes} />
        <TileStat icon={<ChatCircle className="h-4 w-4" weight="fill" />} value={video.comments} />
      </div>
    </button>
  );
}

export function TiktokVideoGrid({
  videos,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: {
  videos: TiktokVideo[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (video: TiktokVideo) => void;
}) {
  const t = useTranslations("tiktok.videos");

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <ImageBroken className="h-8 w-8 text-muted-foreground" weight="duotone" />
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={t("gridLabel")}>
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))" }}>
        {videos.map((video) => (
          <VideoTile key={video.itemId} video={video} onSelect={() => onSelect(video)} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {hasMore ? (
          <Button variant="secondary" title={loadingMore ? t("loading") : t("loadMore")} onClick={onLoadMore} disabled={loadingMore} />
        ) : (
          <p className="text-2xs text-muted-foreground">{t("allLoaded", { count: videos.length })}</p>
        )}
      </div>
    </section>
  );
}
