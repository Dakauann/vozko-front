import { SOUND_FILES } from "@/lib/sounds/sound-player";

import type { Clip } from "./document";
import type { IssueCode } from "./validate";

export const SOUND_ASSET_PREFIX = "sound:";

export const SOUND_GROUPS = ["interface", "effects"] as const;

export type SoundGroup = (typeof SOUND_GROUPS)[number];

export interface BuiltinSound {
  id: string;
  file: string;
  durationMs: number;
  group: SoundGroup;
}

export const BUILTIN_SOUNDS: readonly BuiltinSound[] = [
  { id: "message", file: SOUND_FILES.message, durationMs: 1500, group: "interface" },
  { id: "call-connected", file: SOUND_FILES.callConnected, durationMs: 660, group: "interface" },
  { id: "call-ended", file: SOUND_FILES.callEnded, durationMs: 880, group: "interface" },
  { id: "incoming-call", file: SOUND_FILES.incomingCall, durationMs: 8700, group: "interface" },
  { id: "pop", file: "/audio/studio/pop.mp3", durationMs: 280, group: "effects" },
  { id: "click", file: "/audio/studio/click.mp3", durationMs: 120, group: "effects" },
  { id: "whoosh", file: "/audio/studio/whoosh.mp3", durationMs: 750, group: "effects" },
  { id: "ding", file: "/audio/studio/ding.mp3", durationMs: 1400, group: "effects" },
];

const BY_ASSET = new Map(BUILTIN_SOUNDS.map((sound) => [soundAssetId(sound.id), sound]));

export function soundAssetId(id: string): string {
  return `${SOUND_ASSET_PREFIX}${id}`;
}

export function isSoundAsset(assetId: string): boolean {
  return assetId.startsWith(SOUND_ASSET_PREFIX);
}

export function builtinSound(assetId: string): BuiltinSound | undefined {
  return BY_ASSET.get(assetId);
}

export function soundAssetIssue(clip: Pick<Clip, "type" | "assetId">): IssueCode | null {
  const assetId = (clip.assetId ?? "").trim();
  if (!isSoundAsset(assetId)) return null;
  return clip.type === "audio" && builtinSound(assetId) ? null : "invalid";
}

export const SOUND_FIXTURE_PATH = "vozko-back/domain/studio/testdata/studio_sounds.json";

export function soundFixture(): string {
  const sounds = BUILTIN_SOUNDS.map((sound) => ({ id: sound.id, assetId: soundAssetId(sound.id), durationMs: sound.durationMs }));
  return `${JSON.stringify({ prefix: SOUND_ASSET_PREFIX, sounds }, null, 2)}\n`;
}
