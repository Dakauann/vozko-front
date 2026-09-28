"use client";

import { ArrowSquareOut, ChatCircle, Eye, EyeSlash, Heart, ImageBroken, PaperPlaneRight, Pencil, Trash, X } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import {
  commentOnFacebookPostAction,
  deleteFacebookPostAction,
  facebookPostAssetUrl,
  listFacebookCommentsAction,
  updateFacebookPostAction,
} from "@/app/actions/facebook";
import { CommentPostAnalysisPanel } from "@/components/audience/post";
import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import Button from "@/components/elevated-design/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { CommentRulesPanel } from "@/components/social/comment-rules-panel";
import { CommentThread } from "@/components/social/comment-thread";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";
import { capabilityGate } from "@/lib/facebook/page";
import type { FacebookComment, FacebookPage, FacebookPost } from "@/lib/facebook/types";
import { FACEBOOK_RULE_ACTIONS } from "@/lib/social/comment-rules";
import { facebookCommentActions, facebookRuleApi } from "@/lib/social/comment-sources";
import { threadFacebookComments } from "@/lib/social/comments";
import { cn } from "@/lib/utils";

interface Props {
  page: FacebookPage;
  post: FacebookPost;
  onClose: () => void;
  onUpdated: (post: FacebookPost) => void;
  onDeleted: (postId: string) => void;
}

type Tab = "comments" | "automation" | "analysis";

export function FacebookPostDetail({ page, post, onClose, onUpdated, onDeleted }: Props) {
  const t = useTranslations("facebook.posts");
  const tg = useTranslations("facebook.gate");
  const describeError = useFacebookError();
  const { can } = useWorkspace();
  const canUpdate = can("facebook_pages", "update");
  const canSeeAnalysis = can("audience", "read");

  const publishGate = capabilityGate(page, "publish");
  const moderateGate = capabilityGate(page, "moderate");
  const commentGate = capabilityGate(page, "comment");
  const messagingGate = capabilityGate(page, "messaging");
  const canEditPost = canUpdate && publishGate.allowed;
  const gateReason = !canUpdate ? tg("noPermission") : !publishGate.allowed ? tg(publishGate.reason) : null;

  const [tab, setTab] = useState<Tab>("comments");
  const wide = tab === "analysis";

  const commentActions = useMemo(() => facebookCommentActions(page.id), [page.id]);
  const ruleApi = useMemo(() => facebookRuleApi(page.id), [page.id]);

  const [comments, setComments] = useState<FacebookComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string } | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.message);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pageComment, setPageComment] = useState("");

  const applyFirstPage = useCallback((result: Awaited<ReturnType<typeof listFacebookCommentsAction>>) => {
    if ("error" in result && result.error) setError(result.error);
    else {
      setError(null);
      setComments(result.list.items);
      setCursor(result.list.nextCursor);
      setHasNext(result.list.hasNext);
    }
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    applyFirstPage(await listFacebookCommentsAction(page.id, post.id));
  }, [page.id, post.id, applyFirstPage]);

  useEffect(() => {
    let cancelled = false;
    void listFacebookCommentsAction(page.id, post.id).then((result) => {
      if (!cancelled) applyFirstPage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [page.id, post.id, applyFirstPage]);

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
    const result = await listFacebookCommentsAction(page.id, post.id, cursor);
    if ("error" in result && result.error) setError(result.error);
    else {
      setComments((prev) => [...prev, ...result.list.items]);
      setCursor(result.list.nextCursor);
      setHasNext(result.list.hasNext);
    }
    setLoadingMore(false);
  };

  const run = async (
    action: () => Promise<{ error: string; code?: string; expected?: Record<string, string> } | { ok: true }>,
    onDone: () => void,
  ) => {
    setBusy(true);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if ("error" in result) {
      setNotice({ text: describeError(result), href: result.expected?.manageUrl });
      return;
    }
    onDone();
  };

  const saveMessage = () =>
    run(
      () => updateFacebookPostAction(page.id, post.id, { message: draft.trim() }),
      () => {
        setEditing(false);
        onUpdated({ ...post, message: draft.trim() });
      },
    );

  const toggleHidden = () =>
    run(
      () => updateFacebookPostAction(page.id, post.id, { isHidden: !post.isHidden }),
      () => onUpdated({ ...post, isHidden: !post.isHidden }),
    );

  const publishNow = () =>
    run(
      () => updateFacebookPostAction(page.id, post.id, { publishNow: true }),
      () => onUpdated({ ...post, isPublished: true, scheduledPublishTime: null }),
    );

  const remove = () =>
    run(
      () => deleteFacebookPostAction(page.id, post.id),
      () => onDeleted(post.id),
    );

  const commentAsPage = async () => {
    const text = pageComment.trim();
    if (!text) return;
    setBusy(true);
    const result = await commentOnFacebookPostAction(page.id, post.id, text);
    setBusy(false);
    if ("error" in result) {
      setNotice({ text: describeError(result) });
      return;
    }
    setPageComment("");
    void reload();
  };

  const permissions = {
    canModerate: canUpdate && moderateGate.allowed,
    canComment: canUpdate && commentGate.allowed,
    canMessage: canUpdate && messagingGate.allowed,
  };
  const scheduled = !post.isPublished && !!post.scheduledPublishTime;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("detailTitle")}
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
        <div
          className={cn(
            "relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-black transition-[width] duration-200 md:h-full",
            wide ? "h-[24%] md:w-[34%]" : "h-[38%] md:w-[55%]",
          )}
        >
          {post.hasAsset ? (
            <PostAsset pageId={page.id} post={post} />
          ) : (
            <p className="max-h-full overflow-y-auto whitespace-pre-wrap p-8 text-sm leading-relaxed text-white/90">
              {post.message || post.story || t("noText")}
            </p>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-border p-4">
            <ChannelAvatarImage url={page.pictureUrl} name={page.name} seed={page.id} className="size-8" textClassName="text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{page.name}</p>
              <p className="text-2xs text-muted-foreground">
                {t(`kind.${post.kind}`)}
                {scheduled
                  ? ` · ${t("scheduledFor", { date: new Date(post.scheduledPublishTime as string).toLocaleString() })}`
                  : post.createdTime
                    ? ` · ${new Date(post.createdTime).toLocaleString()}`
                    : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {post.permalinkUrl && (
                <a
                  href={post.permalinkUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={t("openOnFacebook")}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowSquareOut size={16} />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2 border-b border-border p-4">
              {editing ? (
                <>
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} disabled={busy} className="resize-y" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" title={t("cancel")} disabled={busy} onClick={() => setEditing(false)} />
                    <Button size="sm" variant="primary" title={t("save")} disabled={busy} onClick={() => void saveMessage()} />
                  </div>
                </>
              ) : (
                <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {post.message || post.story || t("noText")}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart size={14} weight="fill" />
                {post.reactionsCount}
              </span>
              <span className="flex items-center gap-1">
                <ChatCircle size={14} weight="fill" />
                {post.commentsCount}
              </span>
              <span>{t("shareCount", { count: post.sharesCount })}</span>
              {post.isHidden ? <span className="rounded bg-muted px-1.5 py-0.5 text-warning-ink">{t("hidden")}</span> : null}

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {post.editable && !editing ? (
                  <ActionButton
                    icon={<Pencil size={12} />}
                    label={t("edit")}
                    disabled={busy || !canEditPost}
                    title={gateReason ?? undefined}
                    onClick={() => {
                      setDraft(post.message);
                      setEditing(true);
                    }}
                  />
                ) : null}
                {post.isPublished ? (
                  <ActionButton
                    icon={post.isHidden ? <Eye size={12} /> : <EyeSlash size={12} />}
                    label={post.isHidden ? t("unhide") : t("hide")}
                    disabled={busy || !canEditPost}
                    title={gateReason ?? undefined}
                    onClick={() => void toggleHidden()}
                  />
                ) : null}
                {scheduled ? (
                  <ActionButton
                    icon={<PaperPlaneRight size={12} />}
                    label={t("publishNow")}
                    disabled={busy || !canEditPost}
                    title={gateReason ?? undefined}
                    onClick={() => void publishNow()}
                  />
                ) : null}
                <ActionButton
                  icon={<Trash size={12} />}
                  label={t("delete")}
                  destructive
                  disabled={busy || !canEditPost}
                  title={gateReason ?? undefined}
                  onClick={() => setConfirmDelete(true)}
                />
              </div>
            </div>

            {!post.editable ? (
              <p className="border-b border-border px-4 py-2 text-2xs text-muted-foreground">{t("notEditableHint")}</p>
            ) : null}

            {notice && (
              <p className="border-b border-border px-4 py-2 text-xs text-destructive-ink">
                {notice.text}
                {notice.href ? (
                  <>
                    {" "}
                    <a href={notice.href} target="_blank" rel="noreferrer noopener" className="font-medium underline">
                      {t("openBusinessSuite")}
                    </a>
                  </>
                ) : null}
              </p>
            )}

            {error && <p className="border-b border-border px-4 py-2 text-xs text-destructive-ink">{error}</p>}

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="px-4 pb-4">
              <TabsList>
                <TabsTrigger value="comments">{t("tabComments")}</TabsTrigger>
                <TabsTrigger value="automation">{t("tabAutomation")}</TabsTrigger>
                {canSeeAnalysis ? <TabsTrigger value="analysis">{t("tabAnalysis")}</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="comments" className="mt-3 -mx-4">
                {permissions.canComment ? (
                  <div className="flex items-center gap-2 border-b border-border px-4 pb-3">
                    <input
                      value={pageComment}
                      onChange={(e) => setPageComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void commentAsPage();
                        }
                      }}
                      placeholder={t("commentAsPage")}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void commentAsPage()}
                      disabled={busy || !pageComment.trim()}
                      aria-label={t("send")}
                      className="rounded-lg border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <PaperPlaneRight size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="border-b border-border px-4 pb-3 text-2xs text-muted-foreground">
                    {!canUpdate ? tg("noPermission") : !commentGate.allowed ? tg(commentGate.reason) : null}
                  </p>
                )}
                <CommentThread
                  comments={threadFacebookComments(comments, permissions)}
                  actions={commentActions}
                  translationNamespace="facebook.comments"
                  loading={loading}
                  hasNext={hasNext}
                  loadingMore={loadingMore}
                  totalCount={post.commentsCount}
                  onLoadMore={() => void loadMore()}
                  onChanged={() => void reload()}
                />
              </TabsContent>

              <TabsContent value="automation" className="mt-3">
                <CommentRulesPanel
                  api={ruleApi}
                  allowedActions={FACEBOOK_RULE_ACTIONS}
                  translationNamespace="facebook.commentRules"
                  containerId={post.id}
                  canManage={canUpdate}
                  disabledReason={canUpdate ? undefined : tg("noPermission")}
                  className="border-0 !shadow-none"
                />
              </TabsContent>

              {canSeeAnalysis ? (
                <TabsContent value="analysis" className="mt-3">
                  <CommentPostAnalysisPanel source="facebook" accountId={page.id} containerId={post.id} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />
    </div>,
    document.body,
  );
}

function PostAsset({ pageId, post }: { pageId: string; post: FacebookPost }) {
  const t = useTranslations("facebook.posts");
  const { src, failed, onError } = useAuthenticatedImage(facebookPostAssetUrl(pageId, post.id, "full"));
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-white/60">
        <ImageBroken className="h-8 w-8" weight="duotone" />
        <p className="text-xs">{t("noAsset")}</p>
      </div>
    );
  }
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={post.message.trim()} onError={onError} className="h-full w-full object-contain" />
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  title,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-2xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
        destructive && "hover:text-destructive-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
