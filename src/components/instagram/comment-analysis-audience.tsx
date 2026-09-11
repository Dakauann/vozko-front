"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  getCommentAnalysisSettingsAction,
  getAudienceStatsAction,
  getCommentAnalysisTrendsAction,
  listCommentAnalysisAccountsAction,
} from "@/app/actions/comment-analysis";
import { listInstagramAccountsAction, listInstagramMediaAction } from "@/app/actions/instagram";
import type { CommentAnalysisSettings, CommentAnalysisStats, TrendPoint } from "@/lib/comment-analysis/types";
import type { InstagramAccount, InstagramMedia } from "@/lib/instagram/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link } from "@/i18n/routing";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { CommentAnalysisOverview } from "@/components/instagram/comment-analysis-overview";
import { CommentAnalysisConversations } from "@/components/instagram/comment-analysis-conversations";
import { CommentAnalysisTopics } from "@/components/instagram/comment-analysis-topics";
import type { Period } from "@/lib/comment-analysis/period";
import { DEFAULT_PERIOD, isPeriodReady, periodRange } from "@/lib/comment-analysis/period";
import { PeriodPicker } from "@/components/instagram/comment-analysis-period";
import { CommentAnalysisAuthors } from "@/components/instagram/comment-analysis-authors";
import { CommentAnalysisFeed } from "@/components/instagram/comment-analysis-feed";
import { Chip, EmptyState, Skeleton } from "@/components/instagram/comment-analysis-shared";
import { ChartLineUp, ChatCircle, Gear, Hash, ShieldWarning, Sparkle } from "@/components/icons";

/*
 * The workspace-wide audience dashboard (Métricas > Audiência): every
 * Instagram account in one place, optionally narrowed to one post, over a
 * chosen period. It reuses the account tab's panels verbatim; only the
 * scope picker is new, so a number here and the same number on the account
 * page cannot disagree.
 *
 * Authors are an account-level view (the API ranks them per account), so
 * that section steps aside while a post is selected.
 */

type Section = "overview" | "topics" | "authors" | "feed";


const ALL_POSTS = "__all";
const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

function postLabel(m: InstagramMedia, df: Intl.DateTimeFormat, untitled: string): string {
  const caption = m.caption?.replace(/\s+/g, " ").trim() ?? "";
  const head = caption ? (caption.length > 60 ? `${caption.slice(0, 60)}...` : caption) : untitled;
  return m.timestamp ? `${df.format(new Date(m.timestamp))} · ${head}` : head;
}

export function CommentAnalysisAudience({
  initialAccountId,
  initialContainerId,
  onScopeChange,
}: {
  initialAccountId?: string;
  initialContainerId?: string;
  /** Lets the page mirror the scope into the URL so a view can be shared. */
  onScopeChange?: (accountId: string, containerId: string | undefined) => void;
}) {
  const t = useTranslations("commentAnalysis");
  const ta = useTranslations("commentAnalysis.audience");
  const locale = useLocale();
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short" }), [locale]);
  const { can } = useWorkspace();
  const canConfigure = can("comment_analysis", "update");

  const [accounts, setAccounts] = useState<InstagramAccount[] | null>(null);
  const [configured, setConfigured] = useState<Record<string, CommentAnalysisSettings>>({});
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [containerId, setContainerId] = useState(initialContainerId ?? "");
  const [posts, setPosts] = useState<InstagramMedia[]>([]);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [section, setSection] = useState<Section>("overview");

  const [settings, setSettings] = useState<CommentAnalysisSettings | null>(null);
  const [stats, setStats] = useState<CommentAnalysisStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Accounts and which of them have analysis configured, loaded once. The
  // first enabled account is selected when the URL named none.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listInstagramAccountsAction(1, 50), listCommentAnalysisAccountsAction()]).then(([ig, ca]) => {
      if (cancelled) return;
      const map: Record<string, CommentAnalysisSettings> = {};
      for (const s of ca.accounts) map[s.accountId] = s;
      setConfigured(map);
      setAccounts(ig.accounts);
      if (ig.error) setError(ig.error);
      setAccountId((current) => {
        if (current && ig.accounts.some((a) => a.id === current)) return current;
        const firstEnabled = ig.accounts.find((a) => map[a.id]?.enabled);
        return (firstEnabled ?? ig.accounts[0])?.id ?? "";
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Per account: its settings (the topic set names every chip) and its posts.
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void Promise.all([getCommentAnalysisSettingsAction("instagram", accountId), listInstagramMediaAction(accountId, undefined, 50)]).then(
      ([s, media]) => {
        if (cancelled) return;
        if (s.error) setError(s.error);
        else {
          setError(null);
          setSettings(s.settings ?? null);
        }
        setPosts(media.page.items);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const enabled = settings?.enabled ?? false;

  // The numbers for the current scope and period.
  useEffect(() => {
    if (!accountId || !enabled) return;
    let cancelled = false;
    if (!isPeriodReady(period)) return;
    const { from, to } = periodRange(period);
    void Promise.all([
      getAudienceStatsAction({ accountId, containerId: containerId || undefined, from, to }),
      getCommentAnalysisTrendsAction(containerId ? "container" : "account", containerId || accountId, from, to),
    ]).then(([st, tr]) => {
      if (cancelled) return;
      if (st.error) setError(st.error);
      else setStats(st.stats ?? null);
      if (!tr.error) setTrend(tr.points);
      else { setTrend([]); setError(tr.error); }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, containerId, enabled, period]);

  const changeAccount = (id: string) => {
    setAccountId(id);
    setContainerId("");
    setStats(null);
    setTrend([]);
    setSettings(null);
    if (section === "authors") setSection("overview");
    onScopeChange?.(id, undefined);
  };

  const changePost = (id: string) => {
    const next = id === ALL_POSTS ? "" : id;
    setContainerId(next);
    setStats(null);
    setTrend([]);
    if (next && section === "authors") setSection("overview");
    onScopeChange?.(accountId, next || undefined);
  };

  if (!accounts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-[--radius] border border-border bg-card">
        <EmptyState
          icon={<Sparkle weight="duotone" />}
          title={ta("noAccounts.title")}
          description={ta("noAccounts.description")}
          action={
            <Link href="/dashboard/instagram-accounts" className="mt-2">
              <Button variant="primary" title={ta("noAccounts.cta")} />
            </Link>
          }
        />
      </div>
    );
  }

  const sections = [
    { value: "overview" as const, label: t("sections.overview"), icon: <ChartLineUp className="h-3.5 w-3.5" weight="fill" /> },
    { value: "topics" as const, label: t("sections.topics"), icon: <Hash className="h-3.5 w-3.5" weight="fill" /> },
    ...(containerId ? [] : [{ value: "authors" as const, label: t("sections.authors"), icon: <ShieldWarning className="h-3.5 w-3.5" weight="fill" /> }]),
    { value: "feed" as const, label: t("sections.feed"), icon: <ChatCircle className="h-3.5 w-3.5" weight="fill" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Scope row: account, post, period. Unboxed, like the metrics page. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <ElevatedSelect label={ta("account")} value={accountId} onValueChange={changeAccount}>
            {accounts.map((a) => (
              <ElevatedSelectItem key={a.id} value={a.id}>
                @{a.username}
                {configured[a.id]?.enabled ? ` · ${ta("enabledMark")}` : ""}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <div className="w-full sm:w-80">
          <ElevatedSelect label={ta("post")} value={containerId || ALL_POSTS} disabled={!enabled} onValueChange={changePost}>
            <ElevatedSelectItem value={ALL_POSTS}>{ta("allPosts")}</ElevatedSelectItem>
            {posts.map((m) => (
              <ElevatedSelectItem key={m.id} value={m.id}>
                {postLabel(m, df, ta("untitledPost"))}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <PeriodPicker value={period} onChange={(next) => { setPeriod(next); setStats(null); setTrend([]); setError(null); }} />
      </div>

      {error ? <div role="alert" className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm text-destructive-ink">{error}</div> : null}

      {settings && !enabled ? (
        <div className="rounded-[--radius] border border-border bg-card">
          <EmptyState
            icon={<Sparkle weight="duotone" />}
            title={t("disabled.title")}
            description={t("disabled.description")}
            action={
              canConfigure ? (
                <Link href={`/dashboard/instagram-accounts/${accountId}`} className="mt-2">
                  <Button variant="primary" title={ta("configureCta")} icon={<Gear className="h-4 w-4" weight="fill" />} />
                </Link>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">{t("disabled.noPermission")}</p>
              )
            }
          />
        </div>
      ) : null}

      {settings && enabled ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedPillToggle<Section> aria-label={t("sectionsLabel")} value={section} onChange={setSection} options={sections} collapseLabels="sm" />
            {containerId ? <Chip>{ta("scopedToPost")}</Chip> : null}
          </div>

          {section === "overview" && (!error || stats) ? (
            <div className="flex flex-col gap-6">
              <CommentAnalysisOverview stats={stats} trend={trend} loading={!stats} topics={settings.topics} />
              {/*
                The conversation half of the audience. It renders its own empty
                state, so a workspace that only analyses comments reads an
                explanation rather than finding a gap on the page.
              */}
              <CommentAnalysisConversations stats={stats} loading={!stats} />
            </div>
          ) : null}
          {section === "topics" ? <CommentAnalysisTopics topics={settings.topics} stats={stats?.topics ?? []} /> : null}
          {section === "authors" && !containerId ? (
            <CommentAnalysisAuthors accountId={accountId} topics={settings.topics} period={period} />
          ) : null}
          {section === "feed" ? (
            <CommentAnalysisFeed
              accountId={accountId}
              containerId={containerId || undefined}
              topics={settings.topics}
              period={period}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
