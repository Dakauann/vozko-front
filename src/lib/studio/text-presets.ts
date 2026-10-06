import { newShapeLayer, newStudioId, newTextLayer, type Clip, type Layer, type Transform } from "./document";
import { captionLayer, CAPTION_TRANSFORM, overlayClip } from "./media-clips";

export const TEXT_STYLE_PRESETS = ["headline", "caption", "cta", "lowerThird", "tag"] as const;

export type TextStylePreset = (typeof TEXT_STYLE_PRESETS)[number];

function box(x: number, y: number, w: number, h: number, opacity = 1): Transform {
  return { x, y, w, h, rotation: 0, opacity };
}

function text(content: string, patch: Partial<Layer>): Layer {
  return { ...newTextLayer(content, "body"), ...patch };
}

function plate(fill: string, radius: number): Layer {
  return { ...newShapeLayer("rect"), fill, radius };
}

function linked(clips: Clip[]): Clip[] {
  const linkId = newStudioId("k");
  return clips.map((clip) => ({ ...clip, linkId }));
}

export function textPresetClips(preset: TextStylePreset, content: string, atMs: number): Clip[] {
  switch (preset) {
    case "headline":
      return [
        overlayClip(
          text(content, { fontSize: 0.075, fontWeight: 800, fill: "#ffffff", lineHeight: 1.05, shadow: { color: "#000000", blur: 18, x: 0, y: 4 } }),
          atMs,
          box(0.5, 0.3, 0.86, 0.18),
        ),
      ];
    case "caption":
      return [overlayClip(captionLayer(content), atMs, { ...CAPTION_TRANSFORM })];
    case "cta":
      return linked([
        overlayClip(plate("#ffffff", 1), atMs, box(0.5, 0.82, 0.62, 0.075)),
        overlayClip(text(content, { fontSize: 0.03, fontWeight: 700, fill: "#111111" }), atMs, box(0.5, 0.82, 0.56, 0.075)),
      ]);
    case "lowerThird":
      return linked([
        overlayClip(plate("#111111", 0.2), atMs, box(0.37, 0.8, 0.66, 0.09, 0.88)),
        overlayClip(text(content, { fontSize: 0.03, fontWeight: 600, fill: "#ffffff", align: "left" }), atMs, box(0.38, 0.8, 0.58, 0.09)),
      ]);
    case "tag":
      return linked([
        overlayClip(plate("#ffd23f", 0.35), atMs, box(0.27, 0.12, 0.42, 0.06)),
        overlayClip(text(content, { fontSize: 0.026, fontWeight: 800, fill: "#111111" }), atMs, box(0.27, 0.12, 0.38, 0.06)),
      ]);
  }
}
