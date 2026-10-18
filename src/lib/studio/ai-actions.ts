import { canStart } from "@/lib/media-generation/limits";
import type { MediaKind } from "@/lib/media-generation/types";

import type { Clip, Layer, Track } from "./document";
import { clipImageSource } from "./image-sources";

export type AiEditor = "image" | "video";

export type AiSubjectKind = "image" | "text" | "shape" | "group" | "selection" | "element" | "video" | "audio" | "visualLane" | "audioLane";

export type AiActionId =
  | "removeBackground"
  | "editImage"
  | "imageVariation"
  | "denoise"
  | "captions"
  | "generateMusic"
  | "generateVoice"
  | "generateSfx"
  | "generateImage"
  | "eloRewrite"
  | "eloTranslate"
  | "eloShorten"
  | "eloAsk";

type AiCost = "free" | "paid" | "elo";

export type AiActionIcon = "cutout" | "edit" | "variation" | "denoise" | "captions" | "music" | "voice" | "sfx" | "image" | "rewrite" | "translate" | "shorten" | "elo";

export type AiBlockReason = "noElo" | "locked" | "loading" | "running" | "busy";

export interface AiActionDefinition {
  id: AiActionId;
  editors: readonly AiEditor[];
  kinds: readonly AiSubjectKind[];
  cost: AiCost;
  icon: AiActionIcon;
  job?: MediaKind;
  needsSource?: boolean;
  editsSubject?: boolean;
  elo?: boolean;
  shortcut?: string;
}

export interface AiActionSubject {
  editor: AiEditor;
  kind: AiSubjectKind;
  locked: boolean;
  hasSource: boolean;
  running: readonly AiActionId[];
  activeKinds: readonly MediaKind[];
  canAskElo: boolean;
}

export interface AiActionState {
  definition: AiActionDefinition;
  enabled: boolean;
  reason: AiBlockReason | null;
}

const BOTH: readonly AiEditor[] = ["image", "video"];
const ELEMENTS: readonly AiSubjectKind[] = ["image", "text", "shape", "group", "selection", "element", "video", "audio"];

export const AI_ACTIONS: readonly AiActionDefinition[] = [
  { id: "removeBackground", editors: BOTH, kinds: ["image"], cost: "free", icon: "cutout", job: "cutout", needsSource: true, editsSubject: true },
  { id: "editImage", editors: ["image"], kinds: ["image"], cost: "paid", icon: "edit", job: "image", needsSource: true },
  { id: "imageVariation", editors: ["image"], kinds: ["image"], cost: "paid", icon: "variation", job: "image", needsSource: true },
  { id: "denoise", editors: ["video"], kinds: ["audio"], cost: "free", icon: "denoise", job: "denoise", needsSource: true, editsSubject: true },
  { id: "captions", editors: ["video"], kinds: ["audio", "video"], cost: "free", icon: "captions", job: "captions", needsSource: true },
  { id: "generateMusic", editors: ["video"], kinds: ["audioLane"], cost: "paid", icon: "music", job: "music", editsSubject: true },
  { id: "generateVoice", editors: ["video"], kinds: ["audioLane"], cost: "paid", icon: "voice", job: "voice", editsSubject: true },
  { id: "generateSfx", editors: ["video"], kinds: ["audioLane"], cost: "paid", icon: "sfx", job: "sfx", editsSubject: true },
  { id: "generateImage", editors: ["video"], kinds: ["visualLane"], cost: "paid", icon: "image", job: "image", editsSubject: true },
  { id: "eloRewrite", editors: BOTH, kinds: ["text"], cost: "elo", icon: "rewrite", elo: true, editsSubject: true },
  { id: "eloTranslate", editors: BOTH, kinds: ["text"], cost: "elo", icon: "translate", elo: true, editsSubject: true },
  { id: "eloShorten", editors: BOTH, kinds: ["text"], cost: "elo", icon: "shorten", elo: true, editsSubject: true },
  { id: "eloAsk", editors: BOTH, kinds: ELEMENTS, cost: "elo", icon: "elo", elo: true },
];

function blockOf(definition: AiActionDefinition, subject: AiActionSubject): AiBlockReason | null {
  if (definition.elo && !subject.canAskElo) return "noElo";
  if (definition.editsSubject && subject.locked) return "locked";
  if (definition.needsSource && !subject.hasSource) return "loading";
  if (subject.running.includes(definition.id)) return "running";
  if (definition.job && !canStart(definition.job, subject.activeKinds)) return "busy";
  return null;
}

export function aiActionsFor(subject: AiActionSubject): AiActionState[] {
  return AI_ACTIONS.filter((definition) => definition.editors.includes(subject.editor) && definition.kinds.includes(subject.kind)).map((definition) => {
    const reason = blockOf(definition, subject);
    return { definition, enabled: reason === null, reason };
  });
}

function layerKind(layer: Layer): AiSubjectKind {
  if (layer.type === "image" || layer.type === "text" || layer.type === "shape") return layer.type;
  return "element";
}

export function imageSubjectKind(layers: readonly Layer[], pictures: number = layers.filter((layer) => layer.type === "image").length): AiSubjectKind | null {
  if (layers.length === 0) return null;
  if (pictures === 1) return "image";
  return layers.length > 1 ? "selection" : layerKind(layers[0]);
}

export function clipSubjectKind(clip: Clip, track: Pick<Track, "kind">, selected: number): AiSubjectKind {
  if (selected > 1) return "selection";
  if (clipImageSource(clip)) return "image";
  if (clip.type === "audio" || clip.type === "group") return clip.type;
  if (clip.type === "video") return track.kind === "visual" ? "video" : "element";
  if (clip.type === "overlay" && clip.layer) return layerKind(clip.layer);
  return "element";
}

export function laneSubjectKind(track: Pick<Track, "kind">): AiSubjectKind {
  return track.kind === "audio" ? "audioLane" : "visualLane";
}

const JOB_ACTIONS: Readonly<Record<string, AiActionId>> = { cutout: "removeBackground", edit: "editImage", denoise: "denoise", captions: "captions" };

export function runningActions(purposes: readonly string[]): AiActionId[] {
  return purposes.flatMap((purpose) => (Object.hasOwn(JOB_ACTIONS, purpose) ? [JOB_ACTIONS[purpose]] : []));
}

interface SubjectItem {
  id: string;
  label: string;
  kind: string;
}

const LISTED_ITEMS = 12;

export function subjectList(items: readonly SubjectItem[]): string {
  const listed = items.slice(0, LISTED_ITEMS).map((item) => `"${item.label}" (${item.kind}, id ${item.id})`);
  const rest = items.length - listed.length;
  return [...listed, ...(rest > 0 ? [`+${rest}`] : [])].join("; ");
}
