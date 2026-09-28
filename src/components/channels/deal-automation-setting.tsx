"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { listPipelinesAction } from "@/app/actions/crm-board";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import type { Pipeline } from "@/lib/crm/pipelines";
import { type DealAutomationChannel, getDealAutomation, saveDealAutomation } from "@/lib/deal-automation/client";

type Layout = "stacked" | "row";
type Problem = "loadError" | "saveError" | "noPermission";

function useDealFunnels(): Pipeline[] | null {
  const [funnels, setFunnels] = useState<Pipeline[] | null>(null);
  useEffect(() => {
    let active = true;
    void listPipelinesAction("opportunity").then((list) => {
      if (active) setFunnels(list.pipelines);
    });
    return () => {
      active = false;
    };
  }, []);
  return funnels;
}

function DealAutomationControl({
  funnels,
  pipelineId,
  onChoose,
  busy,
  disabled,
  layout,
  problem,
}: {
  funnels: Pipeline[] | null;
  pipelineId: string | null;
  onChoose: (pipelineId: string) => void;
  busy: boolean;
  disabled: boolean;
  layout: Layout;
  problem: Problem | null;
}) {
  const t = useTranslations("dealAutomation");
  const controlId = useId();
  const [choosing, setChoosing] = useState(false);

  const loaded = funnels !== null && pipelineId !== null;
  const available = funnels ?? [];
  const hasFunnels = available.length > 0;
  const on = Boolean(pipelineId) || choosing;
  const locked = disabled || busy || !loaded || !hasFunnels;
  const hint = loaded && !hasFunnels ? t("noFunnels") : t("hint");

  const handleToggle = (next: boolean) => {
    if (!next) {
      setChoosing(false);
      if (pipelineId) onChoose("");
      return;
    }
    if (available.length === 1) {
      onChoose(available[0].id);
      return;
    }
    setChoosing(true);
  };

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
            value={pipelineId || undefined}
            onValueChange={onChoose}
            disabled={disabled || busy}
          >
            {available.map((funnel) => (
              <ElevatedSelectItem key={funnel.id} value={funnel.id}>
                {funnel.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {!pipelineId ? <p className="text-xs text-muted-foreground">{t("pickToFinish")}</p> : null}
        </div>
      ) : null}
      {problem ? <p className="text-xs text-destructive-ink">{t(problem)}</p> : null}
    </div>
  );
}

export function DealAutomationSetting({
  channel,
  disabled = false,
  layout = "stacked",
}: {
  channel: DealAutomationChannel;
  disabled?: boolean;
  layout?: Layout;
}) {
  const funnels = useDealFunnels();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const { entryType, kind, containerId } = channel;

  useEffect(() => {
    let active = true;
    void getDealAutomation({ entryType, kind, containerId }).then((setting) => {
      if (!active) return;
      if (setting.error) {
        setProblem("loadError");
        return;
      }
      setSavedId(setting.data?.pipelineId ?? "");
    });
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
    }
  };

  return (
    <DealAutomationControl
      funnels={funnels}
      pipelineId={savedId}
      onChoose={(next) => void save(next)}
      busy={saving}
      disabled={disabled}
      layout={layout}
      problem={problem}
    />
  );
}

export function DealAutomationDraft({
  value,
  onChange,
  disabled = false,
  layout = "stacked",
}: {
  value: string;
  onChange: (pipelineId: string) => void;
  disabled?: boolean;
  layout?: Layout;
}) {
  const funnels = useDealFunnels();
  return (
    <DealAutomationControl
      funnels={funnels}
      pipelineId={value}
      onChoose={onChange}
      busy={false}
      disabled={disabled}
      layout={layout}
      problem={null}
    />
  );
}
