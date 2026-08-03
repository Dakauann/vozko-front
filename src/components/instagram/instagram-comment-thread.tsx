"use client";

import { ChatCircleDots, Eye, EyeSlash, PaperPlaneRight, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import {
  deleteInstagramCommentAction,
  hideInstagramCommentAction,
  privateReplyInstagramCommentAction,
  replyInstagramCommentAction,
} from "@/app/actions/instagram";
import type { InstagramComment } from "@/lib/instagram/types";

import Button from "@/components/elevated-design/button";
import { useTranslations } from "next-intl";

interface Props {
  accountId: string;
  comments: InstagramComment[];
  loading: boolean;
  hasNext: boolean;
  loadingMore: boolean;
  canModerate: boolean;
  /**
   * The post's own comments_count, used only to explain an empty list.
   *
   * Instagram's comments_count counts EVERY comment, while the comments edge
   * returns only top-level ones and additionally omits commenters whose accounts
   * are private or restricted. So "2 comments" with nothing listed is a real,
   * expected state, but a bare "no comments" message makes it look broken, so the
   * mismatch is named explicitly instead.
   */
  totalCount?: number;
  onLoadMore: () => void;
  onChanged: () => void;
}

/** How long after a comment a private reply is still allowed. */
const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function InstagramCommentThread({
  accountId,
  comments,
  loading,
  hasNext,
  loadingMore,
  canModerate,
  totalCount,
  onLoadMore,
  onChanged,
}: Props) {
  const t = useTranslations("instagram");

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    // A non-zero count with nothing to show is expected often enough that it needs
    // its own explanation, otherwise it reads as a broken page.
    const hidden = (totalCount ?? 0) > 0;
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("comments.empty")}</p>
        {hidden && (
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground/70">
            {t("comments.countMismatch", { count: totalCount ?? 0 })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          accountId={accountId}
          comment={comment}
          canModerate={canModerate}
          onChanged={onChanged}
        />
      ))}

      {hasNext ? (
        <div className="p-4">
          <Button variant="secondary" className="w-full" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? t("comments.loading") : t("comments.loadMore")}
          </Button>
        </div>
      ) : (
        // Instagram caps this edge at 50 per page, so the count is worth showing
        // once the list is exhausted.
        <p className="p-3 text-center text-[11px] text-muted-foreground/60">
          {t("comments.allLoaded", { count: comments.length })}
        </p>
      )}
    </div>
  );
}

function CommentRow({
  accountId,
  comment,
  canModerate,
  depth = 0,
  onChanged,
}: {
  accountId: string;
  comment: InstagramComment;
  canModerate: boolean;
  depth?: number;
  onChanged: () => void;
}) {
  const t = useTranslations("instagram");

  const [mode, setMode] = useState<"none" | "reply" | "private">("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateReplySent, setPrivateReplySent] = useState(false);

  /**
   * A private reply is only possible within 7 days of the comment, and only once.
   * Checking the age here keeps the button from offering an action that would be
   * rejected, and, more importantly, from burning the single allowance on a
   * request that cannot succeed.
   *
   * The clock is read once per mount rather than during render: reading it on every
   * render is impure, and it would also let the button vanish mid-interaction if a
   * re-render happened to land on the far side of the 7-day boundary.
   */
  const [mountedAt] = useState(() => Date.now());
  const withinPrivateReplyWindow =
    !!comment.timestamp &&
    mountedAt - new Date(comment.timestamp).getTime() < PRIVATE_REPLY_WINDOW_MS;

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);

    if (mode === "reply") {
      const result = await replyInstagramCommentAction(accountId, comment.id, text.trim());
      if (result.error) setError(result.error);
      else {
        setText("");
        setMode("none");
        onChanged();
      }
    } else if (mode === "private") {
      const result = await privateReplyInstagramCommentAction(accountId, comment.id, text.trim());
      if (result.error) {
        // private_reply_used / private_reply_expired are normal states, so they
        // get a specific explanation rather than a raw server message.
        setError(
          result.code === "private_reply_used"
            ? t("comments.privateReplyUsed")
            : result.code === "private_reply_expired"
              ? t("comments.privateReplyExpired")
              : result.error,
        );
        if (result.code === "private_reply_used") setPrivateReplySent(true);
      } else {
        setText("");
        setMode("none");
        setPrivateReplySent(true);
      }
    }
    setBusy(false);
  };

  const toggleHidden = async () => {
    setBusy(true);
    const result = await hideInstagramCommentAction(accountId, comment.id, !comment.hidden);
    if (result.error) setError(result.error);
    else onChanged();
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    const result = await deleteInstagramCommentAction(accountId, comment.id);
    if (result.error) setError(result.error);
    else onChanged();
    setBusy(false);
  };

  return (
    <div
      className="border-b border-border px-4 py-3"
      style={{ paddingLeft: `${16 + depth * 24}px` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold text-foreground">
              @{comment.fromUsername || t("comments.unknownUser")}
            </span>
            {comment.isOurs && (
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t("comments.you")}
              </span>
            )}
            {comment.hidden && (
              <span className="ml-1.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                {t("comments.hidden")}
              </span>
            )}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
            {comment.text}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {comment.timestamp && <span>{new Date(comment.timestamp).toLocaleString()}</span>}
            <span>{t("comments.likes", { count: comment.likeCount })}</span>

            {canModerate && (
              <>
                <button
                  type="button"
                  onClick={() => setMode(mode === "reply" ? "none" : "reply")}
                  className="transition-colors hover:text-foreground"
                >
                  {t("comments.reply")}
                </button>

                {/* Only offered inside the 7-day window and before the single
                    allowance has been used. */}
                {withinPrivateReplyWindow && !privateReplySent && !comment.isOurs && (
                  <button
                    type="button"
                    onClick={() => setMode(mode === "private" ? "none" : "private")}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <ChatCircleDots size={12} />
                    {t("comments.privateReply")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {canModerate && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void toggleHidden()}
              disabled={busy}
              aria-label={comment.hidden ? t("comments.unhide") : t("comments.hide")}
              title={comment.hidden ? t("comments.unhide") : t("comments.hide")}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              {comment.hidden ? <Eye size={14} /> : <EyeSlash size={14} />}
            </button>

            {/* Instagram requires the comment author's token to delete, so this is
                offered only for our own replies. For anyone else's comment, hiding
                is the moderation action. */}
            {comment.canDelete && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                aria-label={t("comments.delete")}
                title={t("comments.delete")}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {mode !== "none" && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={
                mode === "private" ? t("comments.privateReplyPlaceholder") : t("comments.replyPlaceholder")
              }
              className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !text.trim()}
              aria-label={t("comments.send")}
              className="rounded-lg border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <PaperPlaneRight size={14} />
            </button>
          </div>
          {mode === "private" && (
            <p className="text-[11px] text-muted-foreground">{t("comments.privateReplyHint")}</p>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-[11px] text-destructive">{error}</p>}

      {comment.replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          accountId={accountId}
          comment={reply}
          canModerate={canModerate}
          depth={depth + 1}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
