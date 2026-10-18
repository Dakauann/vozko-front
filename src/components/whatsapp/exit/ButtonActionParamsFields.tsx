"use client";

import { useTranslations } from "next-intl";

import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import type { ButtonActionKind, ButtonActionParams } from "@/lib/whatsapp-templates/exit";

import {
  MEMBER_PREFIX,
  TEAM_PREFIX,
  useCallListOptions,
  useDealPipelineOptions,
  useDealStageOptions,
  useHandOffOptions,
  useLeadSelectFields,
  useWorkflowOptions,
  type ParamOptions,
} from "./use-action-param-options";

type ParamsChange = (params: ButtonActionParams) => void;

const POPOVER_LAYER = "z-[200]";

function ParamPicker({ label, choices, value, onPick }: { label: string; choices: ParamOptions; value: string; onPick: (value: string) => void }) {
  const t = useTranslations("templateExit.params");
  return (
    <div className="space-y-1">
      <ElevatedCommandSelect
        label={label}
        value={value}
        onValueChange={onPick}
        options={choices.options}
        isLoading={choices.loading}
        searchPlaceholder={t("search")}
        emptyMessage={choices.loading ? t("loading") : t("empty")}
        contentClassName={POPOVER_LAYER}
        fullWidth
      />
      {choices.failed ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}

function PlainSelect({ label, value, values, onPick }: { label: string; value: string; values: { value: string; label: string }[]; onPick: (value: string) => void }) {
  return (
    <ElevatedSelect label={label} aria-label={label} value={value} onValueChange={onPick} contentClassName={POPOVER_LAYER}>
      {values.map((item) => (
        <ElevatedSelectItem key={item.value} value={item.value}>
          {item.label}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );
}

function PurposeField({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  return (
    <div className="space-y-1">
      <ElevatedTextarea label={t("purpose")} value={params.purpose ?? ""} rows={2} onChange={(event) => onChange({ purpose: event.target.value })} />
      <p className="text-xs text-muted-foreground">{t("purposeHint")}</p>
    </div>
  );
}

function handOffValue(params: ButtonActionParams): string {
  if (params.departmentId) return `${TEAM_PREFIX}${params.departmentId}`;
  if (params.userId) return `${MEMBER_PREFIX}${params.userId}`;
  return "";
}

function handOffParams(value: string): ButtonActionParams {
  if (value.startsWith(TEAM_PREFIX)) return { departmentId: value.slice(TEAM_PREFIX.length) };
  return { userId: value.slice(MEMBER_PREFIX.length) };
}

function HandOffField({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  const choices = useHandOffOptions(true);
  const described = {
    ...choices,
    options: choices.options.map((option) => ({ ...option, description: option.value.startsWith(TEAM_PREFIX) ? t("team") : t("member") })),
  };
  return <ParamPicker label={t("handOff")} choices={described} value={handOffValue(params)} onPick={(value) => onChange(handOffParams(value))} />;
}

function WorkflowField({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  return <ParamPicker label={t("workflow")} choices={useWorkflowOptions(true)} value={params.workflowId ?? ""} onPick={(workflowId) => onChange({ workflowId })} />;
}

function CallListField({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  return <ParamPicker label={t("callList")} choices={useCallListOptions(true)} value={params.callListId ?? ""} onPick={(callListId) => onChange({ callListId })} />;
}

function ClassifyFields({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  const { fields, loading, failed } = useLeadSelectFields(true);
  if (loading) return <p className="text-xs text-muted-foreground">{t("loading")}</p>;
  if (failed) return <p role="alert" className="text-xs text-destructive-ink">{t("failed")}</p>;
  if (fields.length === 0) return <p className="text-xs text-muted-foreground">{t("noSelectFields")}</p>;
  const field = fields.find((candidate) => candidate.key === params.fieldKey);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PlainSelect
        label={t("field")}
        value={params.fieldKey ?? ""}
        values={fields.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
        onPick={(fieldKey) => onChange({ fieldKey })}
      />
      {field ? (
        <PlainSelect
          label={t("option")}
          value={params.option ?? ""}
          values={field.options.map((option) => ({ value: option, label: option }))}
          onPick={(option) => onChange({ fieldKey: field.key, option })}
        />
      ) : null}
    </div>
  );
}

function DealFields({ params, onChange }: { params: ButtonActionParams; onChange: ParamsChange }) {
  const t = useTranslations("templateExit.params");
  const pipelineId = params.pipelineId ?? "";
  const stages = useDealStageOptions(pipelineId);
  return (
    <div className="space-y-3">
      <ParamPicker label={t("pipeline")} choices={useDealPipelineOptions(true)} value={pipelineId} onPick={(next) => onChange({ pipelineId: next })} />
      {pipelineId ? <ParamPicker label={t("stage")} choices={stages} value={params.stageId ?? ""} onPick={(stageId) => onChange({ pipelineId, stageId })} /> : null}
    </div>
  );
}

export function ButtonActionParamsFields({ kind, params, onChange }: { kind: ButtonActionKind; params: ButtonActionParams; onChange: ParamsChange }) {
  switch (kind) {
    case "consent_grant":
      return <PurposeField params={params} onChange={onChange} />;
    case "hand_off":
      return <HandOffField params={params} onChange={onChange} />;
    case "start_workflow":
      return <WorkflowField params={params} onChange={onChange} />;
    case "call_list":
      return <CallListField params={params} onChange={onChange} />;
    case "classify":
      return <ClassifyFields params={params} onChange={onChange} />;
    case "create_deal":
      return <DealFields params={params} onChange={onChange} />;
    default:
      return null;
  }
}
