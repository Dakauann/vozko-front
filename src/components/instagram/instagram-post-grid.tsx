"use client";

import { ChatCircle, Copy, FilmStrip, Heart, ImageBroken, PlayCircle } from "@/components/icons";

import type { InstagramMedia } from "@/lib/instagram/types";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { instagramAssetUrl } from "@/app/actions/instagram";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";
import { useTranslations } from "next-intl";

interface Props {
  accountId: string;
  posts: InstagramMedia[];
  hasNext: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (media: InstagramMedia) => void;
}

/**
 * The post grid.
 *
 * Sizing is driven by `auto-fill` with a fixed tile range rather than a fixed
 * column count. A fixed `grid-cols-3` looks right at ~900px but degrades badly at
 * both ends: on a wide screen three tiles stretch to enormous squares, and with a
 * single post one tile occupies a third of the viewport while two empty cells sit
 * beside it. `auto-fill` + `minmax` keeps every tile within a sane size band and
 * simply fits more per row as space allows, which is also how Instagram's own grid
 * behaves on desktop.
 *
 * Thumbnails come from our own proxy: Instagram's media_url is a signed CDN link
 * that expires, so embedding it directly would produce images that break minutes
 * later.
 */
export function InstagramPostGrid({
  accountId,
  posts,
  hasNext,
  loadingMore,
  onLoadMore,
  onSelect,
}: Props) {
  const t = useTranslations("instagram");

  if (posts.length === 0) {
    return (
      <ElevatedContainer className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <ImageBroken className="h-8 w-8 text-muted-foreground" weight="duotone" />
        <p className="text-sm text-muted-foreground">{t("posts.empty")}</p>
      </ElevatedContainer>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={t("posts.gridLabel")}>
      <div
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}
      >
        {posts.map((media) => (
          <PostTile
            key={media.id}
            accountId={accountId}
            media={media}
            onSelect={() => onSelect(media)}
            openLabel={t("posts.openPost")}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {hasNext ? (
          <Button
            variant="secondary"
            title={loadingMore ? t("posts.loading") : t("posts.loadMore")}
            onClick={onLoadMore}
            disabled={loadingMore}
          />
        ) : (
          <p className="text-2xs text-muted-foreground">
            {t("posts.allLoaded", { count: posts.length })}
          </p>
        )}
      </div>
    </section>
  );
}

function PostTile({
  accountId,
  media,
  onSelect,
  openLabel,
}: {
  accountId: string;
  media: InstagramMedia;
  onSelect: () => void;
  openLabel: string;
}) {
  // A reel is a VIDEO with mediaProductType REELS, there is no media_type=REELS,
  // which is why isReel is precomputed server-side rather than derived here.
  const isVideo = media.mediaType === "VIDEO" || media.isReel;
  const useVideoPreview = isVideo && !media.thumbnailUrl;
  const { src, contentType, failed, onError } = useAuthenticatedImage(
    instagramAssetUrl(accountId, media.id, !useVideoPreview),
  );
  const renderVideo =
    isVideo && (useVideoPreview || contentType?.startsWith("video/") === true);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={media.caption?.trim() || openLabel}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-[--radius] bg-muted",
        "ring-1 ring-border/60 transition-all duration-200",
        "hover:ring-2 hover:ring-ring hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {media.hasAsset && src ? renderVideo ? (
        <video
          src={src}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          aria-label={media.caption?.trim() || ""}
          onError={onError}
          className="size-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={media.caption?.trim() || ""}
          loading="lazy"
          decoding="async"
          onError={onError}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      ) : !media.hasAsset || failed ? (
        // media_url is OMITTED (not null) for copyrighted content, so a missing
        // asset is an expected state rather than an error.
        <div className="grid size-full place-items-center text-muted-foreground">
          <ImageBroken className="h-6 w-6" weight="duotone" />
        </div>
      ) : null}

      {/* Type markers, top-right like Instagram's own grid. */}
      <div className="absolute right-2 top-2 flex gap-1">
        {media.isReel ? (
          <TileBadge>
            <FilmStrip className="h-3.5 w-3.5" weight="fill" />
          </TileBadge>
        ) : isVideo ? (
          <TileBadge>
            <PlayCircle className="h-3.5 w-3.5" weight="fill" />
          </TileBadge>
        ) : null}
        {media.isCarousel && (
          <TileBadge>
            <Copy className="h-3.5 w-3.5" weight="fill" />
          </TileBadge>
        )}
      </div>

      {/* Engagement overlay. Uses a gradient rather than a flat wash so the counts
          stay legible over both light and dark imagery. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-end justify-center gap-5 pb-3",
          "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
          <Heart className="h-4 w-4" weight="fill" />
          {media.likeCount}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
          <ChatCircle className="h-4 w-4" weight="fill" />
          {media.commentsCount}
        </span>
      </div>
    </button>
  );
}

function TileBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-black/55 p-1 text-white">{children}</span>
  );
}
