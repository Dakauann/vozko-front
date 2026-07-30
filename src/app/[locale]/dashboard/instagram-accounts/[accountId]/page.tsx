"use client";

import { ArrowLeft, Warning } from "@phosphor-icons/react";
import { use, useCallback, useEffect, useState } from "react";

import {
  getInstagramAccountAction,
  listInstagramMediaAction,
} from "@/app/actions/instagram";
import type { InstagramAccount, InstagramMedia } from "@/lib/instagram/types";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { accentColorMap } from "@/components/elevated-design/listing-card";
import { cn } from "@/lib/utils";
import { InstagramPostDetail } from "@/components/instagram/instagram-post-detail";
import { InstagramPostGrid } from "@/components/instagram/instagram-post-grid";
import { InstagramProfileHeader } from "@/components/instagram/instagram-profile-header";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * The Instagram-style profile page for one connected account.
 *
 * Everything is scoped to a single accountId so a workspace with several
 * connected accounts never mixes their posts or comments — and so a reply always
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" onClick={() => router.push("/dashboard/instagram-accounts")}>
          <ArrowLeft size={16} />
          {t("profile.back")}
        </Button>
      </div>

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
        <div className="flex flex-col gap-6">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      ) : (
        account && (
          <>
            <InstagramProfileHeader account={account} />

            <InstagramPostGrid
              accountId={accountId}
              posts={posts}
              hasNext={hasNext}
              loadingMore={loadingMore}
              onLoadMore={() => void loadMore()}
              onSelect={setSelected}
            />

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
  );
}
