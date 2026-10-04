"use client";

import { useTranslations } from "next-intl";

import { listAdAppsAction, listAdCatalogsAction } from "@/app/actions/advertising-create";
import { listPixelsAction } from "@/app/actions/advertising-conversions";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import type { AdDraftDestination, AdOptimizationGoal, AdPixelEvent } from "@/lib/advertising/draft-types";
import { screenPaths } from "@/lib/navigation/routes";
import { needsPixel } from "@/lib/advertising/wizard-routes";

import { useAdsFormat } from "../use-ads-format";
import { ExternalLink, Hint, ResourceState } from "./choice-row";
import { LinkWhatsAppNumber } from "../link-whatsapp-number";
import { FieldIssues } from "./field-issues";
import { readyData, useAdsResource } from "./use-ads-resource";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

function WhatsAppNumberField() {
  const t = useTranslations("adsWizard.promotion");
  const { form, patch, page, pages, issues } = useWizard();
  const numbers = page?.numbers ?? [];
  return (
    <div className="space-y-2">
      {!page ? <Hint>{t("choosePageFirst")}</Hint> : null}
      {page && numbers.length === 0 ? (
        <LinkWhatsAppNumber accountId={form.accountId} page={page} onLinked={pages.reload} />
      ) : null}
      {numbers.length > 0 ? (
        <ElevatedSelect label={t("number")} value={form.whatsAppNumber} onValueChange={(whatsAppNumber) => patch({ whatsAppNumber })}>
          {numbers.map((number) => (
            <ElevatedSelectItem key={`${number.kind}-${number.number}`} value={number.number}>
              {number.label} · {number.number} · {t(`numberKind.${number.kind === "unofficial" ? "unofficial" : "official"}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      ) : null}
      <Hint>{t("numberHint")}</Hint>
      <FieldIssues issues={issues} field="adSet.whatsAppNumber" />
    </div>
  );
}

function PixelFields() {
  const t = useTranslations("adsWizard.promotion");
  const labels = useWizardLabels();
  const { form, patch, options, issues } = useWizard();
  const pixels = useAdsResource(form.accountId ? `pixels:${form.accountId}` : null, () => listPixelsAction(form.accountId));
  const list = readyData(pixels) ?? [];
  return (
    <div className="space-y-2">
      <ResourceState resource={pixels} empty={t("noPixels")} />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.length > 0 ? (
          <ElevatedSelect label={t("pixel")} value={form.pixelId} onValueChange={(pixelId) => patch({ pixelId })}>
            {list.map((pixel) => (
              <ElevatedSelectItem key={pixel.metaId} value={pixel.metaId} disabled={pixel.unavailable}>
                {pixel.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        ) : null}
        <ElevatedSelect
          label={t("pixelEvent")}
          value={form.pixelEvent}
          onValueChange={(value) => patch({ pixelEvent: value as AdPixelEvent })}
        >
          {options.pixelEvents.map((event) => (
            <ElevatedSelectItem key={event} value={event}>
              {labels.pixelEvent(event)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Hint>{t("pixelHint")}</Hint>
        <ExternalLink href={screenPaths.ads_conversions}>{t("managePixels")}</ExternalLink>
      </div>
      <FieldIssues issues={issues} field="adSet.pixelId" />
      <FieldIssues issues={issues} field="adSet.pixelEvent" />
    </div>
  );
}

function AppFields() {
  const t = useTranslations("adsWizard.promotion");
  const { form, patch, update, issues } = useWizard();
  const apps = useAdsResource(form.accountId ? `apps:${form.accountId}` : null, () => listAdAppsAction(form.accountId));
  const list = readyData(apps) ?? [];
  const app = list.find((candidate) => candidate.id === form.appId);
  const urls = app?.storeUrls ?? [];
  return (
    <div className="space-y-2">
      <ResourceState resource={apps} empty={t("noApps")} />
      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ElevatedSelect
            label={t("app")}
            value={form.appId}
            onValueChange={(appId) => {
              const chosen = list.find((candidate) => candidate.id === appId);
              update((current) => ({ ...current, appId, appStoreUrl: chosen?.storeUrls?.[0] ?? "" }));
            }}
          >
            {list.map((candidate) => (
              <ElevatedSelectItem key={candidate.id} value={candidate.id}>
                {candidate.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("storeUrl")}
            value={form.appStoreUrl}
            disabled={urls.length === 0}
            onValueChange={(appStoreUrl) => patch({ appStoreUrl })}
          >
            {urls.map((url) => (
              <ElevatedSelectItem key={url} value={url}>
                {url}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
      ) : null}
      <FieldIssues issues={issues} field="adSet.appId" />
      <FieldIssues issues={issues} field="adSet.appStoreUrl" />
    </div>
  );
}

function CatalogFields() {
  const t = useTranslations("adsWizard.promotion");
  const fmt = useAdsFormat();
  const { form, patch, update, issues } = useWizard();
  const catalogs = useAdsResource(form.accountId ? `catalogs:${form.accountId}` : null, () => listAdCatalogsAction(form.accountId));
  const list = readyData(catalogs) ?? [];
  const sets = list.find((candidate) => candidate.id === form.catalogId)?.productSets ?? [];
  return (
    <div className="space-y-2">
      <ResourceState resource={catalogs} empty={t("noCatalogs")} />
      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ElevatedSelect
            label={t("catalog")}
            value={form.catalogId}
            onValueChange={(catalogId) => update((current) => ({ ...current, catalogId, productSetId: "" }))}
          >
            {list.map((catalog) => (
              <ElevatedSelectItem key={catalog.id} value={catalog.id}>
                {catalog.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          <ElevatedSelect
            label={t("productSet")}
            value={form.productSetId}
            disabled={sets.length === 0}
            onValueChange={(productSetId) => patch({ productSetId })}
          >
            {sets.map((set) => (
              <ElevatedSelectItem key={set.id} value={set.id}>
                {t("productSetOption", { name: set.name, count: fmt.count(set.productCount) })}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
      ) : null}
      <FieldIssues issues={issues} field="adSet.catalogId" />
      <FieldIssues issues={issues} field="adSet.productSetId" />
    </div>
  );
}

export function hasPromotionFields(destination: AdDraftDestination | "", goal: AdOptimizationGoal | ""): boolean {
  return destination === "WHATSAPP" || destination === "APP" || destination === "CATALOG" || needsPixel(goal, destination);
}

export function PromotionFields() {
  const { form } = useWizard();
  return (
    <div className="space-y-4">
      {form.destination === "WHATSAPP" ? <WhatsAppNumberField /> : null}
      {form.destination === "APP" ? <AppFields /> : null}
      {form.destination === "CATALOG" ? <CatalogFields /> : null}
      {needsPixel(form.goal, form.destination) ? <PixelFields /> : null}
    </div>
  );
}
