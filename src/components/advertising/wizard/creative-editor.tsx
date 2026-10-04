"use client";

import { useTranslations } from "next-intl";

import { listAdInstantExperiencesAction } from "@/app/actions/advertising-create";
import { listLeadFormsAction } from "@/app/actions/advertising-forms";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Info, Trash } from "@/components/icons";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  MAX_CAROUSEL_CARDS,
  MAX_FLEXIBLE_MEDIAS,
  MAX_FLEXIBLE_TEXTS,
  MAX_GREETING,
  MAX_HEADLINE,
  MAX_ICE_BREAKER,
  MAX_ICE_BREAKERS,
  MAX_NAME,
  MAX_PRIMARY_TEXT,
  MIN_CAROUSEL_CARDS,
  cardChange,
  emptyCard,
  type AdChange,
  type AdForm,
  type CardForm,
} from "@/lib/advertising/draft";
import type { AdCreativeFormat } from "@/lib/advertising/draft-types";
import { screenPaths } from "@/lib/navigation/routes";
import {
  callsToActionFor,
  flexibleAllowed,
  formatsFor,
  isMessaging,
  linkRequired,
  showsCallToAction,
  showsLink,
  usesAssetGroups,
} from "@/lib/advertising/wizard-routes";

import { ChoiceRow, ExternalLink, Hint, ResourceState, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { MediaPicker, MediaThumb } from "./media-picker";
import { PostPicker } from "./post-picker";
import { Counter, TextListEditor } from "./text-list-editor";
import { readyData, useAdsResource } from "./use-ads-resource";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

const TEXT_FORMATS: AdCreativeFormat[] = ["IMAGE", "VIDEO", "CAROUSEL", "CATALOG", "COLLECTION"];

function TextFields({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { issues } = useWizard();
  return (
    <Section title={t("textTitle")} description={t("textDescription")}>
      <div>
        <ElevatedTextarea
          label={t("primaryText")}
          value={ad.primaryText}
          maxLength={MAX_PRIMARY_TEXT}
          onChange={(event) => onChange({ primaryText: event.target.value })}
          autoResize
          maxHeight={240}
        />
        <Counter value={ad.primaryText} max={MAX_PRIMARY_TEXT} />
        <FieldIssues issues={issues} field={`${path}.primaryText`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <ElevatedInput
            label={t("headline")}
            placeholder=" "
            value={ad.headline}
            maxLength={MAX_HEADLINE}
            onChange={(event) => onChange({ headline: event.target.value })}
          />
          <FieldIssues issues={issues} field={`${path}.headline`} />
        </div>
        <div>
          <ElevatedInput
            label={t("description")}
            placeholder=" "
            value={ad.description}
            maxLength={MAX_HEADLINE}
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <FieldIssues issues={issues} field={`${path}.description`} />
        </div>
      </div>
      <Hint>{t("headlineHint")}</Hint>
    </Section>
  );
}

function CarouselCards({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { form, issues, canGenerate } = useWizard();
  const setCard = (index: number, changes: Partial<CardForm>) => onChange(cardChange(index, changes));

  return (
    <Section title={t("cardsTitle")} description={t("cardsDescription")}>
      <ol className="space-y-3">
        {ad.cards.map((card, index) => (
          <li key={index} className="space-y-2 rounded-[--radius] border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="legend">{t("card", { index: index + 1 })}</p>
              {ad.cards.length > MIN_CAROUSEL_CARDS ? (
                <button
                  type="button"
                  onClick={() => onChange((current) => ({ cards: current.cards.filter((_, i) => i !== index) }))}
                  aria-label={t("removeCard", { index: index + 1 })}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <MediaPicker value={card.media} accept="any" canGenerate={canGenerate} onChange={(media) => setCard(index, { media })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ElevatedInput
                label={t("cardHeadline")}
                placeholder=" "
                value={card.headline}
                maxLength={MAX_HEADLINE}
                onChange={(event) => setCard(index, { headline: event.target.value })}
              />
              <ElevatedInput
                label={t("cardDescription")}
                placeholder=" "
                value={card.description}
                maxLength={MAX_HEADLINE}
                onChange={(event) => setCard(index, { description: event.target.value })}
              />
            </div>
            {form.destination === "WEBSITE" ? (
              <ElevatedInput
                label={t("cardLink")}
                placeholder=" "
                inputMode="url"
                value={card.link}
                onChange={(event) => setCard(index, { link: event.target.value })}
              />
            ) : null}
            <FieldIssues issues={issues} field={`${path}.cards[${index}]`} nested />
          </li>
        ))}
      </ol>
      {ad.cards.length < MAX_CAROUSEL_CARDS ? (
        <button
          type="button"
          onClick={() => onChange((current) => ({ cards: [...current.cards, emptyCard()] }))}
          className="text-sm font-medium text-primary-ink hover:underline"
        >
          {t("addCard")}
        </button>
      ) : null}
      <FieldIssues issues={issues} field={`${path}.cards`} />
    </Section>
  );
}

function FlexibleFields({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { issues, canGenerate } = useWizard();
  return (
    <>
      <Section title={t("flexMediasTitle")} description={t("flexMediasDescription", { max: MAX_FLEXIBLE_MEDIAS })}>
        {ad.medias.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {ad.medias.map((media, index) => (
              <li key={`${media.mediaId}-${index}`} className="relative">
                <MediaThumb media={media} className="relative block h-20 w-20 overflow-hidden rounded-[--radius] bg-muted" />
                <button
                  type="button"
                  onClick={() => onChange({ medias: ad.medias.filter((_, i) => i !== index) })}
                  aria-label={t("removeMedia", { index: index + 1 })}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-[--radius] border border-border bg-card text-muted-foreground hover:text-foreground"
                >
                  <Trash className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {ad.medias.length < MAX_FLEXIBLE_MEDIAS ? (
          <MediaPicker
            value={null}
            accept="any"
            canGenerate={canGenerate}
            onChange={(media) => media && onChange({ medias: [...ad.medias, media] })}
          />
        ) : null}
        <FieldIssues issues={issues} field={`${path}.medias`} nested />
      </Section>
      <Section title={t("flexTextsTitle")} description={t("flexTextsDescription", { max: MAX_FLEXIBLE_TEXTS })}>
        <TextListEditor
          values={ad.texts}
          max={MAX_FLEXIBLE_TEXTS}
          maxLength={MAX_PRIMARY_TEXT}
          multiline
          label={(index) => t("flexText", { index: index + 1 })}
          addLabel={t("addText")}
          removeLabel={t("removeText")}
          onChange={(texts) => onChange({ texts })}
        />
        <FieldIssues issues={issues} field={`${path}.texts`} nested />
        <TextListEditor
          values={ad.headlines}
          max={MAX_FLEXIBLE_TEXTS}
          maxLength={MAX_HEADLINE}
          label={(index) => t("flexHeadline", { index: index + 1 })}
          addLabel={t("addHeadline")}
          removeLabel={t("removeText")}
          onChange={(headlines) => onChange({ headlines })}
        />
        <TextListEditor
          values={ad.descriptions}
          max={MAX_FLEXIBLE_TEXTS}
          maxLength={MAX_HEADLINE}
          label={(index) => t("flexDescription", { index: index + 1 })}
          addLabel={t("addDescription")}
          removeLabel={t("removeText")}
          onChange={(descriptions) => onChange({ descriptions })}
        />
        <FieldIssues issues={issues} field={`${path}.headlines`} />
      </Section>
    </>
  );
}

function CollectionFields({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { form, issues, canGenerate } = useWizard();
  const key = form.accountId && form.pageId ? `experiences:${form.accountId}:${form.pageId}` : null;
  const experiences = useAdsResource(key, () => listAdInstantExperiencesAction(form.accountId, form.pageId));
  const list = readyData(experiences) ?? [];
  return (
    <Section title={t("collectionTitle")} description={t("collectionDescription")}>
      {!form.pageId ? <Hint>{t("choosePage")}</Hint> : <ResourceState resource={experiences} empty={t("noExperiences")} />}
      {list.length > 0 ? (
        <ElevatedSelect
          label={t("experience")}
          value={ad.instantExperienceId}
          onValueChange={(instantExperienceId) => onChange({ instantExperienceId })}
        >
          {list.map((experience) => (
            <ElevatedSelectItem key={experience.id} value={experience.id}>
              {experience.name}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      ) : null}
      <FieldIssues issues={issues} field={`${path}.instantExperienceId`} />
      <p className="legend">{t("collectionCover")}</p>
      <MediaPicker value={ad.media} accept="any" canGenerate={canGenerate} onChange={(media) => onChange({ media })} />
      <FieldIssues issues={issues} field={`${path}.media`} nested />
    </Section>
  );
}

function LeadFormField({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const { form, issues } = useWizard();
  const key = form.accountId && form.pageId ? `forms:${form.accountId}:${form.pageId}` : null;
  const forms = useAdsResource(key, () => listLeadFormsAction(form.accountId, form.pageId));
  const list = (readyData(forms) ?? []).filter((candidate) => candidate.status !== "ARCHIVED");
  return (
    <Section
      title={t("formTitle")}
      description={t("formDescription")}
      actions={<ExternalLink href={screenPaths.ads_forms}>{t("createForm")}</ExternalLink>}
    >
      {!form.pageId ? <Hint>{t("choosePage")}</Hint> : <ResourceState resource={forms} empty={t("noForms")} />}
      {list.length > 0 ? (
        <ElevatedSelect label={t("form")} value={ad.leadFormId} onValueChange={(leadFormId) => onChange({ leadFormId })}>
          {list.map((candidate) => (
            <ElevatedSelectItem key={candidate.metaId} value={candidate.metaId}>
              {candidate.name}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      ) : null}
      {form.pageId ? (
        <button type="button" onClick={forms.reload} className="text-xs font-semibold text-primary-ink hover:underline">
          {t("reloadForms")}
        </button>
      ) : null}
      <FieldIssues issues={issues} field={`${path}.leadFormId`} />
    </Section>
  );
}

function DestinationFields({ ad, path, onChange }: { ad: AdForm; path: string; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const labels = useWizardLabels();
  const { form, options, issues } = useWizard();
  const destination = form.destination;
  const ctas = callsToActionFor(destination, options.destinationCallsToAction);
  const link = showsLink(destination) && ad.format !== "EXISTING_POST";

  return (
    <>
      {link || showsCallToAction(destination) ? (
        <Section title={t("linkTitle")} description={t("linkDescription")}>
          {link ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ElevatedInput
                label={linkRequired(destination, ad.format) ? t("link") : t("linkOptional")}
                placeholder=" "
                inputMode="url"
                value={ad.link}
                onChange={(event) => onChange({ link: event.target.value })}
              />
              <ElevatedInput
                label={t("displayLink")}
                placeholder=" "
                value={ad.displayLink}
                onChange={(event) => onChange({ displayLink: event.target.value })}
              />
            </div>
          ) : null}
          <FieldIssues issues={issues} field={`${path}.link`} />
          {ctas.length > 0 ? (
            <ElevatedSelect label={t("cta")} value={ad.callToAction} onValueChange={(callToAction) => onChange({ callToAction })}>
              {ctas.map((cta) => (
                <ElevatedSelectItem key={cta} value={cta}>
                  {labels.callToAction(cta)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          ) : null}
          <FieldIssues issues={issues} field={`${path}.callToAction`} />
        </Section>
      ) : null}

      {destination === "ON_AD" ? <LeadFormField ad={ad} path={path} onChange={onChange} /> : null}

      {isMessaging(destination) ? (
        <Section title={t("conversationTitle")} description={t("conversationDescription")}>
          <div>
            <ElevatedTextarea
              label={t("greeting")}
              value={ad.greeting}
              maxLength={MAX_GREETING}
              onChange={(event) => onChange({ greeting: event.target.value })}
              autoResize
              maxHeight={160}
            />
            <Counter value={ad.greeting} max={MAX_GREETING} />
            <FieldIssues issues={issues} field={`${path}.greeting`} />
          </div>
          <p className="legend">{t("iceBreakers")}</p>
          <TextListEditor
            values={ad.iceBreakers}
            max={MAX_ICE_BREAKERS}
            maxLength={MAX_ICE_BREAKER}
            label={(index) => t("iceBreaker", { index: index + 1 })}
            addLabel={t("addIceBreaker")}
            removeLabel={t("removeIceBreaker")}
            onChange={(iceBreakers) => onChange({ iceBreakers })}
          />
          <Hint>{t("iceBreakersHint")}</Hint>
          <FieldIssues issues={issues} field={`${path}.iceBreakers`} />
        </Section>
      ) : null}
    </>
  );
}

export function CreativeEditor({ ad, index, onChange }: { ad: AdForm; index: number; onChange: (change: AdChange) => void }) {
  const t = useTranslations("adsWizard.ads");
  const labels = useWizardLabels();
  const { form, page, issues, canGenerate } = useWizard();
  const path = `ads[${index}].creative`;
  const formats = formatsFor(form.destination);
  const flexibleOk = flexibleAllowed(form.objective, form.mode !== "adSet", form.ads.length);

  const chooseFormat = (format: AdCreativeFormat) => {
    const want = format === "IMAGE" ? "image" : format === "VIDEO" ? "video" : null;
    onChange({ format, media: want && ad.media?.kind !== want ? null : ad.media });
  };

  return (
    <div className="space-y-6">
      <Section title={t("nameTitle")}>
        <ElevatedInput
          label={t("name")}
          placeholder=" "
          value={ad.name}
          maxLength={MAX_NAME}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Hint>{t("nameHint")}</Hint>
        <FieldIssues issues={issues} field={`ads[${index}].name`} />
      </Section>

      <Section title={t("formatTitle")} description={t("formatDescription")}>
        <RadioGroup
          value={ad.format}
          onValueChange={(value) => chooseFormat(value as AdCreativeFormat)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {formats.map((format) => (
            <ChoiceRow
              key={format}
              value={format}
              title={labels.format(format)}
              hint={format === "FLEXIBLE" && !flexibleOk && ad.format !== "FLEXIBLE" ? t("flexibleBlocked") : t(`formats.${format}.body`)}
              disabled={format === "FLEXIBLE" && !flexibleOk && ad.format !== "FLEXIBLE"}
            />
          ))}
        </RadioGroup>
        {ad.format === "FLEXIBLE" && !usesAssetGroups(form.objective) ? (
          <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("flexibleOwnAdSet")}</Hint>
        ) : null}
        <FieldIssues issues={issues} field={`${path}.format`} />
      </Section>

      {TEXT_FORMATS.includes(ad.format) ? <TextFields ad={ad} path={path} onChange={onChange} /> : null}

      {ad.format === "IMAGE" || ad.format === "VIDEO" ? (
        <Section
          title={t(ad.format === "VIDEO" ? "videoTitle" : "imageTitle")}
          description={t(ad.format === "VIDEO" ? "videoDescription" : "imageDescription")}
        >
          <MediaPicker
            value={ad.media}
            accept={ad.format === "VIDEO" ? "video" : "image"}
            canGenerate={canGenerate}
            onChange={(media) => onChange({ media })}
          />
          <FieldIssues issues={issues} field={`${path}.media`} nested />
        </Section>
      ) : null}

      {ad.format === "CAROUSEL" ? <CarouselCards ad={ad} path={path} onChange={onChange} /> : null}
      {ad.format === "FLEXIBLE" ? <FlexibleFields ad={ad} path={path} onChange={onChange} /> : null}
      {ad.format === "COLLECTION" ? <CollectionFields ad={ad} path={path} onChange={onChange} /> : null}
      {ad.format === "CATALOG" ? <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("catalogNote")}</Hint> : null}

      {ad.format === "EXISTING_POST" ? (
        <Section title={t("postTitle")} description={t("postDescription")}>
          <PostPicker
            accountId={form.accountId}
            pageId={form.pageId}
            hasInstagram={!!page?.instagramUserId}
            value={ad.post}
            onChange={(post) => onChange({ post })}
          />
          <FieldIssues issues={issues} field={`${path}.postId`} />
        </Section>
      ) : null}

      <DestinationFields ad={ad} path={path} onChange={onChange} />

      <Section title={t("enhancementsTitle")}>
        <ElevatedSwitch
          checked={ad.enhancements}
          onCheckedChange={(enhancements) => onChange({ enhancements })}
          label={t("enhancements")}
          description={t("enhancementsHint")}
        />
      </Section>
    </div>
  );
}
