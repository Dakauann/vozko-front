"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  listAnalyzedCommentsAction,
  listAuthorContainersAction,
  listCommentAuthorsAction,
  setCommentAuthorModerationAction,
} from "@/app/actions/audience";
import type {
  AnalyzedComment,
  AuthorContainer,
  CommentAuthor,
  CommentTopic,
  ModerationState,
} from "@/lib/audience/types";
import { MODERATION_STATES } from "@/lib/audience/types";
import type { Period } from "@/lib/audience/period";
import { DEFAULT_AUTHORS_PERIOD, isPeriodReady, periodRange } from "@/lib/audience/period";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { InstagramAvatar } from "@/components/instagram/instagram-avatar";
import { CommentQuickActions } from "@/components/audience/quick-actions";
import {
  AuthorRoleChip,
  Chip,
  EmptyState,
  IntentChip,
  ModerationChip,
  ReputationReadout,
  SentimentChip,
  SeverityBar,
  Skeleton,
  StanceChip,
  topicLabel,
} from "@/components/audience/shared";
import { ChatCircle, ImageSquare, ShieldWarning, Warning, X } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * One person, everywhere (§2).
 *
 * Every @ in the tab opens THIS view, so "who is this and what do they keep
 * doing" has a single answer rather than one per surface. It holds the two
 * halves of that question: the posts they turn up on, and what they wrote.
 *
 * The limit the copy must respect: we know about COMMENTS. A like is not in
 * the comment webhook and is not stored, so nothing here counts "interactions".
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

type Section = "posts" | "comments";

export function CommentAnalysisAuthorView({
  accountId,
  topics,
  period = DEFAULT_AUTHORS_PERIOD,
  author: given,
  authorExternalId,
  onClose,
  onModeration,
}: {
  accountId: string;
  topics: CommentTopic[];
  /** Inherited from the tab, so the dialog answers for the same window. */
  period?: Period;
  /** The row, when the caller already has it (the authors table). */
  author?: CommentAuthor;
  /** The external id, when the caller only saw an @ (the feed). */
  authorExternalId?: string;
  onClose: () => void;
  /** Lets a list that shows this author keep its own row in step. */
  onModeration?: (authorId: string, state: ModerationState) => void;
}) {
  const t = useTranslations("audience.authorView");
  const tMod = useTranslations("audience.enums.moderation");
  const locale = useLocale();
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short" }), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);

  const range = useMemo(() => (isPeriodReady(period) ? periodRange(period) : {}), [period]);
  const [author, setAuthor] = useState<CommentAuthor | null>(given ?? null);
  const [section, setSection] = useState<Section>("posts");
  const [containerId, setContainerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolving the @: the feed knows a handle and an external id, the author
  // endpoints take an author row id. One lookup bridges them.
  useEffect(() => {
    if (given || !authorExternalId) return;
    let cancelled = false;
    void listCommentAuthorsAction({ accountId, authorExternalId, pageSize: 1 }).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else if (result.items.length === 0) setError(t("notAnalyzed"));
      else setAuthor(result.items[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, authorExternalId, given, t]);

  const handle = author?.authorHandle ? `@${author.authorHandle}` : (author?.authorExternalId ?? authorExternalId ?? "");

  const setModeration = async (state: ModerationState) => {
    if (!author) return;
    const previous = author.moderationState;
    setAuthor({ ...author, moderationState: state });
    onModeration?.(author.id, state);
    const result = await setCommentAuthorModerationAction(author.id, state);
    if (result.error) {
      setError(result.error);
      setAuthor({ ...author, moderationState: previous });
      onModeration?.(author.id, previous);
    }
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle className="flex min-w-0 items-center gap-3">
            <InstagramAvatar
              accountId={accountId}
              username={author?.authorHandle ?? author?.authorExternalId ?? ""}
              className="size-9"
              textClassName="text-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{handle}</span>
              {author ? (
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ReputationReadout value={author.reputation} />
                  <StanceChip stance={author.derivedStance} />
                  <AuthorRoleChip role={author.role} displayable={author.roleDisplayable} />
                  {author.isFlagged ? (
                    <Chip className="text-destructive-ink">
                      <ShieldWarning className="h-3 w-3" weight="fill" /> {t("flagged")}
                    </Chip>
                  ) : null}
                  <ModerationChip state={author.moderationState} />
                </span>
              ) : null}
            </span>
          </ElevatedDialogTitle>
          {author ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("summary", {
                comments: nf.format(author.counters.analyzed),
                first: df.format(new Date(author.firstSeenAt)),
                last: df.format(new Date(author.lastSeenAt)),
              })}
            </p>
          ) : null}
        </ElevatedDialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <ElevatedPillToggle<Section>
            size="sm"
            aria-label={t("sectionLabel")}
            value={section}
            onChange={setSection}
            options={[
              { value: "posts", label: t("sections.posts"), icon: <ImageSquare className="h-3.5 w-3.5" weight="fill" /> },
              { value: "comments", label: t("sections.comments"), icon: <ChatCircle className="h-3.5 w-3.5" weight="fill" /> },
            ]}
          />
          {containerId ? (
            <button
              type="button"
              onClick={() => setContainerId(null)}
              className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-1 text-2xs font-medium text-foreground transition-colors hover:text-destructive-ink"
            >
              {t("filteredByPost", { post: containerId })}
              <X className="h-3 w-3" weight="bold" />
            </button>
          ) : null}
          {author ? (
            <ElevatedSelect
              value={author.moderationState}
              onValueChange={(v) => void setModeration(v as ModerationState)}
              className="ml-auto w-[148px]"
            >
              {MODERATION_STATES.map((s) => (
                <ElevatedSelectItem key={s} value={s}>
                  {tMod(s)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
              <Warning className="h-3.5 w-3.5" /> {error}
            </p>
          ) : null}

          {!author ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : section === "posts" ? (
            <AuthorPosts
              author={author}
              range={range}
              df={df}
              nf={nf}
              selected={containerId}
              onSelect={(id) => {
                setContainerId(id);
                setSection("comments");
              }}
            />
          ) : (
            <AuthorComments
              key={`${containerId ?? "all"}:${range.from ?? ""}:${range.to ?? ""}`}
              author={author}
              accountId={accountId}
              topics={topics}
              containerId={containerId}
              range={range}
            />
          )}
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

/** The posts this person turns up on, worst first by their own behaviour there. */
function AuthorPosts({
  author,
  range,
  df,
  nf,
  selected,
  onSelect,
}: {
  author: CommentAuthor;
  range: { from?: string; to?: string };
  df: Intl.DateTimeFormat;
  nf: Intl.NumberFormat;
  selected: string | null;
  onSelect: (containerId: string) => void;
}) {
  const t = useTranslations("audience.authorView");
  const [containers, setContainers] = useState<AuthorContainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listAuthorContainersAction(author.id, 1, 50, range).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setContainers(result.result?.containers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [author.id, range]);

  if (error) return <p className="text-xs text-destructive-ink">{error}</p>;
  if (containers === null) return <Skeleton className="h-24" />;
  if (containers.length === 0) {
    return <EmptyState icon={<ImageSquare weight="duotone" />} title={t("noPostsTitle")} description={t("noPostsDescription")} />;
  }

  return (
    <ul className="space-y-2">
      {containers.map((c) => (
        <li key={c.containerId}>
          <button
            type="button"
            onClick={() => onSelect(c.containerId)}
            className={cn(
              "flex w-full flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-3 py-2.5 text-left transition-colors",
              "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
              selected === c.containerId && "border-primary/60",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs text-foreground">{c.containerId}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <StanceChip stance={c.derivedStance} />
                <Chip>{t("commentsOnPost", { count: c.comments })}</Chip>
                {c.severityHighCount > 0 ? (
                  <Chip className="text-destructive-ink">{t("highOnPost", { count: c.severityHighCount })}</Chip>
                ) : null}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <ReputationReadout value={c.reputation} />
              <SeverityBar severity={c.severityMax} compact />
              <span className="whitespace-nowrap text-2xs text-muted-foreground">{df.format(new Date(c.lastCommentedAt))}</span>
            </span>
          </button>
        </li>
      ))}
      <li className="pt-1 text-2xs text-muted-foreground">{t("postsFootnote", { total: nf.format(containers.length) })}</li>
    </ul>
  );
}

/**
 * What this person wrote, optionally on one post. The list and its actions are
 * the feed's own endpoints, so hiding and replying behave identically here.
 */
function AuthorComments({
  author,
  accountId,
  topics,
  containerId,
  range,
}: {
  author: CommentAuthor;
  accountId: string;
  topics: CommentTopic[];
  containerId: string | null;
  range: { from?: string; to?: string };
}) {
  const t = useTranslations("audience.authorView");
  const tActions = useTranslations("audience.quickActions");
  const tTopics = useTranslations("audience.topics");
  const [comments, setComments] = useState<AnalyzedComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void listAnalyzedCommentsAction({
      accountId,
      authorExternalId: author.authorExternalId,
      containerId: containerId ?? undefined,
      pageSize: 50,
      ...range,
    }).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else {
        setError(null);
        setComments(result.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, author.authorExternalId, containerId, range]);

  if (error && comments === null) return <p className="text-xs text-destructive-ink">{error}</p>;
  if (comments === null) return <Skeleton className="h-24" />;
  if (comments.length === 0) {
    return <EmptyState icon={<ChatCircle weight="duotone" />} title={t("noComments")} />;
  }

  return (
    <>
      {error ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-destructive-ink">
          <Warning className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-[--radius] border border-border bg-card px-3 py-2">
            <p className="text-sm text-foreground">{c.excerpt}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.stance ? <StanceChip stance={c.stance} /> : null}
              {c.sentiment ? <SentimentChip sentiment={c.sentiment} /> : null}
              {c.intent ? <IntentChip intent={c.intent} /> : null}
              {c.topicKey ? <Chip>{topicLabel(topics, c.topicKey, tTopics("otherLabel"))}</Chip> : null}
              {hidden.has(c.id) ? <Chip className="text-muted-foreground">{tActions("hidden")}</Chip> : null}
              <span className="ml-auto">
                <SeverityBar severity={c.severity} compact />
              </span>
            </div>
            {/* No "open the author" here: it is already open. */}
            <CommentQuickActions
              className="mt-2"
              accountId={accountId}
              comment={c}
              hidden={hidden.has(c.id)}
              onHidden={(x) => setHidden((prev) => new Set(prev).add(x.id))}
              onRetried={(x) => setComments((prev) => (prev ?? []).map((y) => (y.id === x.id ? x : y)))}
              onError={setError}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
