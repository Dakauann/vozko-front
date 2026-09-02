"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  getCommentAuthorAction,
  listCommentAuthorsAction,
  setCommentAuthorModerationAction,
} from "@/app/actions/comment-analysis";
import { hideInstagramCommentAction, privateReplyInstagramCommentAction } from "@/app/actions/instagram";
import type { AnalyzedComment, CommentAuthor, CommentTopic, ModerationState } from "@/lib/comment-analysis/types";
import { MODERATION_STATES } from "@/lib/comment-analysis/types";
import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { InstagramAvatar } from "@/components/instagram/instagram-avatar";
import {
  Chip,
  EmptyState,
  IntentChip,
  ModerationChip,
  Panel,
  SentimentChip,
  SeverityBar,
  Skeleton,
  StanceChip,
  topicLabel,
} from "@/components/instagram/comment-analysis-shared";
import { CaretDown, EyeSlash, PaperPlaneTilt, ShieldWarning, UsersThree, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The "who commented bad things" table (plan §11.3, §13).
 *
 * Ranked as the API ranks it: flagged first, then by high-severity count,
 * then by worst comment. A row expands into that author's comments, and the
 * actions on them (hide, private reply) go through the SAME Instagram
 * endpoints the moderation list already uses; the only new action is the
 * author's moderation standing, which lives in the engine.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

type Scope = "flagged" | "all";

export function CommentAnalysisAuthors({ accountId, topics }: { accountId: string; topics: CommentTopic[] }) {
  const t = useTranslations("commentAnalysis.authors");
  const tMod = useTranslations("commentAnalysis.enums.moderation");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);
  const df = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? "pt-BR", { dateStyle: "short" }), [locale]);

  const [scope, setScope] = useState<Scope>("flagged");
  const [authors, setAuthors] = useState<CommentAuthor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Fetches settle in the promise callback, never synchronously in the
  // effect body; the previous page stays visible (dimmed) while the next
  // one loads.
  useEffect(() => {
    let cancelled = false;
    void listCommentAuthorsAction({ accountId, flaggedOnly: scope === "flagged", page, pageSize: 20 }).then((result) => {
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
  }, [accountId, scope, page]);

  const handleModeration = async (author: CommentAuthor, state: ModerationState) => {
    const previous = author.moderationState;
    setAuthors((prev) => prev.map((a) => (a.id === author.id ? { ...a, moderationState: state } : a)));
    const result = await setCommentAuthorModerationAction(author.id, state);
    if (result.error) {
      setError(result.error);
      setAuthors((prev) => prev.map((a) => (a.id === author.id ? { ...a, moderationState: previous } : a)));
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
          onChange={(v) => {
            setScope(v);
            setPage(1);
            setLoading(true);
          }}
          options={[
            { value: "flagged", label: t("scope.flagged"), icon: <ShieldWarning className="h-3.5 w-3.5" weight="fill" /> },
            { value: "all", label: t("scope.all"), icon: <UsersThree className="h-3.5 w-3.5" weight="fill" /> },
          ]}
        />
      }
    >
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">{t("columns.author")}</th>
                <th className="pb-2 pr-3 font-medium tabular-nums">{t("columns.comments")}</th>
                <th className="pb-2 pr-3 font-medium">{t("columns.worst")}</th>
                <th className="pb-2 pr-3 font-medium">{t("columns.stance")}</th>
                <th className="pb-2 pr-3 font-medium">{t("columns.lastSeen")}</th>
                <th className="pb-2 font-medium">{t("columns.moderation")}</th>
              </tr>
            </thead>
            <tbody>
              {authors.map((author) => (
                <AuthorRow
                  key={author.id}
                  author={author}
                  accountId={accountId}
                  topics={topics}
                  expanded={expanded === author.id}
                  onToggle={() => setExpanded((cur) => (cur === author.id ? null : author.id))}
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
    </Panel>
  );
}

function AuthorRow({
  author,
  accountId,
  topics,
  expanded,
  onToggle,
  onModeration,
  nf,
  df,
  moderationLabel,
}: {
  author: CommentAuthor;
  accountId: string;
  topics: CommentTopic[];
  expanded: boolean;
  onToggle: () => void;
  onModeration: (state: ModerationState) => void;
  nf: Intl.NumberFormat;
  df: Intl.DateTimeFormat;
  moderationLabel: (key: ModerationState) => string;
}) {
  const t = useTranslations("commentAnalysis.authors");
  const handle = author.authorHandle ? `@${author.authorHandle}` : author.authorExternalId;
  return (
    <>
      <tr className={cn("border-b border-border align-middle", author.isFlagged && "bg-muted/40")}>
        <td className="py-2.5 pr-3">
          <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={expanded}>
            <CaretDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            <InstagramAvatar accountId={accountId} username={author.authorHandle ?? author.authorExternalId} className="size-7" textClassName="text-xs" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground">{handle}</span>
              <span className="flex flex-wrap gap-1">
                {author.isFlagged ? (
                  <Chip className="text-destructive-ink">
                    <ShieldWarning className="h-3 w-3" weight="fill" /> {t("flagged")}
                  </Chip>
                ) : null}
                <ModerationChip state={author.moderationState} />
              </span>
            </span>
          </button>
        </td>
        <td className="py-2.5 pr-3 tabular-nums text-foreground">
          {nf.format(author.counters.analyzed)}
          {author.counters.severityHighCount > 0 ? (
            <span className="block text-2xs text-destructive-ink">{t("highCount", { count: author.counters.severityHighCount })}</span>
          ) : null}
        </td>
        <td className="py-2.5 pr-3">
          <SeverityBar severity={author.counters.severityMax} compact />
        </td>
        <td className="py-2.5 pr-3">
          <StanceChip stance={author.derivedStance} />
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
      {expanded ? (
        <tr className="border-b border-border">
          <td colSpan={6} className="bg-muted/30 px-3 py-3">
            <AuthorComments author={author} accountId={accountId} topics={topics} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AuthorComments({ author, accountId, topics }: { author: CommentAuthor; accountId: string; topics: CommentTopic[] }) {
  const t = useTranslations("commentAnalysis.authors");
  const tTopics = useTranslations("commentAnalysis.topics");
  const [comments, setComments] = useState<AnalyzedComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replying, setReplying] = useState<AnalyzedComment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCommentAuthorAction(author.id, 1, 20).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setComments(result.detail?.comments ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [author.id]);

  const hide = async (c: AnalyzedComment) => {
    setBusy(c.id);
    const result = await hideInstagramCommentAction(accountId, c.sourceCommentId, true);
    setBusy(null);
    if (result.error) setError(result.error);
  };

  if (error) {
    return <p className="text-xs text-destructive-ink">{error}</p>;
  }
  if (comments === null) {
    return <Skeleton className="h-16" />;
  }
  if (comments.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("noComments")}</p>;
  }
  return (
    <>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-[--radius] border border-border bg-card px-3 py-2">
            <p className="text-sm text-foreground">{c.excerpt}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.stance ? <StanceChip stance={c.stance} /> : null}
              {c.sentiment ? <SentimentChip sentiment={c.sentiment} /> : null}
              {c.intent ? <IntentChip intent={c.intent} /> : null}
              {c.topicKey ? <Chip>{topicLabel(topics, c.topicKey, tTopics("otherLabel"))}</Chip> : null}
              <span className="ml-auto">
                <SeverityBar severity={c.severity} compact />
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="ghost" icon={<EyeSlash className="h-3.5 w-3.5" />} title={t("actions.hide")} disabled={busy === c.id} onClick={() => void hide(c)} />
              <Button size="sm" variant="ghost" icon={<PaperPlaneTilt className="h-3.5 w-3.5" />} title={t("actions.privateReply")} onClick={() => setReplying(c)} />
            </div>
          </li>
        ))}
      </ul>
      {replying ? <PrivateReplyDialog accountId={accountId} comment={replying} onClose={() => setReplying(null)} /> : null}
    </>
  );
}

function PrivateReplyDialog({ accountId, comment, onClose }: { accountId: string; comment: AnalyzedComment; onClose: () => void }) {
  const t = useTranslations("commentAnalysis.authors.privateReply");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    const result = await privateReplyInstagramCommentAction(accountId, comment.sourceCommentId, text.trim());
    setSending(false);
    if (result.error) {
      setError(result.code === "private_reply_used" ? t("alreadyUsed") : result.error);
      return;
    }
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex w-full max-w-md flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <div className="space-y-3 p-5">
          <blockquote className="rounded-[--radius] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{comment.excerpt}</blockquote>
          <ElevatedTextarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("placeholder")} />
          <p className="text-2xs text-muted-foreground">{t("hint")}</p>
          {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
        </div>
        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button title={sending ? t("sending") : t("send")} variant="primary" disabled={sending || text.trim() === ""} onClick={() => void send()} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
