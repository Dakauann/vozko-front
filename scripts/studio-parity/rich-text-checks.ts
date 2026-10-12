import { ensureRunFonts, layoutLayerText } from "@/components/studio/canvas/rich-measure";
import { emptyVideoDocument, newTextLayer, type Clip, type Layer, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import { textSpans, type TextRun } from "@/lib/studio/text-runs";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 1080;
const LIT = 96;
const STRONG = 150;
const FAINT = 90;
const MIN_COLORED = 40;
const STRAY_SHARE = 0.02;
const BOLD_GAIN = 1.15;
const STEADY_SHARE = 0.08;
const TEXT = "BIG SALE";
const BOX = { x: 0.5, y: 0.5, w: 0.9, h: 0.4, rotation: 0, opacity: 1 };

interface Span {
  left: number;
  right: number;
}

interface Tally {
  red: number;
  green: number;
  ink: number;
}

function layerWith(runs: TextRun[]): Layer {
  return { ...newTextLayer(TEXT), id: "l-rich", fontId: "roboto", fontWeight: 400, fontSize: 0.12, fill: "#ffffff", align: "center", runs };
}

function film(layer: Layer): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const clip: Clip = { ...overlayClip(layer, 0, BOX), id: "rich", startMs: 0, durationMs: 1000 };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = 1000;
  return doc;
}

async function wordSpans(layer: Layer): Promise<{ big: Span; sale: Span; top: number; bottom: number }> {
  await ensureRunFonts(textSpans(layer));
  const box = { x: (BOX.x - BOX.w / 2) * SIZE, y: (BOX.y - BOX.h / 2) * SIZE, width: BOX.w * SIZE, height: BOX.h * SIZE };
  const segments = layoutLayerText(layer, { box, fontBasePx: SIZE }).lines.flatMap((line) => line.segments);
  const of = (start: number): Span => {
    const segment = segments.find((s) => s.start <= start && start < s.end)!;
    const chars = segment.chars.filter((c) => c.char.trim() !== "");
    return { left: chars[0].left, right: chars[chars.length - 1].right };
  };
  return { big: of(0), sale: of(4), top: box.y, bottom: box.y + box.height };
}

function tally(frame: Uint8Array, step: number, span: Span, top: number, bottom: number): Tally {
  const columns = Math.ceil(SIZE / step);
  const result: Tally = { red: 0, green: 0, ink: 0 };
  for (let row = Math.floor(top / step); row < Math.ceil(bottom / step); row++) {
    for (let column = Math.floor(span.left / step); column <= Math.ceil(span.right / step); column++) {
      const i = (row * columns + column) * 3;
      const [r, g, b] = [frame[i], frame[i + 1], frame[i + 2]];
      if (Math.max(r, g, b) > LIT) result.ink += 1;
      if (r > STRONG && g < FAINT && b < FAINT) result.red += 1;
      if (g > STRONG && r < FAINT && b < FAINT) result.green += 1;
    }
  }
  return result;
}

export async function richTextRuns(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const bold = layerWith([{ start: 0, end: 3, fill: "#ff0000" }, { start: 4, end: 8, fill: "#00ff00", fontWeight: 900 }]);
  const light = layerWith([{ start: 0, end: 3, fill: "#ff0000" }, { start: 4, end: 8, fill: "#00ff00" }]);
  const [shown] = await frames(film(bold), SIZE, SIZE, [0]);
  const [plain] = await frames(film(light), SIZE, SIZE, [0]);
  const boldSpans = await wordSpans(bold);
  const lightSpans = await wordSpans(light);
  const big = tally(shown, step, boldSpans.big, boldSpans.top, boldSpans.bottom);
  const sale = tally(shown, step, boldSpans.sale, boldSpans.top, boldSpans.bottom);
  const plainBig = tally(plain, step, lightSpans.big, lightSpans.top, lightSpans.bottom);
  const plainSale = tally(plain, step, lightSpans.sale, lightSpans.top, lightSpans.bottom);
  const saleGain = plainSale.ink > 0 ? sale.ink / plainSale.ink : 0;
  const bigGain = plainBig.ink > 0 ? big.ink / plainBig.ink : 0;
  return {
    bigRed: big.red,
    bigGreen: big.green,
    saleGreen: sale.green,
    saleRed: sale.red,
    saleGain: Math.round(saleGain * 1000) / 1000,
    bigGain: Math.round(bigGain * 1000) / 1000,
    colorsOk: big.red >= MIN_COLORED && sale.green >= MIN_COLORED && big.green <= big.red * STRAY_SHARE && sale.red <= sale.green * STRAY_SHARE,
    weightOk: saleGain >= BOLD_GAIN && Math.abs(bigGain - 1) <= STEADY_SHARE,
  };
}
