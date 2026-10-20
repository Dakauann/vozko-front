"use client";

import { useTranslations } from "next-intl";

import { AGENT_CALL_INPUTS_KEY, REPLY_TO_AGENT_FIELDS_KEY, readAgentCallInputs, readReplyFields } from "@/lib/workflows/agent-call";

import { EmptyPreview } from "../message-node-primitives";

const VISIBLE_ROWS = 4;

export function AgentCallTriggerPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.agentCall");
  const names = readAgentCallInputs(config[AGENT_CALL_INPUTS_KEY]).filter((input) => input.name.trim() !== "");
  if (names.length === 0) return <span className="text-2xs text-muted-foreground">{t("noInputs")}</span>;
  const hidden = names.length - VISIBLE_ROWS;
  return (
    <div className="flex flex-wrap gap-1">
      {names.slice(0, VISIBLE_ROWS).map((input) => (
        <code key={input.name} data-testid="agent-call-input-chip" className="rounded bg-muted px-1.5 py-0.5 text-2xs text-foreground/70">
          {input.name}
          {input.required ? "*" : ""}
        </code>
      ))}
      {hidden > 0 ? <span className="text-2xs text-muted-foreground">{t("more", { count: hidden })}</span> : null}
    </div>
  );
}

export function ReplyToAgentPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.replyToAgent");
  const fields = readReplyFields(config[REPLY_TO_AGENT_FIELDS_KEY]).filter((field) => field.key.trim() !== "");
  if (fields.length === 0) return <EmptyPreview label={t("empty")} />;
  const hidden = fields.length - VISIBLE_ROWS;
  return (
    <div className="space-y-1 rounded-lg bg-muted px-2.5 py-1.5">
      {fields.slice(0, VISIBLE_ROWS).map((field, index) => (
        <p key={`${field.key}-${index}`} data-testid="reply-to-agent-field" className="flex min-w-0 gap-1.5 text-2xs">
          <span className="shrink-0 text-muted-foreground">{field.key}</span>
          <code className="min-w-0 truncate text-foreground/70">{field.value}</code>
        </p>
      ))}
      {hidden > 0 ? <p className="text-2xs text-muted-foreground">{t("more", { count: hidden })}</p> : null}
    </div>
  );
}
