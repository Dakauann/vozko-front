"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Check, CircleNotch, House, Plus, Trash, WarningCircle } from "@/components/icons";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { searchCepAction } from "@/app/actions/cep";
import { pinLeadAddressAction } from "@/app/actions/leads";
import { MiniMap } from "@/components/maps/MiniMap";
import { PlaceCombobox } from "@/components/places/PlaceCombobox";
import { useLeadMapViewport } from "@/hooks/use-lead-map";
import { useReferencePoint } from "@/hooks/use-reference-point";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { emptyCrmFilter } from "@/lib/crm/board";
import { cepDigits } from "@/lib/address/cep";
import { areaLine } from "@/lib/leads/detail";
import type { AddressPosition, LeadMapParams } from "@/lib/leads/map-view";
import {
  addAddress,
  applyCepLookup,
  applyPlace,
  makePrimary,
  pinKeepOffered,
  removeAddress,
  shownPinOf,
  withAddressZip,
  withMovedPin,
  type AddressDraft,
  type LeadSheetDraft,
} from "@/lib/leads/sheet";
import { LEAD_ADDRESS_LABELS, type LeadAddressLabel, type LeadRecord } from "@/lib/leads/types";
import type { Place } from "@/lib/maps/places";
import { pinStart } from "@/lib/maps/placement";
import { zoomForPrecision } from "@/lib/maps/precision";
import { cepReferenceQuery } from "@/lib/maps/reference-point";
import type { LatLng } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { SheetHint, SheetIconButton, SheetLinkButton, SheetSection } from "./SheetSection";

type CepStatus = "searching" | "found" | "not_found" | "invalid" | "unavailable";

const CEP_HINT: Record<Exclude<CepStatus, "searching">, string> = {
  found: "cepFound",
  not_found: "cepNotFound",
  invalid: "cepInvalid",
  unavailable: "cepUnavailable",
};

export interface AddressPinEditor {
  leadId: string | null;
  canPlace?: boolean;
  positions: Readonly<Record<string, AddressPosition | null | undefined>>;
  onPinned: (lead: LeadRecord) => void;
}

const WORKSPACE_MAP: LeadMapParams = { filter: emptyCrmFilter, q: "" };

function UnsavedPinPreview({ address }: { address: AddressDraft }) {
  const t = useTranslations("leadSheet.addresses.pin");
  const reference = useReferencePoint(cepReferenceQuery(address.zipCode));
  if (!reference.point) return <SheetHint>{t("unsaved")}</SheetHint>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{t("previewTitle")}</p>
      <MiniMap
        position={reference.point.position}
        precision={reference.point.precision}
        interactive={false}
        draggable={false}
        ariaLabel={t("previewTitle")}
        className="h-40"
      />
      <SheetHint>{t("cepPreview", { source: reference.point.attribution })}</SheetHint>
    </div>
  );
}

function UnsavedAddressPin({ address, onMove }: { address: AddressDraft; onMove: (next: AddressDraft) => void }) {
  const t = useTranslations("leadSheet.addresses.pin");
  const reference = useReferencePoint(address.pin || address.placePoint ? null : cepReferenceQuery(address.zipCode));
  const shown = shownPinOf(address, reference.point);
  const workspaceMap = useLeadMapViewport(WORKSPACE_MAP, { enabled: shown === null });
  if (shown === null && (reference.loading || workspaceMap.isLoading)) {
    return <span aria-hidden="true" className="block h-40 w-full animate-pulse rounded-lg bg-muted" />;
  }
  const frame = shown ? { position: shown.position, zoom: zoomForPrecision(shown.precision) } : pinStart(workspaceMap.data ?? null, null);
  const hint = shown?.moved ? t("unsavedMoved") : shown ? t("unsavedFromAddress") : t("unsavedPlace");
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{t("title")}</p>
      <MiniMap
        position={frame.position}
        precision={shown?.precision ?? null}
        zoom={frame.zoom}
        interactive
        draggable
        ariaLabel={t("title")}
        className="h-40"
        onPinMoved={(next) => onMove(withMovedPin(address, next))}
      />
      <SheetHint>{hint}</SheetHint>
      {shown?.moved ? (
        <SheetLinkButton
          onClick={() => {
            const next = { ...address };
            delete next.pin;
            onMove(next);
          }}
        >
          {t("unsavedReset")}
        </SheetLinkButton>
      ) : null}
    </div>
  );
}

function AddressPin({ address, pin, onMove }: { address: AddressDraft; pin: AddressPinEditor; onMove: (next: AddressDraft) => void }) {
  if (!address.id || !pin.leadId) {
    return pin.canPlace ? <UnsavedAddressPin address={address} onMove={onMove} /> : <UnsavedPinPreview address={address} />;
  }
  return <SavedAddressPin addressId={address.id} leadId={pin.leadId} zipCode={address.zipCode} pin={pin} />;
}

function SavedAddressPin({ addressId, leadId, zipCode, pin }: { addressId: string; leadId: string; zipCode: string; pin: AddressPinEditor }) {
  const t = useTranslations("leadSheet.addresses.pin");
  const tLeads = useTranslations("leadsPage");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const position = pin.positions[addressId] ?? null;
  const placing = position === null;
  const workspaceMap = useLeadMapViewport(WORKSPACE_MAP, { enabled: placing });
  const reference = useReferencePoint(placing ? cepReferenceQuery(zipCode) : null);

  const save = async (next: LatLng) => {
    setSaving(true);
    const outcome = await pinLeadAddressAction(leadId, addressId, next);
    setSaving(false);
    if (!outcome.lead) {
      setRevision((current) => current + 1);
      toast.error(codedErrorMessage(t, outcome.error, codedErrorMessage(tLeads, outcome.error, t("failed"))));
      return;
    }
    pin.onPinned(outcome.lead);
    toast.success(t("saved"));
  };

  if (placing && (reference.loading || (!reference.point && workspaceMap.isLoading))) {
    return <span aria-hidden="true" className="block h-40 w-full animate-pulse rounded-lg bg-muted" />;
  }
  const frame = position
    ? { position: { lat: position.lat, lng: position.lng }, zoom: undefined, placing: false }
    : { ...pinStart(workspaceMap.data ?? null, reference.point), placing: true };
  const placingHint = reference.point ? t("notLocatedFromCep") : t("notLocated");

  return (
    <div className="space-y-1.5" aria-busy={saving}>
      <p className="text-xs font-medium text-foreground">{t("title")}</p>
      <MiniMap
        key={revision}
        position={frame.position}
        precision={position?.precision ?? null}
        zoom={frame.zoom}
        interactive={frame.placing}
        draggable={!saving}
        ariaLabel={t("title")}
        className="h-40"
        onPinMoved={(next) => void save(next)}
      />
      <SheetHint>{saving ? t("saving") : frame.placing ? placingHint : t("hint")}</SheetHint>
    </div>
  );
}

function KeepPinChoice({ address, onKeep }: { address: AddressDraft; onKeep: (keep: boolean) => void }) {
  const t = useTranslations("leadSheet.addresses");
  return (
    <div className="space-y-1">
      <SheetHint tone="info">{t("keepPinHint")}</SheetHint>
      <label className="flex min-h-[34px] items-center gap-2 pl-1 text-xs text-foreground sm:min-h-0">
        <Checkbox checked={address.keepPosition === true} onCheckedChange={(checked) => onKeep(checked === true)} aria-label={t("keepPin")} />
        {t("keepPin")}
      </label>
    </div>
  );
}

export function AddressesSection({
  draft,
  base,
  errors,
  editable,
  onUpdate,
  pin,
}: {
  draft: LeadSheetDraft;
  base?: LeadRecord | null;
  errors: Record<string, string>;
  editable: boolean;
  onUpdate: (update: (draft: LeadSheetDraft) => LeadSheetDraft) => void;
  pin?: AddressPinEditor;
}) {
  const t = useTranslations("leadSheet.addresses");
  const [cepStatus, setCepStatus] = useState<Record<string, CepStatus>>({});
  const latestCep = useRef<Record<string, string>>({});

  if (!editable) {
    return (
      <SheetSection icon={<House />} title={t("title")}>
        {draft.addresses.length === 0 ? (
          <SheetHint>{t("empty")}</SheetHint>
        ) : (
          <ul className="space-y-1.5">
            {draft.addresses.map((address) => (
              <li key={address.key} className="flex items-center gap-2 text-sm text-foreground">
                <span>{areaLine(address) || <EmptyValue />}</span>
                {address.primary ? <PrimaryBadge label={t("primary")} /> : null}
              </li>
            ))}
          </ul>
        )}
        <SheetHint>{t("restricted")}</SheetHint>
      </SheetSection>
    );
  }

  const patchAddress = (key: string, patch: (address: AddressDraft) => AddressDraft) =>
    onUpdate((current) => ({
      ...current,
      addresses: current.addresses.map((address) => (address.key === key ? patch(address) : address)),
    }));

  const lookUpCep = async (key: string, digits: string) => {
    latestCep.current[key] = digits;
    setCepStatus((previous) => ({ ...previous, [key]: "searching" }));
    const lookup = await searchCepAction(digits);
    if (latestCep.current[key] !== digits) return;
    setCepStatus((previous) => ({ ...previous, [key]: lookup.status }));
    if (lookup.status !== "found") return;
    patchAddress(key, (address) => applyCepLookup(address, lookup.address));
  };

  const pickPlace = (address: AddressDraft, place: Place) => {
    if (place.zipCode) {
      latestCep.current[address.key] = place.zipCode;
      setCepStatus((previous) => ({ ...previous, [address.key]: "found" }));
    }
    patchAddress(address.key, (current) => applyPlace(current, place));
  };

  const changeZip = (address: AddressDraft, zipCode: string) => {
    patchAddress(address.key, (current) => withAddressZip(current, zipCode));
    const digits = cepDigits(zipCode);
    if (!digits) {
      latestCep.current[address.key] = "";
      setCepStatus((previous) => {
        const next = { ...previous };
        delete next[address.key];
        return next;
      });
      return;
    }
    if (digits !== cepDigits(address.zipCode)) void lookUpCep(address.key, digits);
  };

  return (
    <SheetSection icon={<House />} title={t("title")}>
      {draft.addresses.length === 0 ? <SheetHint>{t("empty")}</SheetHint> : null}
      {draft.addresses.map((address, index) => {
        const status = cepStatus[address.key];
        const rowError = errors[`addresses.${index}`];
        return (
          <fieldset
            key={address.key}
            aria-label={t("addressN", { index: index + 1 })}
            className={cn("space-y-2 rounded-[--radius] border border-border p-3", rowError && "border-destructive-ink")}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[9rem] flex-1 sm:max-w-[12rem]">
                <ElevatedSelect
                  label={t("label")}
                  value={address.label}
                  onValueChange={(label) => patchAddress(address.key, (current) => ({ ...current, label: label as LeadAddressLabel }))}
                  className="w-full"
                >
                  {LEAD_ADDRESS_LABELS.map((label) => (
                    <ElevatedSelectItem key={label} value={label}>
                      {t(`labels.${label}`)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
              {address.primary ? (
                <PrimaryBadge label={t("primary")} />
              ) : (
                <SheetLinkButton onClick={() => onUpdate((current) => makePrimary(current, address.key))}>{t("makePrimary")}</SheetLinkButton>
              )}
              <span className="ml-auto">
                <SheetIconButton label={t("remove")} onClick={() => onUpdate((current) => removeAddress(current, address.key))}>
                  <Trash />
                </SheetIconButton>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_6rem]">
              <ElevatedInput
                id={`lead-sheet-zip-${address.key}`}
                label={t("zipCode")}
                variant="outline"
                controlSize="sm"
                inputMode="numeric"
                autoComplete="postal-code"
                value={address.zipCode}
                onChange={(event) => changeZip(address, event.target.value)}
                icon={status ? <CepStatusIcon status={status} /> : undefined}
              />
              <PlaceCombobox
                id={`lead-sheet-street-${address.key}`}
                label={t("street")}
                ariaLabel={t("suggest.streets")}
                value={address.street}
                request={{ kind: "street", cityCode: address.cityCode }}
                onValueChange={(value) => patchAddress(address.key, (current) => ({ ...current, street: value }))}
                onPick={(place) => pickPlace(address, place)}
                autoComplete="address-line1"
              />
              <ElevatedInput
                id={`lead-sheet-house-${address.key}`}
                label={t("number")}
                variant="outline"
                controlSize="sm"
                value={address.number}
                onChange={({ target: { value } }) => patchAddress(address.key, (current) => ({ ...current, number: value }))}
              />
            </div>
            <ElevatedInput
              id={`lead-sheet-complement-${address.key}`}
              label={t("complement")}
              variant="outline"
              controlSize="sm"
              value={address.complement}
              onChange={({ target: { value } }) => patchAddress(address.key, (current) => ({ ...current, complement: value }))}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5rem]">
              <PlaceCombobox
                id={`lead-sheet-district-${address.key}`}
                label={t("district")}
                ariaLabel={t("suggest.districts")}
                value={address.district}
                request={{ kind: "district", cityCode: address.cityCode }}
                onValueChange={(value) => patchAddress(address.key, (current) => ({ ...current, district: value }))}
                onPick={(place) => pickPlace(address, place)}
              />
              <PlaceCombobox
                id={`lead-sheet-city-${address.key}`}
                label={t("city")}
                ariaLabel={t("suggest.cities")}
                value={address.city}
                request={{ kind: "city", state: address.state }}
                onValueChange={(value) => patchAddress(address.key, (current) => ({ ...current, city: value, cityCode: "" }))}
                onPick={(place) => pickPlace(address, place)}
                autoComplete="address-level2"
              />
              <ElevatedInput
                id={`lead-sheet-state-${address.key}`}
                label={t("state")}
                variant="outline"
                controlSize="sm"
                maxLength={2}
                autoCapitalize="characters"
                value={address.state}
                onChange={({ target: { value } }) => patchAddress(address.key, (current) => ({ ...current, state: value.toUpperCase(), cityCode: "" }))}
              />
            </div>
            {pin ? <AddressPin address={address} pin={pin} onMove={(next) => patchAddress(address.key, () => next)} /> : null}
            {pinKeepOffered(base, address) ? (
              <KeepPinChoice address={address} onKeep={(keepPosition) => patchAddress(address.key, (current) => ({ ...current, keepPosition }))} />
            ) : null}
            {rowError ? (
              <SheetHint tone="error">{rowError}</SheetHint>
            ) : status && status !== "searching" ? (
              <SheetHint tone={status === "found" ? "muted" : "info"}>{t(CEP_HINT[status])}</SheetHint>
            ) : (
              <SheetHint>{t("cepHint")}</SheetHint>
            )}
          </fieldset>
        );
      })}
      {errors.addresses ? <SheetHint tone="error">{errors.addresses}</SheetHint> : null}
      {draft.addresses.length > 0 ? <SheetHint>{t("positionHint")}</SheetHint> : null}
      <SheetLinkButton icon={<Plus />} onClick={() => onUpdate(addAddress)}>
        {t("add")}
      </SheetLinkButton>
    </SheetSection>
  );
}

function PrimaryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-semibold text-foreground">
      {label}
    </span>
  );
}

function CepStatusIcon({ status }: { status: CepStatus }) {
  const t = useTranslations("leadSheet.addresses");
  if (status === "searching") {
    return <CircleNotch className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={t("cepSearching")} />;
  }
  if (status === "found") return <Check className="h-3.5 w-3.5 text-healthy-ink" aria-hidden />;
  return <WarningCircle className="h-3.5 w-3.5 text-warning-ink" aria-hidden />;
}
