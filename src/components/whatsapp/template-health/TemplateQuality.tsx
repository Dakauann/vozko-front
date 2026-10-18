"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getTemplateHealthAction } from "@/app/actions/template-health";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { FlagCheckered } from "@/components/icons";
import { knownQuality, qualityTone, type TemplateHealth, type TemplateHealthChange } from "@/lib/whatsapp-templates/health";

type TemplateHealthState = { health: TemplateHealth | null; error: boolean };

export function useTemplateHealth(templateId: string | null | undefined): TemplateHealthState {
  const [state, setState] = useState<TemplateHealthState & { id: string | null }>({ id: null, health: null, error: false });

  useEffect(() => {
    if (!templateId) return;
    let active = true;
    getTemplateHealthAction(templateId).then((result) => {
      if (active) setState({ id: templateId, health: result.health, error: result.error !== null });
    });
    return () => {
      active = false;
    };
  }, [templateId]);

  return state.id === templateId ? { health: state.health, error: state.error } : { health: null, error: false };
}

export function TemplateQualityChips({ state }: { state: TemplateHealthState }) {
  const t = useTranslations("templateHealth");
  if (state.error) return <StatusChip tone="outline" label={t("unavailable")} />;
  if (!state.health) return null;
  const quality = knownQuality(state.health.quality);
  return (
    <>
      <span title={t(`qualityHint.${quality}`)}>
        <StatusChip tone={qualityTone(quality)} label={t(`quality.${quality}`)} />
      </span>
      {state.health.flagged ? (
        <span title={t("flaggedHint")}>
          <StatusChip tone="warning" icon={<FlagCheckered className="h-3.5 w-3.5" weight="fill" />} label={t("flagged")} />
        </span>
      ) : null}
    </>
  );
}

function useChangeText() {
  const t = useTranslations("templateHealth");
  const value = (raw: string) => (t.has(`values.${raw}`) ? t(`values.${raw}`) : raw);
  return (change: TemplateHealthChange) => {
    const signal = t(`signal.${change.signal}`);
    return change.previous
      ? t("history.change", { signal, previous: value(change.previous), current: value(change.current) })
      : t("history.value", { signal, current: value(change.current) });
  };
}

export function TemplateHealthHistory({ health }: { health: TemplateHealth }) {
  const t = useTranslations("templateHealth");
  const format = useFormatter();
  const describe = useChangeText();
  if (health.changes.length === 0) return <p className="text-sm text-muted-foreground">{t("history.empty")}</p>;
  return (
    <ul className="space-y-1.5">
      {health.changes.map((change, index) => (
        <li key={`${change.occurredAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="text-foreground">{describe(change)}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {format.dateTime(new Date(change.occurredAt), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </li>
      ))}
    </ul>
  );
}
