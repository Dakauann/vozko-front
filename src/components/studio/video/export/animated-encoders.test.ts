import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultVideoExport, type GifExportRequest, type WebpExportRequest } from "@/lib/studio/animated-export";
import { emptyVideoDocument, type VideoDocument } from "@/lib/studio/document";

import type { FrameLoopDeps } from "./frame-loop";
import type { RenderSession } from "./render-session";

vi.mock("./frame-loop", () => ({
  renderFrames: vi.fn(async (deps: FrameLoopDeps) => {
    for (let index = 0; index < deps.times.length; index++) {
      await deps.emit(index);
      deps.onProgress(index + 1, deps.times.length);
    }
    return "complete";
  }),
}));

vi.mock("./render-session", () => ({
  withRenderSession: vi.fn(async (size: RenderSession["size"], run: (session: RenderSession) => unknown) => run({ size, canvas: document.createElement("canvas") } as RenderSession)),
}));

import { exportAnimationInBrowser } from "./animated-encoders";
import { withRenderSession } from "./render-session";

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];

function film(durationMs: number): VideoDocument {
  return { ...emptyVideoDocument("landscape"), durationMs };
}

function frame(width: number, height: number, rgba: number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return data;
}

function stubCanvas(frames: Uint8ClampedArray[], webp: (canvas: HTMLCanvasElement) => Blob | null) {
  let drawn = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: () => undefined, getImageData: () => ({ data: frames[Math.min(drawn++, frames.length - 1)] }) } as unknown as RenderingContext;
  } as unknown as HTMLCanvasElement["getContext"]);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback) {
    callback(webp(this));
  });
}

function stillWebp(width: number, height: number): Blob {
  const bits = (width - 1) | ((height - 1) << 14);
  const data = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff, 9, 9, 0];
  const chunk = [..."VP8L"].map((c) => c.charCodeAt(0)).concat([data.length, 0, 0, 0], data);
  const body = [..."WEBP"].map((c) => c.charCodeAt(0)).concat(chunk);
  return new Blob([new Uint8Array([..."RIFF"].map((c) => c.charCodeAt(0)).concat([body.length & 0xff, body.length >> 8, 0, 0], body))], { type: "image/webp" });
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function gifDelays(bytes: Uint8Array): number[] {
  const delays: number[] = [];
  for (let i = 0; i + 5 < bytes.length; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4) delays.push(bytes[i + 4] | (bytes[i + 5] << 8));
  return delays;
}

function count(bytes: Uint8Array, fourcc: string): number {
  const text = String.fromCharCode(...bytes);
  return text.split(fourcc).length - 1;
}

describe("animated exports in the browser", () => {
  beforeEach(() => {
    vi.mocked(withRenderSession).mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders a gif at the chosen width and merges frames that did not change", async () => {
    const request = { ...defaultVideoExport("gif", { width: 1920, height: 1080 }), width: 160, fps: 10 } as GifExportRequest;
    const black = frame(160, 90, BLACK);
    const white = frame(160, 90, WHITE);
    const sampled = [black, black, black, white, white, white];
    const rendered = [black, black, white, white, white, white];
    stubCanvas([...sampled, ...rendered], () => null);
    const phases: unknown[] = [];
    const exported = await exportAnimationInBrowser(film(600), request, (phase) => phases.push(phase));
    expect(withRenderSession).toHaveBeenCalledWith({ width: 160, height: 90 }, expect.any(Function));
    expect(exported.status).toBe("done");
    const file = exported.status === "done" ? exported.file : new Blob();
    expect(file.type).toBe("image/gif");
    const bytes = await bytesOf(file);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe("GIF89a");
    expect(gifDelays(bytes)).toEqual([20, 40]);
    expect(phases.at(-1)).toEqual({ phase: "encoding", done: 12, total: 12 });
  });

  it("packs browser webp frames into one animated webp", async () => {
    const request = { ...defaultVideoExport("webp", { width: 1920, height: 1080 }), width: 160, fps: 10 } as WebpExportRequest;
    stubCanvas([frame(160, 90, BLACK), frame(160, 90, WHITE), frame(160, 90, WHITE)], (canvas) => (canvas.width === 1 ? new Blob([], { type: "image/webp" }) : stillWebp(160, 90)));
    const exported = await exportAnimationInBrowser(film(300), request, () => undefined);
    expect(exported.status).toBe("done");
    const bytes = await bytesOf(exported.status === "done" ? exported.file : new Blob());
    expect(String.fromCharCode(...bytes.subarray(8, 16))).toBe("WEBPVP8X");
    expect(count(bytes, "ANMF")).toBe(2);
  });

  it("says when this browser cannot write webp, before rendering anything", async () => {
    const request = defaultVideoExport("webp", { width: 1920, height: 1080 }) as WebpExportRequest;
    stubCanvas([], () => new Blob([], { type: "image/png" }));
    expect(await exportAnimationInBrowser(film(300), request, () => undefined)).toEqual({ status: "failed", reason: "no_encoder" });
    expect(withRenderSession).not.toHaveBeenCalled();
  });
});
