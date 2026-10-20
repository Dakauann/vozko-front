"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CircleNotch, DownloadSimple, Plus, Trash } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Notice } from "@/components/ui/notice";
import { getAgentByIdAction } from "@/app/actions/agents";
import {
  AGENT_CALL_INPUT_TYPES,
  agentCallInputIssues,
  emptyAgentCallInput,
  httpBodySchemaSources,
  importBodySchema,
  readAgentCallInputs,
  readReplyFields,
  type AgentCallInput,
  type AgentCallInputType,
  type HttpBodySchemaSource,
  type ReplyField,
} from "@/lib/workflows/agent-call";

import { VariableCommandInput } from "./variable-command-input";

interface VarGroup {
  label: string;
  description?: string;
  vars: { template: string; description: string }[];
}

export interface AgentPickerProps {
  value: string;
  onChange: (agentId: string) => void;
}

interface AgentCallInputsFieldProps {
  value: unknown;
  onChange: (inputs: AgentCallInput[]) => void;
  renderAgentPicker: (props: AgentPickerProps) => ReactNode;
}

export function AgentCallInputsField({ value, onChange, renderAgentPicker }: AgentCallInputsFieldProps) {
  const t = useTranslations("workflowsPage.agentCall");
  const inputs = useMemo(() => readAgentCallInputs(value), [value]);
  const issues = useMemo(() => new Map(agentCallInputIssues(inputs).map((issue) => [issue.index, issue.code])), [inputs]);
  const [importing, setImporting] = useState(false);

  const update = (index: number, patch: Partial<AgentCallInput>) =>
    onChange(inputs.map((input, at) => (at === index ? { ...input, ...patch } : input)));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-foreground">{t("title")}</p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{t("description")}</p>
      </div>

      {inputs.length === 0 ? (
        <p className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {inputs.map((input, index) => {
            const issue = issues.get(index);
            return (
              <li key={index} className="space-y-3 rounded-[--radius] border border-border bg-mist p-3" data-testid="agent-call-input">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <ElevatedInput
                    label={t("name")}
                    value={input.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder="cpf"
                    controlSize="sm"
                    inputClassName="font-mono text-xs"
                    error={issue ? t(`issues.${issue}`) : undefined}
                  />
                  <ElevatedSelect
                    label={t("type")}
                    value={input.type}
                    onValueChange={(type) => update(index, { type: type as AgentCallInputType })}
                  >
                    {AGENT_CALL_INPUT_TYPES.map((type) => (
                      <ElevatedSelectItem key={type} value={type}>
                        {t(`types.${type}`)}
                      </ElevatedSelectItem>
                    ))}
                  </ElevatedSelect>
                </div>
                <ElevatedInput
                  label={t("aiDescription")}
                  value={input.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  placeholder={t("aiDescriptionPlaceholder")}
                  controlSize="sm"
                />
                <ElevatedInput
                  label={t("example")}
                  value={input.example}
                  onChange={(event) => update(index, { example: event.target.value })}
                  controlSize="sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={input.required}
                      onChange={(event) => update(index, { required: event.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="text-xs font-medium text-foreground">{t("required")}</span>
                  </label>
                  <ElevatedButton
                    variant="ghost"
                    size="sm"
                    title={t("remove")}
                    icon={<Trash size={14} />}
                    iconVisible
                    onClick={() => onChange(inputs.filter((_, at) => at !== index))}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <ElevatedButton
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          iconVisible
          title={t("add")}
          onClick={() => onChange([...inputs, emptyAgentCallInput()])}
        />
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          icon={<DownloadSimple size={14} />}
          iconVisible
          title={t("import.open")}
          aria-expanded={importing}
          onClick={() => setImporting((open) => !open)}
        />
      </div>

      {importing && (
        <HttpSchemaImport
          renderAgentPicker={renderAgentPicker}
          onImport={(bodySchema) => {
            const result = importBodySchema(inputs, bodySchema);
            onChange(result.inputs);
            return result;
          }}
        />
      )}
    </div>
  );
}

interface LoadedAgent {
  agentId: string;
  sources: HttpBodySchemaSource[];
  failed: boolean;
}

interface ImportOutcome {
  added: number;
  skipped: string[];
}

function HttpSchemaImport({
  renderAgentPicker,
  onImport,
}: {
  renderAgentPicker: (props: AgentPickerProps) => ReactNode;
  onImport: (bodySchema: unknown[]) => ImportOutcome;
}) {
  const t = useTranslations("workflowsPage.agentCall.import");
  const [agentId, setAgentId] = useState("");
  const [loaded, setLoaded] = useState<LoadedAgent | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const loading = agentId !== "" && loaded?.agentId !== agentId;

  useEffect(() => {
    if (!agentId) return;
    let live = true;
    void getAgentByIdAction(agentId).then((res) => {
      if (!live) return;
      setLoaded({ agentId, sources: httpBodySchemaSources(res.agent?.internalTools), failed: !res.agent });
    });
    return () => {
      live = false;
    };
  }, [agentId]);

  const current = !loading && loaded?.agentId === agentId ? loaded : null;

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-background p-3">
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      {renderAgentPicker({
        value: agentId,
        onChange: (next) => {
          setAgentId(next);
          setOutcome(null);
        },
      })}
      {loading && (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <CircleNotch size={12} className="animate-spin" />
          {t("loading")}
        </div>
      )}
      {current?.failed && <Notice tone="fault">{t("loadFailed")}</Notice>}
      {current && !current.failed && current.sources.length === 0 && (
        <p className="text-2xs text-muted-foreground">{t("noHttpTools")}</p>
      )}
      {current && current.sources.length > 0 && (
        <ul className="space-y-2">
          {current.sources.map((source) => (
            <li key={source.key} className="flex items-center gap-2 rounded-[--radius] border border-border px-2.5 py-2">
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{source.method}</span>
              <code className="min-w-0 flex-1 truncate text-2xs text-foreground/70">{source.url}</code>
              <span className="shrink-0 text-2xs text-muted-foreground">{t("fields", { count: source.fields })}</span>
              <ElevatedButton
                variant="secondary"
                size="sm"
                title={t("apply")}
                onClick={() => setOutcome(onImport(source.bodySchema))}
              />
            </li>
          ))}
        </ul>
      )}
      {outcome && (
        <p className="text-2xs text-muted-foreground" role="status">
          {t("result", { count: outcome.added })}
          {outcome.skipped.length > 0 ? ` ${t("skipped", { names: outcome.skipped.map((name) => name || "?").join(", ") })}` : ""}
        </p>
      )}
    </div>
  );
}

interface AgentReplyFieldsFieldProps {
  value: unknown;
  onChange: (fields: ReplyField[]) => void;
  availableVars: VarGroup[];
}

export function AgentReplyFieldsField({ value, onChange, availableVars }: AgentReplyFieldsFieldProps) {
  const t = useTranslations("workflowsPage.replyToAgent");
  const fields = useMemo(() => readReplyFields(value), [value]);
  const repeated = useMemo(() => {
    const seen = new Set<string>();
    const twice = new Set<number>();
    fields.forEach((field, index) => {
      const key = field.key.trim();
      if (key && seen.has(key)) twice.add(index);
      seen.add(key);
    });
    return twice;
  }, [fields]);

  const update = (index: number, patch: Partial<ReplyField>) =>
    onChange(fields.map((field, at) => (at === index ? { ...field, ...patch } : field)));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-foreground">{t("title")}</p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{t("description")}</p>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {fields.map((field, index) => (
            <li key={index} className="space-y-3 rounded-[--radius] border border-border bg-mist p-3" data-testid="agent-reply-field">
              <ElevatedInput
                label={t("key")}
                value={field.key}
                onChange={(event) => update(index, { key: event.target.value })}
                placeholder="status"
                controlSize="sm"
                inputClassName="font-mono text-xs"
                error={repeated.has(index) ? t("repeatedKey") : undefined}
              />
              <VariableCommandInput
                label={t("value")}
                value={field.value}
                onChange={(next) => update(index, { value: next })}
                placeholder="{{node.n5.status}}"
                controlSize="sm"
                availableVars={availableVars}
                multiline
              />
              <div className="flex justify-end">
                <ElevatedButton
                  variant="ghost"
                  size="sm"
                  title={t("remove")}
                  icon={<Trash size={14} />}
                  iconVisible
                  onClick={() => onChange(fields.filter((_, at) => at !== index))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ElevatedButton
        variant="secondary"
        size="sm"
        icon={<Plus size={14} />}
        iconVisible
        title={t("add")}
        onClick={() => onChange([...fields, { key: "", value: "" }])}
      />
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("redactionNote")}</p>
    </div>
  );
}
