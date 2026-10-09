"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  BellSlash,
  ClipboardText,
  DeviceMobile,
  Envelope,
  IdentificationCard,
  Lock,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  UploadSimple,
  UserCircle,
  WhatsappLogo,
} from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CustomFieldValue } from "@/components/crm/CustomFieldValue";
import { LeadNumberCall } from "@/components/leads/LeadCall";
import { SharedNumberHolders } from "@/components/leads/SharedNumberHolders";
import { useOptOutLine } from "@/components/leads/use-opt-out-line";
import { readableFields, type CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { translatedLabel } from "@/lib/format/translated-label";
import { MiniMap } from "@/components/maps/MiniMap";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { addressLocation, addressPositionSource } from "@/lib/leads/address-location";
import { areaParts, calendarDateOf, instantOf, primaryAddress, streetLine } from "@/lib/leads/detail";
import { sharedNumberOf, type LeadDetailSummary } from "@/lib/leads/detail-summary";
import { addressPosition, leadMapHref } from "@/lib/leads/map-view";
import type { LeadAddress, LeadDetail } from "@/lib/leads/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";

import { DetailRow, DetailRows } from "./DetailRow";

function ContactSection({ lead, summary }: { lead: LeadDetail; summary: LeadDetailSummary | undefined }) {
  const t = useTranslations("leadDetail.contact");
  const tLabels = useTranslations("leadSheet.phones.labels");
  const tDetail = useTranslations("leadDetail");
  const format = useFormatter();
  const phones = lead.phones ?? [];
  const birth = lead.birthDate ? calendarDateOf(lead.birthDate) : null;
  const created = instantOf(lead.createdAt);
  const source = lead.source && t.has(`sources.${lead.source}`) ? t(`sources.${lead.source}`) : null;

  return (
    <PanelSection title={t("title")} legend={t("phones", { count: phones.length })}>
      <DetailRows>
        <DetailRow
          icon={<WhatsappLogo />}
          label={t("whatsapp")}
          mono={!!lead.number}
          hint={<SharedNumberHolders shared={sharedNumberOf(summary, lead.number)} variant="row" linked />}
          action={lead.number ? <LeadNumberCall leadId={lead.id} revision={lead.version} identity /> : undefined}
        >
          {lead.number ? formatPhoneForDisplay(lead.number) : <span className="font-normal text-muted-foreground">{tDetail("noWhatsApp")}</span>}
        </DetailRow>
        {phones.map((phone) => (
          <DetailRow
            key={phone.id}
            icon={phone.label === "mobile" ? <DeviceMobile /> : <Phone />}
            label={tLabels(phone.label)}
            mono
            hint={<SharedNumberHolders shared={sharedNumberOf(summary, phone.number)} variant="row" linked />}
            action={<LeadNumberCall leadId={lead.id} revision={lead.version} phoneId={phone.id} />}
          >
            {formatPhoneForDisplay(phone.number)}
          </DetailRow>
        ))}
        <DetailRow icon={<Envelope />} label={t("email")}>
          {lead.email || <EmptyValue />}
        </DetailRow>
        <DetailRow
          icon={<Star />}
          label={t("birthDate")}
          hint={typeof lead.age === "number" ? t("age", { age: lead.age }) : undefined}
        >
          {birth ? format.dateTime(birth, { dateStyle: "short", timeZone: "UTC" }) : <EmptyValue />}
        </DetailRow>
        <DetailRow icon={<UserCircle />} label={t("nickname")}>
          {lead.nickname || <EmptyValue />}
        </DetailRow>
        <DetailRow icon={<UploadSimple />} label={t("source")}>
          {source && created
            ? t("since", { source, date: format.dateTime(created, { dateStyle: "short" }) })
            : source ?? <EmptyValue />}
        </DetailRow>
      </DetailRows>
    </PanelSection>
  );
}

function CustomFieldsSection({
  lead,
  definitions,
  loading,
  failed,
}: {
  lead: LeadDetail;
  definitions: CustomFieldDefinition[];
  loading: boolean;
  failed: boolean;
}) {
  const t = useTranslations("leadDetail.customFields");
  const readable = readableFields(definitions);
  const hidden = definitions.length - readable.length;

  return (
    <PanelSection title={t("title")}>
      {loading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {failed ? <p className="text-sm text-destructive-ink">{t("loadFailed")}</p> : null}
      {!loading && !failed && definitions.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      {readable.length > 0 ? (
        <DetailRows>
          {readable.map((field) => {
            const lockLabel = field.legalBasis ? t("sensitive", { basis: field.legalBasis }) : t("sensitiveNoBasis");
            return (
              <DetailRow key={field.id} icon={<IdentificationCard />} label={field.label}>
                <span className="inline-flex items-center gap-1.5">
                  <CustomFieldValue field={field} value={lead.customFields?.[field.key]} />
                  {field.sensitive ? (
                    <span role="img" aria-label={lockLabel} title={lockLabel} className="inline-flex text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                </span>
              </DetailRow>
            );
          })}
        </DetailRows>
      ) : null}
      {hidden > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          {t("hiddenSensitive", { count: hidden })}
        </p>
      ) : null}
    </PanelSection>
  );
}

function AddressLocationLine({ address, mapHref }: { address: LeadAddress; mapHref?: string }) {
  const t = useTranslations("leadDetail.address");
  const tMap = useTranslations("leadMap");
  const format = useFormatter();
  const location = addressLocation(address);
  const label = location.label.kind === "precision" ? tMap(location.label.key) : t(`geoStatus.${location.label.status}`);
  const origin = addressPositionSource(address);
  const source = origin
    ? origin.providerKey
      ? t("providerSource", { source: tMap(origin.sourceKey), provider: tMap(origin.providerKey) })
      : tMap(origin.sourceKey)
    : null;
  const sourceLine = source && origin?.fixedAt ? t("positionSource", { source, date: format.dateTime(origin.fixedAt, { dateStyle: "short" }) }) : source;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <StatusChip tone={location.tone} label={label} icon={<MapPin className="h-3 w-3" aria-hidden />} />
      {sourceLine ? <span className="text-muted-foreground">{sourceLine}</span> : null}
      {location.note ? (
        <span className="text-muted-foreground">{translatedLabel(t, `queuedNote.${location.note}`, "queuedNote.pending")}</span>
      ) : null}
      {mapHref ? (
        <Link href={mapHref} className="ml-auto text-sm font-medium text-primary-ink hover:underline">
          {t("showOnMap")}
        </Link>
      ) : null}
    </div>
  );
}

function AddressSection({
  lead,
  readsAddresses,
  onAdd,
}: {
  lead: LeadDetail;
  readsAddresses: boolean;
  onAdd?: () => void;
}) {
  const t = useTranslations("leadDetail.address");
  const tLabels = useTranslations("leadSheet.addresses.labels");
  const tMap = useTranslations("leadMap");
  const address = primaryAddress(lead.addresses);

  if (!address) {
    return (
      <PanelSection title={t("title")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          {onAdd ? (
            <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" weight="bold" />} iconVisible iconSide="left" title={t("add")} onClick={onAdd} />
          ) : null}
        </div>
      </PanelSection>
    );
  }

  const street = readsAddresses ? streetLine(address) : "";
  const position = readsAddresses ? addressPosition(address) : null;
  const area = [...areaParts(address), ...(readsAddresses && address.zipCode ? [t("zipCode", { zipCode: address.zipCode })] : [])];

  return (
    <PanelSection title={t("title")} legend={tLabels(address.label)}>
      <div className="space-y-2.5">
        <div>
          {street ? <p className="text-sm font-medium text-foreground">{street}</p> : null}
          <p className={street ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>
            {area.length > 0 ? area.join(" · ") : <EmptyValue />}
          </p>
        </div>
        {position ? (
          <MiniMap
            position={{ lat: position.lat, lng: position.lng }}
            precision={position.precision ?? null}
            interactive={false}
            draggable={false}
            ariaLabel={tMap("miniMap.label")}
            className="h-40"
          />
        ) : null}
        <AddressLocationLine address={address} mapHref={position ? leadMapHref(lead.id) : undefined} />
        {!readsAddresses ? <p className="text-xs text-muted-foreground">{t("restricted")}</p> : null}
      </div>
    </PanelSection>
  );
}

function ConsentSection({ lead }: { lead: LeadDetail }) {
  const t = useTranslations("leadDetail.consent");
  const tConsent = useTranslations("leadSheet.consent");
  const format = useFormatter();
  const granted = lead.whatsappOptIn ? instantOf(lead.whatsappOptIn.grantedAt) : null;
  const optedOut = useOptOutLine(lead.optedOutAt, lead.optOutSource);
  const purpose = lead.whatsappOptIn?.purpose?.trim();
  const source = lead.whatsappOptIn ? translatedLabel(tConsent, `sources.${lead.whatsappOptIn.source}`, "sources.other") : null;

  return (
    <PanelSection title={t("title")}>
      <DetailRows>
        <DetailRow
          icon={<ShieldCheck />}
          label={t("whatsapp")}
          hint={lead.whatsappOptIn && granted ? t("grantedDetail", { source: source ?? "", date: format.dateTime(granted, { dateStyle: "short" }) }) : undefined}
        >
          {lead.whatsappOptIn ? t("granted") : <span className="font-normal text-muted-foreground">{t("none")}</span>}
        </DetailRow>
        {purpose ? (
          <DetailRow icon={<ClipboardText />} label={t("purpose")}>
            {purpose}
          </DetailRow>
        ) : null}
        {optedOut ? (
          <DetailRow icon={<BellSlash />} label={t("optedOut")}>
            {optedOut}
          </DetailRow>
        ) : null}
      </DetailRows>
      <p className="mt-2 text-xs text-muted-foreground">{t("hint")}</p>
    </PanelSection>
  );
}

export function LeadOverview({
  lead,
  definitions,
  definitionsLoading,
  definitionsFailed,
  readsAddresses,
  onAddAddress,
  summary,
}: {
  lead: LeadDetail;
  summary?: LeadDetailSummary;
  definitions: CustomFieldDefinition[];
  definitionsLoading: boolean;
  definitionsFailed: boolean;
  readsAddresses: boolean;
  onAddAddress?: () => void;
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <div className="grid gap-8">
        <ContactSection lead={lead} summary={summary} />
        <CustomFieldsSection lead={lead} definitions={definitions} loading={definitionsLoading} failed={definitionsFailed} />
      </div>
      <div className="grid gap-8">
        <AddressSection lead={lead} readsAddresses={readsAddresses} onAdd={onAddAddress} />
        <ConsentSection lead={lead} />
      </div>
    </div>
  );
}
