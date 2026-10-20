"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { listTiktokVideosAction } from "@/app/actions/tiktok";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Notice } from "@/components/ui/notice";
import { canReadVideos, commentManageBlock } from "@/lib/tiktok/account";
import { appendNew } from "@/lib/tiktok/pages";
import type { TiktokVideo } from "@/lib/tiktok/types";

import type { TiktokAccountTabProps } from "./tiktok-account-tabs";
import { TiktokVideoDetail } from "./tiktok-video-detail";
import { TiktokVideoGrid } from "./tiktok-video-grid";
import { useTiktokError } from "./use-tiktok-error";

interface VideosState {
  videos: TiktokVideo[];
  cursor?: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const INITIAL_VIDEOS: VideosState = { videos: [], hasMore: false, loading: true, loadingMore: false, error: null };

function GridSkeleton() {
  return (
    <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))" }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="aspect-[9/16] animate-pulse rounded-[--radius] bg-muted" />
      ))}
    </div>
  );
}

export function TiktokVideosTab({ account, canUpdate }: TiktokAccountTabProps) {
  const t = useTranslations("tiktok.videos");
  const describeError = useTiktokError();
  const readable = canReadVideos(account);
  const [state, setState] = useState<VideosState>(INITIAL_VIDEOS);
  const [selected, setSelected] = useState<TiktokVideo | null>(null);

  useEffect(() => {
    if (!readable) return;
    let cancelled = false;
    void listTiktokVideosAction(account.id).then((result) => {
      if (cancelled) return;
      setState(
        "error" in result
          ? { ...INITIAL_VIDEOS, loading: false, error: describeError(result) }
          : { videos: result.page.videos, cursor: result.page.nextCursor, hasMore: result.page.hasMore, loading: false, loadingMore: false, error: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [account.id, readable, describeError]);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loadingMore) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    const result = await listTiktokVideosAction(account.id, state.cursor);
    setState((prev) =>
      "error" in result
        ? { ...prev, loadingMore: false, error: describeError(result) }
        : {
            ...prev,
            videos: appendNew(prev.videos, result.page.videos, (video) => video.itemId),
            cursor: result.page.nextCursor,
            hasMore: result.page.hasMore,
            loadingMore: false,
            error: null,
          },
    );
  }, [account.id, state.cursor, state.hasMore, state.loadingMore, describeError]);

  if (!readable) return <Notice tone="info">{t("unreadable")}</Notice>;

  return (
    <ElevatedContainer className="overflow-hidden !p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t("sectionTitle")}</h2>
        {!state.loading ? <span className="text-xs tabular-nums text-muted-foreground">{t("sectionCount", { count: state.videos.length })}</span> : null}
      </div>

      <div className="space-y-4 p-5">
        {state.error ? <Notice tone="fault">{state.error}</Notice> : null}
        {state.loading ? (
          <GridSkeleton />
        ) : (
          <TiktokVideoGrid
            videos={state.videos}
            hasMore={state.hasMore}
            loadingMore={state.loadingMore}
            onLoadMore={() => void loadMore()}
            onSelect={setSelected}
          />
        )}
      </div>

      {selected ? (
        <TiktokVideoDetail
          account={account}
          video={selected}
          block={commentManageBlock(account, canUpdate)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </ElevatedContainer>
  );
}
