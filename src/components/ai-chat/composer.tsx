"use client";

import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import {
  CaretDown,
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  Paperclip,
  Stop,
  Waveform,
  X,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BUTTON_GHOST, BUTTON_PRIMARY } from "@/components/ui/button-surfaces";
import { PANEL_EASE } from "@/components/docks/dock-chrome";
import { ChatModelSelector } from "./chat-model-selector";
import { ChatVisionNotice } from "./vision-notice";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { readChatStreamError } from "@/lib/aichat/chat-stream";
import type { ChatAttachment } from "@/lib/aichat/types";
import { useCallActive } from "@/lib/call-session/call-session-control";
import type { ListenFailure } from "@/lib/voice/browser-speech";
import { appendDictation, speechLang } from "@/lib/voice/speech-text";
import { cn } from "@/lib/utils";

import { AttachmentChip } from "./attachment-chip";
import type { ChatAttachments } from "./use-chat-attachments";
import { useComposerSize, type ComposerResize } from "./use-composer-size";
import type { VoiceMode } from "./voice/use-voice-mode";
import { VoiceStrip } from "./voice/voice-strip";

const ICON_ACTION =
  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] transition-colors duration-DEFAULT disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TOOL_BUTTON = cn(ICON_ACTION, BUTTON_GHOST, "aria-pressed:bg-muted aria-pressed:text-foreground");
const STOP_BUTTON = cn(ICON_ACTION, "border border-control-edge bg-card text-foreground hover:bg-muted");
const SEND_BUTTON = cn(ICON_ACTION, BUTTON_PRIMARY);
const FIELD_TEXT = "px-3.5 py-2.5 text-sm leading-6";

function useDictation(input: string, setInput: (v: string) => void, onFailure: (failure: ListenFailure) => void) {
  const locale = useLocale();
  const draft = useRef(input);
  useEffect(() => {
    draft.current = input;
  }, [input]);
  const onFinal = useCallback(
    (text: string) => {
      draft.current = appendDictation(draft.current, text);
      setInput(draft.current);
    },
    [setInput],
  );
  return useSpeechRecognition({ lang: speechLang(locale), continuous: true, onFinal, onFailure });
}

export function Composer({
  docked,
  placeholder,
  disabled = false,
  input,
  setInput,
  onSend,
  onStop,
  streaming,
  model,
  models,
  pricing,
  onModelChange,
  error,
  showScrollDown,
  onScrollDown,
  voice,
  files,
}: {
  docked: boolean;
  placeholder?: string;
  disabled?: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (attachments: ChatAttachment[]) => boolean;
  onStop: () => void;
  streaming: boolean;
  model: string;
  models: string[];
  pricing: ModelPricingInfo[];
  onModelChange: (m: string) => void;
  error: string | null;
  showScrollDown: boolean;
  onScrollDown: () => void;
  voice?: VoiceMode;
  files: ChatAttachments;
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("aiChatPage");
  const callActive = useCallActive();
  const [dictationFailure, setDictationFailure] = useState<ListenFailure | null>(null);
  const [dropping, setDropping] = useState(false);
  const dictation = useDictation(input, setInput, setDictationFailure);
  const voiceOn = voice !== undefined && voice.phase !== "off";
  const voiceFailure = voice?.failure ?? dictationFailure;

  const toggleDictation = () => {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    setDictationFailure(null);
    dictation.start();
  };

  const toggleVoice = () => {
    if (!voice) return;
    if (voiceOn) {
      voice.disable();
      return;
    }
    dictation.abort();
    voice.enable();
  };

  const { listening: dictating, abort: abortDictation } = dictation;
  useEffect(() => {
    if (callActive && dictating) abortDictation();
  }, [callActive, dictating, abortDictation]);

  const picker = useRef<HTMLInputElement>(null);
  const { field, mirror, resize } = useComposerSize(input);
  const fieldId = useId();
  const canSend = Boolean(input.trim()) && Boolean(model) && !files.uploading && !disabled;

  const acceptsFiles = !disabled;

  const dropFiles = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      if (!acceptsFiles || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDropping(true);
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      setDropping(false);
      if (!acceptsFiles || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      files.add(e.dataTransfer.files);
    },
  };

  const pasteFiles = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!acceptsFiles || e.clipboardData.files.length === 0) return;
    e.preventDefault();
    files.add(e.clipboardData.files);
  };

  const submit = () => {
    if (!canSend) return;
    if (onSend(files.ready)) files.clear();
  };

  const streamError = error ? readChatStreamError(error) : null;

  return (
    <motion.div
      layout={reduceMotion ? false : "position"}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: PANEL_EASE }}
      className={cn(
        "relative shrink-0 px-4",
        docked ? "border-t border-border py-3" : "pb-2 pt-0",
      )}
    >
      {showScrollDown && docked ? (
        <button
          type="button"
          onClick={onScrollDown}
          className="absolute -top-11 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-control-edge bg-card text-foreground shadow-lg transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("scrollToBottom")}
        >
          <CaretDown weight="bold" className="h-4 w-4" />
        </button>
      ) : null}

      <div className="mx-auto max-w-3xl">
        {error || files.error || voiceFailure ? (
          <Alert variant="destructive" role="alert" className="mb-2">
            <AlertDescription>
              {error ? (streamError ? t(`streamErrors.${streamError.code}`, { minutes: streamError.minutes }) : error) : files.error ? t(`attachments.errors.${files.error}`) : t(`voice.errors.${voiceFailure}`)}
            </AlertDescription>
          </Alert>
        ) : null}

        {voice ? <VoiceStrip voice={voice} /> : null}

        <ChatVisionNotice model={model} models={models} pricing={pricing} onModelChange={onModelChange} attachments={files.ready} />

        <div
          {...dropFiles}
          className={cn(
            "relative rounded-lg border border-control-edge bg-card dark:bg-muted focus-within:ring-2 focus-within:ring-ring",
            dropping && "ring-2 ring-ring",
            resize.resizing && "select-none",
          )}
        >
          {dropping ? (
            <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/90 text-sm font-medium text-foreground">
              {t("attachments.drop")}
            </p>
          ) : null}
          <ResizeHandle label={t("resizeComposer")} controls={fieldId} resize={resize} />
          <textarea
            ref={field}
            id={fieldId}
            disabled={disabled}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={pasteFiles}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={dictating ? t("voice.dictating") : streaming ? t("queue.placeholder") : (placeholder ?? t("inputPlaceholder"))}
            aria-label={placeholder ?? t("inputPlaceholder")}
            style={{ minHeight: resize.height }}
            className={cn("block w-full resize-none overflow-y-auto bg-transparent text-foreground outline-none placeholder:text-muted-foreground", FIELD_TEXT)}
          />
          <textarea
            ref={mirror}
            aria-hidden
            tabIndex={-1}
            readOnly
            rows={1}
            value={input}
            className={cn("pointer-events-none invisible absolute inset-x-0 top-0 block h-0 w-full resize-none overflow-hidden", FIELD_TEXT)}
          />
          {dictating && dictation.interim ? (
            <p aria-live="polite" className="truncate px-3.5 pb-2 text-xs italic text-muted-foreground">
              {dictation.interim}
            </p>
          ) : null}
          {files.items.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 px-3.5 pb-2" aria-label={t("attachments.legend")}>
              {files.items.map((item) => (
                <AttachmentChip key={item.key} name={item.name} attachment={item.attachment} uploadingLabel={t("attachments.uploading")} className="bg-muted">
                  <button
                    type="button"
                    onClick={() => files.remove(item.key)}
                    className="flex-shrink-0 rounded-sm text-muted-foreground transition-colors duration-DEFAULT hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("attachments.remove", { name: item.name })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </AttachmentChip>
              ))}
            </ul>
          ) : null}
          <div role="group" aria-label={t("composerTools")} className="flex items-center gap-1 px-1.5 pb-1.5">
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) files.add(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => picker.current?.click()}
                disabled={disabled}
                className={TOOL_BUTTON}
                aria-label={t("attachments.add")}
                title={t("attachments.add")}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {dictation.supported && !voiceOn ? (
                <button
                  type="button"
                  onClick={toggleDictation}
                  disabled={disabled || callActive}
                  aria-pressed={dictating}
                  className={cn(TOOL_BUTTON, dictating && "text-healthy-ink")}
                  aria-label={t(dictating ? "voice.stopDictation" : "voice.dictate")}
                  title={t(dictating ? "voice.stopDictation" : "voice.dictate")}
                >
                  {dictating ? <MicrophoneSlash className="h-4 w-4" /> : <Microphone className="h-4 w-4" />}
                </button>
              ) : null}
              {voice?.supported ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={!voiceOn && (disabled || callActive || !model)}
                  aria-pressed={voiceOn}
                  className={TOOL_BUTTON}
                  aria-label={t(voiceOn ? "voice.exit" : "voice.mode")}
                  title={t(voiceOn ? "voice.exit" : "voice.mode")}
                >
                  <Waveform className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex min-w-0 max-w-[24rem] flex-1 items-center">
              <ChatModelSelector
                label={t("modelLabel")}
                value={model}
                onValueChange={onModelChange}
                models={models}
                modelPricing={pricing}
                disabled={streaming || disabled}
              />
            </div>
            <div className="ml-auto flex flex-shrink-0 items-center gap-1">
              {streaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className={STOP_BUTTON}
                  aria-label={t("stop")}
                  title={t("stop")}
                >
                  <Stop weight="fill" className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {streaming && !canSend ? null : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  className={SEND_BUTTON}
                  aria-label={streaming ? t("queue.send") : t("send")}
                  title={streaming ? t("queue.send") : t("send")}
                >
                  <PaperPlaneTilt weight="fill" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ResizeHandle({ label, controls, resize }: { label: string; controls: string; resize: ComposerResize }) {
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={resize.height}
      aria-valuemin={resize.min}
      aria-valuemax={resize.max}
      title={label}
      {...resize.handleProps}
      className="group absolute inset-x-3 -top-1.5 z-20 flex h-3 cursor-ns-resize touch-none items-center justify-center focus-visible:outline-none [@media(pointer:coarse)]:-top-3 [@media(pointer:coarse)]:h-6"
    >
      <span
        aria-hidden
        className={cn(
          "h-1 w-10 rounded-full bg-control-edge transition-colors duration-DEFAULT group-hover:bg-primary group-focus-visible:bg-primary group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-card",
          resize.resizing && "bg-primary",
        )}
      />
    </div>
  );
}
