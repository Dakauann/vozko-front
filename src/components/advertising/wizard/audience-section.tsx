"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createSavedAudienceAction, listAudiencesAction, listSavedAudiencesAction } from "@/app/actions/advertising-audiences";
import { isAdsError } from "@/app/actions/advertising";
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
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { FloppyDisk, Lock } from "@/components/icons";
import { RadioGroup } from "@/components/ui/radio-group";
import { MAX_AGE, MIN_AGE, ageMinOptions, isRestrictedCategory, minCityRadius, withAdvantageAudience } from "@/lib/advertising/draft";
import type { AdDraftTargeting, AdTargetRef } from "@/lib/advertising/draft-types";

import { useAdsFormat } from "../use-ads-format";
import { ChoiceRow, ExternalLink, Hint, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { LocationPicker } from "./location-picker";
import { RefChips, addRef, removeRef } from "./ref-chips";
import { TargetingSearch } from "./targeting-search";
import { readyData, useAdsResource } from "./use-ads-resource";
import { useWizard } from "./wizard-context";

type GenderChoice = "all" | "male" | "female";

const GENDERS: GenderChoice[] = ["all", "male", "female"];
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, index) => MIN_AGE + index);

function genderOf(genders: number[] | undefined): GenderChoice {
  if (genders?.length === 1) return genders[0] === 1 ? "male" : "female";
  return "all";
}

function gendersFor(choice: GenderChoice): number[] | undefined {
  if (choice === "male") return [1];
  if (choice === "female") return [2];
  return undefined;
}

function SavedAudiences() {
  const t = useTranslations("adsWizard.audience");
  const { form, update } = useWizard();
  const saved = useAdsResource("saved-audiences", listSavedAudiencesAction);
  const list = readyData(saved) ?? [];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const apply = (id: string) => {
    const chosen = list.find((candidate) => candidate.id === id);
    if (!chosen) return;
    update((current) => ({
      ...current,
      targeting: { ...current.targeting, ...(chosen.targeting as AdDraftTargeting) },
      placements: chosen.placements ?? { automatic: true },
    }));
    setMessage({ tone: "ok", text: t("savedApplied", { name: chosen.name }) });
  };

  const save = async () => {
    setSaving(true);
    const result = await createSavedAudienceAction({ name: name.trim(), targeting: form.targeting, placements: form.placements });
    setSaving(false);
    if (isAdsError(result)) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setOpen(false);
    setName("");
    setMessage({ tone: "ok", text: t("savedDone", { name: result.data.name }) });
    saved.reload();
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <ElevatedSelect label={t("applySaved")} value="" disabled={list.length === 0} onValueChange={apply}>
          {list.map((audience) => (
            <ElevatedSelectItem key={audience.id} value={audience.id}>
              {audience.name}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <Button
          variant="secondary"
          title={t("saveAudience")}
          icon={<FloppyDisk className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={form.targeting.locations.length === 0}
          onClick={() => setOpen(true)}
        />
      </div>
      {saved.status === "ready" && list.length === 0 ? <Hint>{t("noSaved")}</Hint> : null}
      {saved.status === "error" ? <p className="text-xs text-destructive-ink">{saved.message}</p> : null}
      {message ? (
        <p className={message.tone === "ok" ? "text-xs text-healthy-ink" : "text-xs text-destructive-ink"}>{message.text}</p>
      ) : null}
      {open ? (
        <ElevatedDialog open onOpenChange={(next) => !next && setOpen(false)}>
          <ElevatedDialogContent className="max-w-md">
            <ElevatedDialogHeader>
              <ElevatedDialogTitle>{t("saveTitle")}</ElevatedDialogTitle>
              <ElevatedDialogDescription>{t("saveDescription")}</ElevatedDialogDescription>
            </ElevatedDialogHeader>
            <ElevatedDialogBody>
              <ElevatedInput
                label={t("saveName")}
                placeholder=" "
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </ElevatedDialogBody>
            <ElevatedDialogFooter>
              <Button variant="secondary" title={t("cancel")} onClick={() => setOpen(false)} />
              <Button
                variant="primary"
                title={saving ? t("saving") : t("save")}
                disabled={saving || name.trim() === ""}
                onClick={() => void save()}
              />
            </ElevatedDialogFooter>
          </ElevatedDialogContent>
        </ElevatedDialog>
      ) : null}
    </div>
  );
}

function CustomAudiences({ restricted }: { restricted: boolean }) {
  const t = useTranslations("adsWizard.audience");
  const fmt = useAdsFormat();
  const { form, update, issues } = useWizard();
  const audiences = useAdsResource(form.accountId ? `audiences:${form.accountId}` : null, () => listAudiencesAction(form.accountId));
  const data = readyData(audiences);
  const list = data?.audiences ?? [];
  const included = form.targeting.customAudiences ?? [];
  const excluded = form.targeting.excludedCustomAudiences ?? [];
  const taken = new Set([...included, ...excluded].map((ref) => ref.id));

  const setRefs = (field: "customAudiences" | "excludedCustomAudiences", refs: AdTargetRef[]) =>
    update((current) => ({ ...current, targeting: { ...current.targeting, [field]: refs } }));

  const options = list.map((audience) => ({
    value: audience.metaId,
    label: audience.name,
    description:
      audience.approxLower > 0 && audience.approxUpper > 0
        ? t("sizeRange", { lower: fmt.count(audience.approxLower), upper: fmt.count(audience.approxUpper) })
        : undefined,
    disabled: taken.has(audience.metaId),
  }));

  return (
    <div className="space-y-3">
      {data && !data.termsAccepted ? (
        <div className="notice space-y-1 rounded-[--radius] border border-border px-3 py-2.5 text-xs">
          <p className="notice-ink font-semibold">{t("termsTitle")}</p>
          <p className="text-muted-foreground">{t("termsBody")}</p>
          {data.termsUrl ? <ExternalLink href={data.termsUrl}>{t("termsLink")}</ExternalLink> : null}
        </div>
      ) : null}
      {audiences.status === "error" ? <p className="text-xs text-destructive-ink">{audiences.message}</p> : null}
      <ElevatedCommandSelect
        label={t("include")}
        fullWidth
        value={null}
        isLoading={audiences.status === "loading"}
        emptyMessage={t("noAudiences")}
        searchPlaceholder={t("searchPlaceholder")}
        options={options}
        onValueChange={(id, option) => setRefs("customAudiences", addRef(included, { id, name: option.label }))}
      />
      <RefChips
        refs={included}
        removeLabel={(name) => t("remove", { name })}
        onRemove={(ref) => setRefs("customAudiences", removeRef(included, ref))}
      />
      {restricted ? null : (
        <>
          <ElevatedCommandSelect
            label={t("exclude")}
            fullWidth
            value={null}
            isLoading={audiences.status === "loading"}
            emptyMessage={t("noAudiences")}
            searchPlaceholder={t("searchPlaceholder")}
            options={options}
            onValueChange={(id, option) => setRefs("excludedCustomAudiences", addRef(excluded, { id, name: option.label }))}
          />
          <RefChips
            refs={excluded}
            removeLabel={(name) => t("remove", { name })}
            onRemove={(ref) => setRefs("excludedCustomAudiences", removeRef(excluded, ref))}
          />
        </>
      )}
      <FieldIssues issues={issues} field="adSet.targeting.customAudiences" />
      <FieldIssues issues={issues} field="adSet.targeting.excludedCustomAudiences" />
    </div>
  );
}

export function AudienceSection() {
  const t = useTranslations("adsWizard.audience");
  const { form, update, issues } = useWizard();
  const targeting = form.targeting;
  const restricted = isRestrictedCategory(form.specialCategory);
  const minOptions = ageMinOptions(targeting, form.specialCategory);
  const ageLocked = restricted;
  const maxLocked = restricted || targeting.advantageAudience;
  const ageLabel = (age: number) => (age === MAX_AGE ? t("agePlus", { age }) : String(age));

  const setTargeting = (changes: Partial<AdDraftTargeting>) =>
    update((current) => ({ ...current, targeting: { ...current.targeting, ...changes } }));

  return (
    <div className="space-y-6">
      <Section title={t("savedTitle")} description={t("savedDescription")}>
        <SavedAudiences />
      </Section>

      <Section title={t("locationsTitle")} description={t("locationsDescription")}>
        <LocationPicker
          accountId={form.accountId}
          label={t("locationSearch")}
          value={targeting.locations}
          minRadius={minCityRadius(form.specialCategory)}
          onChange={(locations) => setTargeting({ locations })}
        />
        <FieldIssues issues={issues} field="adSet.targeting.locations" />
        {restricted ? null : (
          <>
            <LocationPicker
              accountId={form.accountId}
              label={t("excludedSearch")}
              value={targeting.excludedLocations ?? []}
              minRadius={minCityRadius(form.specialCategory)}
              onChange={(excludedLocations) => setTargeting({ excludedLocations })}
            />
            <FieldIssues issues={issues} field="adSet.targeting.excludedLocations" />
          </>
        )}
      </Section>

      <Section title={t("peopleTitle")}>
        {restricted ? (
          <Hint tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
            {t("restrictedLock")}
          </Hint>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ElevatedSelect
            label={t("ageMin")}
            value={String(targeting.ageMin)}
            disabled={ageLocked}
            onValueChange={(value) => setTargeting({ ageMin: Number(value), ageMax: Math.max(Number(value), targeting.ageMax) })}
          >
            {minOptions.map((age) => (
              <ElevatedSelectItem key={age} value={String(age)}>
                {ageLabel(age)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("ageMax")}
            value={String(targeting.ageMax)}
            disabled={maxLocked}
            onValueChange={(value) => setTargeting({ ageMax: Number(value), ageMin: Math.min(Number(value), targeting.ageMin) })}
          >
            {AGES.map((age) => (
              <ElevatedSelectItem key={age} value={String(age)}>
                {ageLabel(age)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <FieldIssues issues={issues} field="adSet.targeting.age" />
        <RadioGroup
          value={genderOf(targeting.genders)}
          onValueChange={(value) => setTargeting({ genders: gendersFor(value as GenderChoice) })}
          className="grid-cols-1 sm:grid-cols-3"
          aria-label={t("gender")}
        >
          {GENDERS.map((gender) => (
            <ChoiceRow key={gender} value={gender} title={t(`genders.${gender}`)} disabled={restricted && gender !== "all"} />
          ))}
        </RadioGroup>
        <FieldIssues issues={issues} field="adSet.targeting.genders" />
        <ElevatedSwitch
          checked={targeting.advantageAudience}
          onCheckedChange={(on) => update((current) => ({ ...current, targeting: withAdvantageAudience(current.targeting, on) }))}
          label={t("advantage")}
          description={t("advantageHint")}
        />
        {targeting.advantageAudience ? <Hint>{t("advantageAgeNote")}</Hint> : null}
        <FieldIssues issues={issues} field="adSet.targeting.exclusions" />
      </Section>

      <Section title={t("detailedTitle")} description={t("detailedDescription")}>
        <TargetingSearch
          accountId={form.accountId}
          kind="languages"
          value={targeting.languages ?? []}
          onChange={(languages) => setTargeting({ languages })}
        />
        <TargetingSearch
          accountId={form.accountId}
          kind="interests"
          value={targeting.interests ?? []}
          onChange={(interests) => setTargeting({ interests })}
        />
        <TargetingSearch
          accountId={form.accountId}
          kind="behaviors"
          value={targeting.behaviors ?? []}
          onChange={(behaviors) => setTargeting({ behaviors })}
        />
        <FieldIssues issues={issues} field="adSet.targeting.languages" />
        <FieldIssues issues={issues} field="adSet.targeting.interests" />
        <FieldIssues issues={issues} field="adSet.targeting.behaviors" />
      </Section>

      <Section title={t("customTitle")} description={t("customDescription")}>
        <CustomAudiences restricted={restricted} />
      </Section>
    </div>
  );
}
