"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { listPipelinesAction } from "@/app/actions/crm-board";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import type { Pipeline } from "@/lib/crm/pipelines";
import { type DealAutomationChannel, getDealAutomation, saveDealAutomation } from "@/lib/deal-automation/client";

type Layout = "stacked" | "row";
type Problem = "loadError" | "saveError" | "noPermission";

export function DealAutomationSetting({
  channel,
  disabled = false,
  layout = "stacked",
}: {
  channel: DealAutomationChannel;
  disabled?: boolean;
  layout?: Layout;
}) {
  const t = useTranslations("dealAutomation");
  const [funnels, setFunnels] = useState<Pipeline[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const { entryType, kind, containerId } = channel;

  useEffect(() => {
    let active = true;
    void Promise.all([getDealAutomation({ entryType, kind, containerId }), listPipelinesAction("opportunity")]).then(
      ([setting, list]) => {
        if (!active) return;
        setFunnels(list.pipelines);
        if (setting.error) {
          setProblem("loadError");
          return;
        }
        setSavedId(setting.data?.pipelineId ?? "");
      },
    );
    return () => {
      active = false;
    };
  }, [entryType, kind, containerId]);

  const save = async (next: string) => {
    const previous = savedId;
    setSavedId(next);
    setSaving(true);
    setProblem(null);
    const result = await saveDealAutomation({ entryType, kind, containerId }, next);
    setSaving(false);
    if (result.error) {
      setSavedId(previous);
      setProblem(result.error.status === 403 ? "noPermission" : "saveError");
      return;
    }
    setChoosing(false);
  };

  const handleToggle = (on: boolean) => {
    if (!on) {
      setChoosing(false);
      if (savedId) void save("");
      return;
    }
    if (funnels.length === 1) {
      void save(funnels[0].id);
      return;
    }
    setChoosing(true);
  };

  const loaded = savedId !== null;
  const hasFunnels = funnels.length > 0;
  const on = Boolean(savedId) || choosing;
  const locked = disabled || saving || !loaded || !hasFunnels;
  const hint = loaded && !hasFunnels ? t("noFunnels") : t("hint");
  const controlId = `deal-automation-${containerId}`;

  const toggle =
    layout === "row" ? (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={controlId} className="text-sm text-foreground">
            {t("label")}
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <ElevatedSwitch id={controlId} checked={on} onCheckedChange={handleToggle} disabled={locked} aria-label={t("label")} />
      </div>
    ) : (
      <ElevatedSwitch
        id={controlId}
        checked={on}
        onCheckedChange={handleToggle}
        disabled={locked}
        label={t("label")}
        aria-label={t("label")}
        description={hint}
      />
    );

  return (
    <div className="space-y-3">
      {toggle}
      {on && hasFunnels ? (
        <div className="space-y-1.5">
          <ElevatedSelect
            placeholder={t("choose")}
            value={savedId || undefined}
            onValueChange={(next: string) => void save(next)}
            disabled={disabled || saving}
          >
            {funnels.map((funnel) => (
              <ElevatedSelectItem key={funnel.id} value={funnel.id}>
                {funnel.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {choosing && !savedId ? <p className="text-xs text-muted-foreground">{t("pickToFinish")}</p> : null}
        </div>
      ) : null}
      {problem ? <p className="text-xs text-destructive-ink">{t(problem)}</p> : null}
    </div>
  );
}
