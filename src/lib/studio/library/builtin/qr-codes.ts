import { newQrLayer, qrTransform } from "../../generated-edits";
import { newQrSpec, type QrSpec } from "../../qr";
import { encodeQr } from "../../qr-encoder";
import { modulePath } from "../../qr-parts";
import { LIBRARY_LOCALES, OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibraryLocale } from "../model";
import { previewSvg } from "../preview";

interface QrLook {
  id: string;
  label: string;
  dark: string;
  light: string;
}

const VIEW = 40;
const PREVIEW_SIDE = 30;
const PREVIEW_CONTENT = "https://vozko.com";

const LOOKS: readonly QrLook[] = [
  { id: "qr-code", label: "qrCode", dark: "#111111", light: "#ffffff" },
  { id: "qr-code-navy", label: "qrCodeNavy", dark: "#1e3a8a", light: "#eff6ff" },
  { id: "qr-code-forest", label: "qrCodeForest", dark: "#14532d", light: "#f0fdf4" },
];

const SAMPLE_TEXT: Record<LibraryLocale, string> = { pt: "Seu link aqui", en: "Your link here", es: "Tu enlace aquí", de: "Dein Link hier" };

const TAGS: Record<LibraryLocale, readonly string[]> = {
  pt: ["qr code", "qr", "código", "link", "whatsapp", "escanear"],
  en: ["qr code", "qr", "code", "link", "whatsapp", "scan"],
  es: ["código qr", "qr", "código", "enlace", "whatsapp", "escanear"],
  de: ["qr code", "qr", "code", "link", "whatsapp", "scannen"],
};

function libraryLocale(locale: string): LibraryLocale {
  const short = locale.split("-")[0];
  return (LIBRARY_LOCALES as readonly string[]).includes(short) ? (short as LibraryLocale) : "pt";
}

export function sampleQr(look: Pick<QrLook, "dark" | "light">, locale: string): QrSpec {
  return newQrSpec({ kind: "text", text: SAMPLE_TEXT[libraryLocale(locale)] }, { dark: look.dark, light: look.light });
}

function previewMarkup(look: QrLook): string {
  const symbol = encodeQr(PREVIEW_CONTENT, "M");
  const offset = (VIEW - PREVIEW_SIDE) / 2;
  const path = symbol ? modulePath(symbol) : "";
  return previewSvg(`<rect x="${offset - 2}" y="${offset - 2}" width="${PREVIEW_SIDE + 4}" height="${PREVIEW_SIDE + 4}" rx="2" fill="${look.light}"/><g transform="translate(${offset} ${offset}) scale(${PREVIEW_SIDE})"><path d="${path}" fill="${look.dark}"/></g>`, VIEW);
}

function qrItem(look: QrLook): LibraryItem {
  return {
    id: look.id,
    category: "qrCodes",
    editors: ["image", "video"],
    ratio: 1,
    label: { key: `studio.library.items.${look.label}` },
    tags: TAGS,
    preview: { kind: "svg", markup: previewMarkup(look) },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => ({ layers: [newQrLayer(sampleQr(look, ctx.locale), qrTransform(ctx.canvas))] }) },
  };
}

const QR_ITEMS: readonly LibraryItem[] = LOOKS.map(qrItem);

export const QR_CODES_CATEGORY: LibraryCategory = {
  id: "qrCodes",
  panel: "elements",
  label: { key: "studio.library.categories.qrCodes" },
  notes: { image: { key: "studio.library.notes.qrCodes" }, video: { key: "studio.library.notes.qrCodes" } },
  tile: "square",
  items: () => QR_ITEMS,
};
