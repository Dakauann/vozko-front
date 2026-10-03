"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import { createAdDraftAction } from "@/app/actions/advertising-drafts";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { Info, Warning } from "@/components/icons";
import { draftEditorHref } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import { buildDraft, parentFromRow } from "@/lib/advertising/draft";
import type { AdObjective } from "@/lib/advertising/draft-types";
import { choiceObjective, createdLevels, initialForm, type CreateChoice } from "@/lib/advertising/editor-create";
import type { AdAccount } from "@/lib/advertising/types";
import { routesFor } from "@/lib/advertising/wizard-routes";

import { WizardReadinessBanner } from "../readiness";
import { useAdReadiness } from "../use-ad-readiness";
import { useAdsErrorText } from "../use-ads-error";
import { Hint } from "../wizard/choice-row";
import { useAdsResource } from "../wizard/use-ads-resource";
import { useStructureRows } from "../wizard/use-structure-rows";
import { useWizardLabels } from "../wizard/use-wizard-labels";
import { ObjectivePicker } from "./objective-picker";

export interface CreateParent {
  campaignId?: string;
  adSetId?: string;
}

export interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AdAccount[];
  accountId: string;
  initialParent?: CreateParent;
}

type CreateTab = "new" | "existing";

const AUCTION = "AUCTION";

const keepAccount = () => undefined;

export function CreateCampaignDialog({ open, onOpenChange, accounts, accountId, initialParent }: CreateCampaignDialogProps) {
  const t = useTranslations("adsCreate");
  const account = accounts.find((candidate) => candidate.id === accountId);
  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-3xl">
        {open && account ? <CreateBody account={account} initialParent={initialParent} onCancel={() => onOpenChange(false)} /> : null}
        {open && !account ? (
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>{t("noAccount")}</ElevatedDialogDescription>
          </ElevatedDialogHeader>
        ) : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function CreateBody({ account, initialParent, onCancel }: { account: AdAccount; initialParent?: CreateParent; onCancel: () => void }) {
  const t = useTranslations("adsCreate");
  const router = useRouter();
  const labels = useWizardLabels();
  const errorText = useAdsErrorText();
  const [now] = useState(() => new Date());
  const today = civilToday(account.timezone, now);
  const [tab, setTab] = useState<CreateTab>(initialParent?.campaignId || initialParent?.adSetId ? "existing" : "new");
  const [objective, setObjective] = useState<AdObjective | "">("");
  const [campaignId, setCampaignId] = useState(initialParent?.campaignId ?? "");
  const [adSetId, setAdSetId] = useState(initialParent?.adSetId ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readiness = useAdReadiness(account, keepAccount);
  const options = useAdsResource("ads-options", getAdsOptionsAction);
  const existing = tab === "existing";
  const campaignRows = useStructureRows(account.id, "campaign", existing, today);
  const adSetRows = useStructureRows(account.id, "adset", existing, today);
  const campaigns = campaignRows.status === "ready" ? campaignRows.data : [];
  const adSets = adSetRows.status === "ready" ? adSetRows.data : [];
  const adSetRow = adSets.find((row) => row.metaId === adSetId);
  const chosenCampaignId = campaignId || adSetRow?.campaignId || "";
  const campaignRow = campaigns.find((row) => row.metaId === chosenCampaignId);
  const optionsData = options.status === "ready" ? options.data : null;

  const choice: CreateChoice | null = existing
    ? campaignRow
      ? { kind: "existing", campaign: parentFromRow(campaignRow), adSet: adSetRow && adSetRow.campaignId === campaignRow.metaId ? parentFromRow(adSetRow) : null }
      : null
    : objective
      ? { kind: "new", objective }
      : null;

  const create = () => {
    if (!choice || !optionsData || creating) return;
    const chosen = choiceObjective(choice);
    const objectiveName = labels.objective(chosen ?? (choice.kind === "existing" ? choice.campaign.objective : ""));
    const form = initialForm(account.id, choice, chosen ? routesFor(optionsData, chosen) : [], {
      campaign: t("names.campaign", { objective: objectiveName }),
      adSet: t("names.adSet", { objective: objectiveName }),
      ad: t("names.ad", { objective: objectiveName }),
    });
    setCreating(true);
    setError(null);
    void createAdDraftAction(buildDraft(form, { timezone: account.timezone, currency: account.currency })).then((result) => {
      if (isAdsError(result)) {
        setCreating(false);
        setError(errorText(result));
        return;
      }
      router.push(draftEditorHref(result.data.id));
    });
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription className="sr-only">{t("description")}</ElevatedDialogDescription>
        <Tabs value={tab} onValueChange={(value) => setTab(value as CreateTab)}>
          <TabsList>
            <TabsTrigger value="new">{t("tabs.new")}</TabsTrigger>
            <TabsTrigger value="existing">{t("tabs.existing")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-5">
        <WizardReadinessBanner account={account} state={readiness} canCreate />
        {options.status === "error" ? <p className="text-sm text-destructive-ink">{options.message}</p> : null}
        {existing ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("existingDescription")}</p>
            <ElevatedCommandSelect
              label={t("campaign")}
              fullWidth
              value={chosenCampaignId || null}
              isLoading={campaignRows.status === "loading"}
              emptyMessage={campaignRows.status === "error" ? campaignRows.message : t("noCampaigns")}
              searchPlaceholder={t("search")}
              options={campaigns.map((row) => ({ value: row.metaId, label: row.name, description: labels.objective(row.objective) }))}
              onValueChange={(value) => {
                setCampaignId(value);
                setAdSetId("");
              }}
            />
            <ElevatedCommandSelect
              label={t("adSetOptional")}
              fullWidth
              disabled={!chosenCampaignId}
              value={adSetId || null}
              isLoading={adSetRows.status === "loading"}
              emptyMessage={adSetRows.status === "error" ? adSetRows.message : t("noAdSets")}
              searchPlaceholder={t("search")}
              options={adSets
                .filter((row) => row.campaignId === chosenCampaignId)
                .map((row) => ({ value: row.metaId, label: row.name, description: labels.destination(row.destinationType) }))}
              onValueChange={setAdSetId}
            />
            {choice ? (
              <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t(`creates.${createdLevels(choice).join("_")}`)}</Hint>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="max-w-xs">
              <ElevatedSelect label={t("buyingTypeTitle")} value={AUCTION} onValueChange={() => undefined}>
                <ElevatedSelectItem value={AUCTION}>{t("auction")}</ElevatedSelectItem>
              </ElevatedSelect>
            </div>
            <ObjectivePicker options={optionsData} value={objective} onChange={setObjective} />
          </div>
        )}
        {error ? (
          <p className="flex items-center gap-2 text-sm text-destructive-ink" role="alert">
            <Warning className="h-4 w-4" aria-hidden />
            {error}
          </p>
        ) : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button variant="secondary" title={t("cancel")} onClick={onCancel} />
        <Button variant="primary" title={creating ? t("creating") : t("continue")} disabled={!choice || !optionsData || creating} onClick={create} />
      </ElevatedDialogFooter>
    </>
  );
}
