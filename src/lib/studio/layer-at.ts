import type { Clip, Layer } from "./document";
import { morphFramesOf } from "./keyframes";
import { morphAt } from "./path-morph";
import { layerAtTime, pathOpsKeyed } from "./path-ops";
import { effectsAt, effectsKeyed } from "./effect-keys";

type TimedLayerClip = Pick<Clip, "layer" | "keyframes">;

export function changesPerFrame(clip: TimedLayerClip): boolean {
  return Boolean(clip.layer) && (morphFramesOf(clip.keyframes).length > 0 || pathOpsKeyed(clip.layer?.pathOps) || effectsKeyed(clip.layer?.effects));
}

export function layerAt(clip: TimedLayerClip, localMs: number): Layer | undefined {
  const layer = clip.layer;
  if (!layer || !changesPerFrame(clip)) return layer;
  const frames = morphFramesOf(clip.keyframes);
  const shaped = frames.length > 0 ? { ...layer, path: morphAt(frames, localMs) } : layer;
  return layerAtTime(shaped.effects ? { ...shaped, effects: effectsAt(shaped.effects, localMs) } : shaped, localMs);
}
