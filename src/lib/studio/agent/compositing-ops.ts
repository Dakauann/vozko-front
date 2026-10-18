import { blendsAsMedia, clipBlendPatch, isBlendMode } from "../clip-blend";
import { BLEND_MODES, type Clip } from "../document";
import { changedMatte, isMatteChannel, MATTE_CHANNELS, matteOf, mattePatch, type MatteChannel } from "../matte";
import type { ClipPatch } from "../timeline";

interface AgentCompositingFields {
  matte?: boolean;
  matte_channel?: MatteChannel;
  matte_invert?: boolean;
  blend_mode?: string;
  clear?: string[];
}

const BLEND_CLEAR = "blend_mode";

export function mattePatchOf(clip: Clip, op: AgentCompositingFields): ClipPatch | string {
  if (op.matte === undefined && op.matte_channel === undefined && op.matte_invert === undefined) return {};
  if (clip.type === "audio") return "um áudio não tem imagem para recortar";
  if (op.matte_channel !== undefined && !isMatteChannel(op.matte_channel)) return `matte_channel precisa ser um de: ${MATTE_CHANNELS.join(", ")}`;
  if (op.matte === false && (op.matte_channel !== undefined || op.matte_invert !== undefined)) return "matte false desliga o recorte; não mande matte_channel nem matte_invert junto";
  return mattePatch(changedMatte(matteOf(clip), { on: op.matte, channel: op.matte_channel, invert: op.matte_invert }));
}

export function mediaBlendOf<T extends AgentCompositingFields>(clip: Clip, op: T): { patch: ClipPatch; rest: T } | string {
  const clears = op.clear?.includes(BLEND_CLEAR) ?? false;
  if (!blendsAsMedia(clip) || (op.blend_mode === undefined && !clears)) return { patch: {}, rest: op };
  if (op.blend_mode !== undefined && !isBlendMode(op.blend_mode)) return `blend_mode precisa ser um de: ${BLEND_MODES.join(", ")}`;
  const others = op.clear?.filter((name) => name !== BLEND_CLEAR) ?? [];
  const rest: T = { ...op, blend_mode: undefined, clear: others.length > 0 ? others : undefined };
  return { patch: clipBlendPatch(clip, isBlendMode(op.blend_mode) ? op.blend_mode : "normal") ?? {}, rest };
}
