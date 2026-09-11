"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  getCommentAnalysisSettingsAction,
  getAudienceStatsAction,
  getAudienceTrendsAction,
  getAudienceUsageAction,
  getAudienceWorkspaceSettingsAction,
  listCommentAnalysisAccountsAction,
  type AudienceUsage,
  type AudienceWorkspaceSettings,
} from "@/app/actions/audience";
import { listInstagramAccountsAction, listInstagramMediaAction } from "@/app/actions/instagram";
import type { AudienceSource, CommentAnalysisSettings, CommentAnalysisStats, SubjectKind, TrendPoint } from "@/lib/audience/types";
import { AUDIENCE_SOURCES } from "@/lib/audience/types";
import type { InstagramAccount, InstagramMedia } from "@/lib/instagram/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link } from "@/i18n/routing";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { CommentAnalysisOverview } from "@/components/audience/overview";
import { CommentAnalysisConversations } from "@/components/audience/conversations";
import { AnalysisBudgetPanel } from "@/components/audience/budget";
import { CommentAnalysisTopics } from "@/components/audience/topics";
import type { Period } from "@/lib/audience/period";
import { DEFAULT_PERIOD, isPeriodReady, periodRange } from "@/lib/audience/period";
import { PeriodPicker } from "@/components/audience/period";
import { CommentAnalysisAuthors } from "@/components/audience/authors";
import { CommentAnalysisFeed } from "@/components/audience/feed";
import { Chip, EmptyState, Skeleton } from "@/components/audience/shared";
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
const ALL_CHANNELS = "__channels";
const ALL_ACCOUNTS = "__accounts";
const ALL_KINDS = "__kinds";
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
  const t = useTranslations("audience");
  const ta = useTranslations("audience.page");
  const tChannel = useTranslations("audience.channels");
  const locale = useLocale();
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short" }), [locale]);
  const { can } = useWorkspace();
  const canConfigure = can("audience", "update");

  const [accounts, setAccounts] = useState<InstagramAccount[] | null>(null);
  const [configured, setConfigured] = useState<Record<string, CommentAnalysisSettings>>({});
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [containerId, setContainerId] = useState(initialContainerId ?? "");
  const [posts, setPosts] = useState<InstagramMedia[]>([]);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [section, setSection] = useState<Section>("overview");
  // Empty means every channel, which is the default the page opens on.
  const [source, setSource] = useState<AudienceSource | "">("");
  const [kind, setKind] = useState<SubjectKind | typeof ALL_KINDS>(ALL_KINDS);

  // Instagram's account and post pickers only mean something on Instagram, or
  // when no channel is chosen and Instagram is one of the ones in view.
  const showsInstagramScope = (source === "" || source === "instagram") && accounts !== null && accounts.length > 0;

  const [settings, setSettings] = useState<CommentAnalysisSettings | null>(null);
  const [commentStats, setCommentStats] = useState<CommentAnalysisStats | null>(null);
  const [conversationStats, setConversationStats] = useState<CommentAnalysisStats | null>(null);
  const [previousStats, setPreviousStats] = useState<CommentAnalysisStats | null>(null);
  // The workspace ceiling, read once per load. It belongs beside coverage: a
  // budget that has been hit is the reason coverage would be low, and until now
  // the only sign of it was analysis quietly stopping.
  const [usage, setUsage] = useState<AudienceUsage | null>(null);
  // The settings the budget is measured against. Separate from usage because
  // one is configuration and the other is consumption: the poll refreshes the
  // spend every minute, while the settings only change when somebody edits them.
  const [workspaceSettings, setWorkspaceSettings] = useState<AudienceWorkspaceSettings | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [commentTrend, setCommentTrend] = useState<TrendPoint[]>([]);
  const [conversationTrend, setConversationTrend] = useState<TrendPoint[]>([]);
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
      // Deliberately NOT auto-selecting an account. The page opens on the whole
      // workspace across every channel; picking the first Instagram account for
      // the operator is what made this an Instagram page. A deep link that
      // named an account still keeps it.
      setAccountId((current) => (current && ig.accounts.some((a) => a.id === current) ? current : ""));
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

  /*
   * Analyses land on their own schedule: a conversation goes quiet, its window
   * elapses, and the batch runs minutes later. A page that only reads once
   * therefore shows a backlog that never appears to drain, so the numbers are
   * re-read on a slow tick rather than leaving the reader to guess whether
   * nothing changed or nothing refreshed.
   *
   * This is the most expensive read on the page: one tick is several aggregate
   * queries over the whole period, none of them cached. So it only runs while
   * somebody is actually looking. A dashboard left open on a background tab
   * used to keep asking all day, which is a real cost for an answer nobody is
   * reading, and it refreshes immediately on return so coming back to the tab
   * never shows stale numbers.
   */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setRefresh((value) => value + 1);
    };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  // The numbers for the current scope and period.
  //
  // No account is required. The engine scopes every read to the session's
  // workspace, so an empty account means "everything this workspace analysed",
  // which is what an audience view should open on.
  useEffect(() => {
    let cancelled = false;
    if (!isPeriodReady(period)) return;
    const { from, to: rangeEnd } = periodRange(period);
    const to = rangeEnd ?? new Date().toISOString();
    const scope = {
      accountId: accountId || undefined,
      source: source || undefined,
      containerId: containerId || undefined,
      from,
      to,
    };
    /*
     * A conversation can be analysed several times as it goes on, so the
     * totals count each conversation ONCE, at its most recent verdict.
     * Without this, a long conversation that went quiet three times would be
     * three conversations in every percentage on the page.
     */
    const baseFilters = { ...scope, latestOnly: true };
    /*
     * The daily series is the exception: it says what was learned on each day,
     * so every analysis belongs to the day it ran on. Collapsing to the latest
     * revision here would move a conversation off the day it was analysed and
     * quietly rewrite history every time it is analysed again.
     */
    const seriesFilters = scope;
    const duration = from ? Date.parse(to) - Date.parse(from) : 0;

    void Promise.all([
      kind === "conversation"
        ? Promise.resolve({ stats: null, error: null as string | null })
        : getAudienceStatsAction({ ...baseFilters, subjectKind: ["comment"] }),
      kind === "comment"
        ? Promise.resolve({ stats: null, error: null as string | null })
        : getAudienceStatsAction({ ...baseFilters, subjectKind: ["conversation"] }),
      kind === "conversation"
        ? Promise.resolve({ points: [] as TrendPoint[], error: null as string | null })
        : getAudienceTrendsAction({ ...seriesFilters, subjectKind: ["comment"] }),
      kind === "comment"
        ? Promise.resolve({ points: [] as TrendPoint[], error: null as string | null })
        : getAudienceTrendsAction({ ...seriesFilters, subjectKind: ["conversation"] }),
      kind === "comment" || !from
        ? Promise.resolve({ stats: null, error: null as string | null })
        : getAudienceStatsAction({ ...baseFilters, subjectKind: ["conversation"], from: new Date(Date.parse(from) - duration).toISOString(), to: from }),
      // Not filtered by anything: the budget belongs to the workspace, not to
      // the slice being looked at.
      getAudienceUsageAction(),
      getAudienceWorkspaceSettingsAction(),
    ]).then(([comments, conversations, commentSeries, conversationSeries, previous, budget, analysisSettings]) => {
      if (cancelled) return;
      setUsage(budget.usage);
      setWorkspaceSettings(analysisSettings.settings);
      if (comments.error || conversations.error) setError(comments.error || conversations.error || null);
      else {
        setCommentStats(comments.stats ?? null);
        setConversationStats(conversations.stats ?? null);
        setPreviousStats(previous.error ? null : previous.stats ?? null);
        setError(null);
      }
      if (!commentSeries.error && !conversationSeries.error) {
        setCommentTrend(commentSeries.points);
        setConversationTrend(conversationSeries.points);
      } else {
        setCommentTrend([]);
        setConversationTrend([]);
        setError(commentSeries.error || conversationSeries.error || null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, containerId, source, kind, period, refresh]);

  const resetNumbers = () => {
    setCommentStats(null);
    setConversationStats(null);
    setCommentTrend([]);
    setConversationTrend([]);
    setError(null);
  };

  const changeSource = (next: string) => {
    const value = next === ALL_CHANNELS ? "" : (next as AudienceSource);
    setSource(value);
    // An Instagram account and post mean nothing on another channel, so the
    // narrower scope is dropped rather than silently kept and ignored.
    if (value !== "" && value !== "instagram") {
      setAccountId("");
      setContainerId("");
      onScopeChange?.("", undefined);
    }
    if (section === "authors" || section === "topics") setSection("overview");
    resetNumbers();
  };

  const changeKind = (next: string) => {
    setKind(next as SubjectKind | typeof ALL_KINDS);
    resetNumbers();
  };

  const changeAccount = (id: string) => {
    if (id === ALL_ACCOUNTS) {
      setAccountId("");
      setContainerId("");
      setSettings(null);
      resetNumbers();
      if (section === "authors" || section === "topics") setSection("overview");
      onScopeChange?.("", undefined);
      return;
    }
    setAccountId(id);
    setContainerId("");
    setCommentStats(null);
    setConversationStats(null);
    setCommentTrend([]);
    setConversationTrend([]);
    setSettings(null);
    if (section === "authors") setSection("overview");
    onScopeChange?.(id, undefined);
  };

  const changePost = (id: string) => {
    const next = id === ALL_POSTS ? "" : id;
    setContainerId(next);
    setCommentStats(null);
    setConversationStats(null);
    setCommentTrend([]);
    setConversationTrend([]);
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

  // No Instagram account is NOT an empty page any more. A workspace can analyse
  // WhatsApp, Telegram, unofficial WhatsApp and voice conversations without ever
  // connecting Instagram, and this view is the place those show up.

  /*
   * Topics and authors are ACCOUNT-scoped by the API: the topic set is an
   * account's taxonomy and the author ranking is computed per account. They
   * step aside when no account is selected rather than rendering empty, which
   * would read as "this workspace has no authors" instead of "you have not
   * narrowed to an account yet".
   */
  const sections = [
    { value: "overview" as const, label: t("sections.overview"), icon: <ChartLineUp className="h-3.5 w-3.5" weight="fill" /> },
    ...(accountId ? [{ value: "topics" as const, label: t("sections.topics"), icon: <Hash className="h-3.5 w-3.5" weight="fill" /> }] : []),
    ...(accountId && !containerId ? [{ value: "authors" as const, label: t("sections.authors"), icon: <ShieldWarning className="h-3.5 w-3.5" weight="fill" /> }] : []),
    {
      value: "feed" as const,
      label: kind === "conversation" ? ta("kindConversation") : kind === "comment" ? ta("kindComment") : ta("allKinds"),
      icon: <ChatCircle className="h-3.5 w-3.5" weight="fill" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/*
        Scope row: channel, then the narrower pickers that only some channels
        have. Channel comes FIRST because it is the widest cut and the one that
        decides whether the pickers after it mean anything: an Instagram account
        and a post are Instagram's, and a workspace that only runs WhatsApp
        should not be asked about either.
      */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <ElevatedSelect label={ta("channel")} value={source || ALL_CHANNELS} onValueChange={changeSource}>
            <ElevatedSelectItem value={ALL_CHANNELS}>{ta("allChannels")}</ElevatedSelectItem>
            {AUDIENCE_SOURCES.map((s) => (
              <ElevatedSelectItem key={s} value={s}>
                {tChannel(s)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>

        {/* Instagram's own scope. Hidden entirely on other channels. */}
        {showsInstagramScope ? (
          <>
            <div className="w-full sm:w-56">
              <ElevatedSelect label={ta("account")} value={accountId || ALL_ACCOUNTS} onValueChange={changeAccount}>
                <ElevatedSelectItem value={ALL_ACCOUNTS}>{ta("allAccounts")}</ElevatedSelectItem>
                {accounts.map((a) => (
                  <ElevatedSelectItem key={a.id} value={a.id}>
                    @{a.username}
                    {configured[a.id]?.enabled ? ` · ${ta("enabledMark")}` : ""}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            {accountId ? (
              <div className="w-full sm:w-72">
                <ElevatedSelect label={ta("post")} value={containerId || ALL_POSTS} onValueChange={changePost}>
                  <ElevatedSelectItem value={ALL_POSTS}>{ta("allPosts")}</ElevatedSelectItem>
                  {posts.map((m) => (
                    <ElevatedSelectItem key={m.id} value={m.id}>
                      {postLabel(m, df, ta("untitledPost"))}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="w-full sm:w-52">
          <ElevatedSelect label={ta("subjectKind")} value={kind} onValueChange={changeKind}>
            <ElevatedSelectItem value={ALL_KINDS}>{ta("allKinds")}</ElevatedSelectItem>
            <ElevatedSelectItem value="comment">{ta("kindComment")}</ElevatedSelectItem>
            <ElevatedSelectItem value="conversation">{ta("kindConversation")}</ElevatedSelectItem>
          </ElevatedSelect>
        </div>

        <PeriodPicker value={period} onChange={(next) => { setPeriod(next); setCommentStats(null); setConversationStats(null); setCommentTrend([]); setConversationTrend([]); setError(null); }} />
      </div>

      {error ? <div role="alert" className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm text-destructive-ink">{error}</div> : null}

      {/*
        The "switched off" notice is now a HINT beside the data, not a wall in
        front of it. An Instagram account with analysis off still has history
        worth reading, and the workspace's other channels have nothing to do
        with that switch.
      */}
      {accountId && settings && !settings.enabled ? (
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

      <>
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedPillToggle<Section> aria-label={t("sectionsLabel")} value={section} onChange={setSection} options={sections} collapseLabels="sm" />
            {containerId ? <Chip>{ta("scopedToPost")}</Chip> : null}
          </div>

          {section === "overview" && (!error || commentStats || conversationStats) ? (
            <div className="flex flex-col gap-6">
              {/*
                The ceiling first: it governs both halves below, and when it is
                spent it is the reason the rest of the page looks thin.
              */}
              <AnalysisBudgetPanel
                usage={usage}
                settings={workspaceSettings}
                onChanged={(next) => {
                  setWorkspaceSettings(next);
                  // The meter is drawn against the ceiling, so a saved ceiling
                  // has to reach it now rather than on the next poll a minute
                  // later. The spend itself is unchanged by the edit.
                  setUsage((current) =>
                    current && next.dailyCap > 0 ? { ...current, limit: next.dailyCap } : current,
                  );
                }}
              />
              {kind !== "conversation" && (kind === "comment" || !commentStats || commentStats.commentCount > 0) ? (
                <CommentAnalysisOverview stats={commentStats} trend={commentTrend} loading={!commentStats} topics={settings?.topics ?? []} />
              ) : null}
              {kind !== "comment" ? (
                <CommentAnalysisConversations stats={conversationStats} previousStats={previousStats} trend={conversationTrend} loading={!conversationStats} />
              ) : null}
            </div>
          ) : null}
          {section === "topics" && settings ? <CommentAnalysisTopics topics={settings.topics} stats={commentStats?.topics ?? []} /> : null}
          {section === "authors" && accountId && !containerId ? (
            <CommentAnalysisAuthors accountId={accountId} topics={settings?.topics ?? []} period={period} />
          ) : null}
          {section === "feed" ? (
            <CommentAnalysisFeed
              key={JSON.stringify([accountId, source, kind, containerId, period])}
              accountId={accountId}
              source={source || undefined}
              subjectKind={kind === ALL_KINDS ? undefined : kind}
              containerId={containerId || undefined}
              topics={settings?.topics ?? []}
              period={period}
            />
          ) : null}
      </>
    </div>
  );
}
