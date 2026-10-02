"use client";

import { useTranslations } from "next-intl";

import { listAudiencesAction } from "@/app/actions/advertising-audiences";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Hint, Section } from "@/components/advertising/wizard/choice-row";
import { LocationPicker } from "@/components/advertising/wizard/location-picker";
import { RefChips, addRef, removeRef } from "@/components/advertising/wizard/ref-chips";
import { TargetingSearch } from "@/components/advertising/wizard/targeting-search";
import { readyData, useAdsResource } from "@/components/advertising/wizard/use-ads-resource";
import { MAX_AGE, MIN_CITY_RADIUS_KM, ageMinOptions, withAdvantageAudience } from "@/lib/advertising/draft";
import type { AdDraftTargeting, AdTargetRef } from "@/lib/advertising/draft-types";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";

import { IssueList } from "../field-issue";

type GenderChoice = "all" | "male" | "female";

const GENDERS: GenderChoice[] = ["all", "male", "female"];

function genderOf(genders: number[] | undefined): GenderChoice {
  if (genders?.length === 1) return genders[0] === 1 ? "male" : "female";
  return "all";
}

function gendersFor(choice: GenderChoice): number[] | undefined {
  if (choice === "male") return [1];
  if (choice === "female") return [2];
  return undefined;
}

function AudienceRefs({
  accountId,
  targeting,
  onChange,
}: {
  accountId: string;
  targeting: AdDraftTargeting;
  onChange: (targeting: AdDraftTargeting) => void;
}) {
  const t = useTranslations("adsManager.edit.targeting");
  const audiences = useAdsResource(`audiences:${accountId}`, () => listAudiencesAction(accountId));
  const list = readyData(audiences)?.audiences ?? [];
  const included = targeting.customAudiences ?? [];
  const excluded = targeting.excludedCustomAudiences ?? [];
  const taken = new Set([...included, ...excluded].map((ref) => ref.id));
  const options = list.map((audience) => ({ value: audience.metaId, label: audience.name, disabled: taken.has(audience.metaId) }));

  const set = (field: "customAudiences" | "excludedCustomAudiences", refs: AdTargetRef[]) => onChange({ ...targeting, [field]: refs });

  return (
    <div className="space-y-2">
      {audiences.status === "error" ? <p className="text-xs text-destructive-ink">{audiences.message}</p> : null}
      {(["customAudiences", "excludedCustomAudiences"] as const).map((field) => {
        const refs = field === "customAudiences" ? included : excluded;
        return (
          <div key={field} className="space-y-1.5">
            <ElevatedCommandSelect
              label={t(field)}
              fullWidth
              value={null}
              isLoading={audiences.status === "loading"}
              emptyMessage={t("noAudiences")}
              searchPlaceholder={t("search")}
              options={options}
              onValueChange={(id, option) => set(field, addRef(refs, { id, name: option.label }))}
            />
            <RefChips refs={refs} removeLabel={(name) => t("remove", { name })} onRemove={(ref) => set(field, removeRef(refs, ref))} />
          </div>
        );
      })}
    </div>
  );
}

export function TargetingFields({
  accountId,
  targeting,
  expected,
  onChange,
}: {
  accountId: string;
  targeting: AdDraftTargeting;
  expected: ExpectedIssues;
  onChange: (targeting: AdDraftTargeting) => void;
}) {
  const t = useTranslations("adsManager.edit.targeting");
  const set = (changes: Partial<AdDraftTargeting>) => onChange({ ...targeting, ...changes });
  const minAges = ageMinOptions(targeting, "NONE");
  const maxAges = Array.from({ length: MAX_AGE - targeting.ageMin + 1 }, (_, index) => targeting.ageMin + index);
  const ageLabel = (age: number) => (age === MAX_AGE ? t("agePlus", { age }) : String(age));

  return (
    <div className="space-y-5">
      <Section title={t("locationsTitle")}>
        <LocationPicker
          accountId={accountId}
          label={t("locations")}
          value={targeting.locations}
          minRadius={MIN_CITY_RADIUS_KM}
          onChange={(locations) => set({ locations })}
        />
        <IssueList namespace="adsManager" issues={issuesUnder(expected, "targeting.locations")} />
        <LocationPicker
          accountId={accountId}
          label={t("excludedLocations")}
          value={targeting.excludedLocations ?? []}
          minRadius={MIN_CITY_RADIUS_KM}
          onChange={(excludedLocations) => set({ excludedLocations })}
        />
        <IssueList namespace="adsManager" issues={issuesUnder(expected, "targeting.excludedLocations")} />
      </Section>

      <Section title={t("peopleTitle")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <ElevatedSelect label={t("ageMin")} value={String(targeting.ageMin)} onValueChange={(value) => set({ ageMin: Number(value), ageMax: Math.max(Number(value), targeting.ageMax) })}>
            {minAges.map((age) => (
              <ElevatedSelectItem key={age} value={String(age)}>
                {ageLabel(age)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("ageMax")}
            value={String(targeting.ageMax)}
            disabled={targeting.advantageAudience}
            onValueChange={(value) => set({ ageMax: Number(value) })}
          >
            {maxAges.map((age) => (
              <ElevatedSelectItem key={age} value={String(age)}>
                {ageLabel(age)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("gender")}
            value={genderOf(targeting.genders)}
            onValueChange={(value) => set({ genders: gendersFor(value as GenderChoice) })}
          >
            {GENDERS.map((gender) => (
              <ElevatedSelectItem key={gender} value={gender}>
                {t(`genders.${gender}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        <IssueList namespace="adsManager" issues={[...issuesUnder(expected, "targeting.age"), ...issuesUnder(expected, "targeting.genders")]} />
        <ElevatedSwitch
          checked={targeting.advantageAudience}
          onCheckedChange={(on) => onChange(withAdvantageAudience(targeting, on))}
          label={t("advantage")}
          description={t("advantageHint")}
        />
        {targeting.advantageAudience ? <Hint>{t("advantageAgeNote")}</Hint> : null}
      </Section>

      <Section title={t("detailedTitle")}>
        <TargetingSearch accountId={accountId} kind="languages" value={targeting.languages ?? []} onChange={(languages) => set({ languages })} />
        <TargetingSearch accountId={accountId} kind="interests" value={targeting.interests ?? []} onChange={(interests) => set({ interests })} />
        <TargetingSearch accountId={accountId} kind="behaviors" value={targeting.behaviors ?? []} onChange={(behaviors) => set({ behaviors })} />
        <IssueList
          namespace="adsManager"
          issues={["languages", "interests", "behaviors"].flatMap((field) => issuesUnder(expected, `targeting.${field}`))}
        />
      </Section>

      <Section title={t("customTitle")}>
        <AudienceRefs accountId={accountId} targeting={targeting} onChange={onChange} />
        <IssueList
          namespace="adsManager"
          issues={[...issuesUnder(expected, "targeting.customAudiences"), ...issuesUnder(expected, "targeting.excludedCustomAudiences"), ...issuesUnder(expected, "targeting.exclusions")]}
        />
      </Section>
    </div>
  );
}
