"use client";

import { useCallback, useId, useImperativeHandle, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { useTranslations } from "next-intl";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { createConversationNoteAction, uploadNoteImageAction } from "@/app/actions/conversation-notes";
import { CircleNotch, Image as ImageIcon, NotePencil } from "@/components/icons";
import { memberDisplayName, useAssignableMembers } from "@/hooks/use-assignable-members";
import { useComposerAttachments, type AttachmentUploader } from "@/hooks/use-composer-attachments";
import { rememberNote } from "@/hooks/use-conversation-notes";
import { readDraft, useDraftAutosave, useDraftScope } from "@/hooks/use-conversation-drafts";
import { clipboardFiles } from "@/lib/conversations/clipboard-files";
import { attachmentsReady, type ComposerAttachment } from "@/lib/conversations/composer-attachments";
import {
  insertMention,
  matchingMembers,
  mentionQuery,
  mentionsIn,
  type MentionCandidate,
  type MentionQuery,
} from "@/lib/conversations/notes";
import type { EntryType } from "@/lib/conversations/types";
import { windowKey } from "@/lib/conversations/window-deck";
import { cn } from "@/lib/utils";

import { ComposerAttachmentStrip } from "./ComposerAttachmentStrip";

export interface NoteFieldControl {
  attachFiles: (files: File[]) => void;
}

interface ComposerNoteFieldProps {
  entryId: string;
  entryType: EntryType;
  onEscape: () => void;
  controlRef?: Ref<NoteFieldControl>;
}

const NO_DRAFT_ATTACHMENTS: never[] = [];
const NO_ATTACHMENTS: ComposerAttachment[] = [];
const admitEveryFile = () => true;

export function ComposerNoteField({ entryId, entryType, onEscape, controlRef }: ComposerNoteFieldProps) {
  const t = useTranslations("crmMessage");
  const entryKey = windowKey(entryId, entryType);
  const draftScope = useDraftScope();
  const [text, setText] = useState(() => readDraft(draftScope, entryKey, "note")?.text ?? "");
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [saving, setSaving] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const discardDraft = useDraftAutosave(entryKey, { text, attachments: NO_DRAFT_ATTACHMENTS }, "note");
  const { members } = useAssignableMembers(true);
  const candidates = useMemo<MentionCandidate[]>(
    () => members.map((member) => ({ userId: member.userId, name: memberDisplayName(member) })),
    [members],
  );
  const suggestions = mention ? matchingMembers(candidates, mention.query) : [];
  const picking = mention !== null;

  const errorCopy = useCallback(
    (code: string | undefined, fallback: "notes.saveFailed" | "notes.imageUploadFailed") =>
      code && t.has(`notes.errors.${code}`) ? t(`notes.errors.${code}`) : t(fallback),
    [t],
  );

  const uploadImage = useCallback<AttachmentUploader>(
    async (file) => {
      const result = await uploadNoteImageAction(entryType, entryId, file);
      return result.image ? { mediaId: result.image.id } : { mediaId: null, error: errorCopy(result.code, "notes.imageUploadFailed") };
    },
    [entryId, entryType, errorCopy],
  );

  const { attachments, attachFiles, remove, clearAll } = useComposerAttachments({
    entryType,
    entryId,
    initial: NO_ATTACHMENTS,
    admit: admitEveryFile,
    upload: uploadImage,
  });

  const addFiles = useCallback(
    (files: readonly File[]) => {
      if (files.length > 0) void attachFiles(files);
    },
    [attachFiles],
  );

  useImperativeHandle(controlRef, () => ({ attachFiles: addFiles }), [addFiles]);

  const { getRootProps, getInputProps, isDragActive, open: pickImages } = useDropzone({
    onDrop: addFiles,
    noClick: true,
    noKeyboard: true,
    multiple: true,
    noDragEventsBubbling: true,
  });

  const body = text.trim();
  const savable = (body !== "" || attachments.length > 0) && attachmentsReady(attachments) && !saving;

  const trackMention = (value: string, caret: number) => {
    const next = mentionQuery(value, caret);
    setMention(next);
    if (next?.query !== mention?.query) setHighlighted(0);
  };

  const choose = (candidate: MentionCandidate) => {
    if (!mention) return;
    const next = insertMention(text, mention, candidate.name);
    setText(next.text);
    setMention(null);
    requestAnimationFrame(() => {
      fieldRef.current?.focus();
      fieldRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const save = async () => {
    if (!savable) return;
    setSaving(true);
    const imageIds = attachments.flatMap((attachment) => (attachment.mediaId ? [attachment.mediaId] : []));
    const result = await createConversationNoteAction(entryType, entryId, body, mentionsIn(body, candidates), imageIds);
    setSaving(false);
    if (!result.note) {
      toast.error(errorCopy(result.code, "notes.saveFailed"));
      return;
    }
    rememberNote(result.note);
    discardDraft();
    setText("");
    clearAll();
    setMention(null);
    fieldRef.current?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = clipboardFiles(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (picking && suggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlighted((current) => (current + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(suggestions[Math.min(highlighted, suggestions.length - 1)]);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (picking) setMention(null);
      else onEscape();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div {...getRootProps({ className: "flex items-end gap-2 px-2 py-2 sm:px-3" })}>
      <input {...getInputProps({ accept: "image/*" })} aria-label={t("composer.addNoteImage")} />
      <div
        className={cn(
          "relative min-w-0 flex-1 rounded-[--radius] border border-dashed border-border-strong bg-muted px-1.5 py-1 transition-colors duration-150",
          isDragActive && "border-primary bg-background",
        )}
      >
        {picking ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("composer.mentions")}
            className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-[--radius] border border-border-strong bg-popover p-1 shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">{t("composer.noMembers")}</li>
            ) : (
              suggestions.map((candidate, index) => (
                <li
                  key={candidate.userId}
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(candidate);
                  }}
                  className={cn(
                    "cursor-pointer truncate rounded-[--radius] px-2 py-1.5 text-xs text-foreground",
                    index === highlighted && "bg-[hsl(var(--accent-hover))]",
                  )}
                >
                  {candidate.name}
                </li>
              ))
            )}
          </ul>
        ) : null}
        <ComposerAttachmentStrip attachments={attachments} onRemove={remove} />
        <textarea
          ref={fieldRef}
          rows={2}
          value={text}
          aria-label={t("composer.note")}
          aria-controls={picking ? listId : undefined}
          placeholder={t("composer.notePlaceholder")}
          onChange={(event) => {
            setText(event.target.value);
            trackMention(event.target.value, event.target.selectionStart);
          }}
          onSelect={(event) => trackMention(event.currentTarget.value, event.currentTarget.selectionStart)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="block max-h-[120px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm font-medium leading-snug text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
        />
        <div className="flex items-center gap-2 pb-0.5 pl-2">
          <p className="min-w-0 flex-1 text-2xs text-muted-foreground">{isDragActive ? t("composer.dropNoteImages") : t("composer.noteHint")}</p>
          <button
            type="button"
            onClick={pickImages}
            aria-label={t("composer.addNoteImage")}
            title={t("composer.addNoteImage")}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ImageIcon weight="bold" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={!savable}
        aria-label={t("composer.saveNote")}
        title={t("composer.saveNote")}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50"
      >
        {saving ? <CircleNotch weight="bold" className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <NotePencil weight="fill" className="h-5 w-5" />}
      </button>
    </div>
  );
}
