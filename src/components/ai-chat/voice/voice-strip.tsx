"use client";

import { useTranslations } from "next-intl";

import { CircleNotch, Microphone, Phone, SpeakerHigh, X, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { VoiceMode, VoicePhase } from "./use-voice-mode";

type ActivePhase = Exclude<VoicePhase, "off">;

const PHASES: Record<ActivePhase, { glyph: Icon; tone: string; spin?: boolean }> = {
  listening: { glyph: Microphone, tone: "text-healthy-ink" },
  thinking: { glyph: CircleNotch, tone: "text-muted-foreground", spin: true },
  speaking: { glyph: SpeakerHigh, tone: "text-primary-ink" },
  paused: { glyph: Phone, tone: "text-warning-ink" },
};

const STRIP_BUTTON =
  "inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-[--radius] px-2 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VoiceStrip({ voice }: { voice: VoiceMode }) {
  const t = useTranslations("aiChatPage.voice");
  if (voice.phase === "off") return null;
  const phase = PHASES[voice.phase];
  const Glyph = phase.glyph;
  const detail = voice.phase === "listening" && voice.interim ? voice.interim : t("privacy");

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-2 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 dark:bg-muted"
    >
      <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[--radius] bg-muted dark:bg-card">
        <Glyph weight="bold" aria-hidden className={cn("h-3.5 w-3.5", phase.tone, phase.spin && "animate-spin")} />
        {voice.phase === "listening" ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-healthy animate-dot-pulse" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight text-foreground">{t(`phases.${voice.phase}`)}</p>
        <p className={cn("mt-0.5 truncate text-2xs leading-tight text-muted-foreground", voice.interim && voice.phase === "listening" && "italic")}>
          {detail}
        </p>
      </div>
      {voice.phase === "speaking" ? (
        <button type="button" onClick={voice.skip} className={STRIP_BUTTON}>
          {t("skip")}
        </button>
      ) : null}
      <button type="button" onClick={voice.disable} aria-label={t("exit")} title={t("exit")} className={STRIP_BUTTON}>
        <X weight="bold" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
