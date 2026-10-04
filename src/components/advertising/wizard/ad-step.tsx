"use client";

import { useTranslations } from "next-intl";

import { Info } from "@/components/icons";
import { applyAdChange, type AdChange } from "@/lib/advertising/draft";
import { canAddAdTo } from "@/lib/advertising/editor-tree";
import { dynamicCreative } from "@/lib/advertising/wizard-routes";

import { Hint, Section } from "./choice-row";
import { CreativeEditor } from "./creative-editor";
import { FieldIssues } from "./field-issues";
import { IdentityFields } from "./identity-fields";
import { useWizard } from "./wizard-context";

export function AdStep({ index }: { index: number }) {
  const t = useTranslations("adsWizard.ads");
  const { form, update, issues } = useWizard();
  const ad = form.ads[index];
  const editing = form.mode === "creative";
  const flexibleOnly = dynamicCreative(form.objective, form.ads.map((candidate) => candidate.format));

  const setAd = (change: AdChange) =>
    update((state) => ({ ...state, ads: state.ads.map((candidate, i) => (i === index ? applyAdChange(candidate, change) : candidate)) }));

  if (!ad) return null;

  return (
    <div className="space-y-4">
      {editing ? (
        <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("creativeEditHint")}</Hint>
      ) : (
        <Section title={t("identityTitle")} description={t("identityDescription")}>
          <IdentityFields instagramRequired={form.destination === "INSTAGRAM_DIRECT"} />
        </Section>
      )}
      {!editing && flexibleOnly ? <Hint>{t("flexibleOneAd")}</Hint> : null}
      {!editing && !flexibleOnly && !canAddAdTo(form) ? <Hint>{t("maxAds")}</Hint> : null}
      <FieldIssues issues={issues} field="ads" />
      <CreativeEditor key={ad.id} ad={ad} index={index} onChange={setAd} />
    </div>
  );
}
