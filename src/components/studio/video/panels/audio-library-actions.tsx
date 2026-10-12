"use client";

import { useTranslations } from "next-intl";

import { Sparkle } from "@/components/icons";
import type { ModelKind } from "@/lib/media-generation/types";

import { openAiForm } from "../drafts";
import { useVideoEditor } from "../editor-context";

const SOUND_KINDS: readonly ModelKind[] = ["music", "voice", "sfx"];

export function AudioLibraryActions() {
  const t = useTranslations("studio.library.audio");
  const ai = useTranslations("studio.video.ai");
  const { view } = useVideoEditor();
  return (
    <div className="space-y-1.5">
      <p className="text-2xs leading-snug text-muted-foreground">{t("generate")}</p>
      <div role="group" aria-label={t("generate")} className="grid grid-cols-3 gap-1.5">
        {SOUND_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            data-library-generate={kind}
            onClick={() => openAiForm(view, kind)}
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-[--radius] border border-border bg-card px-1.5 text-2xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkle className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{ai(`${kind}.tab`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
