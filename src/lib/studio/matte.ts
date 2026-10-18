import type { Clip } from "./document";
import { lumaOf } from "./luma-key";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export const MATTE_CHANNELS = ["alpha", "luma"] as const;
export type MatteChannel = (typeof MATTE_CHANNELS)[number];

export interface Matte {
  channel: MatteChannel;
  invert: boolean;
}

export interface MatteChange {
  on?: boolean;
  channel?: MatteChannel;
  invert?: boolean;
}

type MatteFields = Pick<Clip, "matte" | "matteChannel" | "matteInvert">;

export const PLAIN_MATTE: Matte = { channel: "alpha", invert: false };

export function isMatteChannel(value: unknown): value is MatteChannel {
  return (MATTE_CHANNELS as readonly unknown[]).includes(value);
}

export function isPlainMatte(matte: Matte): boolean {
  return matte.channel === PLAIN_MATTE.channel && matte.invert === PLAIN_MATTE.invert;
}

export function matteOf(clip: MatteFields): Matte | null {
  return clip.matte ? { channel: clip.matteChannel ?? PLAIN_MATTE.channel, invert: Boolean(clip.matteInvert) } : null;
}

export function mattePatch(matte: Matte | null): Pick<ClipPatch, "matte" | "matteChannel" | "matteInvert"> {
  return { matte: matte ? true : undefined, matteChannel: matte?.channel === "luma" ? "luma" : undefined, matteInvert: matte?.invert ? true : undefined };
}

export function changedMatte(current: Matte | null, change: MatteChange): Matte | null {
  if (change.on === false) return null;
  const from = current ?? PLAIN_MATTE;
  return { channel: change.channel ?? from.channel, invert: change.invert ?? from.invert };
}

export function matteIssue(clip: MatteFields): IssueCode | null {
  const channel = clip.matteChannel ?? "";
  if (channel !== "" && !isMatteChannel(channel)) return "unknown";
  if ((channel !== "" || clip.matteInvert) && !clip.matte) return "invalid";
  return null;
}

export function matteWeight(matte: Matte, premultiplied: readonly [number, number, number, number]): number {
  const covered = matte.channel === "luma" ? lumaOf([premultiplied[0], premultiplied[1], premultiplied[2]]) : premultiplied[3];
  return matte.invert ? 1 - covered : covered;
}
