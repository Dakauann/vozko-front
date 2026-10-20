"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { NotePencil, Trash } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageTime } from "./message-parts";
import { useThreadRow } from "./thread-context";

type NoteThreadRow = Extract<ThreadRow, { kind: "note" }>;

export function NoteRow({ row }: { row: NoteThreadRow }) {
  const t = useTranslations("crmMessage.notes");
  const { messageActions, onDeleteNote } = useThreadRow();
  const [confirming, setConfirming] = useState(false);
  const { note } = row;
  const ownNote = Boolean(messageActions.selfId) && note.author_id === messageActions.selfId;

  return (
    <div data-note-id={note.id} className="flex justify-center pt-1">
      <article
        aria-label={t("label")}
        className="group/note w-full max-w-[85%] rounded-lg border border-dashed border-border-strong bg-muted px-3 py-2 text-foreground"
      >
        <header className="mb-1 flex items-center gap-1.5 text-2xs">
          <NotePencil weight="bold" aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t("label")}</span>
          <span aria-hidden className="text-muted-foreground">·</span>
          <span className="truncate font-semibold">{note.author_name || <EmptyValue />}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
            <time dateTime={note.created_at}>
              <MessageTime iso={note.created_at} />
            </time>
            {ownNote ? (
              <button
                type="button"
                aria-label={t("delete")}
                onClick={() => setConfirming(true)}
                className="flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 hover:bg-border focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/note:opacity-100"
              >
                <Trash weight="bold" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>
        </header>
        <p className="select-text whitespace-pre-wrap break-words text-sm leading-relaxed">{note.body}</p>
      </article>
      {ownNote ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t("deleteTitle")}
          description={t("deleteDescription")}
          confirmLabel={t("delete")}
          onConfirm={() => onDeleteNote(note.id)}
        />
      ) : null}
    </div>
  );
}
