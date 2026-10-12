"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { LOUDNESS_TARGETS, type LoudnessTarget, type NormalizedPart, type NormalizeTarget } from "@/lib/studio/loudness";
import { formatLevel } from "@/lib/studio/live-meter";

import { useVideoEditor } from "../editor-context";

const TARGETS = Object.keys(LOUDNESS_TARGETS) as LoudnessTarget[];

export function NormalizeFields({ target, disabled }: { target: NormalizeTarget; disabled: boolean }) {
  const t = useTranslations("studio.video.sound");
  const { commands } = useVideoEditor();
  const [busy, setBusy] = useState(false);
  const [parts, setParts] = useState<NormalizedPart[] | null>(null);

  const run = async (name: LoudnessTarget) => {
    setBusy(true);
    setParts(null);
    const result = await commands.normalize(target, LOUDNESS_TARGETS[name]);
    setBusy(false);
    if (result.ok) setParts(result.parts);
  };

  const single = parts?.length === 1 ? parts[0] : null;

  return (
    <div role="group" aria-label={t("normalize")} aria-busy={busy} className="space-y-1.5">
      <p className="text-2xs text-muted-foreground">{t("normalize")}</p>
      <div className="flex flex-wrap gap-1">
        {TARGETS.map((name) => (
          <Button
            key={name}
            variant="outline"
            size="sm"
            title={t(`targets.${name}`)}
            aria-label={t("normalizeTo", { target: t(`targets.${name}`), value: LOUDNESS_TARGETS[name] })}
            disabled={disabled || busy}
            onClick={() => void run(name)}
          />
        ))}
      </div>
      {busy ? <p className="text-2xs text-muted-foreground">{t("measuring")}</p> : null}
      {single ? <p role="status" className="text-2xs text-foreground">{t("measured", { measured: formatLevel(single.measured), gain: formatLevel(single.gainDb) })}</p> : null}
      {parts && parts.length > 1 ? <p role="status" className="text-2xs text-foreground">{t("measuredMany", { count: parts.length })}</p> : null}
      {parts?.some((part) => part.limited) ? <p className="text-2xs text-warning-ink">{t("limited")}</p> : null}
    </div>
  );
}
