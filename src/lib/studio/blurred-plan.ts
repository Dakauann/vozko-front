import { NO_LEVELS, type TrackLevels } from "./behaviors";
import { canvasAspect, fullFrame, videoCanvasSize, type VideoDocument } from "./document";
import { cameraPose } from "./adjustment";
import { motionTrail, shutterOf, takesMotionBlur } from "./motion-blur";
import { clipLookup } from "./parenting";
import { heldLocalMs, poseAt, PREMOUNT_MS, visualPlan, type VisualItem } from "./playback";
import { steppedClipIds } from "./vfx-time";

export function withMotionBlur(doc: VideoDocument, items: readonly VisualItem[], ms: number, pixelScale: number, levels: TrackLevels = NO_LEVELS): VisualItem[] {
  const shutter = shutterOf(doc.canvas);
  if (!(shutter.angle > 0)) return [...items];
  const lookup = clipLookup(doc);
  const aspect = canvasAspect(doc);
  const canvas = videoCanvasSize(doc);
  const stepped = steppedClipIds(doc, ms);
  return items.map((item) => {
    const clip = lookup.get(item.clipId);
    if (item.active && item.camera && clip?.motionBlur && clip.type === "effect") {
      const frame = fullFrame();
      const camera = motionTrail((at) => cameraPose(clip, heldLocalMs(clip, at), canvas) ?? frame, ms, shutter, canvas, pixelScale, frame);
      return camera ? { ...item, camera } : item;
    }
    if (!item.active || !clip?.motionBlur || !takesMotionBlur(clip.type) || stepped.has(item.clipId)) return item;
    const trail = motionTrail((at) => poseAt(lookup, clip, heldLocalMs(clip, at), aspect, canvas, levels), ms, shutter, canvas, pixelScale);
    return trail ? { ...item, trail } : item;
  });
}

export function blurredPlan(doc: VideoDocument, ms: number, pixelScale: number, levels: TrackLevels = NO_LEVELS): VisualItem[] {
  return withMotionBlur(doc, visualPlan(doc, ms, PREMOUNT_MS, levels), ms, pixelScale, levels);
}
