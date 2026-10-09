"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { CustomFieldValue } from "@/components/crm/CustomFieldValue";
import { MapPin, X } from "@/components/icons";
import { LeadCallButton } from "@/components/leads/LeadCall";
import { LeadSendButton } from "@/components/leads/sends/LeadSendButton";
import { useLeadMapPoint } from "@/hooks/use-lead-map";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { AREA_SEPARATOR, primaryAddress, streetLine } from "@/lib/leads/detail";
import { leadNameLines } from "@/lib/leads/display";
import { approximatePlace, sameFullAddress, type LeadMapParams } from "@/lib/leads/map-view";
import type { LeadRecord } from "@/lib/leads/types";
import { positionSourceKey } from "@/lib/maps/position";
import { precisionLabelKey } from "@/lib/maps/precision";
import type { MapPoint } from "@/lib/maps/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";
import { MAP_FLOATY } from "@/components/maps/map-layout";

export const PEEK_SIZE = { width: 236, height: 240 };

export interface LeadMapPeekProps {
  point: MapPoint;
  params: LeadMapParams;
  placement: { left: number; top: number };
  classification?: CustomFieldDefinition;
  onClose: () => void;
  className?: string;
}

function PeekLead({ lead, point, classification }: { lead: LeadRecord; point: MapPoint; classification?: CustomFieldDefinition }) {
  const t = useTranslations("leadMap");
  const tLeads = useTranslations("leadsPage");
  const lines = leadNameLines({ realName: lead.realName, number: lead.number });
  const address = primaryAddress(lead.addresses);
  const place = address ? [streetLine(address), address.district?.trim() ?? ""].filter(Boolean).join(AREA_SEPARATOR) : "";
  const precision = t(precisionLabelKey(address?.precision ?? point.precision));
  const sourceKey = positionSourceKey(address?.positionSource);
  const source = sourceKey ? t(sourceKey) : null;
  const near = point.placement === "approximate" ? approximatePlace(address ?? { precision: point.precision }) : null;
  const position = near
    ? t("peek.approximate", {
        place: near.name ? t(`peek.approximatePlace.${near.kind}`, { name: near.name }) : t(`peek.approximateKind.${near.kind}`),
      })
    : source
      ? t("peek.precisionSource", { precision, source })
      : precision;
  const phones = (lead.phones ?? []).map((phone) => phone.number).filter((number) => number.trim() !== "");
  const classificationValue = classification ? lead.customFields?.[classification.key] : undefined;

  return (
    <li className="flex flex-col gap-1.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold text-foreground", lines.titleMono && "font-mono font-medium")}>{lines.title}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {lines.detail.kind === "identity" ? lines.detail.text : lines.detail.kind === "noName" ? tLeads("table.noName") : tLeads("table.noWhatsApp")}
        </p>
        {phones.map((number) => (
          <p key={number} className="truncate font-mono text-xs text-muted-foreground">
            {formatPhoneForDisplay(number)}
          </p>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {place ? <p className="truncate">{place}</p> : null}
        <p className="flex items-center gap-1">
          <MapPin size={12} aria-hidden="true" />
          <span>{position}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {classification && classificationValue !== undefined ? <CustomFieldValue field={classification} value={classificationValue} /> : null}
        <LeadSendButton leadId={lead.id} action="send_template" label={t("peek.template")} />
        <LeadCallButton leadId={lead.id} revision={lead.version} />
        <Link
          href={`/dashboard/leads/${encodeURIComponent(lead.id)}`}
          className="inline-flex h-8 items-center rounded-[--radius] px-2.5 text-xs font-medium text-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("peek.open")}
        </Link>
      </div>
    </li>
  );
}

export function LeadMapPeek({ point, params, placement, classification, onClose, className }: LeadMapPeekProps) {
  const t = useTranslations("leadMap.peek");
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  const peek = useLeadMapPoint(params, { lat: point.lat, lng: point.lng, placement: point.placement });

  useEffect(() => {
    card.current?.focus();
  }, [point.id]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const items = peek.data?.items ?? [];
  const total = peek.data?.total ?? point.count;
  const unlisted = Math.max(0, total - items.length);
  const oneAddress = unlisted === 0 && sameFullAddress(items);

  return (
    <div
      ref={card}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ left: placement.left, top: placement.top, width: PEEK_SIZE.width }}
      className={cn(
        "absolute z-30 flex max-h-[min(22rem,calc(100%-1.5rem))] flex-col gap-2 px-3 pb-2.5 pt-3 focus-visible:outline-none",
        MAP_FLOATY,
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <p id={titleId} className={cn("min-w-0 flex-1 text-xs text-muted-foreground", total <= 1 && "sr-only")}>
          {total > 1 ? t(oneAddress ? "peopleAddress" : "people", { count: total }) : t("label")}
        </p>
        <button
          type="button"
          onClick={onClose}
          title={t("close")}
          className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={12} aria-hidden="true" />
          <span className="sr-only">{t("close")}</span>
        </button>
      </div>
      {peek.isError ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("failed")}
        </p>
      ) : peek.isPending ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("loading")}
        </p>
      ) : (
        <ul className="-mt-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          {items.map((lead) => (
            <PeekLead key={lead.id} lead={lead} point={point} classification={classification} />
          ))}
        </ul>
      )}
      {!peek.isPending && !peek.isError && unlisted > 0 ? <p className="text-2xs text-muted-foreground">{t("more", { count: unlisted })}</p> : null}
      <p className="text-2xs text-muted-foreground max-sm:hidden">{t("selectHint")}</p>
    </div>
  );
}
