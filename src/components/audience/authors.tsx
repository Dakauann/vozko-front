"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  listCommentAuthorsAction,
  setCommentAuthorModerationAction,
} from "@/app/actions/audience";
import type {
  AuthorSort,
  AuthorSortKey,
  CommentAuthor,
  CommentStance,
  CommentTopic,
  ModerationState,
} from "@/lib/audience/types";
import {
  AUTHOR_SORT_FIRST_DIRECTION,
  AUTHOR_TABLE_COLUMNS,
  COMMENT_STANCES,
  DEFAULT_AUTHOR_SORT,
  MODERATION_STATES,
} from "@/lib/audience/types";
import type { Period } from "@/lib/audience/period";
import { DEFAULT_AUTHORS_PERIOD, isPeriodReady, periodRange } from "@/lib/audience/period";
import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { InstagramAvatar } from "@/components/instagram/instagram-avatar";
import { CommentAnalysisAuthorView } from "@/components/audience/author-view";
import { SortableColumnHead } from "@/components/elevated-design/table/sortable-column-head";
import {
  AuthorRoleChip,
  Chip,
  EmptyState,
  ModerationChip,
  Panel,
  ReputationReadout,
  SeverityBar,
  Skeleton,
  StanceChip,
} from "@/components/audience/shared";
import { CaretRight, ShieldWarning, UsersThree, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The "who commented bad things" table (plan §11.3, §13, §1).
 *
 * Ranked as the API ranks it: the ordering is a query parameter, the column
 * heads are the control, and the default opens on the worst reputations. A row
 * opens the AUTHOR VIEW rather than expanding in place, so "who is this person"
 * has one answer here, in the feed, and anywhere else an @ appears.
 *
 * The period changes what the ranking MEANS, not just what it filters: with a
 * window the standing in every column describes that window, so somebody
 * hostile last month and quiet since drops out of this week's list. The panel
 * opens on all time, which is also the server's cheap path.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

type Scope = "flagged" | "all";

/** The minimum-comments options. Enough to cut one-off commenters, no more. */
const MIN_COMMENT_OPTIONS = [2, 5, 10, 25];

const ANY = "__any";

export function CommentAnalysisAuthors({
  accountId,
  topics,
  period = DEFAULT_AUTHORS_PERIOD,
}: {
  accountId: string;
  topics: CommentTopic[];
  period?: Period;
}) {
  const t = useTranslations("commentAnalysis.authors");
  const tFilters = useTranslations("commentAnalysis.authors.filters");
  const tMod = useTranslations("commentAnalysis.enums.moderation");
  const tStance = useTranslations("commentAnalysis.enums.stance");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short" }), [locale]);

  const [scope, setScope] = useState<Scope>("flagged");
  const [sort, setSort] = useState<AuthorSort>(DEFAULT_AUTHOR_SORT);
  const [stance, setStance] = useState<CommentStance | typeof ANY>(ANY);
  const [minComments, setMinComments] = useState(0);
  const [authors, setAuthors] = useState<CommentAuthor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CommentAuthor | null>(null);

  // Fetches settle in the promise callback, never synchronously in the
  // effect body; the previous page stays visible (dimmed) while the next
  // one loads.
  const range = useMemo(() => (isPeriodReady(period) ? periodRange(period) : null), [period]);

  useEffect(() => {
    // A half-typed custom range would reload the table on every keystroke and
    // then be refused by the API, so it simply waits.
    if (!range) return;
    let cancelled = false;
    void listCommentAuthorsAction({
      accountId,
      flaggedOnly: scope === "flagged",
      stance: stance === ANY ? undefined : stance,
      minComments: minComments || undefined,
      sort,
      page,
      pageSize: 20,
      ...range,
    }).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else {
        setError(null);
        setAuthors(result.items);
        setTotal(result.meta.totalItems);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, scope, stance, minComments, sort, page, range]);

  // Any narrowing sends the reader back to page one: page 4 of a list that
  // just shrank to two pages is an empty table with no explanation.
  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
    setLoading(true);
  };

  // One key at a time: the API orders by a single key, so clicking a new head
  // replaces the order rather than stacking onto it, and clicking the active
  // head flips it. Each key opens on the direction that answers its own
  // question first — worst reputation, most comments, most recent.
  const toggleSort = (key: string) => {
    setSort((cur) =>
      cur.key === key
        ? { key: cur.key, direction: cur.direction === "asc" ? "desc" : "asc" }
        : { key: key as AuthorSortKey, direction: AUTHOR_SORT_FIRST_DIRECTION[key as AuthorSortKey] },
    );
    setPage(1);
    setLoading(true);
  };

  const applyModeration = (authorId: string, state: ModerationState) =>
    setAuthors((prev) => prev.map((a) => (a.id === authorId ? { ...a, moderationState: state } : a)));

  const handleModeration = async (author: CommentAuthor, state: ModerationState) => {
    const previous = author.moderationState;
    applyModeration(author.id, state);
    const result = await setCommentAuthorModerationAction(author.id, state);
    if (result.error) {
      setError(result.error);
      applyModeration(author.id, previous);
    }
  };

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        <ElevatedPillToggle<Scope>
          size="sm"
          aria-label={t("scopeLabel")}
          value={scope}
          onChange={narrow(setScope)}
          options={[
            { value: "flagged", label: t("scope.flagged"), icon: <ShieldWarning className="h-3.5 w-3.5" weight="fill" /> },
            { value: "all", label: t("scope.all"), icon: <UsersThree className="h-3.5 w-3.5" weight="fill" /> },
          ]}
        />
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <ElevatedSelect
          label={tFilters("stance")}
          value={stance}
          onValueChange={narrow((v: string) => setStance(v as CommentStance | typeof ANY))}
        >
          <ElevatedSelectItem value={ANY}>{tFilters("any")}</ElevatedSelectItem>
          {COMMENT_STANCES.map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {tStance(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <ElevatedSelect
          label={tFilters("minComments")}
          value={String(minComments)}
          onValueChange={narrow((v: string) => setMinComments(Number(v)))}
        >
          <ElevatedSelectItem value="0">{tFilters("noMinimum")}</ElevatedSelectItem>
          {MIN_COMMENT_OPTIONS.map((n) => (
            <ElevatedSelectItem key={n} value={String(n)}>
              {tFilters("atLeast", { count: n })}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>

      {error ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {loading && authors.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : authors.length === 0 ? (
        <EmptyState
          icon={<ShieldWarning weight="duotone" />}
          title={scope === "flagged" ? t("emptyFlaggedTitle") : t("emptyTitle")}
          description={scope === "flagged" ? t("emptyFlaggedDescription") : t("emptyDescription")}
        />
      ) : (
        <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-muted-foreground">
                <SortableColumnHead className="pb-2 pr-3 font-medium" label={t("columns.author")} />
                {AUTHOR_TABLE_COLUMNS.map((column) => (
                  <SortableColumnHead
                    key={column.key}
                    className={cn("pb-2 pr-3 font-medium", column.numeric && "tabular-nums")}
                    label={t(`columns.${column.key}`)}
                    sortKey={column.key}
                    sorts={[sort]}
                    onToggle={toggleSort}
                  />
                ))}
                <SortableColumnHead className="pb-2 font-medium" label={t("columns.moderation")} />
              </tr>
            </thead>
            <tbody>
              {authors.map((author) => (
                <AuthorRow
                  key={author.id}
                  author={author}
                  accountId={accountId}
                  onOpen={() => setViewing(author)}
                  onModeration={(state) => void handleModeration(author, state)}
                  nf={nf}
                  df={df}
                  moderationLabel={tMod}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("pagination", { from: (page - 1) * 20 + 1, to: Math.min(page * 20, total), total: nf.format(total) })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" title={t("previous")} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <Button size="sm" variant="ghost" title={t("next")} disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)} />
          </div>
        </div>
      ) : null}

      {viewing ? (
        <CommentAnalysisAuthorView
          accountId={accountId}
          topics={topics}
          period={period}
          author={viewing}
          onClose={() => setViewing(null)}
          onModeration={applyModeration}
        />
      ) : null}
    </Panel>
  );
}

function AuthorRow({
  author,
  accountId,
  onOpen,
  onModeration,
  nf,
  df,
  moderationLabel,
}: {
  author: CommentAuthor;
  accountId: string;
  onOpen: () => void;
  onModeration: (state: ModerationState) => void;
  nf: Intl.NumberFormat;
  df: Intl.DateTimeFormat;
  moderationLabel: (key: ModerationState) => string;
}) {
  const t = useTranslations("commentAnalysis.authors");
  const handle = author.authorHandle ? `@${author.authorHandle}` : author.authorExternalId;
  return (
    <tr className={cn("border-b border-border align-middle", author.isFlagged && "bg-muted/40")}>
      <td className="py-2.5 pr-3">
        <button type="button" onClick={onOpen} title={t("openAuthor")} className="group/open flex min-w-0 items-center gap-2 text-left">
          <CaretRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover/open:translate-x-0.5" />
          <InstagramAvatar accountId={accountId} username={author.authorHandle ?? author.authorExternalId} className="size-7" textClassName="text-xs" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{handle}</span>
            <span className="flex flex-wrap gap-1">
              {author.isFlagged ? (
                <Chip className="text-destructive-ink">
                  <ShieldWarning className="h-3 w-3" weight="fill" /> {t("flagged")}
                </Chip>
              ) : null}
              <StanceChip stance={author.derivedStance} />
              <AuthorRoleChip role={author.role} displayable={author.roleDisplayable} />
              <ModerationChip state={author.moderationState} />
            </span>
          </span>
        </button>
      </td>
      <td className="py-2.5 pr-3">
        <ReputationReadout value={author.reputation} />
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-foreground">{nf.format(author.counters.analyzed)}</td>
      <td className="py-2.5 pr-3 tabular-nums text-healthy-ink">{nf.format(author.counters.stanceSupporter)}</td>
      <td className="py-2.5 pr-3 tabular-nums text-destructive-ink">
        {nf.format(author.counters.stanceHostile)}
        {author.counters.severityHighCount > 0 ? (
          <span className="block text-2xs text-muted-foreground">{t("highCount", { count: author.counters.severityHighCount })}</span>
        ) : null}
      </td>
      <td className="py-2.5 pr-3">
        <SeverityBar severity={author.counters.severityMax} compact />
      </td>
      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{df.format(new Date(author.lastSeenAt))}</td>
      <td className="py-2.5">
        <ElevatedSelect value={author.moderationState} onValueChange={(v) => onModeration(v as ModerationState)} className="w-[132px]">
          {MODERATION_STATES.map((s) => (
            <ElevatedSelectItem key={s} value={s}>
              {moderationLabel(s)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </td>
    </tr>
  );
}
