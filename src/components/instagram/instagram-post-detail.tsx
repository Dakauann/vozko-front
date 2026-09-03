"use client";

import { ArrowSquareOut, CaretLeft, CaretRight, Heart, ImageBroken, X } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  instagramAssetUrl,
  listInstagramCommentsAction,
  setInstagramCommentEnabledAction,
} from "@/app/actions/instagram";
import type { InstagramAccount, InstagramComment, InstagramMedia } from "@/lib/instagram/types";

import { InstagramAvatar } from "@/components/instagram/instagram-avatar";
import { InstagramCommentThread } from "@/components/instagram/instagram-comment-thread";
import { InstagramCommentRulesPanel } from "@/components/instagram/instagram-comment-rules-panel";
import { CommentPostAnalysisPanel } from "@/components/instagram/comment-analysis-post";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";

interface Props {
  accountId: string;
  account: InstagramAccount;
  media: InstagramMedia;
  onClose: () => void;
  onUpdated: (media: InstagramMedia) => void;
}

/**
 * Post detail: the asset, its metadata, and its paginated comment thread.
 *
 * Note what is deliberately absent, a caption editor. Instagram exposes no
 * endpoint to edit a published caption, so offering one would be a dead control.
 * The only supported post update is toggling comments.
 */
export function InstagramPostDetail({ accountId, account, media, onClose, onUpdated }: Props) {
  const t = useTranslations("instagram");
  const { can } = useWorkspace();
  // The analysis tab exists only for readers of the feature; the panel
  // itself gates the override editor on the update permission.
  const canSeeAnalysis = can("comment_analysis", "read");

  // Controlled so the split can follow the tab: the analysis tab carries
  // charts and a form, which need the width the picture can spare.
  const [tab, setTab] = useState<"comments" | "automation" | "analysis">("comments");
  const wide = tab === "analysis";
  const carouselItems = media.isCarousel && media.children?.length ? media.children : [media];
  const [carouselState, setCarouselState] = useState({ mediaId: "", index: 0 });
  const carouselIndex = carouselState.mediaId === media.id
    ? Math.min(carouselState.index, carouselItems.length - 1)
    : 0;
  const activeMedia = carouselItems[carouselIndex] ?? media;
  const isVideo = activeMedia.mediaType === "VIDEO" || activeMedia.isReel;
  const {
    src: assetSrc,
    contentType: assetContentType,
    failed: assetFailed,
    onError: onAssetError,
  } = useAuthenticatedImage(
    instagramAssetUrl(accountId, activeMedia.id),
  );
  const renderVideo =
    isVideo || assetContentType?.startsWith("video/") === true;

  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingComments, setTogglingComments] = useState(false);

  const applyFirstPage = useCallback(
    (result: Awaited<ReturnType<typeof listInstagramCommentsAction>>) => {
      if (result.error) setError(result.error);
      else {
        setError(null);
        setComments(result.page.items);
        setCursor(result.page.nextCursor);
        setHasNext(result.page.hasNext);
      }
      setLoading(false);
    },
    [],
  );

  // Refresh after a moderation action, where the spinner is wanted because the
  // operator just did something and expects the list to react.
  const reload = useCallback(async () => {
    setLoading(true);
    applyFirstPage(await listInstagramCommentsAction(accountId, media.id));
  }, [accountId, media.id, applyFirstPage]);

  /* First load. `loading` already starts true, so this effect sets no state
     synchronously, it only lands the result once the request settles, and drops
     it if the dialog moved to another post meanwhile. */
  useEffect(() => {
    let cancelled = false;
    void listInstagramCommentsAction(accountId, media.id).then((result) => {
      if (!cancelled) applyFirstPage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, media.id, applyFirstPage]);

  // Escape closes, matching the rest of the dashboard's overlay behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadMore = async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    const result = await listInstagramCommentsAction(accountId, media.id, cursor);
    if (result.error) setError(result.error);
    else {
      setComments((prev) => [...prev, ...result.page.items]);
      setCursor(result.page.nextCursor);
      setHasNext(result.page.hasNext);
    }
    setLoadingMore(false);
  };

  const toggleComments = async () => {
    setTogglingComments(true);
    const next = !(media.isCommentEnabled ?? true);
    const result = await setInstagramCommentEnabledAction(accountId, media.id, next);
    if (result.error) setError(result.error);
    else onUpdated({ ...media, isCommentEnabled: result.commentEnabled });
    setTogglingComments(false);
  };

  /* Portaled to <body> and stacked above every chrome layer (navbar z-40,
     call strip and dropdowns z-50): rendered inline, those elements painted
     over the scrim as bright patches. */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("posts.detailTitle")}
      /* A neutral dark scrim, NOT bg-foreground: `--foreground` is near-white in
         dark mode, which turned the backdrop into a white wash, most visibly as a
         bright band in the padding above the dialog. */
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex h-[min(90vh,820px)] w-full flex-col overflow-hidden rounded-[--radius] border border-border bg-card shadow-2xl md:flex-row",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asset. object-contain keeps portrait and landscape posts uncropped; the
            panel owns a fixed share of the dialog so letterboxing shows as an even
            surround rather than shifting the layout per image aspect ratio. On the
            analysis tab the picture yields width to the panels beside it. */}
        <div
          className={cn(
            "relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-black transition-[width] duration-200 md:h-full",
            wide ? "h-[24%] md:w-[34%]" : "h-[38%] md:w-[55%]",
          )}
        >
          {activeMedia.hasAsset && assetSrc ? renderVideo ? (
            <video
              src={assetSrc}
              controls
              playsInline
              preload="metadata"
              onError={onAssetError}
              className="h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetSrc}
              alt={activeMedia.caption?.trim() || media.caption?.trim() || ""}
              onError={onAssetError}
              className="h-full w-full object-contain"
            />
          ) : !activeMedia.hasAsset || assetFailed ? (
            <div className="flex flex-col items-center gap-2 p-10 text-white/60">
              <ImageBroken className="h-8 w-8" weight="duotone" />
              <p className="text-xs">{t("posts.noAsset")}</p>
            </div>
          ) : null}

          {carouselItems.length > 1 && (
            <>
              <button
                type="button"
                aria-label={`${t("posts.openPost")} ${carouselIndex}`}
                disabled={carouselIndex === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  setCarouselState({ mediaId: media.id, index: carouselIndex - 1 });
                }}
                className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
              >
                <CaretLeft className="h-5 w-5" weight="bold" />
              </button>
              <button
                type="button"
                aria-label={`${t("posts.openPost")} ${carouselIndex + 2}`}
                disabled={carouselIndex === carouselItems.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  setCarouselState({ mediaId: media.id, index: carouselIndex + 1 });
                }}
                className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
              >
                <CaretRight className="h-5 w-5" weight="bold" />
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums text-white">
                {carouselIndex + 1}/{carouselItems.length}
              </span>
            </>
          )}
        </div>

        {/* Meta + comments. min-h-0 is what allows the inner list to scroll rather
            than stretching the flex row. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-border p-4">
            <InstagramAvatar
              accountId={accountId}
              username={account.username}
              className="size-8"
              textClassName="text-xs"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">@{account.username}</p>
              <p className="text-2xs text-muted-foreground">
                {media.mediaProductType}
                {media.timestamp ? ` · ${new Date(media.timestamp).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {media.permalink && (
                <a
                  href={media.permalink}
                  target="_blank"
                  rel="noreferrer"
                  title={t("posts.openInInstagram")}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowSquareOut size={16} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("posts.close")}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {media.caption && (
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap border-b border-border p-4 text-sm leading-relaxed text-foreground">
                {media.caption}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart size={14} weight="fill" />
                {media.likeCount}
              </span>
              <span>{t("posts.commentCount", { count: media.commentsCount })}</span>

              {account.canManageComments && (
                <button
                  type="button"
                  onClick={() => void toggleComments()}
                  disabled={togglingComments}
                  className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-2xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {(media.isCommentEnabled ?? true)
                    ? t("posts.disableComments")
                    : t("posts.enableComments")}
                </button>
              )}
            </div>

            {error && (
              <p className="border-b border-border px-4 py-2 text-xs text-destructive-ink">
                {error}
              </p>
            )}

            {/* The comments on this post and the automation that answers them
                are two views of the same job, so they share the panel through
                tabs, the same split the account page uses. Without this the
                rule that replies here was configured somewhere the operator
                could not see from the post. */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="px-4 pb-4">
              <TabsList>
                <TabsTrigger value="comments">{t("posts.tabComments")}</TabsTrigger>
                <TabsTrigger value="automation">{t("posts.tabAutomation")}</TabsTrigger>
                {canSeeAnalysis ? <TabsTrigger value="analysis">{t("posts.tabAnalysis")}</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="comments" className="mt-3 -mx-4">
                <InstagramCommentThread
                  accountId={accountId}
                  comments={comments}
                  loading={loading}
                  hasNext={hasNext}
                  loadingMore={loadingMore}
                  canModerate={account.canManageComments}
                  totalCount={media.commentsCount}
                  onLoadMore={() => void loadMore()}
                  onChanged={() => void reload()}
                />
              </TabsContent>

              <TabsContent value="automation" className="mt-3">
                {/* Scoped to this post: the panel shows rules attached to it plus
                    the account-wide defaults that also run here, which is
                    exactly what will fire on the next comment. */}
                <InstagramCommentRulesPanel
                  accountId={accountId}
                  mediaId={media.id}
                  className="border-0 !shadow-none"
                />
              </TabsContent>

              {canSeeAnalysis ? (
                <TabsContent value="analysis" className="mt-3">
                  {/* What the classifier does with THIS post's comments: the
                      account's settings with the post's own layered on, the
                      post's numbers, and the override editor. */}
                  <CommentPostAnalysisPanel accountId={accountId} containerId={media.id} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
