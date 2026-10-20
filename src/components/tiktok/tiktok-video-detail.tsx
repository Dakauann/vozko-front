"use client";

import { ArrowSquareOut, ChatCircle, Eye, Heart, PaperPlaneTilt } from "@/components/icons";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listTiktokCommentsAction } from "@/app/actions/tiktok";
import { CommentPostAnalysisPanel } from "@/components/audience/post";
import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { CommentThread } from "@/components/social/comment-thread";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { canReadComments, type CommentManageBlock } from "@/lib/tiktok/account";
import { TIKTOK_COMMENT_SOURCE } from "@/lib/tiktok/channel";
import { threadTiktokComments } from "@/lib/tiktok/comments";
import { appendNew } from "@/lib/tiktok/pages";
import { tiktokCommentActions } from "@/lib/tiktok/sources";
import type { TiktokAccount, TiktokComment, TiktokVideo } from "@/lib/tiktok/types";

import { TiktokCommentRulesPanel } from "./tiktok-comment-rules-panel";
import { TiktokVideoThumbnail } from "./tiktok-video-grid";
import { useTiktokError } from "./use-tiktok-error";

type DetailTab = "comments" | "rules" | "analysis";

interface CommentsState {
  comments: TiktokComment[];
  cursor?: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const INITIAL_COMMENTS: CommentsState = { comments: [], hasMore: false, loading: true, loadingMore: false, error: null };

function useVideoComments(accountId: string, videoId: string, includeHidden: boolean, enabled: boolean) {
  const describeError = useTiktokError();
  const [state, setState] = useState<CommentsState>(INITIAL_COMMENTS);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void listTiktokCommentsAction(accountId, videoId, undefined, includeHidden).then((result) => {
      if (cancelled) return;
      setState(
        "error" in result
          ? { ...INITIAL_COMMENTS, loading: false, error: describeError(result) }
          : { comments: result.page.comments, cursor: result.page.nextCursor, hasMore: result.page.hasMore, loading: false, loadingMore: false, error: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, videoId, includeHidden, enabled, reloadKey, describeError]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loadingMore) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    const result = await listTiktokCommentsAction(accountId, videoId, state.cursor, includeHidden);
    setState((prev) =>
      "error" in result
        ? { ...prev, loadingMore: false, error: describeError(result) }
        : {
            ...prev,
            comments: appendNew(prev.comments, result.page.comments, (comment) => comment.commentId),
            cursor: result.page.nextCursor,
            hasMore: result.page.hasMore,
            loadingMore: false,
            error: null,
          },
    );
  }, [accountId, videoId, includeHidden, state.cursor, state.hasMore, state.loadingMore, describeError]);

  return { ...state, reload, loadMore };
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1" title={label}>
      {icon}
      <span className="tabular-nums">{value.toLocaleString()}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function VideoComments({ account, video, block }: { account: TiktokAccount; video: TiktokVideo; block: CommentManageBlock | null }) {
  const t = useTranslations("tiktok");
  const readable = canReadComments(account);
  const canModerate = block === null;
  const comments = useVideoComments(account.id, video.itemId, canModerate, readable);
  const actions = useMemo(() => tiktokCommentActions(account.id), [account.id]);
  const thread = useMemo(() => threadTiktokComments(comments.comments, canModerate), [comments.comments, canModerate]);

  if (!readable) return <Notice tone="info">{t("comments.unreadable")}</Notice>;

  return (
    <div className="space-y-2">
      {comments.error ? <Notice tone="fault">{comments.error}</Notice> : null}
      {block ? <p className="px-4 text-2xs text-muted-foreground">{t(`commentRules.blocked.${block}`)}</p> : null}
      <CommentThread
        comments={thread}
        actions={actions}
        translationNamespace="tiktok.comments"
        loading={comments.loading}
        hasNext={comments.hasMore}
        loadingMore={comments.loadingMore}
        totalCount={video.comments}
        onLoadMore={() => void comments.loadMore()}
        onChanged={comments.reload}
      />
    </div>
  );
}

export function TiktokVideoDetail({
  account,
  video,
  block,
  onClose,
}: {
  account: TiktokAccount;
  video: TiktokVideo;
  block: CommentManageBlock | null;
  onClose: () => void;
}) {
  const t = useTranslations("tiktok");
  const format = useFormatter();
  const { can } = useWorkspace();
  const canSeeAnalysis = can("audience", "read");
  const [tab, setTab] = useState<DetailTab>("comments");
  const wide = tab === "analysis";

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent
        className={
          wide
            ? "h-[min(90vh,820px)] max-w-7xl gap-0 overflow-hidden !p-0 md:flex-row"
            : "h-[min(90vh,820px)] max-w-5xl gap-0 overflow-hidden !p-0 md:flex-row"
        }
      >
        <div className="relative h-[34%] w-full shrink-0 overflow-hidden bg-black md:h-full md:w-[38%]">
          <TiktokVideoThumbnail video={video} className="object-contain" />
          {video.shareUrl ? (
            <a
              href={video.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/80"
            >
              <ArrowSquareOut className="h-3.5 w-3.5" />
              {t("videos.openInTiktok")}
            </a>
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-border p-4 pr-16">
            <ChannelAvatarImage
              url={account.avatarUrl}
              name={account.displayName || account.username}
              seed={account.username || account.id}
              className="size-8"
              textClassName="text-xs"
            />
            <div className="min-w-0 flex-1">
              <ElevatedDialogTitle className="truncate text-sm font-semibold text-foreground">@{account.username}</ElevatedDialogTitle>
              <ElevatedDialogDescription className="text-2xs text-muted-foreground">
                {video.postedAt ? format.dateTime(new Date(video.postedAt), { dateStyle: "medium", timeStyle: "short" }) : t("videos.detailTitle")}
              </ElevatedDialogDescription>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {video.caption ? (
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap border-b border-border p-4 text-sm leading-relaxed text-foreground">
                {video.caption}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              <Stat icon={<Eye className="h-3.5 w-3.5" weight="fill" />} value={video.views} label={t("videos.views")} />
              <Stat icon={<Heart className="h-3.5 w-3.5" weight="fill" />} value={video.likes} label={t("videos.likes")} />
              <Stat icon={<ChatCircle className="h-3.5 w-3.5" weight="fill" />} value={video.comments} label={t("videos.comments")} />
              <Stat icon={<PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />} value={video.shares} label={t("videos.shares")} />
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)} className="px-4 pb-4">
              <TabsList>
                <TabsTrigger value="comments">{t("videos.tabComments")}</TabsTrigger>
                <TabsTrigger value="rules">{t("videos.tabRules")}</TabsTrigger>
                {canSeeAnalysis ? <TabsTrigger value="analysis">{t("videos.tabAnalysis")}</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="comments" className="-mx-4 mt-3">
                <VideoComments account={account} video={video} block={block} />
              </TabsContent>

              <TabsContent value="rules" className="mt-3">
                <TiktokCommentRulesPanel accountId={account.id} videoId={video.itemId} block={block} className="border-0 !shadow-none" />
              </TabsContent>

              {canSeeAnalysis ? (
                <TabsContent value="analysis" className="mt-3">
                  <CommentPostAnalysisPanel source={TIKTOK_COMMENT_SOURCE} accountId={account.id} containerId={video.itemId} />
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
