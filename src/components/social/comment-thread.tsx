"use client";

import { ChatCircleDots, Eye, EyeSlash, Heart, PaperPlaneRight, Pencil, Trash } from "@/components/icons";
import { useState } from "react";

import {
  privateReplyError,
  privateReplyOpen,
  type CommentThreadActions,
  type SocialComment,
} from "@/lib/social/comments";
import { useTranslations } from "next-intl";

import { CommentAuthorLine, CommentIconAction, CommentListFrame, CommentText } from "./comment-row-parts";

interface Props {
  comments: SocialComment[];
  actions: CommentThreadActions;
  translationNamespace: string;
  authorPrefix?: string;
  loading: boolean;
  hasNext: boolean;
  loadingMore: boolean;
  totalCount?: number;
  onLoadMore: () => void;
  onChanged: () => void;
}

export function CommentThread({
  comments,
  actions,
  translationNamespace,
  authorPrefix = "",
  loading,
  hasNext,
  loadingMore,
  totalCount,
  onLoadMore,
  onChanged,
}: Props) {
  return (
    <CommentListFrame
      translationNamespace={translationNamespace}
      loading={loading}
      count={comments.length}
      totalCount={totalCount}
      hasNext={hasNext}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
    >
      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          actions={actions}
          translationNamespace={translationNamespace}
          authorPrefix={authorPrefix}
          onChanged={onChanged}
        />
      ))}
    </CommentListFrame>
  );
}

type Mode = "none" | "reply" | "private" | "edit";

function CommentRow({
  comment,
  actions,
  translationNamespace,
  authorPrefix,
  depth = 0,
  onChanged,
}: {
  comment: SocialComment;
  actions: CommentThreadActions;
  translationNamespace: string;
  authorPrefix: string;
  depth?: number;
  onChanged: () => void;
}) {
  const t = useTranslations(translationNamespace);

  const [mode, setMode] = useState<Mode>("none");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateReplySent, setPrivateReplySent] = useState(false);

  const [mountedAt] = useState(() => Date.now());
  const canPrivateReply = !privateReplySent && Boolean(actions.privateReply) && privateReplyOpen(comment, mountedAt);
  const canHide = comment.canHide && Boolean(actions.setHidden);
  const showModeration = canHide || comment.canRemove || comment.canLike;

  const openMode = (next: Mode) => {
    setMode(mode === next ? "none" : next);
    setText(next === "edit" && mode !== "edit" ? comment.text : "");
  };

  const finish = () => {
    setText("");
    setMode("none");
  };

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);

    if (mode === "reply") {
      const result = await actions.reply(comment.id, value);
      if (result.error) setError(result.error);
      else {
        finish();
        onChanged();
      }
    } else if (mode === "edit" && actions.edit) {
      const result = await actions.edit(comment.id, value);
      if (result.error) setError(result.error);
      else {
        finish();
        onChanged();
      }
    } else if (mode === "private" && actions.privateReply) {
      const result = await actions.privateReply(comment.id, value);
      if (result.error) {
        const known = privateReplyError(result.code);
        setError(known ? t(known.key) : result.error);
        if (known?.consumed) setPrivateReplySent(true);
      } else {
        finish();
        setPrivateReplySent(true);
      }
    }
    setBusy(false);
  };

  const run = async (action: () => Promise<{ error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.error) setError(result.error);
    else onChanged();
    setBusy(false);
  };

  return (
    <div className="border-b border-border px-4 py-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <CommentAuthorLine author={comment.author} fallback={t("unknownUser")} prefix={authorPrefix}>
            {comment.isOurs && (
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{t("you")}</span>
            )}
            {comment.hidden && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                {t("hidden")}
              </span>
            )}
          </CommentAuthorLine>
          <CommentText text={comment.text} />
          <div className="mt-1 flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
            {comment.createdAt && <span>{new Date(comment.createdAt).toLocaleString()}</span>}
            <span>{t("likes", { count: comment.likeCount })}</span>

            {comment.canReply && (
              <button type="button" onClick={() => openMode("reply")} className="transition-colors hover:text-foreground">
                {t("reply")}
              </button>
            )}

            {canPrivateReply && (
              <button
                type="button"
                onClick={() => openMode("private")}
                className="flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <ChatCircleDots size={12} />
                {t("privateReply")}
              </button>
            )}

            {comment.canEdit && actions.edit && (
              <button
                type="button"
                onClick={() => openMode("edit")}
                className="flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <Pencil size={12} />
                {t("edit")}
              </button>
            )}
          </div>
        </div>

        {showModeration && (
          <div className="flex shrink-0 items-center gap-1">
            {comment.canLike && actions.setLiked && (
              <CommentIconAction
                label={comment.likedByPage ? t("unlike") : t("like")}
                onClick={() => void run(() => actions.setLiked!(comment.id, !comment.likedByPage))}
                disabled={busy}
                pressed={comment.likedByPage}
                className={comment.likedByPage ? "text-destructive-ink" : "text-muted-foreground hover:text-foreground"}
              >
                <Heart size={14} weight={comment.likedByPage ? "fill" : "regular"} />
              </CommentIconAction>
            )}

            {canHide && actions.setHidden && (
              <CommentIconAction
                label={comment.hidden ? t("unhide") : t("hide")}
                onClick={() => void run(() => actions.setHidden!(comment.id, !comment.hidden))}
                disabled={busy}
              >
                {comment.hidden ? <Eye size={14} /> : <EyeSlash size={14} />}
              </CommentIconAction>
            )}

            {comment.canRemove && (
              <CommentIconAction label={t("delete")} onClick={() => void run(() => actions.remove(comment.id))} disabled={busy} danger>
                <Trash size={14} />
              </CommentIconAction>
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
                mode === "private"
                  ? t("privateReplyPlaceholder")
                  : mode === "edit"
                    ? t("editPlaceholder")
                    : t("replyPlaceholder")
              }
              className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !text.trim()}
              aria-label={t("send")}
              className="rounded-lg border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              <PaperPlaneRight size={14} />
            </button>
          </div>
          {mode === "private" && <p className="text-2xs text-muted-foreground">{t("privateReplyHint")}</p>}
        </div>
      )}

      {error && <p className="mt-1.5 text-2xs text-destructive-ink">{error}</p>}

      {comment.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          actions={actions}
          translationNamespace={translationNamespace}
          authorPrefix={authorPrefix}
          depth={depth + 1}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
