import { formatCep, type CepAddress } from "@/lib/address/cep";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { isFilledValue } from "@/lib/crm/custom-fields";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { placeAsCepAddress, type Place } from "@/lib/maps/places";
import type { ReferencePoint } from "@/lib/maps/reference-point";
import type { LatLng, Precision } from "@/lib/maps/types";
import type {
  LeadAddressLabel,
  LeadPhoneLabel,
  LeadRecord,
  LeadRelationKind,
} from "@/lib/leads/types";

export interface PhoneDraft {
  key: string;
  id?: string;
  number: string;
  label: LeadPhoneLabel;
}

export interface AddressDraft {
  key: string;
  id?: string;
  label: LeadAddressLabel;
  primary: boolean;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  cityCode: string;
  keepPosition?: boolean;
  pin?: LatLng;
  placePoint?: PlacePoint;
}

export interface PlacePoint {
  position: LatLng;
  precision: Precision;
}

export interface ShownPin extends PlacePoint {
  moved: boolean;
}

export interface RelativeDraft {
  key: string;
  kind: LeadRelationKind;
  existingLeadId?: string;
  name: string;
  number: string;
  copyPrimaryAddress: boolean;
}

export interface LeadSheetDraft {
  number: string;
  name: string;
  nickname: string;
  email: string;
  birthDate: string;
  whatsappOptIn: boolean;
  ownerId: string;
  phones: PhoneDraft[];
  addresses: AddressDraft[];
  customFields: Record<string, unknown>;
  relatives: RelativeDraft[];
  removedRelationIds: string[];
}

export interface ContactPhoneBody {
  id?: string;
  number: string;
  label: LeadPhoneLabel;
}

export interface AddressBody {
  id?: string;
  label: LeadAddressLabel;
  primary: boolean;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  cityCode?: string;
  keepPosition?: boolean;
  pin?: { latitude: number; longitude: number };
}

export interface CreateLeadBody {
  number?: string;
  name?: string;
  nickname?: string;
  email?: string;
  birthDate?: string;
  whatsappOptIn?: boolean;
  phones?: ContactPhoneBody[];
  addresses?: AddressBody[];
  customFields?: Record<string, unknown>;
}

export interface UpdateLeadBody {
  number?: string;
  name?: string;
  nickname?: string;
  email?: string;
  birthDate?: string;
  whatsappOptIn?: boolean;
  phones?: ContactPhoneBody[];
  addresses?: AddressBody[];
  customFields?: Record<string, unknown>;
}

const TEXT_FIELDS = ["number", "name", "nickname", "email", "birthDate"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

const ADDRESS_TEXT = ["zipCode", "street", "number", "complement", "district", "city", "state", "cityCode"] as const;

const HAND_PLACED_SOURCES: ReadonlySet<string> = new Set(["manual", "lead_pin"]);

let sequence = 0;
function nextKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function emptyLeadDraft(): LeadSheetDraft {
  return {
    number: "",
    name: "",
    nickname: "",
    email: "",
    birthDate: "",
    whatsappOptIn: false,
    ownerId: "",
    phones: [],
    addresses: [],
    customFields: {},
    relatives: [],
    removedRelationIds: [],
  };
}

function formattedNumber(raw: string | undefined): string {
  return raw ? formatPhoneForDisplay(raw) : "";
}

export function draftFromRecord(lead: LeadRecord): LeadSheetDraft {
  return {
    number: formattedNumber(lead.number),
    name: lead.realName ?? "",
    nickname: lead.nickname ?? "",
    email: lead.email ?? "",
    birthDate: lead.birthDate ?? "",
    whatsappOptIn: !!lead.whatsappOptIn,
    ownerId: lead.owner ?? "",
    phones: (lead.phones ?? []).map((phone) => ({
      key: phone.id,
      id: phone.id,
      number: formattedNumber(phone.number),
      label: phone.label,
    })),
    addresses: (lead.addresses ?? []).map((address) => ({
      key: address.id,
      id: address.id,
      label: address.label,
      primary: address.primary,
      zipCode: address.zipCode ?? "",
      street: address.street ?? "",
      number: address.number ?? "",
      complement: address.complement ?? "",
      district: address.district ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      cityCode: address.cityCode ?? "",
    })),
    customFields: { ...(lead.customFields ?? {}) },
    relatives: [],
    removedRelationIds: [],
  };
}

export function addPhone(draft: LeadSheetDraft): LeadSheetDraft {
  return { ...draft, phones: [...draft.phones, { key: nextKey("phone"), number: "", label: "mobile" }] };
}

export function addAddress(draft: LeadSheetDraft): LeadSheetDraft {
  const address: AddressDraft = {
    key: nextKey("address"),
    label: draft.addresses.length === 0 ? "home" : "other",
    primary: draft.addresses.length === 0,
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    cityCode: "",
  };
  return { ...draft, addresses: [...draft.addresses, address] };
}

export function makePrimary(draft: LeadSheetDraft, key: string): LeadSheetDraft {
  return { ...draft, addresses: draft.addresses.map((address) => ({ ...address, primary: address.key === key })) };
}

export function removeAddress(draft: LeadSheetDraft, key: string): LeadSheetDraft {
  const remaining = draft.addresses.filter((address) => address.key !== key);
  if (remaining.length > 0 && !remaining.some((address) => address.primary)) {
    remaining[0] = { ...remaining[0], primary: true };
  }
  return { ...draft, addresses: remaining };
}

function addressIsEmpty(address: AddressDraft): boolean {
  return !address.pin && ADDRESS_TEXT.every((field) => address[field].trim() === "");
}

export function leadDraftIssues(draft: LeadSheetDraft): string[] {
  const issues: string[] = [];
  draft.phones.forEach((phone, index) => {
    if (phone.number.trim() === "") issues.push(`phones.${index}`);
  });
  draft.addresses.forEach((address, index) => {
    if (addressIsEmpty(address)) issues.push(`addresses.${index}`);
  });
  return issues;
}

function phoneBody(phone: PhoneDraft): ContactPhoneBody {
  return { ...(phone.id ? { id: phone.id } : {}), number: phone.number.trim(), label: phone.label };
}

function addressBody(address: AddressDraft): AddressBody {
  const body: AddressBody = { ...(address.id ? { id: address.id } : {}), label: address.label, primary: address.primary };
  for (const field of ADDRESS_TEXT) {
    const value = address[field].trim();
    if (value) body[field] = value;
  }
  if (address.pin) body.pin = { latitude: address.pin.lat, longitude: address.pin.lng };
  return body;
}

export function pinKeepOffered(base: LeadRecord | null | undefined, address: AddressDraft): boolean {
  const stored = address.id ? base?.addresses?.find((candidate) => candidate.id === address.id) : undefined;
  if (!stored?.positionSource || !HAND_PLACED_SOURCES.has(stored.positionSource)) return false;
  if (typeof stored.latitude !== "number" || typeof stored.longitude !== "number") return false;
  return ADDRESS_TEXT.some((field) => (stored[field] ?? "").trim() !== address[field].trim());
}

function updatedAddressBody(base: LeadRecord, address: AddressDraft): AddressBody {
  const body = addressBody(address);
  return address.keepPosition && pinKeepOffered(base, address) ? { ...body, keepPosition: true } : body;
}

function filledCustomFields(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => isFilledValue(value)));
}

export function createLeadBody(draft: LeadSheetDraft): CreateLeadBody {
  const body: CreateLeadBody = {};
  for (const field of TEXT_FIELDS) {
    const value = draft[field].trim();
    if (value) body[field] = value;
  }
  if (draft.whatsappOptIn) body.whatsappOptIn = true;
  if (draft.phones.length > 0) body.phones = draft.phones.map(phoneBody);
  if (draft.addresses.length > 0) body.addresses = draft.addresses.map(addressBody);
  const customFields = filledCustomFields(draft.customFields);
  if (Object.keys(customFields).length > 0) body.customFields = customFields;
  return body;
}

export function applyCepLookup(address: AddressDraft, found: CepAddress): AddressDraft {
  return {
    ...address,
    street: found.logradouro.trim() || address.street,
    district: found.bairro.trim(),
    city: found.localidade.trim(),
    state: found.uf.trim(),
    cityCode: found.ibge?.trim() ?? "",
  };
}

function placePointOf(place: Place): PlacePoint {
  return { position: place.position, precision: place.precision };
}

export function applyPlace(address: AddressDraft, place: Place): AddressDraft {
  const found = placeAsCepAddress(place);
  const placePoint = placePointOf(place);
  if (found) return { ...applyCepLookup(address, found), zipCode: formatCep(found.cep), placePoint };
  const located = { ...address, city: place.city, state: place.state, cityCode: place.cityCode, placePoint };
  if (place.kind === "city") return located;
  const withDistrict = place.district ? { ...located, district: place.district } : located;
  return place.kind === "street" && place.street ? { ...withDistrict, street: place.street } : withDistrict;
}

export function withAddressZip(address: AddressDraft, zipCode: string): AddressDraft {
  const next = { ...address, zipCode };
  delete next.placePoint;
  return next;
}

export function withMovedPin(address: AddressDraft, position: LatLng): AddressDraft {
  return { ...address, pin: { lat: position.lat, lng: position.lng } };
}

export function shownPinOf(address: AddressDraft, reference: ReferencePoint | null): ShownPin | null {
  if (address.pin) return { position: address.pin, precision: "exact", moved: true };
  if (address.placePoint) return { ...address.placePoint, moved: false };
  if (reference) return { position: reference.position, precision: reference.precision, moved: false };
  return null;
}

function sameJSON(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function phonesChanged(before: LeadSheetDraft, after: LeadSheetDraft): boolean {
  return !sameJSON(before.phones.map(phoneBody), after.phones.map(phoneBody));
}

function addressesChanged(before: LeadSheetDraft, after: LeadSheetDraft): boolean {
  return !sameJSON(before.addresses.map(addressBody), after.addresses.map(addressBody));
}

function normalizedValue(value: unknown): unknown {
  return isFilledValue(value) ? value : undefined;
}

function changedCustomKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !sameJSON(normalizedValue(before[key]), normalizedValue(after[key])));
}

function changedTextFields(before: LeadSheetDraft, after: LeadSheetDraft): TextField[] {
  return TEXT_FIELDS.filter((field) => before[field].trim() !== after[field].trim());
}

export function updateLeadBody(
  base: LeadRecord,
  draft: LeadSheetDraft,
  access: { addresses: boolean },
): UpdateLeadBody {
  const before = draftFromRecord(base);
  const body: UpdateLeadBody = {};
  for (const field of changedTextFields(before, draft)) body[field] = draft[field].trim();
  if (before.whatsappOptIn !== draft.whatsappOptIn) body.whatsappOptIn = draft.whatsappOptIn;
  if (phonesChanged(before, draft)) body.phones = draft.phones.map(phoneBody);
  if (access.addresses && addressesChanged(before, draft)) body.addresses = draft.addresses.map((address) => updatedAddressBody(base, address));
  const customKeys = changedCustomKeys(before.customFields, draft.customFields);
  if (customKeys.length > 0) {
    body.customFields = Object.fromEntries(
      customKeys.map((key) => [key, normalizedValue(draft.customFields[key]) ?? null]),
    );
  }
  return body;
}

export const CUSTOM_FIELD_PATH = "customFields.";

export function customFieldKeyOf(path: string): string | null {
  return path.startsWith(CUSTOM_FIELD_PATH) ? path.slice(CUSTOM_FIELD_PATH.length) : null;
}

function changedFields(before: LeadSheetDraft, after: LeadSheetDraft): string[] {
  const fields: string[] = [...changedTextFields(before, after)];
  if (before.whatsappOptIn !== after.whatsappOptIn) fields.push("whatsappOptIn");
  if (before.ownerId !== after.ownerId) fields.push("owner");
  if (phonesChanged(before, after)) fields.push("phones");
  if (addressesChanged(before, after)) fields.push("addresses");
  for (const key of changedCustomKeys(before.customFields, after.customFields)) fields.push(`${CUSTOM_FIELD_PATH}${key}`);
  return fields;
}

export function conflictFields(base: LeadRecord, current: LeadRecord): string[] {
  return changedFields(draftFromRecord(base), draftFromRecord(current));
}

export interface LeadConflict {
  changed: string[];
  overlap: string[];
}

export function leadConflict(base: LeadRecord, current: LeadRecord, mine: LeadSheetDraft): LeadConflict {
  const before = draftFromRecord(base);
  const changed = changedFields(before, draftFromRecord(current));
  const mineChanged = new Set(changedFields(before, mine));
  return { changed, overlap: changed.filter((field) => mineChanged.has(field)) };
}

function isTextField(field: string): field is TextField {
  return (TEXT_FIELDS as readonly string[]).includes(field);
}

function withFieldFrom(target: LeadSheetDraft, source: LeadSheetDraft, field: string): LeadSheetDraft {
  const key = customFieldKeyOf(field);
  if (key !== null) {
    const customFields = { ...target.customFields };
    if (isFilledValue(source.customFields[key])) customFields[key] = source.customFields[key];
    else delete customFields[key];
    return { ...target, customFields };
  }
  if (isTextField(field)) return { ...target, [field]: source[field] };
  if (field === "whatsappOptIn") return { ...target, whatsappOptIn: source.whatsappOptIn };
  if (field === "owner") return { ...target, ownerId: source.ownerId };
  if (field === "phones") return { ...target, phones: source.phones };
  if (field === "addresses") return { ...target, addresses: source.addresses };
  return target;
}

export function rebaseDraft(
  base: LeadRecord,
  current: LeadRecord,
  mine: LeadSheetDraft,
  keepMine: ReadonlySet<string> = new Set(),
): LeadSheetDraft {
  const before = draftFromRecord(base);
  const next = draftFromRecord(current);
  const theirs = new Set(changedFields(before, next));
  const rebased = changedFields(before, mine)
    .filter((field) => !theirs.has(field) || keepMine.has(field))
    .reduce((draft, field) => withFieldFrom(draft, mine, field), next);
  return { ...rebased, relatives: mine.relatives, removedRelationIds: mine.removedRelationIds };
}

export interface RefusalTargets {
  addressesEditable: boolean;
  readableFieldKeys: ReadonlySet<string>;
}

export function refusalShownOnField(path: string, targets: RefusalTargets): boolean {
  const key = customFieldKeyOf(path);
  if (key !== null) return targets.readableFieldKeys.has(key);
  if (path === "addresses" || path.startsWith("addresses.")) return targets.addressesEditable;
  return true;
}

const FIELD_OF_CODE: Record<string, string> = {
  lead_number_invalid: "number",
  lead_identity_taken: "number",
  lead_identity_in_use: "number",
  lead_identity_required: "name",
  lead_name_too_long: "name",
  lead_nickname_too_long: "nickname",
  lead_email_invalid: "email",
  lead_birth_date_invalid: "birthDate",
};

export function refusalPath(error: CodedRefusal): string | null {
  const code = error.code ?? "";
  if (FIELD_OF_CODE[code]) return FIELD_OF_CODE[code];
  const expected = error.expected ?? {};
  if (code.startsWith("custom_field_") && expected.key) return `${CUSTOM_FIELD_PATH}${expected.key}`;
  const list = code.startsWith("lead_phone_") ? "phones" : code.startsWith("lead_address_") || code === "lead_no_primary_address" ? "addresses" : null;
  if (!list) return null;
  return expected.index !== undefined && expected.field === list ? `${list}.${expected.index}` : list;
}

const PHONE_LIKE = /^[\d\s()+.-]+$/;
const MIN_PHONE_DIGITS = 8;

export function relativeFromText(text: string): { name: string; number: string } {
  const typed = text.trim();
  const digits = typed.replace(/\D/g, "");
  if (PHONE_LIKE.test(typed) && digits.length >= MIN_PHONE_DIGITS) return { name: "", number: typed };
  return { name: typed, number: "" };
}

export function moveNumberToContacts(draft: LeadSheetDraft, base: LeadRecord): LeadSheetDraft {
  const typed = draft.number.trim();
  const withPhone = typed ? addPhone(draft) : draft;
  const phones = typed
    ? withPhone.phones.map((phone, index) => (index === withPhone.phones.length - 1 ? { ...phone, number: typed } : phone))
    : withPhone.phones;
  return { ...withPhone, number: formattedNumber(base.number), phones };
}
