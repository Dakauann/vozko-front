import type { ColorStop, ExportScene, PortableBlend, RasterItem, SceneStroke, ScenePaint, VectorItem } from "./export-scene";
import type { Box } from "./paint";
import { segmentControls, type Subpath } from "./path-nodes";

const PT_PER_PX = 0.75;
const PDF_CREATOR = "Vozko Estúdio";
export const PDF_PRESETS = ["digital", "print"] as const;
export type PdfPreset = (typeof PDF_PRESETS)[number];
export const PDF_PATCH_RATIOS: Record<PdfPreset, number> = { digital: 2, print: 300 / 96 };

export function rgbAndAlpha(rgba: ArrayLike<number>): { rgb: Uint8Array<ArrayBuffer>; alpha: Uint8Array<ArrayBuffer> } {
  const pixels = rgba.length >> 2;
  const rgb = new Uint8Array(pixels * 3);
  const alpha = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
    alpha[i] = rgba[i * 4 + 3];
  }
  return { rgb, alpha };
}

export type PdfImage =
  | { kind: "jpeg"; width: number; height: number; data: Uint8Array }
  | { kind: "flate"; width: number; height: number; rgb: Uint8Array; alpha: Uint8Array | null };

export interface PlacedPdfImage {
  bounds: Box;
  image: PdfImage;
}

export interface PdfPage {
  scene: ExportScene;
  images: ReadonlyMap<string, PlacedPdfImage>;
}

interface PdfDocument {
  title: string;
  created: Date;
  pages: readonly PdfPage[];
}

const BLEND_NAMES: Record<PortableBlend, string> = {
  normal: "Normal",
  multiply: "Multiply",
  screen: "Screen",
  overlay: "Overlay",
  darken: "Darken",
  lighten: "Lighten",
  "color-dodge": "ColorDodge",
  "color-burn": "ColorBurn",
  "hard-light": "HardLight",
  "soft-light": "SoftLight",
  difference: "Difference",
  exclusion: "Exclusion",
  hue: "Hue",
  saturation: "Saturation",
  color: "Color",
  luminosity: "Luminosity",
};

const CAPS = { butt: 0, round: 1, square: 2 } as const;
const JOINS = { miter: 0, round: 1, bevel: 2 } as const;
const encoder = new TextEncoder();
const BINARY_MARKER = new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);

function num(value: number): string {
  return String(Number(value.toFixed(4)) || 0);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [number, number, number];
}

function utf16Hex(value: string): string {
  let out = "FEFF";
  for (let i = 0; i < value.length; i++) out += value.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return `<${out}>`;
}

export function pdfDate(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;
}

class PdfObjects {
  private readonly bodies: (Uint8Array | null)[] = [];

  reserve(): number {
    this.bodies.push(null);
    return this.bodies.length;
  }

  set(id: number, body: string | Uint8Array): void {
    this.bodies[id - 1] = typeof body === "string" ? encoder.encode(body) : body;
  }

  add(body: string | Uint8Array): number {
    const id = this.reserve();
    this.set(id, body);
    return id;
  }

  stream(dict: string, data: Uint8Array): number {
    return this.add(concat([encoder.encode(`<< ${dict} /Length ${data.length} >>\nstream\n`), data, encoder.encode("\nendstream")]));
  }

  bytes(root: number, info: number): Uint8Array<ArrayBuffer> {
    const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n"), BINARY_MARKER];
    let offset = parts.reduce((sum, part) => sum + part.length, 0);
    const offsets: number[] = [];
    this.bodies.forEach((body, index) => {
      if (!body) throw new Error(`pdf object ${index + 1} was never written`);
      const chunk = concat([encoder.encode(`${index + 1} 0 obj\n`), body, encoder.encode("\nendobj\n")]);
      offsets.push(offset);
      offset += chunk.length;
      parts.push(chunk);
    });
    const xref = [`xref\n0 ${this.bodies.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
    parts.push(encoder.encode(`${xref}trailer\n<< /Size ${this.bodies.length + 1} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
    return concat(parts);
  }
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function pathOps(subpaths: readonly Subpath[]): string {
  const ops: string[] = [];
  const point = (p: { x: number; y: number }) => `${num(p.x)} ${num(p.y)}`;
  for (const { closed, nodes } of subpaths) {
    if (nodes.length === 0) continue;
    ops.push(`${point(nodes[0])} m`);
    const segment = (from: Subpath["nodes"][number], to: Subpath["nodes"][number]) => {
      const controls = segmentControls(from, to);
      ops.push(controls ? `${point(controls[0])} ${point(controls[1])} ${point(to)} c` : `${point(to)} l`);
    };
    for (let i = 1; i < nodes.length; i++) segment(nodes[i - 1], nodes[i]);
    if (!closed) continue;
    const last = nodes[nodes.length - 1];
    if (segmentControls(last, nodes[0])) segment(last, nodes[0]);
    ops.push("h");
  }
  return ops.join("\n");
}

function stitched(stops: readonly ColorStop[], channel: (stop: ColorStop) => number[]): string {
  const pieces = stops.slice(1).map((stop, i) => `<< /FunctionType 2 /Domain [0 1] /C0 [${channel(stops[i]).map(num).join(" ")}] /C1 [${channel(stop).map(num).join(" ")}] /N 1 >>`);
  if (pieces.length === 1) return pieces[0];
  const bounds = stops.slice(1, -1).map((stop) => num(stop.offset));
  return `<< /FunctionType 3 /Domain [0 1] /Functions [${pieces.join(" ")}] /Bounds [${bounds.join(" ")}] /Encode [${pieces.map(() => "0 1").join(" ")}] >>`;
}

type Gradient = Exclude<ScenePaint, { kind: "solid" }>;

function paintable(paint: Gradient): boolean {
  if (paint.stops.length < 2) return false;
  return paint.kind === "radial" ? paint.radius > 0 : paint.from.x !== paint.to.x || paint.from.y !== paint.to.y;
}

function shadingDict(paint: Gradient, space: "DeviceRGB" | "DeviceGray", channel: (stop: ColorStop) => number[]): string {
  const coords = paint.kind === "linear" ? [paint.from.x, paint.from.y, paint.to.x, paint.to.y] : [paint.center.x, paint.center.y, 0, paint.center.x, paint.center.y, paint.radius];
  return `<< /ShadingType ${paint.kind === "linear" ? 2 : 3} /ColorSpace /${space} /Coords [${coords.map(num).join(" ")}] /Function ${stitched(paint.stops, channel)} /Extend [true true] >>`;
}

class PageWriter {
  private readonly states = new Map<string, string>();
  private readonly shadings = new Map<string, string>();
  private readonly xobjects = new Map<string, number>();
  readonly resources: number;

  constructor(
    private readonly objects: PdfObjects,
    private readonly scene: ExportScene,
  ) {
    this.resources = objects.reserve();
  }

  private state(dict: string): string {
    const known = this.states.get(dict);
    if (known) return known;
    const name = `GS${this.states.size}`;
    this.states.set(dict, name);
    return name;
  }

  private alphaState(fill: number, stroke: number, blend: PortableBlend): string {
    return `/${this.state(`<< /Type /ExtGState /ca ${num(fill)} /CA ${num(stroke)} /BM /${BLEND_NAMES[blend]} >>`)} gs`;
  }

  private shading(dict: string): string {
    const known = this.shadings.get(dict);
    if (known) return known;
    const name = `Sh${this.shadings.size}`;
    this.shadings.set(dict, name);
    return name;
  }

  private xobject(prefix: string, id: number): string {
    const name = `${prefix}${this.xobjects.size}`;
    this.xobjects.set(name, id);
    return name;
  }

  private box(): string {
    return `[0 0 ${num(this.scene.width)} ${num(this.scene.height)}]`;
  }

  private softMask(paint: Gradient): string {
    const shade = this.shading(shadingDict(paint, "DeviceGray", (stop) => [stop.alpha]));
    const form = this.objects.stream(`/Type /XObject /Subtype /Form /BBox ${this.box()} /Group << /S /Transparency /CS /DeviceGray >> /Resources ${this.resources} 0 R`, encoder.encode(`/${shade} sh`));
    return `/${this.state(`<< /Type /ExtGState /SMask << /Type /Mask /S /Luminosity /G ${form} 0 R >> >>`)} gs`;
  }

  private fillWith(paint: ScenePaint, subpaths: string, evenOdd: boolean, alpha: number, blend: PortableBlend): string {
    if (paint.kind === "solid") {
      const [r, g, b] = rgb(paint.color);
      return ["q", this.alphaState(paint.alpha * alpha, 1, blend), `${num(r)} ${num(g)} ${num(b)} rg`, subpaths, evenOdd ? "f*" : "f", "Q"].join("\n");
    }
    if (!paintable(paint)) return "";
    const mask = paint.stops.some((stop) => stop.alpha < 1) ? [this.softMask(paint)] : [];
    const shade = this.shading(shadingDict(paint, "DeviceRGB", (stop) => rgb(stop.color)));
    return ["q", this.alphaState(alpha, 1, blend), subpaths, evenOdd ? "W* n" : "W n", ...mask, `/${shade} sh`, "Q"].join("\n");
  }

  private strokeWith(stroke: SceneStroke, subpaths: string, alpha: number, blend: PortableBlend): string {
    const [r, g, b] = rgb(stroke.color);
    return ["q", this.alphaState(1, stroke.alpha * alpha, blend), ...this.strokeStyle(stroke), `${num(r)} ${num(g)} ${num(b)} RG`, subpaths, "S", "Q"].join("\n");
  }

  private strokeStyle(stroke: SceneStroke): string[] {
    return [`${num(stroke.width)} w`, `${CAPS[stroke.cap]} J`, `${JOINS[stroke.join]} j`, `${num(stroke.miterLimit)} M`, `[${(stroke.dash ?? []).map(num).join(" ")}] ${num(stroke.dashOffset)} d`];
  }

  private paintVector(item: VectorItem, alpha: number, blend: PortableBlend): string {
    const subpaths = pathOps(item.subpaths);
    const evenOdd = item.fillRule === "evenodd";
    const { fill, stroke } = item;
    if (fill?.kind === "solid" && stroke) {
      const [fr, fg, fb] = rgb(fill.color);
      const [sr, sg, sb] = rgb(stroke.color);
      return ["q", this.alphaState(fill.alpha * alpha, stroke.alpha * alpha, blend), ...this.strokeStyle(stroke), `${num(fr)} ${num(fg)} ${num(fb)} rg`, `${num(sr)} ${num(sg)} ${num(sb)} RG`, subpaths, evenOdd ? "B*" : "B", "Q"].join("\n");
    }
    return [fill ? this.fillWith(fill, subpaths, evenOdd, alpha, blend) : "", stroke ? this.strokeWith(stroke, subpaths, alpha, blend) : ""].filter(Boolean).join("\n");
  }

  private vector(item: VectorItem): string {
    if (item.opacity >= 1 || !item.fill || !item.stroke) return this.paintVector(item, item.opacity, item.blend);
    const group = this.objects.stream(`/Type /XObject /Subtype /Form /BBox ${this.box()} /Group << /S /Transparency >> /Resources ${this.resources} 0 R`, encoder.encode(this.paintVector(item, 1, "normal")));
    return ["q", this.alphaState(item.opacity, item.opacity, item.blend), `/${this.xobject("Fm", group)} Do`, "Q"].join("\n");
  }

  private image(image: PdfImage): number {
    const base = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8 /Interpolate true`;
    if (image.kind === "jpeg") return this.objects.stream(`${base} /ColorSpace /DeviceRGB /Filter /DCTDecode`, image.data);
    const mask = image.alpha ? this.objects.stream(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8 /ColorSpace /DeviceGray /Filter /FlateDecode`, image.alpha) : null;
    return this.objects.stream(`${base} /ColorSpace /DeviceRGB /Filter /FlateDecode${mask ? ` /SMask ${mask} 0 R` : ""}`, image.rgb);
  }

  private raster(item: RasterItem, placed: PlacedPdfImage | undefined): string {
    if (!placed) throw new Error(`pdf export is missing the pixels of ${item.id}`);
    const { bounds } = placed;
    const name = this.xobject("Im", this.image(placed.image));
    return ["q", this.alphaState(1, 1, item.blend), `${num(bounds.width)} 0 0 ${num(-bounds.height)} ${num(bounds.x)} ${num(bounds.y + bounds.height)} cm`, `/${name} Do`, "Q"].join("\n");
  }

  content(images: ReadonlyMap<string, PlacedPdfImage>): string {
    const { scene } = this;
    const frame = `${num(PT_PER_PX)} 0 0 ${num(-PT_PER_PX)} 0 ${num(scene.height * PT_PER_PX)} cm`;
    const background = scene.background ? this.fillWith(scene.background, `0 0 ${num(scene.width)} ${num(scene.height)} re`, false, 1, "normal") : "";
    const items = scene.items.map((item) => (item.kind === "vector" ? this.vector(item) : this.raster(item, images.get(item.id))));
    return ["q", frame, background, ...items, "Q"].filter(Boolean).join("\n");
  }

  writeResources(): void {
    const states = [...this.states].map(([dict, name]) => `/${name} ${dict}`).join(" ");
    const shadings = [...this.shadings].map(([dict, name]) => `/${name} ${this.objects.add(dict)} 0 R`).join(" ");
    const xobjects = [...this.xobjects].map(([name, id]) => `/${name} ${id} 0 R`).join(" ");
    this.objects.set(this.resources, `<< /ExtGState << ${states} >> /Shading << ${shadings} >> /XObject << ${xobjects} >> >>`);
  }
}

export function writePdf(doc: PdfDocument): Uint8Array<ArrayBuffer> {
  const objects = new PdfObjects();
  const catalog = objects.reserve();
  const pages = objects.reserve();
  const info = objects.add(`<< /Title ${utf16Hex(doc.title)} /Creator ${utf16Hex(PDF_CREATOR)} /Producer ${utf16Hex(PDF_CREATOR)} /CreationDate (${pdfDate(doc.created)}) >>`);
  const kids = doc.pages.map(({ scene, images }) => {
    const writer = new PageWriter(objects, scene);
    const contents = objects.stream("", encoder.encode(writer.content(images)));
    writer.writeResources();
    return objects.add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${num(scene.width * PT_PER_PX)} ${num(scene.height * PT_PER_PX)}] /Resources ${writer.resources} 0 R /Contents ${contents} 0 R /Group << /S /Transparency /CS /DeviceRGB >> >>`);
  });
  objects.set(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects.set(pages, `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`);
  return objects.bytes(catalog, info);
}
