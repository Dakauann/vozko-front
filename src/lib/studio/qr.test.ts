import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import type { CanvasSize, Layer } from "./document";
import { encodeQr, QR_BYTE_CAPACITY } from "./qr-encoder";
import { modulePath, qrPartLayers, QR_PART_IDS } from "./qr-parts";
import { logoFits, logoPlate, modulePixels, newQrSpec, qrColorProblem, qrContent, qrIssue, qrLayerIssue, qrLinkIssue, qrScanProblem, qrSymbol, QR_LOGO_MAX, whatsappUrl, withEcc, withLogo, type QrLink, type QrSpec } from "./qr";

const SIDE = 600;
const LINK_ID = "3f2c8a1e-9b4d-4c2a-8e1f-5a6b7c8d9e0f";
const SHORT: QrLink = { kind: "shortLink", shortLinkId: LINK_ID, url: "https://vzk.to/aB3dE9" };

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rectsOf(path: string): [number, number, number, number][] {
  return [...path.matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)H[\d.]+Z/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
}

function paint(data: Uint8ClampedArray, size: CanvasSize, left: number, top: number, right: number, bottom: number, color: (x: number, y: number) => [number, number, number]): void {
  for (let y = Math.max(0, Math.round(top)); y < Math.min(size.height, Math.round(bottom)); y++) {
    for (let x = Math.max(0, Math.round(left)); x < Math.min(size.width, Math.round(right)); x++) {
      const [r, g, b] = color(x, y);
      const at = (y * size.width + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
    }
  }
}

function render(parts: readonly Layer[], size: CanvasSize, logoInk: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size.width * size.height * 4).fill(255);
  for (const part of parts) {
    const t = part.transform;
    const left = (t.x - t.w / 2) * size.width;
    const top = (t.y - t.h / 2) * size.height;
    const width = t.w * size.width;
    const height = t.h * size.height;
    if (part.shape === "rect") paint(data, size, left, top, left + width, top + height, () => hex(part.fill ?? "#ffffff"));
    if (part.shape === "path") for (const [x0, y0, x1, y1] of rectsOf(part.path ?? "")) paint(data, size, left + x0 * width, top + y0 * height, left + x1 * width, top + y1 * height, () => hex(part.fill ?? "#000000"));
    if (part.type === "image") paint(data, size, left, top, left + width, top + height, logoInk);
  }
  return data;
}

function decodedParts(spec: QrSpec, size: CanvasSize = { width: SIDE, height: SIDE }): string | null {
  const noise = (x: number, y: number): [number, number, number] => (((x * 7919 + y * 104729) >> 3) % 2 === 0 ? [0, 0, 0] : [255, 255, 255]);
  return jsQR(render(qrPartLayers(spec, size), size, noise), size.width, size.height)?.data ?? null;
}

function longText(bytes: number): string {
  return "Oi! Quero saber mais sobre a oferta de verão. ".repeat(Math.ceil(bytes / 40)).slice(0, bytes);
}

describe("qr content", () => {
  it("builds each link kind into the encoded text", () => {
    expect(qrContent(SHORT)).toBe("https://vzk.to/aB3dE9");
    expect(qrContent({ kind: "url", url: "https://vozko.com/ofertas" })).toBe("https://vozko.com/ofertas");
    expect(qrContent({ kind: "whatsapp", phone: "5511999998888" })).toBe("https://wa.me/5511999998888");
    expect(qrContent({ kind: "whatsapp", phone: "5511999998888", message: "Olá, quero 50% & mais" })).toBe("https://wa.me/5511999998888?text=Ol%C3%A1%2C%20quero%2050%25%20%26%20mais");
    expect(qrContent({ kind: "text", text: "Wi-Fi: Loja" })).toBe("Wi-Fi: Loja");
    expect(whatsappUrl("5511999998888", "")).toBe("https://wa.me/5511999998888");
  });

  it("checks every link kind strictly", () => {
    expect(qrLinkIssue(SHORT)).toBeNull();
    expect(qrLinkIssue({ ...SHORT, shortLinkId: "not-a-link" })).toBe("invalid");
    expect(qrLinkIssue({ kind: "url", url: "ftp://vozko.com" })).toBe("invalid");
    expect(qrLinkIssue({ kind: "url", url: "https://vozko.com/a b" })).toBe("invalid");
    expect(qrLinkIssue({ kind: "url", url: `https://vozko.com/${"a".repeat(2048)}` })).toBe("invalid");
    expect(qrLinkIssue({ kind: "whatsapp", phone: "+55 11 99999-8888" })).toBe("invalid");
    expect(qrLinkIssue({ kind: "whatsapp", phone: "5511999998888", message: "linha 1\nlinha 2" })).toBeNull();
    expect(qrLinkIssue({ kind: "text", text: "   " })).toBe("required");
    expect(qrLinkIssue({ kind: "text", text: "a\u0007b" })).toBe("invalid");
    expect(qrLinkIssue({ kind: "url", url: "https://vozko.com", phone: "5511999998888" } as unknown as QrLink)).toBe("invalid");
    expect(qrLinkIssue({ kind: "sms", url: "x" } as unknown as QrLink)).toBe("unknown");
  });
});

describe("qr validation", () => {
  const base = newQrSpec(SHORT);

  it("accepts the default spec and a full layer", () => {
    expect(qrIssue(base)).toBeNull();
    expect(qrLayerIssue({ id: "l-qr", type: "qr", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }, qr: base })).toBeNull();
    expect(qrLayerIssue({ id: "l-qr", type: "qr", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }, qr: base, fill: "#ff0000" })).toBe("invalid");
  });

  it("refuses colors a scanner cannot read", () => {
    expect(qrColorProblem("#ffffff", "#111111")).toBe("inverted");
    expect(qrColorProblem("#f97316", "#ffffff")).toBe("contrast");
    expect(qrColorProblem("#1e40af", "#ffffff")).toBeNull();
    expect(qrIssue({ ...base, dark: "#f97316" })).toBe("invalid");
    expect(qrIssue({ ...base, dark: "#ffffff", light: "#000000" })).toBe("invalid");
    expect(qrIssue({ ...base, light: "#ffffff00" })).toBe("invalid");
    expect(qrScanProblem({ ...base, dark: "#f97316" })).toBe("contrast");
  });

  it("refuses a quiet zone below two modules and content past the level capacity", () => {
    expect(qrIssue({ ...base, quietZone: 1 })).toBe("out_of_range");
    expect(qrIssue({ ...base, quietZone: 2.5 })).toBe("invalid");
    const text: QrLink = { kind: "text", text: longText(QR_BYTE_CAPACITY.H + 1) };
    expect(qrIssue({ ...newQrSpec(text), ecc: "H" })).toBe("too_large");
    expect(qrIssue({ ...newQrSpec(text), ecc: "L" })).toBeNull();
    expect(qrScanProblem({ ...newQrSpec(text), ecc: "H" })).toBe("tooLong");
  });

  it("limits the logo by the error correction level", () => {
    const logo = { assetId: "media-logo", scale: 0.25, aspect: 1 };
    expect(qrIssue({ ...base, ecc: "L", logo: { ...logo, scale: 0.1 } })).toBe("out_of_range");
    expect(qrScanProblem({ ...base, ecc: "L", logo: { ...logo, scale: 0.1 } })).toBe("logoEcc");
    expect(qrIssue({ ...base, ecc: "M", logo })).toBe("out_of_range");
    expect(qrScanProblem({ ...base, ecc: "M", logo })).toBe("logoSize");
    expect(qrIssue({ ...base, ecc: "Q", logo })).toBeNull();
    expect(qrIssue({ ...base, ecc: "H", logo: { ...logo, scale: 0.05 } })).toBe("out_of_range");
    expect(qrIssue({ ...base, ecc: "H", logo: { ...logo, aspect: 20 } })).toBe("out_of_range");
    expect(qrIssue({ ...base, ecc: "H", logo: { ...logo, assetId: "Bad Id" } })).toBe("invalid");
  });

  it("raises the level when a logo needs it and clamps the logo when the level drops", () => {
    const logo = { assetId: "media-logo", scale: 0.28, aspect: 1 };
    expect(withLogo(base, logo).ecc).toBe("H");
    expect(withLogo({ ...base, ecc: "Q" }, { ...logo, scale: 0.2 }).ecc).toBe("Q");
    expect(withLogo(withLogo(base, logo), null).logo).toBeUndefined();
    expect(withEcc(withLogo(base, logo), "M").logo?.scale).toBe(QR_LOGO_MAX.M);
    expect(qrIssue(withEcc(withLogo(base, logo), "L"))).toBe("out_of_range");
  });
});

describe("qr parts", () => {
  it("draws a light square, one module path and nothing else without a logo", () => {
    const parts = qrPartLayers(newQrSpec(SHORT), { width: 400, height: 400 });
    expect(parts.map((part) => part.id)).toEqual([QR_PART_IDS.background, QR_PART_IDS.modules]);
    expect(parts[1].fill).toBe("#111111");
    expect(parts[0].transform).toMatchObject({ x: 0.5, y: 0.5, w: 1, h: 1 });
  });

  it("keeps the code square and centered in a wide box", () => {
    const [background] = qrPartLayers(newQrSpec(SHORT), { width: 800, height: 400 });
    expect(background.transform).toMatchObject({ x: 0.5, y: 0.5, w: 0.5, h: 1 });
  });

  it("writes one rectangle per run of dark modules", () => {
    const symbol = encodeQr("https://vzk.to/aB3dE9", "M")!;
    const rects = rectsOf(modulePath(symbol));
    const dark = symbol.modules.reduce((sum, value) => sum + value, 0);
    expect(rects.reduce((sum, [x0, , x1]) => sum + Math.round((x1 - x0) * symbol.size), 0)).toBe(dark);
  });

  it("decodes back to the link from the rendered parts", () => {
    for (const link of [SHORT, { kind: "whatsapp", phone: "5511999998888", message: "Olá! Vi o anúncio" } as QrLink, { kind: "url", url: "https://vozko.com/ofertas?utm_source=qr" } as QrLink]) {
      const spec = newQrSpec(link);
      expect(decodedParts(spec)).toBe(qrContent(link));
    }
  });

  it.each(["M", "Q", "H"] as const)("decodes with the largest logo level %s allows, the logo drawn as noise", (ecc) => {
    for (const bytes of [12, 60, 180]) {
      const spec: QrSpec = { ...newQrSpec({ kind: "text", text: longText(bytes) }), ecc, logo: { assetId: "media-logo", scale: QR_LOGO_MAX[ecc], aspect: 1.6 } };
      const symbol = qrSymbol(spec)!;
      expect(logoFits(symbol, spec.logo!)).toBe(true);
      expect(logoPlate(symbol.size, spec.logo!).start).toBeGreaterThanOrEqual(9);
      expect(decodedParts(spec, { width: 900, height: 900 })).toBe(qrContent(spec.link));
    }
  });

  it("grows the version so the logo hides fewer codewords than the level corrects", () => {
    const plain = qrSymbol(newQrSpec(SHORT))!;
    const logoed = qrSymbol({ ...newQrSpec(SHORT), ecc: "M", logo: { assetId: "media-logo", scale: QR_LOGO_MAX.M, aspect: 1 } })!;
    expect(logoed.version).toBeGreaterThan(plain.version);
    expect(qrPartLayers({ ...newQrSpec(SHORT), ecc: "H", logo: { assetId: "media-logo", scale: 0.2, aspect: 2 } }, { width: 300, height: 300 }).map((part) => part.id)).toEqual([QR_PART_IDS.background, QR_PART_IDS.modules, QR_PART_IDS.logo]);
  });

  it("reports the export pixels per module", () => {
    const spec = newQrSpec(SHORT);
    const symbol = qrSymbol(spec)!;
    expect(modulePixels(spec, 290)).toBeCloseTo(290 / (symbol.size + 8));
  });
});
