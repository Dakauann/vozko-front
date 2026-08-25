"use client";

import { InstagramLogo, Plus, Warning } from "@/components/icons";
import { use, useCallback, useEffect, useState } from "react";

import {
  getInstagramAccountAction,
  listInstagramMediaAction,
} from "@/app/actions/instagram";
import type { InstagramAccount, InstagramMedia } from "@/lib/instagram/types";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { accentColorMap } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { InstagramAutomationPanel } from "@/components/instagram/instagram-automation-panel";
import { InstagramCommentRulesPanel } from "@/components/instagram/instagram-comment-rules-panel";
import { InstagramPostComposer } from "@/components/instagram/instagram-post-composer";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import { GridFour, Robot } from "@/components/icons";
import { InstagramPostDetail } from "@/components/instagram/instagram-post-detail";
import { InstagramPostGrid } from "@/components/instagram/instagram-post-grid";
import { InstagramProfileHeader } from "@/components/instagram/instagram-profile-header";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * The Instagram-style profile page for one connected account.
 *
 * Everything is scoped to a single accountId so a workspace with several
 * connected accounts never mixes their posts or comments, and so a reply always
 * leaves from the account the post belongs to.
 */
export default function InstagramAccountProfilePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const t = useTranslations("instagram");
  const router = useRouter();

  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [posts, setPosts] = useState<InstagramMedia[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstagramMedia | null>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accountResult, mediaResult] = await Promise.all([
        getInstagramAccountAction(accountId),
        listInstagramMediaAction(accountId),
      ]);
      if (cancelled) return;

      if (accountResult.error) setError(accountResult.error);
      else setAccount(accountResult.account ?? null);

      if (mediaResult.error) setError((prev) => prev ?? mediaResult.error!);
      else {
        setPosts(mediaResult.page.items);
        setCursor(mediaResult.page.nextCursor);
        setHasNext(mediaResult.page.hasNext);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  /**
   * Paginates forward with the opaque cursor.
   *
   * `hasNext` is the only stop condition: a page shorter than the requested limit
   * does not mean the end, because Instagram filters items out after applying the
   * limit.
   */
  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore) return;
    setLoadingMore(true);
    const result = await listInstagramMediaAction(accountId, cursor);
    if (result.error) {
      setError(result.error);
    } else {
      setPosts((prev) => [...prev, ...result.page.items]);
      setCursor(result.page.nextCursor);
      setHasNext(result.page.hasNext);
    }
    setLoadingMore(false);
  }, [accountId, cursor, hasNext, loadingMore]);

  const handlePostUpdated = (updated: InstagramMedia) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  };

  return (
    // max-w-5xl matches the business phone detail page, and happens to be close to
    // Instagram's own ~935px profile column, so the grid reads as a profile rather
    // than stretching tiles across an ultrawide monitor.
    <div className="mx-auto w-full max-w-5xl">
      <div className="space-y-6">
        <DashboardPageHeader
          icon={<InstagramLogo className="h-5 w-5" weight="fill" />}
          colorClass="text-chart-4"
          badge={t("page.title")}
          title={account ? `@${account.username}` : t("page.title")}
          description={account?.name ?? ""}
          back={{
            onClick: () => router.push("/dashboard/instagram-accounts"),
            label: t("profile.back"),
          }}
        />

        {error && (
          <ElevatedContainer
            className={cn(
              "flex items-center gap-2 p-4 text-sm",
              accentColorMap.rose.light,
              accentColorMap.rose.border,
              accentColorMap.rose.text,
            )}
          >
            <Warning className="h-4 w-4" />
            {error}
          </ElevatedContainer>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />
            <ElevatedContainer className="!p-0">
              <div className="border-b border-border px-5 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div
                className="grid gap-2 p-5 sm:gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-[--radius] bg-muted" />
                ))}
              </div>
            </ElevatedContainer>
          </div>
        ) : (
          account && (
            <>
              <InstagramProfileHeader account={account} />

              {/* Instagram's own profile splits content into tabs, and the two
                  jobs here are genuinely different: browsing what was published
                  versus configuring who answers. Stacking four equal panels made
                  every section compete; tabs give each its own full width and put
                  the posts, the reason people open this page, first. */}
              <Tabs defaultValue="posts">
                <TabsList>
                  <TabsTrigger value="posts" className="gap-1.5">
                    <GridFour className="h-4 w-4" weight="fill" />
                    {t("tabs.posts")}
                  </TabsTrigger>
                  <TabsTrigger value="automation" className="gap-1.5">
                    <Robot className="h-4 w-4" weight="fill" />
                    {t("tabs.automation")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="mt-4">
                  <ElevatedContainer className="overflow-hidden !p-0">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                      <h2 className="text-sm font-semibold text-foreground">
                        {t("posts.sectionTitle")}
                      </h2>
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t("posts.sectionCount", { count: account.mediaCount })}
                        </span>
                        <Button
                          title={t("composer.newPost")}
                          variant="primary"
                          size="sm"
                          icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
                          onClick={() => setComposing(true)}
                        />
                      </div>
                    </div>

                    <div className="p-5">
                      <InstagramPostGrid
                        accountId={accountId}
                        posts={posts}
                        hasNext={hasNext}
                        loadingMore={loadingMore}
                        onLoadMore={() => void loadMore()}
                        onSelect={setSelected}
                      />
                    </div>
                  </ElevatedContainer>
                </TabsContent>

                {/* Who answers, then what the rules are, the same order the
                    backend resolves them in. */}
                <TabsContent value="automation" className="mt-4 space-y-6">
                  <InstagramAutomationPanel account={account} onUpdated={setAccount} />
                  <InstagramCommentRulesPanel accountId={accountId} />
                </TabsContent>
              </Tabs>

              {composing && (
                <InstagramPostComposer
                  accountId={accountId}
                  onClose={() => setComposing(false)}
                  onPublished={() => {
                    setComposing(false);
                    // The new post is not in the loaded page; refetching is the
                    // only way to show it in the right chronological slot.
                    router.refresh();
                  }}
                />
              )}

              {selected && (
                <InstagramPostDetail
                  accountId={accountId}
                  account={account}
                  media={selected}
                  onClose={() => setSelected(null)}
                  onUpdated={handlePostUpdated}
                />
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
