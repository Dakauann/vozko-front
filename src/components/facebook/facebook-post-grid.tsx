"use client";

import {
  ArrowUpRight,
  ChatCircle,
  Clock,
  Copy,
  EyeSlash,
  FilmStrip,
  Heart,
  ImageBroken,
  Link as LinkIcon,
  PlayCircle,
} from "@/components/icons";
import { useTranslations } from "next-intl";

import { facebookPostAssetUrl } from "@/app/actions/facebook";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { FacebookPost } from "@/lib/facebook/types";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";
import { cn } from "@/lib/utils";

interface Props {
  pageId: string;
  posts: FacebookPost[];
  hasNext: boolean;
  loadingMore: boolean;
  emptyLabel: string;
  onLoadMore: () => void;
  onSelect: (post: FacebookPost) => void;
}

export function FacebookPostGrid({ pageId, posts, hasNext, loadingMore, emptyLabel, onLoadMore, onSelect }: Props) {
  const t = useTranslations("facebook.posts");

  if (posts.length === 0) {
    return (
      <ElevatedContainer className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <ImageBroken className="h-8 w-8 text-muted-foreground" weight="duotone" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </ElevatedContainer>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={t("gridLabel")}>
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
        {posts.map((post) => (
          <PostTile key={post.id} pageId={pageId} post={post} onSelect={() => onSelect(post)} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {hasNext ? (
          <Button
            variant="secondary"
            title={loadingMore ? t("loading") : t("loadMore")}
            onClick={onLoadMore}
            disabled={loadingMore}
          />
        ) : (
          <p className="text-2xs text-muted-foreground">{t("allLoaded", { count: posts.length })}</p>
        )}
      </div>
    </section>
  );
}

const KIND_WITH_MARK = new Set<FacebookPost["kind"]>(["album", "video", "reel", "link"]);

function KindMark({ kind }: { kind: FacebookPost["kind"] }) {
  switch (kind) {
    case "album":
      return <Copy className="h-3.5 w-3.5" weight="fill" />;
    case "video":
      return <PlayCircle className="h-3.5 w-3.5" weight="fill" />;
    case "reel":
      return <FilmStrip className="h-3.5 w-3.5" weight="fill" />;
    case "link":
      return <LinkIcon className="h-3.5 w-3.5" weight="fill" />;
    default:
      return null;
  }
}

function PostTile({ pageId, post, onSelect }: { pageId: string; post: FacebookPost; onSelect: () => void }) {
  const t = useTranslations("facebook.posts");
  const text = post.message || post.story || "";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={text.trim() || t("openPost")}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-[--radius] bg-muted text-left",
        "ring-1 ring-border/60 transition-all duration-200",
        "hover:ring-2 hover:ring-ring hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {post.hasAsset ? (
        <PostThumb pageId={pageId} postId={post.id} alt={text} />
      ) : (
        <p className="line-clamp-6 size-full whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-foreground">
          {text || t("noText")}
        </p>
      )}

      <div className="absolute right-2 top-2 flex gap-1">
        {KIND_WITH_MARK.has(post.kind) ? (
          <TileBadge>
            <KindMark kind={post.kind} />
          </TileBadge>
        ) : null}
        {post.isHidden ? (
          <TileBadge>
            <EyeSlash className="h-3.5 w-3.5" weight="fill" />
          </TileBadge>
        ) : null}
      </div>

      {!post.isPublished && post.scheduledPublishTime ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-2xs font-medium text-white">
          <Clock className="h-3 w-3" />
          {new Date(post.scheduledPublishTime).toLocaleString()}
        </span>
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-end justify-center gap-4 pb-3",
          "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        <Count icon={<Heart className="h-4 w-4" weight="fill" />} value={post.reactionsCount} />
        <Count icon={<ChatCircle className="h-4 w-4" weight="fill" />} value={post.commentsCount} />
        <Count icon={<ArrowUpRight className="h-4 w-4" weight="fill" />} value={post.sharesCount} />
      </div>
    </button>
  );
}

function PostThumb({ pageId, postId, alt }: { pageId: string; postId: string; alt: string }) {
  const { src, failed, onError } = useAuthenticatedImage(facebookPostAssetUrl(pageId, postId, "thumb"));
  if (failed) {
    return (
      <div className="grid size-full place-items-center text-muted-foreground">
        <ImageBroken className="h-6 w-6" weight="duotone" />
      </div>
    );
  }
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt.trim()}
      loading="lazy"
      decoding="async"
      onError={onError}
      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
    />
  );
}

function Count({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
      {icon}
      {value}
    </span>
  );
}

function TileBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-black/55 p-1 text-white">{children}</span>;
}
