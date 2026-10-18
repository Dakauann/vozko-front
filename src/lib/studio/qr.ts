import { contrastRatio, luminance, parseColor } from "./color";
import type { Layer } from "./document";
import { encodeQrVersion, QR_BYTE_CAPACITY, QR_ECC_LEVELS, QR_VERSION_RANGE, qrBytes, smallestVersion, type QrEcc, type QrSymbol } from "./qr-encoder";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";

export { QR_ECC_LEVELS, type QrEcc } from "./qr-encoder";

export const QR_LINK_KINDS = ["shortLink", "whatsapp", "url", "text"] as const;

export type QrLinkKind = (typeof QR_LINK_KINDS)[number];

export type QrLink =
  | { kind: "shortLink"; shortLinkId: string; url: string }
  | { kind: "whatsapp"; phone: string; message?: string }
  | { kind: "url"; url: string }
  | { kind: "text"; text: string };

export interface QrLogo {
  assetId: string;
  scale: number;
  aspect: number;
}

export interface QrSpec {
  link: QrLink;
  ecc: QrEcc;
  quietZone: number;
  dark: string;
  light: string;
  logo?: QrLogo;
}

export const QR_LIMITS = {
  quietZone: [2, 16],
  minContrast: 4,
  urlBytes: 2048,
  logoScale: 0.08,
  logoAspect: [0.1, 10],
  minModulePx: 3,
} as const;

export const QR_LOGO_MAX: Readonly<Record<QrEcc, number>> = { L: 0, M: 0.2, Q: 0.25, H: 0.3 };

export const QR_DEFAULTS = { ecc: "M", logoEcc: "H", quietZone: 4, dark: "#111111", light: "#ffffff", logoScale: 0.22 } as const satisfies { ecc: QrEcc; logoEcc: QrEcc; quietZone: number; dark: string; light: string; logoScale: number };

const QR_LAYER_FIELDS: readonly string[] = ["id", "type", "name", "transform", "hidden", "locked", "groupId", "qr", "layoutItem"];

const WHATSAPP_LINK_BASE = "https://wa.me/";

const URL_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i;
const PHONE_PATTERN = /^[1-9]\d{7,14}$/;
const LINK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FORMAT_REACH = 9;
const LOGO_DAMAGE_SHARE = 0.35;
const TEXT_BREAKS = new Set(["\n", "\r", "\t"]);

export type QrScanProblem = "contrast" | "inverted" | "quietZone" | "tooLong" | "logoEcc" | "logoSize";

export function isQrEcc(value: unknown): value is QrEcc {
  return typeof value === "string" && (QR_ECC_LEVELS as readonly string[]).includes(value);
}

function isQrLinkKind(value: unknown): value is QrLinkKind {
  return typeof value === "string" && (QR_LINK_KINDS as readonly string[]).includes(value);
}

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function whatsappUrl(phone: string, message?: string): string {
  const text = message ?? "";
  return `${WHATSAPP_LINK_BASE}${phone}${text === "" ? "" : `?text=${encodeURIComponent(text)}`}`;
}

export function qrContent(link: QrLink): string {
  switch (link.kind) {
    case "shortLink":
    case "url":
      return link.url;
    case "whatsapp":
      return whatsappUrl(link.phone, link.message);
    case "text":
      return link.text;
  }
}

function hasControl(text: string, allowBreaks: boolean): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if ((code < 0x20 || (code >= 0x7f && code <= 0x9f)) && !(allowBreaks && TEXT_BREAKS.has(char))) return true;
  }
  return false;
}

export function isQrUrl(value: string): boolean {
  return URL_PATTERN.test(value) && !hasControl(value, false) && qrBytes(value).length <= QR_LIMITS.urlBytes;
}

const LINK_FIELDS: Readonly<Record<QrLinkKind, readonly string[]>> = {
  shortLink: ["kind", "shortLinkId", "url"],
  whatsapp: ["kind", "phone", "message"],
  url: ["kind", "url"],
  text: ["kind", "text"],
};

function strayField(link: QrLink): boolean {
  const allowed = LINK_FIELDS[link.kind];
  return Object.entries(link).some(([key, value]) => !allowed.includes(key) && value !== undefined && value !== "");
}

export function qrLinkIssue(link: QrLink | undefined): IssueCode | null {
  if (!link) return "required";
  if (!isQrLinkKind(link.kind)) return "unknown";
  if (strayField(link)) return "invalid";
  switch (link.kind) {
    case "shortLink":
      return LINK_ID_PATTERN.test(link.shortLinkId ?? "") && isQrUrl(link.url ?? "") ? null : "invalid";
    case "url":
      return isQrUrl(link.url ?? "") ? null : "invalid";
    case "whatsapp":
      return PHONE_PATTERN.test(link.phone ?? "") && !hasControl(link.message ?? "", true) ? null : "invalid";
    case "text": {
      const text = link.text ?? "";
      if (text.trim() === "") return "required";
      return hasControl(text, true) ? "invalid" : null;
    }
  }
}

function colorOf(value: string): ReturnType<typeof parseColor> {
  return HEX_COLOR.test(value) ? parseColor(value) : null;
}

export function qrContrast(dark: string, light: string): number | null {
  const a = colorOf(dark);
  const b = colorOf(light);
  return a && b ? contrastRatio(a, b) : null;
}

export function qrColorProblem(dark: string, light: string): QrScanProblem | null {
  const a = colorOf(dark);
  const b = colorOf(light);
  if (!a || !b) return null;
  if (luminance(a) >= luminance(b)) return "inverted";
  return contrastRatio(a, b) < QR_LIMITS.minContrast ? "contrast" : null;
}

export function logoMax(ecc: QrEcc): number {
  return QR_LOGO_MAX[ecc];
}

function logoIssue(logo: QrLogo | undefined, ecc: QrEcc): IssueCode | null {
  if (!logo) return null;
  if (!isValidToken(logo.assetId ?? "")) return "invalid";
  const aspect = logo.aspect;
  if (!(Number.isFinite(aspect) && aspect >= QR_LIMITS.logoAspect[0] && aspect <= QR_LIMITS.logoAspect[1])) return "out_of_range";
  const max = logoMax(ecc);
  return Number.isFinite(logo.scale) && logo.scale >= QR_LIMITS.logoScale && logo.scale <= max ? null : "out_of_range";
}

export function qrScanProblem(spec: QrSpec): QrScanProblem | null {
  const colors = qrColorProblem(spec.dark, spec.light);
  if (colors) return colors;
  if (!(Number.isInteger(spec.quietZone) && spec.quietZone >= QR_LIMITS.quietZone[0])) return "quietZone";
  if (qrBytes(qrContent(spec.link)).length > QR_BYTE_CAPACITY[spec.ecc]) return "tooLong";
  if (spec.logo && logoMax(spec.ecc) === 0) return "logoEcc";
  if (spec.logo && spec.logo.scale > logoMax(spec.ecc)) return "logoSize";
  return null;
}

export function qrIssue(spec: QrSpec | undefined): IssueCode | null {
  if (!spec) return "required";
  const linkCode = qrLinkIssue(spec.link);
  if (linkCode) return linkCode;
  if (!isQrEcc(spec.ecc)) return "unknown";
  if (!Number.isInteger(spec.quietZone)) return "invalid";
  if (spec.quietZone < QR_LIMITS.quietZone[0] || spec.quietZone > QR_LIMITS.quietZone[1]) return "out_of_range";
  if (!colorOf(spec.dark) || !colorOf(spec.light)) return "invalid";
  if (qrColorProblem(spec.dark, spec.light)) return "invalid";
  if (qrBytes(qrContent(spec.link)).length > QR_BYTE_CAPACITY[spec.ecc]) return "too_large";
  return logoIssue(spec.logo, spec.ecc);
}

function isZero(value: unknown): boolean {
  return value === undefined || value === "" || value === false || value === 0 || (Array.isArray(value) && value.length === 0);
}

export function qrLayerIssue(layer: Layer): IssueCode | null {
  if (Object.entries(layer).some(([key, value]) => !QR_LAYER_FIELDS.includes(key) && !isZero(value))) return "invalid";
  return qrIssue(layer.qr);
}

interface ModuleRect {
  start: number;
  side: number;
}

export function logoPlate(size: number, logo: QrLogo): ModuleRect {
  const raw = Math.max(1, Math.round(logo.scale * size));
  const side = raw % 2 === size % 2 ? raw : raw + 1;
  return { start: (size - side) / 2, side };
}

function hiddenPerBlock(symbol: QrSymbol, plate: ModuleRect): number[] {
  const hidden = Array.from({ length: symbol.blocks }, () => new Set<number>());
  for (let y = plate.start; y < plate.start + plate.side; y++) {
    for (let x = plate.start; x < plate.start + plate.side; x++) {
      const owner = symbol.codewords[y * symbol.size + x];
      if (owner >= 0) hidden[symbol.blockOf[owner]].add(owner);
    }
  }
  return hidden.map((set) => set.size);
}

export function logoFits(symbol: QrSymbol, logo: QrLogo): boolean {
  const plate = logoPlate(symbol.size, logo);
  if (plate.start < FORMAT_REACH) return false;
  const allowed = Math.floor(symbol.ecPerBlock * LOGO_DAMAGE_SHARE);
  return hiddenPerBlock(symbol, plate).every((count) => count <= allowed);
}

const symbols = new WeakMap<QrSpec, QrSymbol | null>();

export function qrSymbol(spec: QrSpec): QrSymbol | null {
  if (symbols.has(spec)) return symbols.get(spec) ?? null;
  const content = qrContent(spec.link);
  const first = smallestVersion(qrBytes(content).length, spec.ecc);
  let found: QrSymbol | null = null;
  for (let version = first ?? QR_VERSION_RANGE[1] + 1; version <= QR_VERSION_RANGE[1] && !found; version++) {
    const symbol = encodeQrVersion(content, spec.ecc, version);
    if (symbol && (!spec.logo || logoFits(symbol, spec.logo))) found = symbol;
  }
  symbols.set(spec, found);
  return found;
}

export function modulePixels(spec: QrSpec, sidePx: number): number | null {
  const symbol = qrSymbol(spec);
  return symbol ? sidePx / (symbol.size + spec.quietZone * 2) : null;
}

export function newQrSpec(link: QrLink, colors: { dark: string; light: string } = QR_DEFAULTS): QrSpec {
  return { link, ecc: QR_DEFAULTS.ecc, quietZone: QR_DEFAULTS.quietZone, dark: colors.dark, light: colors.light };
}

export function withLogo(spec: QrSpec, logo: QrLogo | null): QrSpec {
  if (!logo) {
    const rest = { ...spec };
    delete rest.logo;
    return rest;
  }
  const ecc = logoMax(spec.ecc) === 0 || logo.scale > logoMax(spec.ecc) ? QR_DEFAULTS.logoEcc : spec.ecc;
  return { ...spec, ecc, logo: { ...logo, scale: Math.min(logo.scale, logoMax(ecc)) } };
}

export function withEcc(spec: QrSpec, ecc: QrEcc): QrSpec {
  const max = logoMax(ecc);
  return spec.logo && max > 0 ? { ...spec, ecc, logo: { ...spec.logo, scale: Math.min(spec.logo.scale, max) } } : { ...spec, ecc };
}
