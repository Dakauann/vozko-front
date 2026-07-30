"use client";

import { ArrowSquareOut, Heart, ImageBroken, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import {
  instagramAssetUrl,
  listInstagramCommentsAction,
  setInstagramCommentEnabledAction,
} from "@/app/actions/instagram";
import type { InstagramAccount, InstagramComment, InstagramMedia } from "@/lib/instagram/types";

import { IconBox } from "@/components/elevated-design/listing-card";
import { InstagramCommentThread } from "@/components/instagram/instagram-comment-thread";
import { InstagramLogo } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

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
 * Note what is deliberately absent — a caption editor. Instagram exposes no
 * endpoint to edit a published caption, so offering one would be a dead control.
 * The only supported post update is toggling comments.
 */
export function InstagramPostDetail({ accountId, account, media, onClose, onUpdated }: Props) {
  const t = useTranslations("instagram");

  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingComments, setTogglingComments] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const result = await listInstagramCommentsAction(accountId, media.id);
    if (result.error) setError(result.error);
    else {
      setError(null);
      setComments(result.page.items);
      setCursor(result.page.nextCursor);
      setHasNext(result.page.hasNext);
    }
    setLoading(false);
  }, [accountId, media.id]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("posts.detailTitle")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:h-[min(88vh,760px)] md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asset. object-contain keeps portrait and landscape posts uncropped, and
            the panel is height-bounded so a tall image cannot grow the dialog. */}
        <div className="relative flex min-h-[220px] shrink-0 items-center justify-center bg-black/90 md:h-full md:w-[55%] md:min-h-0">
          {media.hasAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={instagramAssetUrl(accountId, media.id)}
              alt={media.caption?.trim() || ""}
              className="max-h-[38vh] w-full object-contain md:max-h-full"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-white/60">
              <ImageBroken className="h-8 w-8" weight="duotone" />
              <p className="text-xs">{t("posts.noAsset")}</p>
            </div>
          )}
        </div>

        {/* Meta + comments. min-h-0 is what allows the inner list to scroll rather
            than stretching the flex row. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-border p-4">
            {account.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.profilePictureUrl}
                alt={account.username}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <IconBox color="purple" size="sm" animated={false} className="size-8 rounded-lg">
                <InstagramLogo weight="duotone" />
              </IconBox>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">@{account.username}</p>
              <p className="text-[11px] text-muted-foreground">
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
                  className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {(media.isCommentEnabled ?? true)
                    ? t("posts.disableComments")
                    : t("posts.enableComments")}
                </button>
              )}
            </div>

            {error && (
              <p className="border-b border-border bg-destructive/5 px-4 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <InstagramCommentThread
              accountId={accountId}
              comments={comments}
              loading={loading}
              hasNext={hasNext}
              loadingMore={loadingMore}
              canModerate={account.canManageComments}
              totalCount={media.commentsCount}
              onLoadMore={() => void loadMore()}
              onChanged={() => void loadFirstPage()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
