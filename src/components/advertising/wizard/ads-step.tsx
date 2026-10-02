"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Copy, Info, Plus, Trash } from "@/components/icons";
import { duplicateAd, emptyAdForm, type AdForm } from "@/lib/advertising/draft";
import { canAddAd, dynamicCreative, formatsFor } from "@/lib/advertising/wizard-routes";
import { adHasIssues } from "@/lib/advertising/wizard-issues";
import { cn } from "@/lib/utils";

import { Hint, Section } from "./choice-row";
import { CreativeEditor } from "./creative-editor";
import { FieldIssues } from "./field-issues";
import { IdentityFields } from "./identity-fields";
import { useWizard } from "./wizard-context";

export function AdsStep({ active, onActive }: { active: number; onActive: (index: number) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { form, update, issues } = useWizard();
  const ads = form.ads;
  const current = Math.min(active, ads.length - 1);
  const ad = ads[current];
  const formats = ads.map((candidate) => candidate.format);
  const editing = form.mode === "creative";
  const addable = !editing && canAddAd(form.objective, formats);

  const setAd = (changes: Partial<AdForm>) =>
    update((state) => ({ ...state, ads: state.ads.map((candidate, i) => (i === current ? { ...candidate, ...changes } : candidate)) }));

  const add = () => {
    const fresh = { ...emptyAdForm(), format: formatsFor(form.destination)[0] };
    update((state) => ({ ...state, ads: [...state.ads, fresh] }));
    onActive(ads.length);
  };

  const duplicate = () => {
    update((state) => ({ ...state, ads: [...state.ads, duplicateAd(state.ads[current], t("copySuffix"))] }));
    onActive(ads.length);
  };

  const remove = () => {
    update((state) => ({ ...state, ads: state.ads.filter((_, i) => i !== current) }));
    onActive(Math.max(0, current - 1));
  };

  return (
    <div className="space-y-6">
      {editing ? (
        <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("creativeEditHint")}</Hint>
      ) : (
        <Section title={t("identityTitle")} description={t("identityDescription")}>
          <IdentityFields instagramRequired={form.destination === "INSTAGRAM_DIRECT"} />
        </Section>
      )}

      <Section
        title={t("title")}
        description={editing ? undefined : t("creativesHint")}
        actions={
          editing ? undefined : (
            <>
              <Button
                variant="secondary"
                size="sm"
                title={t("duplicate")}
                icon={<Copy className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                disabled={!addable}
                onClick={duplicate}
              />
              <Button
                variant="secondary"
                size="sm"
                title={t("add")}
                icon={<Plus className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                disabled={!addable}
                onClick={add}
              />
            </>
          )
        }
      >
        <div role="tablist" aria-label={t("title")} className="flex items-center gap-1 overflow-x-auto border-b border-border">
          {ads.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={index === current}
              onClick={() => onActive(index)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                index === current
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {candidate.name.trim() || t("tab", { index: index + 1 })}
              {adHasIssues(issues, index) ? (
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-label={t("tabHasIssues")} />
              ) : null}
            </button>
          ))}
        </div>
        {dynamicCreative(form.objective, formats) ? <Hint>{t("flexibleOneAd")}</Hint> : null}
        {!editing && !dynamicCreative(form.objective, formats) && !addable ? <Hint>{t("maxAds")}</Hint> : null}
        <FieldIssues issues={issues} field="ads" />
        {ads.length > 1 ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              title={t("remove")}
              icon={<Trash className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={remove}
            />
          </div>
        ) : null}
      </Section>

      {ad ? <CreativeEditor key={ad.id} ad={ad} index={current} onChange={setAd} /> : null}
    </div>
  );
}
