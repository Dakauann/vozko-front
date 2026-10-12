import type { Artboard, CanvasSize, VideoAspect, VideoDocument } from "@/lib/studio/document";

export const BENCH_PROJECT_ID = "5f0c7c1e-1d2a-4b8e-9d11-3a2b1c0d9e8f";
export const BENCH_ARTBOARD_ID = "ab-1";
export const VIDEO_SAMPLE_FRAMES = 6;

export type OpenSpec = { kind: "image"; width: number; height: number; background?: string } | { kind: "video"; aspect: VideoAspect; background?: string };

export interface ImageReference {
  id: string;
  title: string;
  kind: "image";
  origin: string;
  artboard: Artboard;
}

export interface VideoReference {
  id: string;
  title: string;
  kind: "video";
  origin: string;
  doc: VideoDocument;
}

export type Reference = ImageReference | VideoReference;

export interface Brief {
  id: string;
  title: string;
  open: OpenSpec;
  text: string;
}

export interface Finding {
  kind: string;
  level: "erro" | "aviso";
  text: string;
}

export interface Inspection {
  image: string;
  findings: Finding[];
  checks: string[];
  legibility: string[];
  valid: boolean;
}

export function openSpecOf(reference: Reference): OpenSpec {
  if (reference.kind === "video") return { kind: "video", aspect: reference.doc.canvas.aspect };
  const size: CanvasSize = reference.artboard.canvas;
  return { kind: "image", width: size.width, height: size.height };
}
