import { describe, expect, it } from "vitest";

import { emptyVideoDocument, imageDocument, type ImageDocument, type VideoDocument } from "../document";
import { qrContent } from "../qr";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline, outlineClip } from "./outline";
import { shortLinksOf } from "./qr-ops";
import { imageQrChecks, videoDesignChecks } from "./design-check";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const LINK_ID = "3f2c8a1e-9b4d-4c2a-8e1f-5a6b7c8d9e0f";
const LINKS = new Map([[LINK_ID, "https://vzk.to/aB3dE9"]]);
const SIZES = new Map([["media-logo", { width: 800, height: 400 }]]);

const IMAGE_CTX: ImageOpContext = { naturalSize: (id) => SIZES.get(id), icons: [], activeArtboard: "a1", shortLinkUrl: (id) => LINKS.get(id) };

const VIDEO_CTX: VideoOpContext = {
  playheadMs: 500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  naturalSize: (id) => SIZES.get(id),
  shortLinkUrl: (id) => LINKS.get(id),
};

const PRICES = { table_rows: [["Plano", "Preço"], ["Básico", "R$ 49"], ["Pro", "R$ 99"]] };

function artboard(): ImageDocument {
  return imageDocument([{ id: "a1", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [] }]);
}

function image(ops: ImageOperation[], start: ImageDocument = artboard(), ctx: ImageOpContext = IMAGE_CTX) {
  return planBatch(start, ops, (doc, op) => applyImageOperation(doc, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function video(ops: VideoOperation[], start: VideoDocument = emptyVideoDocument("landscape")) {
  return planBatch(start, ops, (doc, op) => applyVideoOperation(doc, op, VIDEO_CTX), VIDEO_ID_FIELDS, videoIds);
}

function failure(plan: ReturnType<typeof image> | ReturnType<typeof video>): string {
  return plan.ok ? "" : plan.reason;
}

describe("table operations", () => {
  it("adds a table with columns and style, then edits one cell and styles part of it", () => {
    const plan = image([
      { op: "add_table", ref: "precos", ...PRICES, table_columns: [{ width: 2 }, { align: "right" }], table_style: { borders: "all", header_weight: 800 }, name: "Planos", x: 0.5, y: 0.3, w: 0.8 },
      { op: "update_table", layer_id: "@precos", table_row: 2, table_column: 1, text: "R$ 89" },
      { op: "style_text", layer_id: "@precos", table_row: 1, table_column: 0, match: "Bás", fill: "#ff0000", font_weight: 700 },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const layer = plan.final.artboards[0].layers[0];
    expect(layer).toMatchObject({ type: "table", name: "Planos" });
    expect(layer.transform).toMatchObject({ x: 0.5, y: 0.3, w: 0.8 });
    expect(layer.table!.columns).toEqual([{ width: 2, align: "left" }, { width: 1, align: "right" }]);
    expect(layer.table!.style).toMatchObject({ borders: "all", headerWeight: 800, textColor: "#111111" });
    expect(layer.table!.rows[2][1]).toEqual({ text: "R$ 89" });
    expect(layer.table!.rows[1][0]).toEqual({ text: "Básico", runs: [{ start: 0, end: 3, fill: "#ff0000", fontWeight: 700 }] });
    expect(plan.created.precos).toEqual([layer.id]);
    expect(documentIssue("image", plan.final)).toBeNull();
  });

  it("keeps cell styles when all rows are replaced and the cell text stays", () => {
    const plan = image([
      { op: "add_table", ref: "t", ...PRICES },
      { op: "style_text", layer_id: "@t", table_row: 1, table_column: 0, italic: true },
      { op: "update_table", layer_id: "@t", table_rows: [["Plano", "Preço"], ["Básico", "R$ 59"], ["Pro", "R$ 99"], ["Empresa", "R$ 199"]] },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const table = plan.final.artboards[0].layers[0].table!;
    expect(table.rows).toHaveLength(4);
    expect(table.rows[1][0].runs).toEqual([{ start: 0, end: 6, italic: true }]);
  });

  it("refuses wrong cells, a font size on one cell and an empty add", () => {
    expect(failure(image([{ op: "add_table" }]))).toContain("table_rows");
    expect(failure(image([{ op: "add_table", ref: "t", ...PRICES }, { op: "update_table", layer_id: "@t", table_row: 5, table_column: 0, text: "x" }]))).toContain("fora dela");
    expect(failure(image([{ op: "add_table", ref: "t", ...PRICES }, { op: "style_text", layer_id: "@t", table_row: 0, table_column: 0, font_size: 0.1 }]))).toContain("table_style.font_size");
    expect(failure(image([{ op: "add_table", ref: "t", ...PRICES }, { op: "update_table", layer_id: "@t", table_columns: [{}, {}, {}] }]))).toContain("table_columns");
    expect(failure(image([{ op: "add_table", ref: "t", ...PRICES }, { op: "update_table", layer_id: "@t" }]))).toContain("update_table precisa");
    expect(failure(image([{ op: "add_table", ref: "t", ...PRICES, table_style: { font_size: 0.9 } }]))).toContain("inválida");
  });

  it("shows the table in the outline in the shape the operations take", () => {
    const plan = image([{ op: "add_table", ref: "t", ...PRICES }, { op: "style_text", layer_id: "@t", table_row: 1, table_column: 0, caps: true }]);
    if (!plan.ok) throw new Error(plan.reason);
    const outline = imageOutline(plan.final, { detail: "full", icons: [], asset: () => undefined, playheadMs: 0, selection: [], activeArtboard: "a1", jobs: [] });
    const table = JSON.stringify(outline);
    expect(table).toContain('"rows":[["Plano","Preço"],["Básico","R$ 49"],["Pro","R$ 99"]]');
    expect(table).toContain('"styled_cells":[{"row":1,"column":0,"runs":[{"start":0,"end":6,"text":"Básico","caps":true}]}]');
  });

  it("adds and updates a table overlay in the video editor", () => {
    const plan = video([{ op: "add_table", ref: "t", ...PRICES, at_ms: 0, duration_ms: 3000 }, { op: "update_table", clip_id: "@t", table_header: false }]);
    if (!plan.ok) throw new Error(plan.reason);
    const clip = findClip(plan.final, plan.created.t[0])!.clip;
    expect(clip.layer).toMatchObject({ type: "table", table: { header: false, style: { textColor: "#ffffff" } } });
    expect(documentIssue("video", plan.final)).toBeNull();
    expect(JSON.stringify(outlineClip(clip, { detail: "full", icons: [], asset: () => undefined, playheadMs: 0, selection: [], activeArtboard: "", jobs: [] }))).toContain('"header":false');
  });
});

describe("qr code operations", () => {
  it("adds a code on the short link the server resolved, with a logo that raises the level", () => {
    const plan = image([{ op: "add_qr_code", ref: "qr", qr_link: "short_link", short_link_id: LINK_ID, logo_media_id: "media-logo", logo_scale: 0.26, x: 0.8, y: 0.8, w: 0.25 }]);
    if (!plan.ok) throw new Error(plan.reason);
    const layer = plan.final.artboards[0].layers[0];
    expect(layer.qr).toMatchObject({ link: { kind: "shortLink", shortLinkId: LINK_ID, url: "https://vzk.to/aB3dE9" }, ecc: "H", logo: { assetId: "media-logo", scale: 0.26, aspect: 2 } });
    expect(documentIssue("image", plan.final)).toBeNull();
  });

  it("builds WhatsApp, direct and text codes and keeps the link when only colors change", () => {
    const plan = image([
      { op: "add_qr_code", ref: "wa", qr_link: "whatsapp", qr_phone: "+55 (11) 99999-8888", qr_message: "Olá!" },
      { op: "update_qr_code", layer_id: "@wa", qr_dark: "#1E3A8A", qr_quiet_zone: 2 },
      { op: "add_qr_code", ref: "site", qr_link: "url", qr_url: "https://vozko.com" },
      { op: "add_qr_code", ref: "wifi", qr_link: "text", qr_text: "WIFI:T:WPA;S:Loja;;", qr_ecc: "L" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const [wa, site, wifi] = plan.final.artboards[0].layers;
    expect(qrContent(wa.qr!.link)).toBe("https://wa.me/5511999998888?text=Ol%C3%A1!");
    expect(wa.qr).toMatchObject({ dark: "#1e3a8a", quietZone: 2 });
    expect(site.qr!.link).toEqual({ kind: "url", url: "https://vozko.com" });
    expect(wifi.qr).toMatchObject({ ecc: "L", link: { kind: "text" } });
  });

  it("treats a destination without a link kind as a short link, which needs the server", () => {
    const resolved = image([{ op: "add_qr_code", qr_url: "https://loja.com", short_link_id: LINK_ID }]);
    expect(resolved.ok).toBe(true);
    expect(failure(image([{ op: "add_qr_code", qr_url: "https://loja.com" }], artboard(), { ...IMAGE_CTX, shortLinkUrl: undefined }))).toContain("link curto não está pronto");
    expect(failure(image([{ op: "add_qr_code", short_link_id: "9d0c8a1e-9b4d-4c2a-8e1f-5a6b7c8d9e09" }]))).toContain("link curto não está pronto");
  });

  it("refuses unreadable colors, a logo too big for the level and a bad phone with the reason", () => {
    const base = { op: "add_qr_code" as const, qr_link: "url", qr_url: "https://vozko.com" };
    expect(failure(image([{ ...base, qr_dark: "#f97316" }]))).toContain("contraste");
    expect(failure(image([{ ...base, qr_dark: "#ffffff", qr_light: "#000000" }]))).toContain("mais escura");
    expect(failure(image([{ ...base, qr_ecc: "M", logo_media_id: "media-logo", logo_scale: 0.25 }]))).toContain("qr_ecc H");
    expect(failure(image([{ ...base, logo_media_id: "unknown" }]))).toContain("não está na biblioteca");
    expect(failure(image([{ op: "add_qr_code", qr_link: "whatsapp", qr_phone: "123" }]))).toContain("qr_phone");
    expect(failure(image([{ ...base, qr_url: "vozko.com" }]))).toContain("https://");
  });

  it("removes the logo and keeps the level, and the outline shows the encoded content", () => {
    const plan = image([
      { op: "add_qr_code", ref: "qr", qr_link: "url", qr_url: "https://vozko.com", logo_media_id: "media-logo" },
      { op: "update_qr_code", layer_id: "@qr", qr_remove_logo: true },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const layer = plan.final.artboards[0].layers[0];
    expect(layer.qr!.logo).toBeUndefined();
    expect(layer.qr!.ecc).toBe("H");
    const outline = JSON.stringify(imageOutline(plan.final, { detail: "full", icons: [], asset: () => undefined, playheadMs: 0, selection: [], activeArtboard: "a1", jobs: [] }));
    expect(outline).toContain('"content":"https://vozko.com"');
    expect(outline).toContain('"version":');
  });

  it("adds a code overlay in the video editor", () => {
    const plan = video([{ op: "add_qr_code", ref: "qr", short_link_id: LINK_ID, at_ms: 0 }]);
    if (!plan.ok) throw new Error(plan.reason);
    const clip = findClip(plan.final, plan.created.qr[0])!.clip;
    expect(clip.layer?.qr?.link).toEqual({ kind: "shortLink", shortLinkId: LINK_ID, url: "https://vzk.to/aB3dE9" });
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("reads the short links the server sent with the batch", () => {
    expect(shortLinksOf({ operations: [], short_links: { [LINK_ID]: "https://vzk.to/aB3dE9", bad: 3 } })).toEqual(new Map([[LINK_ID, "https://vzk.to/aB3dE9"]]));
    expect(shortLinksOf({ operations: [] }).size).toBe(0);
    expect(shortLinksOf(null).size).toBe(0);
  });
});

describe("qr code design check", () => {
  it("warns when a module is smaller than three export pixels, in both editors", () => {
    const tiny = image([{ op: "add_qr_code", qr_link: "url", qr_url: "https://vozko.com", w: 0.04 }]);
    const large = image([{ op: "add_qr_code", qr_link: "url", qr_url: "https://vozko.com", w: 0.4 }]);
    if (!tiny.ok || !large.ok) throw new Error("plan failed");
    expect(imageQrChecks(tiny.final.artboards[0]).join(" ")).toMatch(/aviso: o QR Code .* px por módulo/);
    expect(imageQrChecks(large.final.artboards[0])).toEqual([]);
    const film = video([{ op: "add_qr_code", short_link_id: LINK_ID, at_ms: 0, w: 0.03 }]);
    if (!film.ok) throw new Error(film.reason);
    expect(videoDesignChecks(film.final).join(" ")).toContain("px por módulo");
  });
});
