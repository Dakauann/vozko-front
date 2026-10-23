"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowBendUpLeft,
  ClipboardText,
  Clock,
  Lightning,
  Microphone,
  PaperPlaneRight,
  PaperPlaneTilt,
  Paperclip,
  Warning,
  X,
} from "@/components/icons";
import {
  channelCapabilities,
  type EntryType,
  type MediaType,
  type WindowClosedReason,
  type WindowTier,
} from "@/lib/conversations/types";
import { textLimitState } from "@/lib/conversations/text-limit";
import { windowClosedCopyKey } from "@/lib/conversations/window-closed";
import { mediaLabelKey } from "@/lib/conversations/thread-labels";
import {
  attachmentsReady,
  fromDraftAttachments,
  hasCaptionTarget,
  planOutgoing,
  toDraftAttachments,
} from "@/lib/conversations/composer-attachments";
import type { ReplyTarget } from "@/lib/conversations/drafts";
import { insertAtSelection } from "@/lib/conversations/composer-format";
import { clipboardFiles } from "@/lib/conversations/clipboard-files";
import { windowKey } from "@/lib/conversations/window-deck";
import { resolveShortcutVariables, unresolvedVariables } from "@/lib/message-shortcuts/variables";
import { FacebookThreadBanner } from "./FacebookThreadBanner";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import ElevatedSwitch from "../elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import type { MessageShortcut } from "@/lib/message-shortcuts/types";
import MessageShortcutSheet from "@/components/message-shortcuts/MessageShortcutSheet";
import type { SendButtonWsInput } from "@/hooks/use-conversation-ws";
import { ShieldWarning } from "@/components/icons";
import ShortcutPicker from "./ShortcutPicker";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useComposerFormatting } from "@/hooks/use-composer-formatting";
import { useAttachmentAdmission } from "@/hooks/use-attachment-admission";
import { useComposerAttachments } from "@/hooks/use-composer-attachments";
import { readDraft, useDraftAutosave, useDraftScope } from "@/hooks/use-conversation-drafts";
import { useShortcutVariableValues } from "@/hooks/use-shortcut-variable-values";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useVoiceRecorder, type VoiceRecorderErrorCode } from "@/hooks/use-voice-recorder";
import { VoiceRecordingBar } from "@/components/media/voice-recording-bar";
import { DESKTOP_QUERY, FINE_POINTER_QUERY } from "@/hooks/use-media-query";
import { ComposerFormatPreview, ComposerPreviewToggle } from "./ComposerFormatPreview";
import { ComposerAttachmentStrip } from "./ComposerAttachmentStrip";
import { ComposerEmojiPicker } from "./ComposerEmojiPicker";
import { ComposerUnresolvedVariables } from "./ComposerUnresolvedVariables";
import { TextLimitFeedback } from "./TextLimitFeedback";
import { ComposerModeSwitch, type ComposerMode } from "./ComposerModeSwitch";
import { ComposerNoteField, type NoteFieldControl } from "./ComposerNoteField";
import { useEntryConversation } from "@/hooks/use-entry-conversation";
import { useMessageActions } from "@/hooks/use-message-actions";
import { editingMessageOf, startEditing, stopEditing } from "@/hooks/use-message-editing";
import { COMPOSER_BOX, COMPOSER_ICON_BUTTON, COMPOSER_ROW, COMPOSER_SEND_BUTTON, COMPOSER_TEXTAREA } from "./composer-chrome";

export interface ComposerDraft {
  text: string;
  mediaId?: string;
  mediaType?: MediaType;
  mediaName?: string;
  replyToMessageId?: string;
  signed: boolean;
}

interface CrmMessageInputProps {
  entryType: EntryType;
  entryId: string;
  onSend: (text: string, signed: boolean, replyToMessageId?: string) => void;
  onSendMedia: (
    text: string,
    mediaId: string,
    mediaType: MediaType,
    signed: boolean,
    replyToMessageId?: string,
  ) => void;
  onSendButton?: (input: SendButtonWsInput, replyToMessageId?: string) => void;
  onSendAndFinish?: () => void;
  onTyping: (isTyping: boolean) => void;
  windowOpen: boolean;
  windowExpiresAt: string | null;
  windowClosedReason?: WindowClosedReason | null;
  windowClosedDetail?: string | null;
  windowTier?: WindowTier | null;
  onSchedule?: (draft: ComposerDraft, onScheduled: () => void) => void;
  onScheduleTemplate?: () => void;
  onSendTemplateNow?: () => void;
  onSendForm?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  replyToMessage?: ReplyTarget | null;
  onClearReply?: () => void;
  controlRef?: Ref<ComposerControl>;
  focusOnOpen?: boolean;
  translations: {
    placeholder: string;
    windowClosed: string;
    windowClosedDescription: string;
    windowClosedNoClock: string;
    sendButton: string;
    attachFile: string;
    recording: string;
    uploading: string;
    windowExpires: string;
  };
}

export interface ComposerControl {
  focus: () => void;
  attachFiles: (files: File[]) => void;
}

const ICON_BUTTON_CLASS = COMPOSER_ICON_BUTTON;

const SIGNED_PREFERENCE_KEY = "sendSigned";

type RemainingWindow = {
  hours: number;
  minutes: number;
};

function remainingWindow(expiresAt: string | null): RemainingWindow | null {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  return { hours: Math.floor(remaining / 3_600_000), minutes: Math.floor((remaining % 3_600_000) / 60_000) };
}

function readSignedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSignedPreference(signed: boolean) {
  try {
    window.localStorage.setItem(SIGNED_PREFERENCE_KEY, String(signed));
  } catch {
    return;
  }
}

function opensWithKeyboardFocus(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches && window.matchMedia(FINE_POINTER_QUERY).matches;
}

function isShortcutCommand(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith("/") && !trimmed.includes(" ");
}

export default function CrmMessageInput(props: CrmMessageInputProps) {
  return <EntryComposer key={`${props.entryType}:${props.entryId}`} {...props} />;
}

function EntryComposer({
  entryType,
  entryId,
  onSend,
  onSendMedia,
  onSendButton,
  onSendAndFinish,
  onTyping,
  windowOpen,
  windowExpiresAt,
  windowClosedReason,
  windowClosedDetail = null,
  windowTier,
  onSchedule,
  onScheduleTemplate,
  onSendTemplateNow,
  onSendForm,
  disabled = false,
  disabledReason,
  replyToMessage,
  onClearReply,
  controlRef,
  focusOnOpen = false,
  translations: t,
}: CrmMessageInputProps) {
  const { can } = useWorkspace();
  const crmT = useTranslations("crm");
  const composerT = useTranslations("crmComposer");
  const scheduleT = useTranslations("scheduledMessages");
  const conversationWindowT = useTranslations("conversationWindow");
  const shortcutPageT = useTranslations("messageShortcutsPage");
  const threadT = useTranslations("crmConversation.thread");
  const recorderT = useTranslations("voiceRecorder");
  const entryKey = windowKey(entryId, entryType);
  const [mode, setMode] = useState<ComposerMode>("message");
  const entryConversation = useEntryConversation(entryId, entryType);
  const messageActions = useMessageActions(entryConversation);
  const admission = useAttachmentAdmission(entryId, entryType);
  const draftScope = useDraftScope();
  const [restored] = useState(() => readDraft(draftScope, entryKey));
  const [text, setText] = useState(restored?.text ?? "");
  const [shortcutPickerVisible, setShortcutPickerVisible] = useState(false);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);
  const [shortcutRefreshToken, setShortcutRefreshToken] = useState(0);
  const [shortcutDraftValue, setShortcutDraftValue] = useState("");
  const [autoSendCreatedShortcut, setAutoSendCreatedShortcut] = useState(false);
  const [sendSigned, setSendSigned] = useState(readSignedPreference);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaElement, setTextareaElement] = useState<HTMLTextAreaElement | null>(null);
  const attachTextarea = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    setTextareaElement(node);
  }, []);
  const [previewing, setPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteControlRef = useRef<NoteFieldControl | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTypingRef = useRef(onTyping);
  const variableValues = useShortcutVariableValues(entryId, entryType);

  const { attachments, attachFiles, attachFromUrl, remove: removeAttachment, clearAll: clearAttachments } =
    useComposerAttachments({
      entryType,
      entryId,
      initial: restored ? fromDraftAttachments(restored.attachments) : [],
      admit: admission.admit,
    });

  const discardDraft = useDraftAutosave(entryKey, {
    text,
    attachments: toDraftAttachments(attachments),
    ...(replyToMessage ? { reply: pickReply(replyToMessage) } : {}),
  });

  const attachRecording = useCallback((file: File) => void attachFiles([file]), [attachFiles]);
  const reportRecorderFailure = useCallback(
    (code: VoiceRecorderErrorCode) => toast.error(recorderT(`errors.${code}`)),
    [recorderT],
  );
  const recorder = useVoiceRecorder(attachRecording, { onError: reportRecorderFailure });

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const handleTyping = useCallback(() => {
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  }, [onTyping]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        onTypingRef.current(false);
      }
    },
    [],
  );

  const [windowRemaining, setWindowRemaining] = useState<RemainingWindow | null>(remainingWindow(windowExpiresAt));

  useEffect(() => {
    if (!windowExpiresAt || !windowOpen) return;
    const interval = setInterval(() => setWindowRemaining(remainingWindow(windowExpiresAt)), 30_000);
    setWindowRemaining(remainingWindow(windowExpiresAt));
    return () => clearInterval(interval);
  }, [windowExpiresAt, windowOpen]);

  const handleSendSignedToggle = useCallback((active: boolean) => {
    writeSignedPreference(active);
    setSendSigned(active);
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text, attachments.length]);

  const focusTextarea = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const clearComposer = useCallback(() => {
    clearAttachments();
    setText("");
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    focusTextarea();
  }, [clearAttachments, focusTextarea, onTyping]);

  const captionAllowed = hasCaptionTarget(attachments);
  const firstReadyAttachment = attachments.find((attachment) => attachment.status === "ready" && attachment.mediaId);

  const handleSchedule = useCallback(() => {
    if (!onSchedule) return;
    onSchedule(
      {
        text: text.trim(),
        mediaId: firstReadyAttachment?.mediaId,
        mediaType: firstReadyAttachment?.type,
        mediaName: firstReadyAttachment?.name,
        replyToMessageId: replyToMessage?.id,
        signed: sendSigned,
      },
      clearComposer,
    );
  }, [clearComposer, firstReadyAttachment, onSchedule, replyToMessage, sendSigned, text]);

  const limitState = textLimitState(text, channelCapabilities.textLimit(entryType));
  const overLimit = limitState?.refused ?? false;
  const unresolved = unresolvedVariables(text);
  const hasContent = text.trim().length > 0 || attachments.length > 0;

  const canSend =
    !disabled && windowOpen && !overLimit && unresolved.length === 0 && attachmentsReady(attachments) && hasContent;
  const schedulable =
    !disabled &&
    unresolved.length === 0 &&
    attachmentsReady(attachments) &&
    attachments.length <= 1 &&
    (captionAllowed || !text.trim());

  const sendComposed = useCallback((): boolean => {
    if (!canSend) return false;
    const parts = planOutgoing(text, attachments, replyToMessage?.id);
    if (parts.length === 0) return false;
    for (const part of parts) {
      if (part.kind === "text") onSend(part.text, sendSigned, part.replyToMessageId);
      else onSendMedia(part.caption, part.mediaId, part.mediaType, sendSigned, part.replyToMessageId);
    }
    onClearReply?.();
    discardDraft();
    clearComposer();
    return true;
  }, [attachments, canSend, clearComposer, discardDraft, onClearReply, onSend, onSendMedia, replyToMessage, sendSigned, text]);

  const handleSend = useCallback(() => {
    sendComposed();
  }, [sendComposed]);

  const handleSendAndFinish = useCallback(() => {
    if (sendComposed()) onSendAndFinish?.();
  }, [onSendAndFinish, sendComposed]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shortcutPickerVisible && ["Enter", "Tab", "ArrowUp", "ArrowDown", "Escape"].includes(e.key)) return;
    if (e.key === "Escape" && editingMessageOf(entryKey)) {
      e.preventDefault();
      e.stopPropagation();
      stopEditing(entryKey);
      return;
    }
    if (e.key === "ArrowUp" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !text && attachments.length === 0) {
      const editable = entryConversation ? messageActions.lastEditable(entryConversation.messages) : null;
      if (!editable) return;
      e.preventDefault();
      startEditing(entryKey, editable.id);
      return;
    }
    if (e.key === "Escape" && replyToMessage && onClearReply) {
      e.preventDefault();
      e.stopPropagation();
      onClearReply();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      handleTyping();
      if (isShortcutCommand(value)) {
        setShortcutPickerVisible(true);
        setShortcutQuery(value.trimStart().slice(1));
      } else {
        setShortcutPickerVisible(false);
        setShortcutQuery("");
      }
    },
    [handleTyping],
  );

  const placeCaretAtEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, []);

  const sendButtonShortcut = useCallback(
    (shortcut: MessageShortcut) => {
      const resolve = (value?: string) => (value ? resolveShortcutVariables(value, variableValues) : null);
      const body = resolve(shortcut.content.text);
      const header = resolve(shortcut.content.headerText);
      const footer = resolve(shortcut.content.footerText);
      const missing = [...new Set([body, header, footer].flatMap((part) => part?.unresolved ?? []))];
      if (missing.length > 0) {
        toast.error(composerT("variables.blockedToast", { variables: missing.map((name) => `{{${name}}}`).join(", ") }));
        return;
      }
      if (!onSendButton || !body?.text || !shortcut.content.buttons?.length) return;
      onSendButton(
        {
          headerType: shortcut.content.headerType,
          headerText: header?.text,
          bodyText: body.text,
          footerText: footer?.text,
          buttons: shortcut.content.buttons,
        },
        replyToMessage?.id,
      );
      onClearReply?.();
    },
    [composerT, onSendButton, onClearReply, replyToMessage, variableValues],
  );

  const handleShortcutSelect = useCallback(
    (shortcut: MessageShortcut) => {
      setShortcutPickerVisible(false);
      setShortcutQuery("");

      if (shortcut.messageType === "button") {
        setText("");
        sendButtonShortcut(shortcut);
        focusTextarea();
        return;
      }

      setText(resolveShortcutVariables(shortcut.content.text ?? "", variableValues).text);
      handleTyping();
      if (shortcut.messageType === "media" && shortcut.content.mediaUrl) {
        void attachFromUrl(shortcut.content.mediaUrl, shortcut.content.mediaType);
      }
      placeCaretAtEnd();
    },
    [attachFromUrl, focusTextarea, handleTyping, placeCaretAtEnd, sendButtonShortcut, variableValues],
  );

  const canCreateShortcut = can("message_shortcuts", "create");

  const openShortcutCreator = useCallback(
    (rawShortcut?: string, autoSend = false) => {
      if (!canCreateShortcut) return;
      const normalized = (rawShortcut || "").replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]/g, "");
      setShortcutDraftValue(normalized);
      setAutoSendCreatedShortcut(autoSend);
      setShortcutSheetOpen(true);
      setShortcutPickerVisible(false);
    },
    [canCreateShortcut],
  );

  const acceptsFiles = !disabled && windowOpen;

  const addFiles = useCallback(
    (files: File[]) => {
      if (!acceptsFiles || files.length === 0) return;
      void attachFiles(files);
    },
    [acceptsFiles, attachFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!acceptsFiles) return;
      const files = clipboardFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    },
    [acceptsFiles, addFiles],
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      const selection = textarea
        ? { text, start: textarea.selectionStart, end: textarea.selectionEnd }
        : { text, start: text.length, end: text.length };
      const next = insertAtSelection(selection, emoji);
      setText(next.text);
      handleTyping();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(next.start, next.end);
      });
    },
    [handleTyping, text],
  );

  const closedCopy = (() => {
    if (windowClosedReason) {
      const key = windowClosedCopyKey(entryType, windowClosedReason, windowClosedDetail) as "closed.expired";
      if (conversationWindowT.has(key)) return conversationWindowT(key);
    }
    return windowExpiresAt ? t.windowClosedDescription : t.windowClosedNoClock;
  })();

  const humanOnly = windowOpen && windowTier === "human_agent";
  const humanOnlyUntil = windowExpiresAt ? new Date(windowExpiresAt).toLocaleString() : null;
  const textEditable = !disabled && windowOpen;

  useComposerFormatting({
    textarea: textareaElement,
    enabled: textEditable && !previewing,
    onText: handleTextChange,
  });

  useShortcuts(
    "composer",
    { "composer.sendAndFinish": () => (onSendAndFinish ? handleSendAndFinish() : false) },
    { element: textareaElement, enabled: Boolean(onSendAndFinish) },
  );

  useImperativeHandle(
    controlRef,
    () => ({
      focus: () => textareaRef.current?.focus(),
      attachFiles: (files: File[]) => (mode === "note" ? noteControlRef.current?.attachFiles(files) : addFiles(files)),
    }),
    [addFiles, mode],
  );

  useEffect(() => {
    if (focusOnOpen && opensWithKeyboardFocus()) textareaRef.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  const togglePreview = useCallback(() => {
    setPreviewing((current) => !current);
    focusTextarea();
  }, [focusTextarea]);

  return (
    <div className="vz-composer relative flex-shrink-0">
      <div className="relative">
        {disabled && disabledReason && (
          <div className="flex justify-center px-4 pt-2">
            <div className="flex max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 shadow-md">
              <ShieldWarning weight="fill" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <p className="truncate text-2xs font-medium text-foreground">{disabledReason}</p>
            </div>
          </div>
        )}

        {!windowOpen && (
          <div className="flex justify-center px-4 pt-2">
            <div className="flex max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 shadow-md">
              <Warning weight="fill" className="h-4 w-4 flex-shrink-0 text-warning-ink" />
              <div className="min-w-0">
                <p className="text-2xs font-semibold text-foreground">{t.windowClosed}</p>
                <p className="truncate text-2xs text-muted-foreground">{closedCopy}</p>
              </div>
            </div>
          </div>
        )}

        {entryType === "facebook" && <FacebookThreadBanner entryId={entryId} canSend={!disabled} />}

        {humanOnly && (
          <div className="flex justify-center px-4 pt-2">
            <div className="flex max-w-[92%] items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-2 shadow-md">
              <Clock weight="fill" className="h-4 w-4 flex-shrink-0 text-warning-ink" />
              <p className="text-2xs font-medium text-foreground">
                {humanOnlyUntil
                  ? conversationWindowT("tier.humanAgent", { date: humanOnlyUntil })
                  : conversationWindowT("tier.humanAgentNoDate")}
              </p>
            </div>
          </div>
        )}

        {windowOpen && !humanOnly && windowRemaining && (
          <div className="flex justify-center px-4 pt-2">
            <div className="flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 py-1 shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-healthy" />
              <span className="text-2xs font-medium text-foreground">
                {t.windowExpires}:{" "}
                {windowRemaining.hours > 0
                  ? composerT("windowRemaining.hours", windowRemaining)
                  : composerT("windowRemaining.minutes", windowRemaining)}
              </span>
            </div>
          </div>
        )}

        {!recorder.isRecording && <ComposerModeSwitch mode={mode} onChange={setMode} />}

        {mode === "note" ? (
          <ComposerNoteField entryId={entryId} entryType={entryType} onEscape={() => setMode("message")} controlRef={noteControlRef} />
        ) : (
          <>
            <ComposerAttachmentStrip attachments={attachments} onRemove={removeAttachment} />

            <AnimatePresence>
              {recorder.isRecording && (
                <VoiceRecordingBar
                  duration={recorder.duration}
                  levels={recorder.levels}
                  onCancel={recorder.cancel}
                  onStop={recorder.stop}
                  labels={{ cancel: composerT("recording.cancel"), stop: composerT("recording.stop") }}
                />
              )}
            </AnimatePresence>

            {!recorder.isRecording && (
              <>
                <AnimatePresence>
                  {replyToMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden border-b border-border"
                    >
                      <div className="flex items-center gap-2 bg-muted px-4 py-2">
                        <ArrowBendUpLeft weight="bold" className="h-4 w-4 flex-shrink-0 text-primary-ink" />
                        <div className="min-w-0 flex-1 rounded-md border-l-[3px] border-info bg-card px-2.5 py-1.5">
                          <p className="truncate text-2xs font-semibold text-primary-ink">
                            {replyToMessage.sender_name || replyToMessage.from}
                          </p>
                          <p className="truncate text-2xs text-muted-foreground">
                            {replyToMessage.media_type
                              ? `📎 ${threadT(`media.${mediaLabelKey(replyToMessage.media_type)}`)}`
                              : replyToMessage.text || "..."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onClearReply}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-border"
                          aria-label={crmT("cancelReply")}
                        >
                          <X weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={admission.accept}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className={COMPOSER_ROW}>
                  <div className={COMPOSER_BOX}>
                    <div className="vz-composer-tools-start flex flex-wrap items-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!acceptsFiles || !admission.takesAttachments}
                        aria-label={t.attachFile}
                        className={ICON_BUTTON_CLASS}
                      >
                        <Paperclip weight="bold" className="h-5 w-5" />
                      </button>

                      <ComposerEmojiPicker disabled={!textEditable} onPick={insertEmoji} onClosed={focusTextarea} />

                      {onSchedule && windowOpen ? (
                        <button
                          type="button"
                          onClick={handleSchedule}
                          disabled={!schedulable}
                          aria-label={scheduleT("composer.scheduleAria")}
                          title={scheduleT("composer.scheduleAria")}
                          className={ICON_BUTTON_CLASS}
                        >
                          <Clock weight="bold" className="h-5 w-5" />
                        </button>
                      ) : null}

                      {!windowOpen && onScheduleTemplate ? (
                        <button
                          type="button"
                          onClick={onScheduleTemplate}
                          disabled={disabled}
                          aria-label={scheduleT("composer.scheduleTemplateAria")}
                          title={scheduleT("composer.scheduleTemplateAria")}
                          className={ICON_BUTTON_CLASS}
                        >
                          <Clock weight="bold" className="h-5 w-5" />
                        </button>
                      ) : null}

                      {!windowOpen && onSendTemplateNow ? (
                        <button
                          type="button"
                          onClick={onSendTemplateNow}
                          disabled={disabled}
                          aria-label={composerT("sendTemplateNow")}
                          title={composerT("sendTemplateNow")}
                          className={ICON_BUTTON_CLASS}
                        >
                          <PaperPlaneTilt weight="bold" className="h-5 w-5" />
                        </button>
                      ) : null}

                      {onSendForm ? (
                        <button
                          type="button"
                          onClick={onSendForm}
                          disabled={disabled}
                          aria-label={composerT("form.open")}
                          title={composerT("form.open")}
                          className={ICON_BUTTON_CLASS}
                        >
                          <ClipboardText weight="bold" className="h-5 w-5" />
                        </button>
                      ) : null}

                      {canCreateShortcut ? (
                        <button
                          type="button"
                          onClick={() => openShortcutCreator(shortcutQuery || "", false)}
                          aria-label={shortcutPageT("inlineCreateButton")}
                          title={shortcutPageT("inlineCreateButton")}
                          className={ICON_BUTTON_CLASS}
                        >
                          <Lightning weight="fill" className="h-5 w-5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="vz-composer-field relative">
                      <ShortcutPicker
                        query={shortcutQuery}
                        onSelect={handleShortcutSelect}
                        onClose={() => setShortcutPickerVisible(false)}
                        visible={shortcutPickerVisible}
                        canCreate={canCreateShortcut}
                        onCreateShortcut={(value) => openShortcutCreator(value, true)}
                        refreshToken={shortcutRefreshToken}
                      />
                      {previewing ? <ComposerFormatPreview text={text} /> : null}
                      <textarea
                        ref={attachTextarea}
                        rows={1}
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          !captionAllowed ? composerT("audioNoCaption") : windowOpen ? t.placeholder : t.windowClosed
                        }
                        disabled={!textEditable}
                        spellCheck
                        autoCorrect="on"
                        autoCapitalize="sentences"
                        autoComplete="on"
                        className={`${previewing ? "hidden" : "block"} ${COMPOSER_TEXTAREA}`}
                      />
                      <ComposerUnresolvedVariables names={unresolved} />
                      <TextLimitFeedback state={limitState} />
                    </div>

                    <div className="vz-composer-tools-end flex items-center gap-0.5">
                      <ComposerPreviewToggle
                        previewing={previewing}
                        disabled={!previewing && !text.trim()}
                        onToggle={togglePreview}
                      />

                      <div className="flex flex-shrink-0 items-center gap-1 pl-1 pr-0.5">
                        <span className="vz-composer-sign-label whitespace-nowrap text-2xs font-medium text-muted-foreground">
                          {composerT("signLabel")}
                        </span>
                        <ElevatedSwitch
                          onCheckedChange={handleSendSignedToggle}
                          checked={sendSigned}
                          aria-label={composerT("signLabel")}
                          explainer={<ExplainerHint id="crm.signMessage" side="top" align="end" />}
                        />
                      </div>
                    </div>
                  </div>

                  {hasContent || !admission.voiceNotes ? (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSend}
                      aria-label={t.sendButton}
                      className={COMPOSER_SEND_BUTTON}
                    >
                      <PaperPlaneRight weight="fill" className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={recorder.start}
                      disabled={!acceptsFiles}
                      aria-label={t.recording}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:bg-[hsl(var(--primary-hover))] active:scale-95 disabled:opacity-40"
                    >
                      <Microphone weight="fill" className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <MessageShortcutSheet
          open={shortcutSheetOpen}
          onOpenChange={setShortcutSheetOpen}
          defaultShortcut={shortcutDraftValue}
          onSaved={async (shortcut) => {
            setShortcutRefreshToken((current) => current + 1);
            if (autoSendCreatedShortcut) {
              handleShortcutSelect(shortcut);
              return;
            }
            setText(`/${shortcut.shortcut}`);
            setShortcutQuery(shortcut.shortcut);
            setShortcutPickerVisible(true);
            focusTextarea();
          }}
        />
      </div>
    </div>
  );
}

function pickReply({ id, sender_name, from, text, media_type }: ReplyTarget): ReplyTarget {
  return media_type ? { id, sender_name, from, text, media_type } : { id, sender_name, from, text };
}
