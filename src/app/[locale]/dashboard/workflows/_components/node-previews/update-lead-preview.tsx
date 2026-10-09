"use client";

import { useTranslations } from "next-intl";

import { normalizeKeyValueMap } from "@/lib/workflows/key-value";

import { EmptyPreview } from "../message-node-primitives";
import { useNodeDefinition } from "./node-definitions";

const KEY_VALUE_FIELD = "keyvalue";

const VISIBLE_ROWS = 4;

export function UpdateLeadPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage");
  const definition = useNodeDefinition("action_update_lead");
  if (!definition?.configSchema) return null;

  const rows: { key: string; label: string; value: string }[] = [];
  for (const field of definition.configSchema) {
    if (field.type === KEY_VALUE_FIELD) {
      for (const [key, raw] of Object.entries(normalizeKeyValueMap(config[field.key]))) {
        const value = raw.trim();
        if (key.trim() && value) rows.push({ key: `${field.key}:${key}`, label: t("updateLead.customField", { key }), value });
      }
      continue;
    }
    const value = typeof config[field.key] === "string" ? (config[field.key] as string).trim() : "";
    if (value) rows.push({ key: field.key, label: field.label, value });
  }

  if (rows.length === 0) return <EmptyPreview label={t("updateLead.empty")} />;
  const hidden = rows.length - VISIBLE_ROWS;

  return (
    <div className="space-y-1 rounded-lg bg-muted px-2.5 py-1.5">
      {rows.slice(0, VISIBLE_ROWS).map((row) => (
        <p key={row.key} data-testid="update-lead-field" className="flex min-w-0 gap-1.5 text-2xs">
          <span className="shrink-0 text-muted-foreground">{row.label}</span>
          <code className="min-w-0 truncate text-foreground/70">{row.value}</code>
        </p>
      ))}
      {hidden > 0 ? <p className="text-2xs text-muted-foreground">{t("updateLead.more", { count: hidden })}</p> : null}
    </div>
  );
}
