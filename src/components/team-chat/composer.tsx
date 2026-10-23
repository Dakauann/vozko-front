"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Clock, PaperPlaneRight, X } from "@/components/icons";
import { ChatComposerFrame, ChatComposerRow } from "@/components/chat/chat-parts";
import { CHAT_COMPOSER_PANEL } from "@/components/chat/chat-styles";
import { COMPOSER_ICON_BUTTON, COMPOSER_SEND_BUTTON, COMPOSER_TEXTAREA } from "@/components/crm/composer-chrome";
import ScheduleWhenField, { useScheduleWhen } from "@/components/crm/ScheduleWhenField";
import { insertMention, matchingMembers, mentionQuery, mentionsIn, type MentionQuery } from "@/lib/conversations/notes";
import type { SchedulingWindow } from "@/lib/scheduled-messages/types";
import type { TeamChatMessage, TeamChatParticipant } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";


const TEAM_SCHEDULING_WINDOW: SchedulingWindow = { open: true };

const MENTIONS_SHOWN = 6;

export interface ComposedMessage {
  body: string;
  mentions: string[];
  reply_to_id?: string;
}

export function Composer({
  me,
  members,
  replyTo,
  editing,
  canSchedule,
  onCancelReply,
  onCancelEdit,
  onSend,
  onEdit,
  onSchedule,
  onTyping,
}: {
  me: string;
  members: readonly TeamChatParticipant[];
  replyTo: TeamChatMessage | null;
  editing: TeamChatMessage | null;
  canSchedule: boolean;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (message: ComposedMessage) => void;
  onEdit: (message: TeamChatMessage, body: string) => void;
  onSchedule: (message: ComposedMessage, sendAt: Date) => Promise<boolean>;
  onTyping: () => void;
}) {
  const t = useTranslations("teamChat.composer");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const when = useScheduleWhen(TEAM_SCHEDULING_WINDOW);
  const sendAt = when.valid ? when.chosen : null;
  const area = useRef<HTMLTextAreaElement>(null);

  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    setText(editing?.body ?? "");
  }

  const candidates = useMemo(
    () => members.filter((m) => m.user_id !== me).map((m) => ({ userId: m.user_id, name: m.name })),
    [me, members],
  );
  const suggestions = mention ? matchingMembers(candidates, mention.query, MENTIONS_SHOWN) : [];

  const pick = (name: string) => {
    if (!mention) return;
    const next = insertMention(text, mention, name);
    setText(next.text);
    setMention(null);
    requestAnimationFrame(() => area.current?.setSelectionRange(next.caret, next.caret));
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      onEdit(editing, body);
      setText("");
      return;
    }
    const composed: ComposedMessage = { body, mentions: mentionsIn(body, candidates), reply_to_id: replyTo?.id };
    if (scheduling) {
      if (!sendAt) return;
      if (await onSchedule(composed, sendAt)) {
        setText("");
        setScheduling(false);
      }
      return;
    }
    onSend(composed);
    setText("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlight((current) => (current + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(suggestions[Math.min(highlight, suggestions.length - 1)].name);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    if (event.key === "Escape" && (editing || replyTo)) {
      event.preventDefault();
      if (editing) onCancelEdit();
      else onCancelReply();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <ChatComposerFrame>
      {replyTo || editing ? (
        <div className={cn(CHAT_COMPOSER_PANEL, "flex items-center gap-2 py-1.5")}>
          <span aria-hidden className="h-6 w-0.5 shrink-0 rounded-full bg-foreground/60" />
          <span className="min-w-0 flex-1">
            <span className="block text-2xs font-semibold text-foreground">
              {editing ? t("editing") : t("replyingTo", { name: replyTo?.author_name ?? "" })}
            </span>
            <span className="block truncate text-2xs text-muted-foreground">{(editing ?? replyTo)?.body}</span>
          </span>
          <button type="button" onClick={editing ? onCancelEdit : onCancelReply} aria-label={t("cancel")} title={t("cancel")} className={COMPOSER_ICON_BUTTON}>
            <X weight="bold" className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {scheduling && !editing ? (
        <div className={cn(CHAT_COMPOSER_PANEL, "py-2")}>
          <ScheduleWhenField when={when} />
          {when.clientError ? <p className="mt-1 text-2xs text-destructive">{when.clientError}</p> : null}
        </div>
      ) : null}
      <ChatComposerRow
        start={
          canSchedule && !editing ? (
            <button
              type="button"
              onClick={() => setScheduling((on) => !on)}
              aria-pressed={scheduling}
              aria-label={t("schedule")}
              title={t("schedule")}
              className={cn(COMPOSER_ICON_BUTTON, scheduling && "bg-muted text-foreground")}
            >
              <Clock weight="bold" className="h-5 w-5" />
            </button>
          ) : null
        }
        field={
          <>
            {suggestions.length > 0 ? (
              <ul role="listbox" aria-label={t("mentions")} className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-48 overflow-y-auto rounded-[--radius] border border-border bg-popover p-1 shadow-md">
                {suggestions.map((candidate, index) => (
                  <li key={candidate.userId} role="option" aria-selected={index === highlight}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pick(candidate.name);
                      }}
                      className={cn("w-full rounded-[--radius] px-2 py-1.5 text-left text-sm text-foreground", index === highlight && "bg-accent-hover")}
                    >
                      {candidate.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              ref={area}
              rows={1}
              value={text}
              aria-label={t("label")}
              placeholder={scheduling ? t("schedulePlaceholder") : t("placeholder")}
              spellCheck
              autoCapitalize="sentences"
              onChange={(event) => {
                setText(event.target.value);
                setMention(mentionQuery(event.target.value, event.target.selectionStart ?? event.target.value.length));
                setHighlight(0);
                if (!editing) onTyping();
              }}
              onKeyDown={onKeyDown}
              className={cn("block", COMPOSER_TEXTAREA)}
            />
          </>
        }
        send={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={text.trim() === "" || (scheduling && !sendAt)}
            aria-label={editing ? t("saveEdit") : scheduling ? t("scheduleSend") : t("send")}
            title={editing ? t("saveEdit") : scheduling ? t("scheduleSend") : t("send")}
            className={COMPOSER_SEND_BUTTON}
          >
            {scheduling && !editing ? <Clock weight="bold" className="h-5 w-5" /> : <PaperPlaneRight weight="fill" className="h-5 w-5" />}
          </button>
        }
      />
    </ChatComposerFrame>
  );
}
