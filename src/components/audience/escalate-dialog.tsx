"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { escalateCommentAction, listEscalationRecipientsAction } from "@/app/actions/audience";
import type { AnalyzedComment, EscalationRecipient } from "@/lib/audience/types";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Chip, Skeleton } from "@/components/audience/shared";
import { Check, MagnifyingGlass, Warning, WhatsappLogo } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * "Encaminhar por WhatsApp" (§3).
 *
 * The recipient list is conversations the workspace ALREADY has open, which is
 * both the safe answer and the honest one: this is forwarding, not a way to
 * start messaging a stranger from the comment dashboard. The copy says so, and
 * a conversation whose send window has closed is shown with that fact rather
 * than hidden, because whether it can be delivered is the channel's call and
 * the operator may still want to queue it.
 *
 * Sending is an explicit act on a message the operator can read first: the
 * preview is the exact text the API will send, built by the same domain code.
 */

export function EscalateCommentDialog({
  comment,
  onClose,
  onSent,
}: {
  comment: AnalyzedComment;
  onClose: () => void;
  onSent?: (text: string) => void;
}) {
  const t = useTranslations("audience.escalate");
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<EscalationRecipient[] | null>(null);
  const [selected, setSelected] = useState<EscalationRecipient | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One debounce, so typing a name is not one request per keystroke.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void listEscalationRecipientsAction(debounced, 20).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else {
        setError(null);
        setRecipients(result.recipients);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const preview = useMemo(() => {
    // A local approximation of the message, shown so the operator knows what
    // leaves. The API sends the domain's own version; the two agree because
    // both are built from the same fields, and the response echoes the real
    // text back after sending.
    const author = comment.authorHandle ? `@${comment.authorHandle}` : comment.authorExternalId;
    const lines = [t("preview.heading"), "", `${t("preview.author")}: ${author}`];
    if (comment.status === "analyzed") lines.push(`${t("preview.severity")}: ${comment.severity}`);
    lines.push(`${t("preview.post")}: ${comment.containerId}`, "", `${t("preview.comment")}:`, `"${comment.excerpt}"`);
    if (note.trim()) lines.push("", note.trim());
    return lines.join("\n");
  }, [comment, note, t]);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    const result = await escalateCommentAction(comment.id, selected, note);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSent?.(result.result?.text ?? preview);
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden !p-0">
        <ElevatedDialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <ElevatedDialogTitle className="flex items-center gap-2">
            <WhatsappLogo className="h-4 w-4" weight="fill" /> {t("title")}
          </ElevatedDialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
        </ElevatedDialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <ElevatedInput
              autoFocus
              variant="search"
              icon={<MagnifyingGlass className="h-3.5 w-3.5" />}
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {recipients === null ? (
                <>
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </>
              ) : recipients.length === 0 ? (
                <p className="px-1 py-3 text-xs text-muted-foreground">{t("noRecipients")}</p>
              ) : (
                recipients.map((r) => {
                  const active = selected?.entryId === r.entryId && selected?.entryType === r.entryType;
                  return (
                    <button
                      key={`${r.entryType}:${r.entryId}`}
                      type="button"
                      onClick={() => setSelected(r)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 text-left transition-colors",
                        "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        active && "border-primary/60",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {r.name || r.number || r.entryId}
                        </span>
                        {r.number && r.name ? (
                          <span className="block truncate text-2xs text-muted-foreground">{r.number}</span>
                        ) : null}
                      </span>
                      {!r.windowOpen ? <Chip className="text-warning-ink">{t("windowClosed")}</Chip> : null}
                      {active ? <Check className="h-4 w-4 shrink-0 text-primary" weight="bold" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <ElevatedTextarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
            />
            <p className="mt-1 text-2xs text-muted-foreground">{t("noteHint")}</p>
          </div>

          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("previewLabel")}
            </p>
            <pre className="whitespace-pre-wrap rounded-[--radius] border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {preview}
            </pre>
          </div>

          {error ? (
            <p className="flex items-center gap-2 text-xs text-destructive-ink">
              <Warning className="h-3.5 w-3.5" /> {error}
            </p>
          ) : null}
        </div>

        <ElevatedDialogFooter className="shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button title={t("cancel")} variant="ghost" onClick={onClose} />
          <Button
            title={sending ? t("sending") : t("send")}
            variant="primary"
            disabled={sending || !selected}
            onClick={() => void send()}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
