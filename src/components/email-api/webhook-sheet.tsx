"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isActionError } from "@/app/actions/action-result";
import { createEmailWebhookAction, updateEmailWebhookAction } from "@/app/actions/email-api";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetFooter, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Notice } from "@/components/ui/notice";
import type { EmailWebhookEndpoint } from "@/lib/email-api/types";

export function WebhookSheet({
  endpoint,
  events,
  onClose,
  onSaved,
}: {
  endpoint: EmailWebhookEndpoint | null;
  events: string[];
  onClose: () => void;
  onSaved: (secret: string | null) => void;
}) {
  const t = useTranslations("emailApi.webhooks");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const editing = endpoint !== null;
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [chosen, setChosen] = useState<string[]>(endpoint?.events ?? []);
  const [enabled, setEnabled] = useState(endpoint?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (event: string, checked: boolean) => setChosen((current) => (checked ? [...current, event] : current.filter((e) => e !== event)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const input = { url: url.trim(), events: chosen, enabled };
    if (editing) {
      const result = await updateEmailWebhookAction(endpoint.id, input);
      setSaving(false);
      if (isActionError(result)) {
        setError(describe(result));
        return;
      }
      onSaved(null);
      return;
    }
    const result = await createEmailWebhookAction(input);
    setSaving(false);
    if (isActionError(result)) {
      setError(describe(result));
      return;
    }
    onSaved(result.data.secret);
  };

  return (
    <ElevatedSheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{editing ? t("form.editTitle") : t("form.createTitle")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("form.description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <form
          id="email-webhook-form"
          className="space-y-5 px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <ElevatedInput label={t("form.url")} placeholder=" " type="url" value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="off" spellCheck={false} required />
          <p className="-mt-3 text-xs text-muted-foreground">{t("form.urlHelp")}</p>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{t("form.events")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map((event) => (
                <label key={event} className="flex cursor-pointer items-start gap-2 rounded-[--radius] border border-border px-3 py-2">
                  <Checkbox checked={chosen.includes(event)} onCheckedChange={(checked) => toggle(event, checked === true)} aria-label={event} className="mt-0.5" />
                  <span>
                    <span className="block text-sm text-foreground">{t.has(`eventNames.${event}`) ? t(`eventNames.${event}`) : event}</span>
                    <span className="block font-mono text-2xs text-muted-foreground">{event}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-start justify-between gap-4 rounded-[--radius] border border-border px-3 py-2.5">
            <span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                {t("form.enabled")}
                <ExplainerHint id="email.webhookEnabled" />
              </span>
              <span className="block text-xs text-muted-foreground">{t("form.enabledHelp")}</span>
            </span>
            <ElevatedSwitch checked={enabled} onCheckedChange={setEnabled} aria-label={t("form.enabled")} />
          </label>

          {error ? (
            <Notice tone="fault" title={t("form.failed")}>
              <p>{error}</p>
            </Notice>
          ) : null}
        </form>
        <ElevatedSheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border">
          <Button variant="outline" title={tm("common.cancel")} onClick={onClose} />
          <Button type="submit" form="email-webhook-form" title={saving ? t("form.saving") : t("form.save")} disabled={saving || url.trim() === "" || chosen.length === 0} />
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
