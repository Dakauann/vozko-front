"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import {
  CaretDown,
  CircleNotch,
  FileText,
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  Paperclip,
  Stop,
  Waveform,
  X,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PANEL_EASE } from "@/components/docks/dock-chrome";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { ChatAttachment } from "@/lib/aichat/types";
import { useCallActive } from "@/lib/call-session/call-session-control";
import type { ListenFailure } from "@/lib/voice/browser-speech";
import { appendDictation, speechLang } from "@/lib/voice/speech-text";
import { cn } from "@/lib/utils";

import { useChatAttachments } from "./use-chat-attachments";
import type { VoiceMode } from "./voice/use-voice-mode";
import { VoiceStrip } from "./voice/voice-strip";

const TOOL_BUTTON =
  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted aria-pressed:text-foreground";

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
  spacious = false,
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
}: {
  docked: boolean;
  spacious?: boolean;
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
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("aiChatPage");
  const files = useChatAttachments();
  const callActive = useCallActive();
  const [dictationFailure, setDictationFailure] = useState<ListenFailure | null>(null);
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
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = textarea.current;
    if (!field || !spacious) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }, [input, spacious]);
  const canSend = Boolean(input.trim()) && Boolean(model) && !files.uploading && !streaming && !disabled;

  const submit = () => {
    if (!canSend) return;
    if (onSend(files.ready)) files.clear();
  };

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
              {error ?? (files.error ? t(`attachments.errors.${files.error}`) : t(`voice.errors.${voiceFailure}`))}
            </AlertDescription>
          </Alert>
        ) : null}

        {voice ? <VoiceStrip voice={voice} /> : null}

        <div className="rounded-lg border border-control-edge bg-card dark:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={textarea}
            disabled={disabled}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={spacious ? 2 : docked ? 1 : 2}
            placeholder={dictating ? t("voice.dictating") : (placeholder ?? t("inputPlaceholder"))}
            aria-label={placeholder ?? t("inputPlaceholder")}
            className={cn("block max-h-40 w-full resize-none bg-transparent px-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground", spacious ? "py-3" : "pt-2.5")}
          />
          {dictating && dictation.interim ? (
            <p aria-live="polite" className="truncate px-3 pb-2 text-xs italic text-muted-foreground">
              {dictation.interim}
            </p>
          ) : null}
          {files.items.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label={t("attachments.legend")}>
              {files.items.map((item) => (
                <li
                  key={item.key}
                  className="flex max-w-[14rem] items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-1 text-xs text-foreground"
                >
                  {item.uploading ? (
                    <CircleNotch className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-muted-foreground" aria-label={t("attachments.uploading")} />
                  ) : (
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => files.remove(item.key)}
                    className="flex-shrink-0 rounded-sm text-muted-foreground transition-colors duration-DEFAULT hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("attachments.remove", { name: item.name })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
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
            <div className="flex flex-shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => picker.current?.click()}
                disabled={streaming || disabled}
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
            <div className="min-w-0 max-w-[15rem] flex-1">
              <AIModelSelector
                label={t("modelLabel")}
                value={model}
                onValueChange={onModelChange}
                models={models}
                modelPricing={pricing}
                disabled={streaming || disabled}
              />
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] border border-control-edge bg-card text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("stop")}
              >
                <Stop weight="fill" className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("send")}
              >
                <PaperPlaneTilt weight="fill" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
