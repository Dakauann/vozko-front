"use client";

import { useTranslations } from "next-intl";

import { configText } from "@/lib/workflows/config-text";
import { formTriggerIds, readSendFormConfig } from "@/lib/workflows/form-node";

import { ChatSurface, EmptyPreview, MessageBubble } from "../message-node-primitives";

export function SendFormPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.sendForm");
  const form = readSendFormConfig(config);
  const formName = configText(config._display_form_id) || form.form_id;
  if (!form.form_id) return <EmptyPreview label={t("noForm")} />;
  return (
    <ChatSurface>
      <MessageBubble
        headerText={form.header || undefined}
        body={form.body || undefined}
        emptyBodyLabel={t("noBody")}
        footer={[form.cta || t("defaultCta"), formName].filter(Boolean).join(" · ")}
      />
    </ChatSurface>
  );
}

export function FormTriggerPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.formTrigger");
  const ids = formTriggerIds(config);
  const names = configText(config._display_form_ids);
  if (ids.length === 0) return <span className="text-2xs text-muted-foreground">{t("anyForm")}</span>;
  return (
    <span className="line-clamp-2 text-2xs text-muted-foreground">{names || t("someForms", { count: ids.length })}</span>
  );
}
