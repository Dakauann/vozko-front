import type { CanvasSize } from "../document";
import { isQrEcc, logoMax, newQrSpec, phoneDigits, qrContent, qrContrast, qrIssue, qrLinkIssue, qrScanProblem, qrSymbol, withEcc, withLogo, QR_DEFAULTS, QR_ECC_LEVELS, QR_LIMITS, type QrLink, type QrSpec } from "../qr";
import { QR_BYTE_CAPACITY, qrBytes } from "../qr-encoder";

export const QR_OPERATIONS = ["add_qr_code", "update_qr_code"] as const;

export type QrOpName = (typeof QR_OPERATIONS)[number];

export const AGENT_QR_LINKS = ["short_link", "whatsapp", "url", "text"] as const;

export type AgentQrLink = (typeof AGENT_QR_LINKS)[number];

export interface AgentQrFields {
  qr_link?: string;
  qr_url?: string;
  short_link_id?: string;
  qr_phone?: string;
  qr_message?: string;
  qr_text?: string;
  qr_ecc?: string;
  qr_quiet_zone?: number;
  qr_dark?: string;
  qr_light?: string;
  logo_media_id?: string;
  logo_scale?: number;
  qr_remove_logo?: boolean;
}

export interface QrOpContext {
  shortLinkUrl: (id: string) => string | undefined;
  naturalSize: (mediaId: string) => CanvasSize | undefined;
}

type Built<T> = { ok: true; value: T } | { ok: false; reason: string };

const DOMAIN_KINDS: Readonly<Record<AgentQrLink, QrLink["kind"]>> = { short_link: "shortLink", whatsapp: "whatsapp", url: "url", text: "text" };
const AGENT_KINDS: Readonly<Record<QrLink["kind"], AgentQrLink>> = { shortLink: "short_link", whatsapp: "whatsapp", url: "url", text: "text" };
const LINK_FIELDS = ["qr_link", "qr_url", "short_link_id", "qr_phone", "qr_message", "qr_text"] as const;

function short(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function refuse<T>(reason: string): Built<T> {
  return { ok: false, reason };
}

export function isQrOperation(op: string): op is QrOpName {
  return (QR_OPERATIONS as readonly string[]).includes(op);
}

function isAgentLink(value: string): value is AgentQrLink {
  return (AGENT_QR_LINKS as readonly string[]).includes(value);
}

export function agentLinkKind(fields: AgentQrFields, current: QrLink | null): AgentQrLink | null {
  if (fields.qr_link !== undefined) return isAgentLink(fields.qr_link) ? fields.qr_link : null;
  if (fields.qr_phone !== undefined) return "whatsapp";
  if (fields.qr_text !== undefined) return "text";
  if (fields.qr_url !== undefined || fields.short_link_id !== undefined) return "short_link";
  return current ? AGENT_KINDS[current.kind] : null;
}

function linkOf(fields: AgentQrFields, current: QrLink | null, ctx: QrOpContext): Built<QrLink> {
  const touched = LINK_FIELDS.some((key) => fields[key] !== undefined);
  if (!touched && current) return { ok: true, value: current };
  const kind = agentLinkKind(fields, current);
  if (!kind) return refuse(`qr_link precisa ser um de: ${AGENT_QR_LINKS.join(", ")}`);
  const link = linkFor(kind, fields, current, ctx);
  if (!link.ok) return link;
  const code = qrLinkIssue(link.value);
  if (!code) return link;
  return refuse(linkProblem(link.value));
}

function linkFor(kind: AgentQrLink, fields: AgentQrFields, current: QrLink | null, ctx: QrOpContext): Built<QrLink> {
  const same = current?.kind === DOMAIN_KINDS[kind] ? current : null;
  switch (kind) {
    case "short_link": {
      const id = fields.short_link_id ?? (same?.kind === "shortLink" ? same.shortLinkId : undefined);
      const url = id ? ctx.shortLinkUrl(id) : undefined;
      if (!id || !url) return refuse("o link curto não está pronto: mande qr_url com o destino para criar um link curto, ou short_link_id de um link deste workspace");
      return { ok: true, value: { kind: "shortLink", shortLinkId: id, url } };
    }
    case "whatsapp": {
      const phone = phoneDigits(fields.qr_phone ?? (same?.kind === "whatsapp" ? same.phone : ""));
      const message = fields.qr_message ?? (same?.kind === "whatsapp" ? same.message : undefined);
      return { ok: true, value: { kind: "whatsapp", phone, ...(message ? { message } : {}) } };
    }
    case "url":
      return { ok: true, value: { kind: "url", url: (fields.qr_url ?? (same?.kind === "url" ? same.url : "")).trim() } };
    case "text":
      return { ok: true, value: { kind: "text", text: fields.qr_text ?? (same?.kind === "text" ? same.text : "") } };
  }
}

function linkProblem(link: QrLink): string {
  switch (link.kind) {
    case "shortLink":
      return "o link curto informado não é válido";
    case "whatsapp":
      return "qr_phone precisa do número completo com código do país e DDD, de 8 a 15 dígitos, como 5511999998888";
    case "url":
      return `qr_url precisa começar com https:// ou http://, sem espaços, até ${QR_LIMITS.urlBytes} bytes`;
    case "text":
      return "qr_text precisa de algum texto, sem caracteres de controle";
  }
}

function logoOf(fields: AgentQrFields, spec: QrSpec, ctx: QrOpContext): Built<QrSpec> {
  if (fields.qr_remove_logo) return { ok: true, value: withLogo(spec, null) };
  if (fields.logo_media_id === undefined && fields.logo_scale === undefined) return { ok: true, value: spec };
  const assetId = fields.logo_media_id ?? spec.logo?.assetId;
  if (!assetId) return refuse("logo_scale precisa de um logo: mande logo_media_id com uma imagem da biblioteca");
  const natural = fields.logo_media_id !== undefined ? ctx.naturalSize(assetId) : undefined;
  if (fields.logo_media_id !== undefined && !natural) return refuse(`a imagem ${assetId} não está na biblioteca`);
  const aspect = natural ? natural.width / natural.height : (spec.logo?.aspect ?? 1);
  if (aspect < QR_LIMITS.logoAspect[0] || aspect > QR_LIMITS.logoAspect[1]) return refuse("o logo é estreito demais para ficar no centro do QR Code; use uma imagem mais próxima de um quadrado");
  const scale = fields.logo_scale ?? spec.logo?.scale ?? QR_DEFAULTS.logoScale;
  if (fields.qr_ecc !== undefined && scale > logoMax(spec.ecc)) return refuse(`com qr_ecc ${spec.ecc} o logo vai até ${short(logoMax(spec.ecc))} do lado do código; use qr_ecc H para um logo de até ${short(logoMax("H"))}`);
  if (scale < QR_LIMITS.logoScale || scale > logoMax("H")) return refuse(`logo_scale vai de ${short(QR_LIMITS.logoScale)} a ${short(logoMax("H"))} do lado do código`);
  return { ok: true, value: withLogo(spec, { assetId, scale, aspect }) };
}

function problemText(spec: QrSpec): string {
  switch (qrScanProblem(spec)) {
    case "inverted":
      return "qr_dark precisa ser mais escura que qr_light; leitores comuns não leem o código invertido";
    case "contrast":
      return `o contraste entre qr_dark e qr_light é ${short(qrContrast(spec.dark, spec.light) ?? 0)} e precisa ser de pelo menos ${QR_LIMITS.minContrast}; escureça qr_dark ou clareie qr_light`;
    case "tooLong":
      return `o conteúdo tem ${qrBytes(qrContent(spec.link)).length} bytes e o nível ${spec.ecc} guarda até ${QR_BYTE_CAPACITY[spec.ecc]}; encurte o texto, use um link curto ou um nível menor (L guarda mais)`;
    case "quietZone":
      return `qr_quiet_zone vai de ${QR_LIMITS.quietZone[0]} a ${QR_LIMITS.quietZone[1]} módulos`;
    case "logoEcc":
      return "o nível L não aguenta logo; use qr_ecc M, Q ou H";
    case "logoSize":
      return `com qr_ecc ${spec.ecc} o logo vai até ${short(logoMax(spec.ecc))} do lado do código`;
    default:
      return "o QR Code ficaria inválido; confira cores, nível e logo";
  }
}

export function qrSpecFrom(fields: AgentQrFields, current: QrSpec | null, ctx: QrOpContext): Built<QrSpec> {
  if (fields.qr_ecc !== undefined && !isQrEcc(fields.qr_ecc)) return refuse(`qr_ecc precisa ser um de: ${QR_ECC_LEVELS.join(", ")}`);
  if (fields.qr_quiet_zone !== undefined && !Number.isInteger(fields.qr_quiet_zone)) return refuse("qr_quiet_zone é um número inteiro de módulos");
  const link = linkOf(fields, current?.link ?? null, ctx);
  if (!link.ok) return link;
  const base = current ? { ...current, link: link.value } : newQrSpec(link.value);
  const leveled = fields.qr_ecc !== undefined && isQrEcc(fields.qr_ecc) ? withEcc(base, fields.qr_ecc) : base;
  const painted: QrSpec = {
    ...leveled,
    ...(fields.qr_dark !== undefined ? { dark: fields.qr_dark.toLowerCase() } : {}),
    ...(fields.qr_light !== undefined ? { light: fields.qr_light.toLowerCase() } : {}),
    ...(fields.qr_quiet_zone !== undefined ? { quietZone: fields.qr_quiet_zone } : {}),
  };
  const logoed = logoOf(fields, painted, ctx);
  if (!logoed.ok) return logoed;
  return qrIssue(logoed.value) ? refuse(problemText(logoed.value)) : logoed;
}

export function qrChangeRequested(fields: AgentQrFields): boolean {
  return [...LINK_FIELDS, "qr_ecc", "qr_quiet_zone", "qr_dark", "qr_light", "logo_media_id", "logo_scale", "qr_remove_logo"].some((key) => fields[key as keyof AgentQrFields] !== undefined);
}

export interface OutlineQr {
  link: { kind: AgentQrLink; url?: string; short_link_id?: string; phone?: string; message?: string; text?: string };
  content: string;
  ecc: string;
  quiet_zone: number;
  dark: string;
  light: string;
  logo?: { media_id: string; scale: number };
  version?: number;
  modules?: number;
}

function outlineLink(link: QrLink): OutlineQr["link"] {
  switch (link.kind) {
    case "shortLink":
      return { kind: "short_link", short_link_id: link.shortLinkId, url: link.url };
    case "whatsapp":
      return { kind: "whatsapp", phone: link.phone, ...(link.message ? { message: link.message } : {}) };
    case "url":
      return { kind: "url", url: link.url };
    case "text":
      return { kind: "text", text: link.text };
  }
}

export function qrOutline(spec: QrSpec): OutlineQr {
  const symbol = qrSymbol(spec);
  return {
    link: outlineLink(spec.link),
    content: qrContent(spec.link),
    ecc: spec.ecc,
    quiet_zone: spec.quietZone,
    dark: spec.dark,
    light: spec.light,
    ...(spec.logo ? { logo: { media_id: spec.logo.assetId, scale: spec.logo.scale } } : {}),
    ...(symbol ? { version: symbol.version, modules: symbol.size } : {}),
  };
}

export const SHORT_LINKS_ARG = "short_links";

export function shortLinksOf(args: unknown): ReadonlyMap<string, string> {
  const raw = args && typeof args === "object" ? (args as Record<string, unknown>)[SHORT_LINKS_ARG] : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
  return new Map(Object.entries(raw as Record<string, unknown>).flatMap(([id, url]) => (typeof url === "string" ? [[id, url] as const] : [])));
}

export function logoMediaIds(operations: readonly AgentQrFields[]): string[] {
  return operations.flatMap((op) => (op.logo_media_id ? [op.logo_media_id] : []));
}
