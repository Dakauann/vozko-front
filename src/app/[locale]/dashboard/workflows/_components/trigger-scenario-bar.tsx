"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { getTriggerLastInputAction } from "@/app/actions/workflows";
import ElevatedButton from "@/components/elevated-design/button";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ClockCounterClockwise, FloppyDisk, PencilSimple, Spinner, Trash } from "@/components/icons";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  renamedTestInput,
  savedTestInput,
  scenarioInputOf,
  testInputNameTaken,
  withoutTestInput,
  type TriggerTestInput,
} from "@/lib/workflows/test-inputs";
import type { TriggerInputSpec, TriggerStartBuild } from "@/lib/workflows/trigger-input";

const NO_SCENARIO = "__none__";

type NameEdit = { kind: "save"; name: string } | { kind: "rename"; id: string; name: string };

function useCallTime(): (at: string) => string {
  const format = useFormatter();
  const empty = useEmptyValue();
  return (at) => {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? empty : format.dateTime(date, { dateStyle: "short", timeStyle: "medium" });
  };
}

type LastCall = { kind: "idle" } | { kind: "loading" } | { kind: "loaded"; startedAt: string } | { kind: "failed"; message: string };

export interface TriggerScenarioBarProps {
  workflowId?: string;
  spec: TriggerInputSpec;
  scenarios: TriggerTestInput[];
  onScenariosChange?: (nodeId: string, scenarios: TriggerTestInput[]) => void;
  onLoad: (input: unknown, masked: string[]) => void;
  buildInput: () => TriggerStartBuild;
}

export function TriggerScenarioBar({ workflowId, spec, scenarios, onScenariosChange, onLoad, buildInput }: TriggerScenarioBarProps) {
  const t = useTranslations("workflowDebug.triggerInput");
  const tWorkflows = useTranslations("workflowsPage");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<NameEdit | null>(null);
  const [lastCall, setLastCall] = useState<LastCall>({ kind: "idle" });
  const [notObject, setNotObject] = useState(false);
  const callTime = useCallTime();
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? null;
  const editable = Boolean(onScenariosChange);

  const choose = (id: string) => {
    const scenario = scenarios.find((item) => item.id === id);
    setSelectedId(scenario?.id ?? null);
    setLastCall({ kind: "idle" });
    if (scenario) onLoad(scenario.input, []);
  };

  const nameTaken = edit ? testInputNameTaken(scenarios, edit.name, edit.kind === "rename" ? edit.id : undefined) : false;
  const blocked = !edit || !edit.name.trim() || (edit.kind === "rename" && nameTaken);

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!edit || blocked || !onScenariosChange) return;
    if (edit.kind === "rename") {
      onScenariosChange(spec.nodeId, renamedTestInput(scenarios, edit.id, edit.name));
      setEdit(null);
      return;
    }
    const built = buildInput();
    if (!built.ok) return;
    const input = scenarioInputOf(built.start.input);
    setNotObject(!input);
    if (!input) return;
    const next = savedTestInput(scenarios, { id: crypto.randomUUID(), name: edit.name, input, at: new Date() });
    onScenariosChange(spec.nodeId, next);
    setSelectedId(next.find((scenario) => scenario.name === edit.name.trim())?.id ?? null);
    setEdit(null);
    toast.success(t("scenarios.saved"));
  };

  const remove = () => {
    if (!selected || !onScenariosChange) return;
    onScenariosChange(spec.nodeId, withoutTestInput(scenarios, selected.id));
    setSelectedId(null);
  };

  const loadLastCall = () => {
    if (!workflowId) return;
    setLastCall({ kind: "loading" });
    void getTriggerLastInputAction(workflowId, spec.nodeId).then((answer) => {
      if (!answer.lastInput) {
        setLastCall({ kind: "failed", message: codedErrorMessage(tWorkflows, { code: answer.code }, t("scenarios.lastCallFailed")) });
        return;
      }
      setSelectedId(null);
      setLastCall({ kind: "loaded", startedAt: answer.lastInput.startedAt });
      onLoad(answer.lastInput.input, answer.lastInput.maskedKeys);
    });
  };

  return (
    <div className="space-y-2 border-b border-border pb-3" data-testid="trigger-scenario-bar">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <ElevatedSelect
            aria-label={t("scenarios.label")}
            value={selected?.id ?? NO_SCENARIO}
            onValueChange={(value) => (value === NO_SCENARIO ? setSelectedId(null) : choose(value))}
            disabled={scenarios.length === 0}
          >
            <ElevatedSelectItem value={NO_SCENARIO}>{scenarios.length === 0 ? t("scenarios.none") : t("scenarios.label")}</ElevatedSelectItem>
            {scenarios.map((scenario) => (
              <ElevatedSelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        {editable && selected && (
          <>
            <ElevatedButton
              variant="ghost"
              size="sm"
              iconVisible
              icon={<PencilSimple size={12} />}
              aria-label={t("scenarios.rename")}
              title={t("scenarios.rename")}
              onClick={() => setEdit({ kind: "rename", id: selected.id, name: selected.name })}
            />
            <ElevatedButton
              variant="ghost"
              size="sm"
              iconVisible
              icon={<Trash size={12} />}
              aria-label={t("scenarios.delete")}
              title={t("scenarios.delete")}
              onClick={remove}
              className="text-destructive-ink"
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {editable && (
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            iconVisible
            icon={<FloppyDisk size={12} />}
            title={t("scenarios.saveAs")}
            onClick={() => {
              if (buildInput().ok) setEdit({ kind: "save", name: selected?.name ?? "" });
            }}
          />
        )}
        {workflowId && (
          <ElevatedButton
            variant="ghost"
            size="sm"
            iconVisible
            icon={lastCall.kind === "loading" ? <Spinner size={12} className="animate-spin motion-reduce:animate-none" /> : <ClockCounterClockwise size={12} />}
            title={t("scenarios.lastCall")}
            disabled={lastCall.kind === "loading"}
            onClick={loadLastCall}
          />
        )}
      </div>

      {edit && (
        <form onSubmit={submitName} className="space-y-1.5">
          <ElevatedInput
            label={t("scenarios.name")}
            controlSize="sm"
            autoFocus
            value={edit.name}
            onChange={(event) => {
              setEdit({ ...edit, name: event.target.value });
              setNotObject(false);
            }}
          />
          {edit.kind === "rename" && nameTaken && <p className="text-2xs text-muted-foreground">{t("scenarios.nameTaken")}</p>}
          {edit.kind === "save" && notObject && <p className="text-2xs text-muted-foreground">{t("scenarios.notObject")}</p>}
          <div className="flex gap-1.5">
            <ElevatedButton type="submit" variant="primary" size="sm" title={t("scenarios.save")} disabled={blocked} />
            <ElevatedButton type="button" variant="ghost" size="sm" title={t("scenarios.cancel")} onClick={() => setEdit(null)} />
          </div>
        </form>
      )}

      {lastCall.kind === "loaded" && (
        <p className="text-2xs text-muted-foreground">
          {t("scenarios.lastCallLoaded", { date: callTime(lastCall.startedAt) })}
        </p>
      )}
      {lastCall.kind === "failed" && <p className="text-2xs text-muted-foreground">{lastCall.message}</p>}
      {editable && scenarios.length > 0 && <p className="text-2xs text-muted-foreground">{t("scenarios.draftOnly")}</p>}
    </div>
  );
}
