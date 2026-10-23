"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Info, type Icon } from "@/components/icons";
import type { TriggerTestInput } from "@/lib/workflows/test-inputs";
import {
  chosenTriggerSpec,
  defaultWindowOpen,
  draftFromInput,
  emptyTriggerDraft,
  hasTriggerInput,
  orderedTriggerSpecs,
  triggerDisplayLabel,
  triggerStartOf,
  type TriggerInputDraft,
  type TriggerInputIssue,
  type TriggerInputSpec,
  type TriggerStartBuild,
} from "@/lib/workflows/trigger-input";
import { cn } from "@/lib/utils";

import { useNodeDefinition } from "./node-previews/node-definitions";
import { TriggerInputEditor } from "./trigger-input-editor";
import { TriggerScenarioBar } from "./trigger-scenario-bar";
import { nodeIconOf } from "./workflow-node";

const NO_SCENARIOS: TriggerTestInput[] = [];
const NO_SYNTAX: readonly string[] = [];

export interface TriggerStartState {
  specs: TriggerInputSpec[];
  spec: TriggerInputSpec | null;
  draft: TriggerInputDraft | null;
  syntax: readonly string[];
  windowOpen: boolean | null;
  setWindowOpen: (open: boolean) => void;
  choose: (nodeId: string) => void;
  setDraft: (draft: TriggerInputDraft) => void;
  load: (input: unknown, masked: string[]) => void;
  build: () => TriggerStartBuild | null;
}

export function useTriggerStart(triggers: TriggerInputSpec[], defaultNodeId: string | null): TriggerStartState {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TriggerInputDraft>>({});
  const [syntax, setSyntax] = useState<readonly string[]>(NO_SYNTAX);
  const [windows, setWindows] = useState<Record<string, boolean>>({});
  const specs = useMemo(() => orderedTriggerSpecs(triggers, defaultNodeId), [triggers, defaultNodeId]);
  const spec = chosenTriggerSpec(triggers, chosenId, defaultNodeId);
  const draft = spec ? (drafts[spec.nodeId] ?? emptyTriggerDraft(spec)) : null;
  const specId = spec?.nodeId ?? null;
  const specWindow = spec ? defaultWindowOpen(spec) : null;
  const windowOpen = specWindow === null || !specId ? null : (windows[specId] ?? specWindow);

  const setWindowOpen = useCallback(
    (open: boolean) => {
      if (specId) setWindows((current) => ({ ...current, [specId]: open }));
    },
    [specId],
  );

  const setDraft = useCallback(
    (next: TriggerInputDraft) => {
      if (!specId) return;
      setDrafts((current) => ({ ...current, [specId]: next }));
      setSyntax(NO_SYNTAX);
    },
    [specId],
  );

  const choose = useCallback((nodeId: string) => {
    setChosenId(nodeId);
    setSyntax(NO_SYNTAX);
  }, []);

  const load = useCallback(
    (input: unknown, masked: string[]) => {
      if (spec) setDraft(draftFromInput(spec, input, masked));
    },
    [spec, setDraft],
  );

  const build = useCallback((): TriggerStartBuild | null => {
    if (!spec || !draft) return null;
    const built = triggerStartOf(spec, draft, windowOpen ?? undefined);
    setSyntax(built.ok ? NO_SYNTAX : built.syntax);
    return built;
  }, [spec, draft, windowOpen]);

  return { specs, spec, draft, syntax, windowOpen, setWindowOpen, choose, setDraft, load, build };
}

function ChipIcon({ icon: IconComp }: { icon: Icon }) {
  return <IconComp size={12} aria-hidden className="shrink-0" />;
}

function TriggerChip({
  spec,
  active,
  onChoose,
  nodeLabel,
}: {
  spec: TriggerInputSpec;
  active: boolean;
  onChoose: (nodeId: string) => void;
  nodeLabel?: (nodeId: string) => string | undefined;
}) {
  const definition = useNodeDefinition(spec.triggerType);
  const icon = nodeIconOf(definition?.icon);
  const label = triggerDisplayLabel(spec, nodeLabel?.(spec.nodeId) || definition?.label);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChoose(spec.nodeId)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      <ChipIcon icon={icon} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export interface TriggerStartScreenProps {
  state: TriggerStartState;
  unreadable: number;
  issues: readonly TriggerInputIssue[];
  workflowId?: string;
  scenariosOf?: (nodeId: string) => TriggerTestInput[] | undefined;
  onScenariosChange?: (nodeId: string, scenarios: TriggerTestInput[]) => void;
  nodeLabel?: (nodeId: string) => string | undefined;
  onFocusNode?: (nodeId: string) => void;
}

export function TriggerStartScreen({
  state,
  unreadable,
  issues,
  workflowId,
  scenariosOf,
  onScenariosChange,
  nodeLabel,
  onFocusNode,
}: TriggerStartScreenProps) {
  const t = useTranslations("workflowDebug.triggerInput");
  const { specs, spec, draft, syntax, windowOpen, setWindowOpen, choose, setDraft, load, build } = state;
  const buildInput = useCallback((): TriggerStartBuild => build() ?? { ok: false, syntax: [] }, [build]);

  return (
    <section aria-label={t("title")} className="space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="trigger-start-screen">
      <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>

      {specs.length > 1 && (
        <div role="group" aria-label={t("chooser")} className="flex flex-wrap gap-1.5">
          {specs.map((item) => (
            <TriggerChip key={item.nodeId} spec={item} active={item.nodeId === spec?.nodeId} onChoose={choose} nodeLabel={nodeLabel} />
          ))}
        </div>
      )}

      {unreadable > 0 && (
        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
          <Info size={12} weight="fill" aria-hidden className="mt-px shrink-0 text-info-ink" />
          <span>{t("unreadable", { count: unreadable })}</span>
        </p>
      )}

      {spec && draft && hasTriggerInput(spec) && (
        <>
          <TriggerScenarioBar
            key={spec.nodeId}
            workflowId={workflowId}
            spec={spec}
            scenarios={scenariosOf?.(spec.nodeId) ?? NO_SCENARIOS}
            onScenariosChange={onScenariosChange}
            onLoad={load}
            buildInput={buildInput}
          />
          <TriggerInputEditor
            spec={spec}
            draft={draft}
            onDraftChange={setDraft}
            issues={issues}
            syntax={syntax}
            nodeLabel={nodeLabel}
            onFocusNode={onFocusNode}
          />
        </>
      )}

      {windowOpen !== null && <WindowChoice open={windowOpen} onChange={setWindowOpen} />}

      {spec?.shape === "message" && <p className="text-xs text-muted-foreground">{t("messageHint")}</p>}
      {spec?.shape === "none" && <p className="text-xs text-muted-foreground">{t("noInput")}</p>}
    </section>
  );
}

function WindowChoice({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  const t = useTranslations("workflowDebug.triggerInput.window");
  const option = (value: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={open === value}
      onClick={() => onChange(value)}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        open === value ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-1.5">
      <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">{t("label")}:</span>
        {option(true, t("open"))}
        {option(false, t("closed"))}
      </div>
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
