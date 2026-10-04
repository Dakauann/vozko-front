"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  connectConversionDatasetAction,
  getConversionSettingsAction,
  saveConversionSettingsAction,
} from "@/app/actions/advertising-conversions";
import { isAdsError } from "@/app/actions/advertising";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { CheckCircle, ShieldCheck, Warning, WhatsappLogo } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { useToast } from "@/hooks/use-toast";
import {
  sameSettings,
  settingsForAccount,
  settingsProblems,
  type ConversionSettings,
  type Pixel,
} from "@/lib/advertising/conversions";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";
import type { ConversionPermissions } from "./conversions-page";

const PHONES_PAGE_SIZE = 100;
const NO_PIXEL = "none";

const loadPhones = () => listBusinessPhonesAction({ pageSize: PHONES_PAGE_SIZE, ownership: "owned" });

export function ConversionSettingsCard({
  account,
  accounts,
  pixels,
  permissions,
}: {
  account: AdAccount;
  accounts: AdAccount[];
  pixels: Pixel[];
  permissions: ConversionPermissions;
}) {
  const t = useTranslations("adsConversions.settings");
  const settings = useKeyedLoad("settings", getConversionSettingsAction);
  const response = settings.value;

  return (
    <section className="space-y-3 rounded-[--radius] border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {settings.loading ? <div className="h-40 animate-pulse rounded-[--radius] bg-muted" /> : null}
      {response && isAdsError(response) ? (
        <div className="flex items-center gap-2 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" aria-hidden />
          {response.error}
          <button type="button" onClick={settings.reload} className="ml-auto font-semibold text-primary-ink hover:underline">
            {t("retry")}
          </button>
        </div>
      ) : null}
      {response && !isAdsError(response) ? (
        <SettingsForm
          key={account.id}
          account={account}
          accounts={accounts}
          saved={response.data}
          pixels={pixels}
          canUpdate={permissions.canUpdate}
          onSaved={settings.reload}
        />
      ) : null}
    </section>
  );
}

function SettingsForm({
  account,
  accounts,
  saved,
  pixels,
  canUpdate,
  onSaved,
}: {
  account: AdAccount;
  accounts: AdAccount[];
  saved: ConversionSettings | null;
  pixels: Pixel[];
  canUpdate: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("adsConversions.settings");
  const { toast } = useToast();
  const [form, setForm] = useState<ConversionSettings>(() => settingsForAccount(saved, account.id));
  const [phoneId, setPhoneId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const phones = useKeyedLoad(canUpdate ? "phones" : null, loadPhones);
  const phoneList = phones.value?.phones ?? [];
  const phonesError = phones.value?.error ?? null;

  const linkedAccount = saved?.adAccountId ? accounts.find((candidate) => candidate.id === saved.adAccountId) : undefined;
  const otherAccount = saved?.adAccountId && saved.adAccountId !== account.id;
  const problems = settingsProblems(form);
  const dirty = !saved || !sameSettings(form, saved);
  const patch = (change: Partial<ConversionSettings>) => setForm((current) => ({ ...current, ...change }));

  const connect = async () => {
    if (!phoneId) return;
    setConnecting(true);
    const outcome = await connectConversionDatasetAction(phoneId);
    setConnecting(false);
    if (isAdsError(outcome)) {
      toast({ title: t("dataset.failed"), description: outcome.error, variant: "destructive" });
      return;
    }
    patch({ datasetId: outcome.data.datasetId });
    toast({ title: t("dataset.connected"), description: t("dataset.saveHint") });
  };

  const save = async () => {
    setSaving(true);
    const outcome = await saveConversionSettingsAction(form);
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      if (!outcome.expected) toast({ title: t("saveFailed"), description: outcome.error, variant: "destructive" });
      return;
    }
    setExpected({});
    toast({ title: t("saved") });
    onSaved();
  };

  return (
    <div className="space-y-5">
      {otherAccount ? (
        <Alert variant="info">
          <AlertDescription>{t("otherAccount", { name: linkedAccount?.name ?? saved?.adAccountId ?? "" })}</AlertDescription>
        </Alert>
      ) : null}

      <ElevatedSwitch
        checked={form.enabled}
        disabled={!canUpdate}
        onCheckedChange={(enabled) => patch({ enabled })}
        label={t("enabled")}
        description={t("enabledHint")}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ElevatedSwitch
          checked={form.enabled && form.sendLeads}
          disabled={!canUpdate || !form.enabled}
          onCheckedChange={(sendLeads) => patch({ sendLeads })}
          label={t("sendLeads")}
          description={t("sendLeadsHint")}
        />
        <ElevatedSwitch
          checked={form.enabled && form.sendPurchases}
          disabled={!canUpdate || !form.enabled}
          onCheckedChange={(sendPurchases) => patch({ sendPurchases })}
          label={t("sendPurchases")}
          description={t("sendPurchasesHint")}
        />
      </div>
      {problems.includes("nothing_to_send") ? <p className="text-xs text-warning-ink">{t("problems.nothing_to_send")}</p> : null}
      <IssueList namespace="adsConversions" issues={[...issuesAt(expected, "sendLeads"), ...issuesAt(expected, "sendPurchases")]} />

      <div className="space-y-2 rounded-[--radius] border border-border px-4 py-3">
        <div className="flex items-start gap-2">
          <WhatsappLogo className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t("dataset.title")}</p>
            <p className="text-xs text-muted-foreground">{t("dataset.description")}</p>
          </div>
        </div>
        {form.datasetId ? (
          <p className="flex items-center gap-1.5 text-sm text-healthy-ink">
            <CheckCircle className="h-4 w-4" aria-hidden />
            {t("dataset.linked", { id: form.datasetId })}
          </p>
        ) : null}
        {canUpdate ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-72 max-w-full">
              <ElevatedSelect
                label={t("dataset.phone")}
                value={phoneId || undefined}
                onValueChange={setPhoneId}
                disabled={phones.loading || phoneList.length === 0}
              >
                {phoneList.map((phone) => (
                  <ElevatedSelectItem key={phone.id} value={phone.id}>
                    {phone.verifiedName ? `${phone.verifiedName} · ${phone.displayPhoneNumber}` : phone.displayPhoneNumber}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <Button
              variant="secondary"
              title={connecting ? t("dataset.connecting") : form.datasetId ? t("dataset.reconnect") : t("dataset.connect")}
              onClick={connect}
              disabled={connecting || !phoneId}
            />
          </div>
        ) : null}
        {canUpdate && !phones.loading && phoneList.length === 0 ? (
          <p className="text-xs text-muted-foreground">{phonesError ?? t("dataset.noPhones")}</p>
        ) : null}
        <IssueList namespace="adsConversions" issues={issuesAt(expected, "datasetId")} />
      </div>

      <div className="space-y-1">
        <div className="w-72 max-w-full">
          <ElevatedSelect
            label={t("pixel")}
            value={form.pixelId || NO_PIXEL}
            onValueChange={(value) => patch({ pixelId: value === NO_PIXEL ? undefined : value })}
            disabled={!canUpdate}
          >
            <ElevatedSelectItem value={NO_PIXEL}>{t("noPixel")}</ElevatedSelectItem>
            {pixels.map((pixel) => (
              <ElevatedSelectItem key={pixel.metaId} value={pixel.metaId}>
                {pixel.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <p className="text-xs text-muted-foreground">{t("pixelHint")}</p>
        <IssueList namespace="adsConversions" issues={issuesAt(expected, "pixelId")} />
      </div>
      {problems.includes("needs_target") ? <p className="text-xs text-warning-ink">{t("problems.needs_target")}</p> : null}

      <div className="flex items-start gap-2.5 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-healthy-ink" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{t("privacy.title")}</p>
          <p className="text-xs text-muted-foreground">{t("privacy.body")}</p>
        </div>
      </div>

      {canUpdate ? (
        <div className="flex justify-end">
          <Button variant="primary" title={saving ? t("saving") : t("save")} onClick={save} disabled={saving || !dirty} />
        </div>
      ) : null}
    </div>
  );
}
