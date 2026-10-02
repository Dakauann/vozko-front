"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createLookalikeAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Info } from "@/components/icons";
import { Slider } from "@/components/ui/slider";
import {
  MAX_LOOKALIKE_PERCENT,
  MIN_LOOKALIKE_PERCENT,
  clampLookalikePercent,
  type Audience,
} from "@/lib/advertising/audiences";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";

const DEFAULT_PERCENT = 1;

export function LookalikeDialog({
  account,
  origins,
  onClose,
  onCreated,
}: {
  account: AdAccount;
  origins: Audience[];
  onClose: () => void;
  onCreated: (audience: Audience) => void;
}) {
  const t = useTranslations("adsAudiences.lookalike");
  const [originId, setOriginId] = useState(origins[0]?.metaId ?? "");
  const [percent, setPercent] = useState(DEFAULT_PERCENT);
  const origin = origins.find((audience) => audience.metaId === originId);
  const [name, setName] = useState("");
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const suggested = origin ? t("suggestedName", { origin: origin.name, percent }) : "";

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    const outcome = await createLookalikeAction({
      adAccountId: account.id,
      name: name.trim() || suggested,
      originAudienceId: originId,
      percent,
    });
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onCreated(outcome.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent>
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-5">
          <div className="space-y-1">
            <ElevatedSelect label={t("origin")} value={originId} onValueChange={setOriginId}>
              {origins.map((audience) => (
                <ElevatedSelectItem key={audience.metaId} value={audience.metaId}>
                  {audience.name}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <IssueList namespace="adsAudiences" issues={issuesAt(expected, "originAudienceId")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{t("size")}</span>
              <span className="font-display text-lg font-semibold tabular-nums text-foreground">{t("percent", { percent })}</span>
            </div>
            <Slider
              min={MIN_LOOKALIKE_PERCENT}
              max={MAX_LOOKALIKE_PERCENT}
              step={1}
              value={[percent]}
              onValueChange={([value]) => setPercent(clampLookalikePercent(value))}
              aria-label={t("size")}
            />
            <div className="flex justify-between text-2xs text-muted-foreground">
              <span>{t("closer")}</span>
              <span>{t("broader")}</span>
            </div>
            <IssueList namespace="adsAudiences" issues={issuesAt(expected, "percent")} />
            <p className="text-xs text-muted-foreground">{t("sizeHint")}</p>
          </div>

          <div className="space-y-1">
            <ElevatedInput label={t("name")} placeholder=" " value={name} onChange={(event) => setName(event.target.value)} />
            {!name.trim() && suggested ? <p className="text-xs text-muted-foreground">{t("nameHint", { name: suggested })}</p> : null}
            <IssueList namespace="adsAudiences" issues={issuesAt(expected, "name")} />
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("locationHint")}
          </p>
          {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} />
          <Button variant="primary" title={saving ? t("creating") : t("create")} onClick={submit} disabled={saving || !originId} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
