"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createSavedAudienceAction, updateSavedAudienceAction } from "@/app/actions/advertising-audiences";
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
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import {
  AUDIENCE_MAX_AGE,
  AUDIENCE_MIN_AGE,
  GENDER_CHOICES,
  emptySavedAudience,
  genderChoiceOf,
  gendersOf,
  type GenderChoice,
  type SavedAudience,
  type SavedAudienceInput,
} from "@/lib/advertising/audiences";
import { MIN_CITY_RADIUS_KM } from "@/lib/advertising/draft";
import { issuesAt, issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";
import { LocationPicker } from "../wizard/location-picker";

const AGES = Array.from({ length: AUDIENCE_MAX_AGE - AUDIENCE_MIN_AGE + 1 }, (_, index) => AUDIENCE_MIN_AGE + index);

export function SavedAudienceDialog({
  account,
  audience,
  onClose,
  onSaved,
}: {
  account: AdAccount;
  audience: SavedAudience | null;
  onClose: () => void;
  onSaved: (audience: SavedAudience, created: boolean) => void;
}) {
  const t = useTranslations("adsAudiences.saved.editor");
  const [form, setForm] = useState<SavedAudienceInput>(() =>
    audience ? { name: audience.name, targeting: audience.targeting, placements: audience.placements } : emptySavedAudience(),
  );
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const targeting = form.targeting;
  const ageLabel = (age: number) => (age === AUDIENCE_MAX_AGE ? t("agePlus", { age }) : String(age));

  const patchTargeting = (patch: Partial<SavedAudienceInput["targeting"]>) =>
    setForm((current) => ({ ...current, targeting: { ...current.targeting, ...patch } }));

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    const input = { ...form, name: form.name.trim() };
    const outcome = audience ? await updateSavedAudienceAction(audience.id, input) : await createSavedAudienceAction(input);
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onSaved(outcome.data, !audience);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{audience ? t("editTitle") : t("createTitle")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-5">
          <div className="space-y-1">
            <ElevatedInput
              label={t("name")}
              placeholder=" "
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <IssueList namespace="adsAudiences" issues={issuesAt(expected, "name")} />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t("locations")}</h3>
            <LocationPicker
              accountId={account.id}
              value={targeting.locations ?? []}
              minRadius={MIN_CITY_RADIUS_KM}
              label={t("locationSearch")}
              onChange={(locations) => patchTargeting({ locations })}
            />
            <IssueList namespace="adsAudiences" issues={issuesUnder(expected, "targeting.locations")} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t("people")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <ElevatedSelect
                label={t("ageMin")}
                value={String(targeting.ageMin)}
                onValueChange={(value) => patchTargeting({ ageMin: Number(value), ageMax: Math.max(Number(value), targeting.ageMax) })}
              >
                {AGES.map((age) => (
                  <ElevatedSelectItem key={age} value={String(age)}>
                    {ageLabel(age)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              <ElevatedSelect
                label={t("ageMax")}
                value={String(targeting.ageMax)}
                onValueChange={(value) => patchTargeting({ ageMax: Number(value), ageMin: Math.min(Number(value), targeting.ageMin) })}
              >
                {AGES.map((age) => (
                  <ElevatedSelectItem key={age} value={String(age)}>
                    {ageLabel(age)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <IssueList namespace="adsAudiences" issues={issuesUnder(expected, "targeting.age")} />
            <ElevatedSegmentedControl
              options={GENDER_CHOICES.map((choice) => ({ value: choice, label: t(`genders.${choice}`) }))}
              value={genderChoiceOf(targeting.genders)}
              onChange={(value) => patchTargeting({ genders: gendersOf(value as GenderChoice) })}
              size="sm"
              columns={3}
            />
            <IssueList namespace="adsAudiences" issues={issuesUnder(expected, "targeting.genders")} />
            <ElevatedSwitch
              checked={targeting.advantageAudience}
              onCheckedChange={(advantageAudience) => patchTargeting({ advantageAudience })}
              label={t("advantage")}
              description={t("advantageHint")}
            />
          </section>
          {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} />
          <Button variant="primary" title={saving ? t("saving") : t("save")} onClick={submit} disabled={saving} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
