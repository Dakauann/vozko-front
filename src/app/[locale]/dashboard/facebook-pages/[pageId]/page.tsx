"use client";

import {
  ChatCircleDots,
  Clock,
  FacebookLogo,
  FilmStrip,
  GridFour,
  Plus,
  Robot,
  UsersThree,
  Warning,
} from "@/components/icons";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getFacebookPageAction, listFacebookPostsAction, listFacebookStoriesAction } from "@/app/actions/facebook";
import { CommentAnalysisTab } from "@/components/audience/tab";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { FacebookAutomationPanel } from "@/components/facebook/facebook-automation-panel";
import { FacebookPageHeader } from "@/components/facebook/facebook-page-header";
import { FacebookPostComposer } from "@/components/facebook/facebook-post-composer";
import { FacebookPostDetail } from "@/components/facebook/facebook-post-detail";
import { FacebookPostGrid } from "@/components/facebook/facebook-post-grid";
import { FacebookStoriesList } from "@/components/facebook/facebook-stories-list";
import { MessengerProfileEditor } from "@/components/facebook/messenger-profile-editor";
import { RoutingHealthBanner } from "@/components/facebook/routing-health-banner";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { CommentRulesPanel } from "@/components/social/comment-rules-panel";
import { useWorkspace } from "@/contexts/workspace-context";
import { FACEBOOK_PAGES_PATH } from "@/lib/facebook/connect";
import { capabilityGate } from "@/lib/facebook/page";
import type { FacebookPage, FacebookPost, FacebookPostListKind, FacebookStory } from "@/lib/facebook/types";
import { FACEBOOK_RULE_ACTIONS } from "@/lib/social/comment-rules";
import { facebookRuleApi } from "@/lib/social/comment-sources";

type LoadState = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; page: FacebookPage };

export default function FacebookPageDetail({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  const t = useTranslations("facebook");
  const tg = useTranslations("facebook.gate");
  const router = useRouter();
  const describeError = useFacebookError();
  const { can } = useWorkspace();
  const canUpdate = can("facebook_pages", "update");
  const canCreate = can("facebook_pages", "create");

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<FacebookPost | null>(null);
  const [postPatch, setPostPatch] = useState<{ post?: FacebookPost; deletedId?: string } | null>(null);
  const ruleApi = useMemo(() => facebookRuleApi(pageId), [pageId]);

  useEffect(() => {
    let cancelled = false;
    void getFacebookPageAction(pageId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setState({ status: "failed", message: describeError(result) });
      else if (!result.page) setState({ status: "failed", message: t("page.loadFailed") });
      else setState({ status: "ready", page: result.page });
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, reloadKey, describeError, t]);

  const page = state.status === "ready" ? state.page : null;
  const setPage = (next: FacebookPage) => setState({ status: "ready", page: next });

  const publishGate = page ? capabilityGate(page, "publish") : null;
  const messagingGate = page ? capabilityGate(page, "messaging") : null;
  const canPublish = canUpdate && !!publishGate?.allowed;
  const publishReason = !canUpdate
    ? tg("noPermission")
    : publishGate && !publishGate.allowed
      ? tg(publishGate.reason)
      : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="space-y-6">
        <DashboardPageHeader
          icon={<FacebookLogo className="h-5 w-5" weight="fill" />}
          colorClass="text-chart-2"
          badge={t("page.title")}
          title={page ? page.name : t("page.title")}
          description={page?.category ?? ""}
          back={{ onClick: () => router.push(FACEBOOK_PAGES_PATH), label: t("page.back") }}
        />

        {state.status === "failed" && (
          <ElevatedContainer className="flex flex-wrap items-center gap-3 p-4 text-sm text-destructive-ink">
            <Warning className="h-4 w-4" />
            <span className="flex-1">{state.message}</span>
            <Button
              size="sm"
              variant="secondary"
              title={t("page.retry")}
              onClick={() => {
                setState({ status: "loading" });
                setReloadKey((k) => k + 1);
              }}
            />
          </ElevatedContainer>
        )}

        {state.status === "loading" && <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />}

        {page && (
          <>
            <FacebookPageHeader
              page={page}
              canReconnect={canCreate}
              canCheckHealth={canUpdate}
              onUpdated={setPage}
              onReconnected={() => setReloadKey((k) => k + 1)}
            />

            <Tabs defaultValue="posts">
              <TabsList>
                <TabsTrigger value="posts" className="gap-1.5">
                  <GridFour className="h-4 w-4" weight="fill" />
                  {t("tabs.posts")}
                </TabsTrigger>
                <TabsTrigger value="scheduled" className="gap-1.5">
                  <Clock className="h-4 w-4" weight="fill" />
                  {t("tabs.scheduled")}
                </TabsTrigger>
                <TabsTrigger value="reels" className="gap-1.5">
                  <FilmStrip className="h-4 w-4" weight="fill" />
                  {t("tabs.reels")}
                </TabsTrigger>
                <TabsTrigger value="messenger" className="gap-1.5">
                  <ChatCircleDots className="h-4 w-4" weight="fill" />
                  {t("tabs.messenger")}
                </TabsTrigger>
                <TabsTrigger value="automation" className="gap-1.5">
                  <Robot className="h-4 w-4" weight="fill" />
                  {t("tabs.automation")}
                </TabsTrigger>
                <TabsTrigger value="audience" className="gap-1.5">
                  <UsersThree className="h-4 w-4" weight="fill" />
                  {t("tabs.audience")}
                </TabsTrigger>
              </TabsList>

              {(["posts", "scheduled", "reels"] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
                  <ElevatedContainer className="overflow-hidden !p-0">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                      <h2 className="text-sm font-semibold text-foreground">{t(`posts.section.${tab}`)}</h2>
                      <Button
                        title={t("composer.newPost")}
                        variant="primary"
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
                        disabled={!canPublish}
                        onClick={() => setComposing(true)}
                      />
                    </div>
                    {!canPublish && publishReason ? (
                      <p className="border-b border-border px-5 py-2 text-xs text-muted-foreground">{publishReason}</p>
                    ) : null}
                    <div className="p-5">
                      <PostList
                        pageId={pageId}
                        kind={tab === "posts" ? "published" : tab}
                        version={listVersion}
                        patch={postPatch}
                        emptyLabel={t(`posts.empty.${tab}`)}
                        onSelect={setSelected}
                      />
                    </div>
                  </ElevatedContainer>
                  {tab === "reels" ? <StoriesSection pageId={pageId} version={listVersion} /> : null}
                </TabsContent>
              ))}

              <TabsContent value="messenger" className="mt-4 space-y-6">
                <RoutingHealthBanner routing={page.routing} />
                <MessengerProfileEditor
                  pageId={pageId}
                  canEdit={canUpdate && !!messagingGate?.allowed}
                  disabledReason={
                    !canUpdate ? tg("noPermission") : messagingGate && !messagingGate.allowed ? tg(messagingGate.reason) : undefined
                  }
                />
                <ElevatedContainer className="space-y-1 p-5 text-xs text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground">{t("messenger.humanAgentTitle")}</p>
                  <p>{page.humanAgentAvailable ? t("messenger.humanAgentOn") : t("messenger.humanAgentOff")}</p>
                </ElevatedContainer>
              </TabsContent>

              <TabsContent value="automation" className="mt-4 space-y-6">
                <FacebookAutomationPanel page={page} onUpdated={setPage} />
                <CommentRulesPanel
                  api={ruleApi}
                  allowedActions={FACEBOOK_RULE_ACTIONS}
                  translationNamespace="facebook.commentRules"
                  canManage={canUpdate}
                  disabledReason={canUpdate ? undefined : tg("noPermission")}
                />
              </TabsContent>

              <TabsContent value="audience" className="mt-4">
                <CommentAnalysisTab source="facebook" accountId={pageId} />
              </TabsContent>
            </Tabs>

            {composing && (
              <FacebookPostComposer
                page={page}
                onClose={() => setComposing(false)}
                onFinished={() => {
                  setComposing(false);
                  setListVersion((v) => v + 1);
                }}
              />
            )}

            {selected && (
              <FacebookPostDetail
                page={page}
                post={selected}
                onClose={() => setSelected(null)}
                onUpdated={(post) => {
                  setSelected(post);
                  setPostPatch({ post });
                }}
                onDeleted={(postId) => {
                  setSelected(null);
                  setPostPatch({ deletedId: postId });
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PostList({
  pageId,
  kind,
  version,
  patch,
  emptyLabel,
  onSelect,
}: {
  pageId: string;
  kind: FacebookPostListKind;
  version: number;
  patch: { post?: FacebookPost; deletedId?: string } | null;
  emptyLabel: string;
  onSelect: (post: FacebookPost) => void;
}) {
  const describeError = useFacebookError();
  const [posts, setPosts] = useState<FacebookPost[] | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listFacebookPostsAction(pageId, kind).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(describeError({ error: result.error, code: result.code }));
        setPosts([]);
        return;
      }
      setError(null);
      setPosts(result.list.items);
      setCursor(result.list.nextCursor);
      setHasNext(result.list.hasNext);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, kind, version, describeError]);

  const shown = useMemo(() => {
    if (!posts || !patch) return posts;
    if (patch.deletedId) return posts.filter((p) => p.id !== patch.deletedId);
    if (patch.post) return posts.map((p) => (p.id === patch.post?.id ? patch.post : p));
    return posts;
  }, [posts, patch]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    const result = await listFacebookPostsAction(pageId, kind, cursor);
    if ("error" in result && result.error) setError(describeError({ error: result.error, code: result.code }));
    else {
      setPosts((prev) => [...(prev ?? []), ...result.list.items]);
      setCursor(result.list.nextCursor);
      setHasNext(result.list.hasNext);
    }
    setLoadingMore(false);
  }, [pageId, kind, cursor, hasNext, loadingMore, describeError]);

  if (shown === null) {
    return (
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[--radius] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
      {error && shown.length === 0 ? null : (
        <FacebookPostGrid
          pageId={pageId}
          posts={shown}
          hasNext={hasNext}
          loadingMore={loadingMore}
          emptyLabel={emptyLabel}
          onLoadMore={() => void loadMore()}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function StoriesSection({ pageId, version }: { pageId: string; version: number }) {
  const t = useTranslations("facebook.stories");
  const describeError = useFacebookError();
  const [stories, setStories] = useState<FacebookStory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listFacebookStoriesAction(pageId).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(describeError({ error: result.error, code: result.code }));
        setStories([]);
        return;
      }
      setError(null);
      setStories(result.stories);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, version, describeError]);

  return (
    <ElevatedContainer className="overflow-hidden !p-0">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>
      <div className="p-5">
        {error ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-destructive-ink">
            <Warning className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : stories === null ? (
          <div className="h-16 animate-pulse rounded-[--radius] bg-muted" />
        ) : (
          <FacebookStoriesList stories={stories} />
        )}
      </div>
    </ElevatedContainer>
  );
}
