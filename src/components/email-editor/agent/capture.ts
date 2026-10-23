"use client";

import { focusBox, LOOK_WIDTHS, sliceSheet, type Box, type LookDevice, type LookRequest, type MarkLegend } from "@/lib/email-design/agent/look";
import { DARK_CLIENT_BACKGROUND, withDarkBackdrop } from "@/lib/email-design/look";
import { canvasOf, encodeWithin } from "@/lib/vision/encode";

const LOAD_TIMEOUT_MS = 8000;
const FOCUS_SCALE = 2;
const SHEET_FILL = "#1f2937";
const MARK_FILL = "#ffd400";
const MARK_INK = "#000000";
const LABEL_FILL = "rgba(0, 0, 0, 0.72)";
const LABEL_INK = "#ffffff";
const MIN_MARK_RADIUS = 9;
const MARK_SHARE = 0.025;
const DEVICE_NAMES: Record<LookDevice, string> = { desktop: "computador", mobile: "celular" };
const PLACEHOLDER_FILL = "#d4d4d8";
const PLACEHOLDER_INK = "#71717a";

export interface LookSlice {
  device: LookDevice;
  index: number;
  of: number;
  from_px: number;
  to_px: number;
}

export interface LookData {
  marks?: MarkLegend[];
  slices: LookSlice[];
  heights: Partial<Record<LookDevice, number>>;
  focus_id?: string;
}

export interface LookCapture {
  image: string;
  data: LookData;
}

interface LaidPage {
  device: LookDevice;
  width: number;
  height: number;
  blocks: Map<string, Box>;
  canvas: HTMLCanvasElement;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("a prévia demorou demais para carregar")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function placeholder(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${PLACEHOLDER_FILL}"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="${PLACEHOLDER_INK}" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function frameFor(width: number): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", left: "-20000px", top: "0", width: `${width}px`, height: "200px", border: "0", opacity: "0", pointerEvents: "none" });
  return frame;
}

async function loaded(frame: HTMLIFrameElement, html: string): Promise<Document> {
  const ready = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await withTimeout(ready, LOAD_TIMEOUT_MS);
  const page = frame.contentDocument;
  if (!page) throw new Error("a prévia não abriu nesta aba");
  const images = Array.from(page.images);
  await withTimeout(Promise.all(images.map((image) => image.decode().catch(() => undefined))), LOAD_TIMEOUT_MS).catch(() => undefined);
  return page;
}

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function markExternalImages(page: Document): void {
  for (const image of Array.from(page.images)) {
    if (image.src.startsWith("data:")) continue;
    const box = boxOf(image);
    image.src = placeholder(box.width, box.height || box.width / 2);
    image.style.height = `${Math.max(1, Math.round(box.height || box.width / 2))}px`;
  }
}

function darken(page: Document): void {
  const outer = page.body.querySelector(":scope > table");
  if (!outer) return;
  outer.setAttribute("bgcolor", DARK_CLIENT_BACKGROUND);
  (outer as HTMLElement).style.backgroundColor = DARK_CLIENT_BACKGROUND;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function pageSvg(page: Document, width: number, height: number, dark: boolean): string {
  const serializer = new XMLSerializer();
  const styles = Array.from(page.querySelectorAll("style"))
    .map((style) => serializer.serializeToString(style))
    .join("");
  const inner = Array.from(page.body.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join("");
  const background = dark ? `background-color:${DARK_CLIENT_BACKGROUND};` : "";
  const style = `${page.body.getAttribute("style") ?? ""};${background}width:${width}px;min-height:${height}px;margin:0;`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${escapeAttribute(style)}">${styles}${inner}</div></foreignObject></svg>`;
}

async function rasterize(svg: string, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await withTimeout(image.decode(), LOAD_TIMEOUT_MS);
  const canvas = canvasOf(width * scale, height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawMarks(canvas: HTMLCanvasElement, legend: readonly MarkLegend[], blocks: ReadonlyMap<string, Box>, scale: number): void {
  const context = canvas.getContext("2d")!;
  const radius = Math.max(MIN_MARK_RADIUS, Math.round(Math.min(canvas.width, canvas.height) * MARK_SHARE));
  for (const mark of legend) {
    const box = blocks.get(mark.id);
    if (!box) continue;
    const left = box.left * scale;
    const top = box.top * scale;
    context.save();
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    context.strokeStyle = MARK_FILL;
    context.strokeRect(left, top, box.width * scale, box.height * scale);
    context.setLineDash([]);
    context.fillStyle = MARK_FILL;
    context.beginPath();
    context.arc(left + radius, top + radius, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = MARK_INK;
    context.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(mark.n), left + radius, top + radius);
    context.restore();
  }
}

async function layPage(request: LookRequest, device: LookDevice, legend: readonly MarkLegend[]): Promise<LaidPage> {
  const width = LOOK_WIDTHS[device];
  const frame = frameFor(width);
  try {
    const page = await loaded(frame, request.dark ? withDarkBackdrop(request.html) : request.html);
    markExternalImages(page);
    if (request.dark) darken(page);
    frame.style.height = `${page.documentElement.scrollHeight}px`;
    const height = Math.max(1, page.documentElement.scrollHeight);
    const blocks = new Map(Array.from(page.querySelectorAll("[data-block-id]")).map((element) => [element.getAttribute("data-block-id") ?? "", boxOf(element)]));
    const scale = request.focusId ? FOCUS_SCALE : 1;
    const canvas = await rasterize(pageSvg(page, width, height, request.dark), width, height, scale);
    if (request.marks) drawMarks(canvas, legend, blocks, scale);
    if (!request.focusId) return { device, width, height, blocks, canvas };
    const block = blocks.get(request.focusId);
    if (!block) throw new Error(`o bloco ${request.focusId} não aparece na prévia`);
    const crop = focusBox(block, { width, height });
    const cropped = canvasOf(crop.width * scale, crop.height * scale);
    cropped.getContext("2d")!.drawImage(canvas, crop.left * scale, crop.top * scale, crop.width * scale, crop.height * scale, 0, 0, cropped.width, cropped.height);
    return { device, width: cropped.width, height: cropped.height, blocks, canvas: cropped };
  } finally {
    frame.remove();
  }
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  context.save();
  context.font = "600 12px sans-serif";
  const width = context.measureText(text).width + 12;
  context.fillStyle = LABEL_FILL;
  context.fillRect(x, y, width, 20);
  context.fillStyle = LABEL_INK;
  context.textBaseline = "middle";
  context.fillText(text, x + 6, y + 10);
  context.restore();
}

export async function captureEmail(request: LookRequest, legend: readonly MarkLegend[]): Promise<LookCapture> {
  const pages: LaidPage[] = [];
  for (const device of request.devices) pages.push(await layPage(request, device, legend));
  const sheet = sliceSheet(pages.map((page) => ({ device: page.device, width: page.width, height: page.height })));
  const canvas = canvasOf(sheet.width, sheet.height);
  const context = canvas.getContext("2d")!;
  context.fillStyle = SHEET_FILL;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const slice of sheet.slices) {
    const page = pages.find((candidate) => candidate.device === slice.device)!;
    const scale = slice.cell.width / page.width;
    context.drawImage(page.canvas, 0, slice.top, page.width, slice.height, slice.cell.x, slice.cell.y, slice.cell.width, slice.height * scale);
    drawLabel(context, slice.of > 1 ? `${DEVICE_NAMES[slice.device]} ${slice.index}/${slice.of}` : DEVICE_NAMES[slice.device], slice.cell.x + 4, slice.cell.y + 4);
  }
  const seen = new Set(pages.flatMap((page) => [...page.blocks.keys()]));
  const data: LookData = {
    slices: sheet.slices.map((slice) => ({ device: slice.device, index: slice.index, of: slice.of, from_px: slice.top, to_px: slice.top + slice.height })),
    heights: Object.fromEntries(pages.map((page) => [page.device, page.height])),
    ...(request.marks ? { marks: legend.filter((mark) => seen.has(mark.id)) } : {}),
    ...(request.focusId ? { focus_id: request.focusId } : {}),
  };
  return { image: encodeWithin(canvas), data };
}
