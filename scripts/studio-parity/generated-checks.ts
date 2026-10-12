import jsQR from "jsqr";

import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import { resolvedSurface } from "@/lib/studio/components";
import { emptyArtboard, emptyVideoDocument, imageDocument, newOverlayClip, videoCanvasSize, type Artboard, type Layer, type VideoDocument } from "@/lib/studio/document";
import { newQrSpec, qrContent, type QrSpec } from "@/lib/studio/qr";
import { artboardScenes } from "@/lib/studio/scene/image-scene";
import type { Scene } from "@/lib/studio/scene/scene";
import { newTableSpec, tableInk, type TableSpec } from "@/lib/studio/table";
import { tableLayout } from "@/lib/studio/table-parts";

type Board = (board: Artboard, scene?: Scene) => Promise<(x: number, y: number) => number[]>;
type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 600;
const QR_BOX = 0.6;
const TABLE_BOX = { x: 0.5, y: 0.5, w: 0.8, h: 0.6, rotation: 0, opacity: 1 };
const BORDER_WIDTH = 0.01;
const RED_MIN = 200;
const DARK_MAX = 80;
const EDGE_TOLERANCE_PX = 1.5;
const FILM_MS = 1000;
const SHORT_LINK: QrSpec = newQrSpec({ kind: "shortLink", shortLinkId: "3f2c8a1e-9b4d-4c2a-8e1f-5a6b7c8d9e0f", url: "https://vzk.to/aB3dE9" });
const WHATSAPP: QrSpec = { ...newQrSpec({ kind: "whatsapp", phone: "5511999998888", message: "Olá! Vi o anúncio e quero saber mais sobre a oferta de verão" }), ecc: "Q", dark: "#1e3a8a", light: "#eff6ff" };

function qrBoard(spec: QrSpec): Artboard {
  const layer: Layer = { id: "code", type: "qr", transform: { x: 0.5, y: 0.5, w: QR_BOX, h: QR_BOX, rotation: 0, opacity: 1 }, qr: spec };
  return { ...emptyArtboard({ width: SIZE, height: SIZE }, "#ffffff"), id: "board", layers: [layer] };
}

function tableSpec(): TableSpec {
  const base = newTableSpec(
    [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ],
    tableInk("#111111"),
    false,
  );
  return { ...base, columns: [{ width: 2, align: "left" }, { width: 1, align: "left" }, { width: 1, align: "left" }], style: { ...base.style, borders: "all", borderColor: "#ff0000", borderWidth: BORDER_WIDTH, banding: false } };
}

function tableBoard(spec: TableSpec): Artboard {
  return { ...emptyArtboard({ width: SIZE, height: SIZE }, "#ffffff"), id: "board", layers: [{ id: "table", type: "table", transform: TABLE_BOX, table: spec }] };
}

async function gpuOf(draw: Board, artboard: Artboard): Promise<(x: number, y: number) => number[]> {
  const [scene] = artboardScenes(imageDocument([artboard]), { hidden: new Set(), overrides: new Map() });
  return draw(artboard, scene);
}

async function konvaOf(artboard: Artboard): Promise<(x: number, y: number) => number[]> {
  const layers = resolvedSurface(imageDocument([artboard]), artboard).layers;
  const data = (await rasterizeRegion(layers, SIZE, SIZE, { x: 0, y: 0, width: SIZE, height: SIZE }, { background: "#ffffff" })).getContext("2d")!.getImageData(0, 0, SIZE, SIZE).data;
  return (x, y) => {
    const i = (Math.floor(y) * SIZE + Math.floor(x)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

function decode(at: (x: number, y: number) => number[], width: number, height: number): string | null {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = at(x + 0.5, y + 0.5);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return jsQR(data, width, height)?.data ?? null;
}

function qrFilm(spec: QrSpec): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#ffffff";
  const layer: Layer = { id: "code-layer", type: "qr", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }, qr: spec };
  doc.tracks = [{ id: "codes", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, FILM_MS, { x: 0.5, y: 0.5, w: QR_BOX, h: QR_BOX, rotation: 0, opacity: 1 }), id: "code" }] }];
  doc.durationMs = FILM_MS;
  return doc;
}

async function qrDecodes(draw: Board, frames: Frames, step: number): Promise<Record<string, unknown>> {
  const read: Record<string, string | null> = {};
  for (const [name, spec] of [["short", SHORT_LINK], ["whatsapp", WHATSAPP]] as const) {
    read[`${name}Gpu`] = decode(await gpuOf(draw, qrBoard(spec)), SIZE, SIZE);
    read[`${name}Konva`] = decode(await konvaOf(qrBoard(spec)), SIZE, SIZE);
  }
  const film = qrFilm(SHORT_LINK);
  const { width, height } = videoCanvasSize(film);
  const [frame] = await frames(film, width, height, [FILM_MS / 2]);
  const columns = Math.ceil(width / step);
  read.shortExport = decode((x, y) => {
    const i = (Math.floor(y) * columns + Math.floor(x)) * 3;
    return [frame[i], frame[i + 1], frame[i + 2]];
  }, columns, Math.ceil(height / step));
  const short = qrContent(SHORT_LINK.link);
  const whatsapp = qrContent(WHATSAPP.link);
  return {
    ...Object.fromEntries(Object.entries(read).map(([key, value]) => [key, value ?? "none"])),
    qrOk: read.shortGpu === short && read.whatsappGpu === whatsapp,
    qrFallbackOk: read.shortKonva === short && read.whatsappKonva === whatsapp,
    qrExportOk: read.shortExport === short,
  };
}

interface Run {
  from: number;
  to: number;
}

function redRuns(sample: (i: number) => number[], length: number): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i <= length; i++) {
    const [r, g, b] = i < length ? sample(i) : [255, 255, 255];
    const red = r >= RED_MIN && g <= DARK_MAX && b <= DARK_MAX;
    if (red && start < 0) start = i;
    if (!red && start >= 0) {
      runs.push({ from: start, to: i });
      start = -1;
    }
  }
  return runs;
}

function expectedRuns(edges: readonly number[], offset: number, extent: number, thickness: number): Run[] {
  return edges.map((at, k) => {
    if (k === 0) return { from: offset, to: offset + thickness };
    if (k === edges.length - 1) return { from: offset + extent - thickness, to: offset + extent };
    return { from: offset + at - thickness / 2, to: offset + at + thickness / 2 };
  });
}

function cumulative(lengths: readonly number[]): number[] {
  const out = [0];
  for (const length of lengths) out.push(out[out.length - 1] + length);
  return out;
}

function runsMatch(found: readonly Run[], wanted: readonly Run[]): boolean {
  return found.length === wanted.length && found.every((run, i) => Math.abs(run.from - wanted[i].from) <= EDGE_TOLERANCE_PX && Math.abs(run.to - wanted[i].to) <= EDGE_TOLERANCE_PX);
}

function bordersAt(at: (x: number, y: number) => number[], spec: TableSpec): { columns: Run[]; rows: Run[]; ok: boolean } {
  const box = { width: TABLE_BOX.w * SIZE, height: TABLE_BOX.h * SIZE };
  const left = (TABLE_BOX.x - TABLE_BOX.w / 2) * SIZE;
  const top = (TABLE_BOX.y - TABLE_BOX.h / 2) * SIZE;
  const layout = tableLayout(spec, box);
  const thickness = BORDER_WIDTH * box.height;
  const xs = cumulative(layout.columns);
  const ys = cumulative(layout.rows);
  const middleY = top + ys[0] + layout.rows[0] / 2;
  const middleX = left + xs[0] + layout.columns[0] / 2;
  const columns = redRuns((x) => at(x + 0.5, middleY), SIZE);
  const rows = redRuns((y) => at(middleX, y + 0.5), SIZE);
  const ok = runsMatch(columns, expectedRuns(xs, left, box.width, thickness)) && runsMatch(rows, expectedRuns(ys, top, box.height, thickness));
  return { columns, rows, ok };
}

function runText(runs: readonly Run[]): string {
  return runs.map((run) => `${run.from}-${run.to}`).join(",");
}

async function tableBorders(draw: Board): Promise<Record<string, unknown>> {
  const spec = tableSpec();
  const gpu = bordersAt(await gpuOf(draw, tableBoard(spec)), spec);
  const konva = bordersAt(await konvaOf(tableBoard(spec)), spec);
  const box = { width: TABLE_BOX.w * SIZE, height: TABLE_BOX.h * SIZE };
  const layout = tableLayout(spec, box);
  return {
    columnBorders: runText(gpu.columns),
    rowBorders: runText(gpu.rows),
    expectedColumns: cumulative(layout.columns).map((x) => Math.round((TABLE_BOX.x - TABLE_BOX.w / 2) * SIZE + x)).join(","),
    tableOk: gpu.ok,
    tableFallbackOk: konva.ok,
  };
}

export async function generatedParity(draw: Board, frames: Frames, step: number): Promise<Record<string, unknown>> {
  return { ...(await qrDecodes(draw, frames, step)), ...(await tableBorders(draw)) };
}
