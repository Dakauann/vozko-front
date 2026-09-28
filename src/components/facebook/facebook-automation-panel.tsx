"use client";

import { Warning } from "@/components/icons";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { updateFacebookPageAction } from "@/app/actions/facebook";
import { ChannelAutomationPanel, type ChannelAutomationPayload } from "@/components/channels/channel-automation-panel";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import Textarea from "@/components/elevated-design/elevated-textarea";
import { useFacebookError } from "@/components/facebook/use-facebook-error";
import { withPageConfig } from "@/lib/facebook/page";
import type { FacebookPage } from "@/lib/facebook/types";

export function FacebookAutomationPanel({
  page,
  onUpdated,
}: {
  page: FacebookPage;
  onUpdated: (page: FacebookPage) => void;
}) {
  const describeError = useFacebookError();

  const save = async (pageId: string, payload: ChannelAutomationPayload) => {
    const result = await updateFacebookPageAction(pageId, withPageConfig(page, payload));
    if ("error" in result) return { error: describeError(result) };
    return { account: result.account };
  };

  return (
    <div className="space-y-6">
      <ChannelAutomationPanel<FacebookPage>
        account={page}
        onUpdated={onUpdated}
        onSave={save}
        translationNamespace="facebook.automation"
        controlId="fb-automation-enabled"
        showHandling
        dealEntryType="facebook"
      />
      <AutomationDisclosureEditor page={page} onUpdated={onUpdated} />
    </div>
  );
}

function AutomationDisclosureEditor({
  page,
  onUpdated,
}: {
  page: FacebookPage;
  onUpdated: (page: FacebookPage) => void;
}) {
  const t = useTranslations("facebook.automation");
  const describeError = useFacebookError();
  const [text, setText] = useState(page.automationDisclosure);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== page.automationDisclosure.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateFacebookPageAction(page.id, withPageConfig(page, { automationDisclosure: text.trim() }));
    setSaving(false);
    if ("error" in result) {
      setError(describeError(result));
      return;
    }
    if (result.account) {
      onUpdated(result.account);
      setText(result.account.automationDisclosure);
    }
    setSaved(true);
  };

  return (
    <ElevatedContainer className="space-y-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("disclosureTitle")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("disclosureHint")}</p>
      </div>
      <Textarea
        value={text}
        rows={2}
        disabled={saving}
        placeholder={t("disclosurePlaceholder")}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      {error ? (
        <p className="flex items-start gap-2 text-xs text-destructive-ink">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-healthy-ink">{t("saved")}</span> : null}
        <Button
          size="sm"
          variant="primary"
          title={saving ? t("saving") : t("disclosureSave")}
          disabled={saving || !dirty}
          onClick={() => void save()}
        />
      </div>
    </ElevatedContainer>
  );
}
