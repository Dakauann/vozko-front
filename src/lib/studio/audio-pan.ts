import { GAIN_SAMPLE_MS, withoutFlatRuns, type GainPoint } from "./audio-gain";
import type { Clip, Track } from "./document";
import { KEYFRAME_RANGES, valueAt } from "./keyframes";
import type { IssueCode } from "./validate";

export const PAN_RANGE = KEYFRAME_RANGES.pan;

const QUARTER_TURN = Math.PI / 2;

interface ChannelGains {
  left: number;
  right: number;
}

function clampPan(pan: number): number {
  return Math.min(PAN_RANGE[1], Math.max(PAN_RANGE[0], pan));
}

function balance(pan: number): ChannelGains {
  const p = clampPan(pan);
  return { left: p > 0 ? Math.cos(p * QUARTER_TURN) : 1, right: p < 0 ? Math.cos(-p * QUARTER_TURN) : 1 };
}

function constantPower(pan: number): ChannelGains {
  const angle = ((clampPan(pan) + 1) * Math.PI) / 4;
  return { left: Math.SQRT2 * Math.cos(angle), right: Math.SQRT2 * Math.sin(angle) };
}

export function panGains(clipPan: number, trackPan: number, sourceChannels: number): ChannelGains {
  const clip = sourceChannels === 1 ? constantPower(clipPan) : balance(clipPan);
  const track = balance(trackPan);
  return { left: clip.left * track.left, right: clip.right * track.right };
}

export function clipPanAt(clip: Pick<Clip, "pan" | "keyframes">, localMs: number): number {
  const frames = clip.keyframes?.pan ?? [];
  return clampPan(frames.length === 0 ? (clip.pan ?? 0) : valueAt(frames, localMs));
}

export function panPoints(clip: Pick<Clip, "pan" | "keyframes">, fromLocalMs: number, toLocalMs: number): GainPoint[] {
  if ((clip.keyframes?.pan ?? []).length === 0) return [{ atMs: 0, value: clipPanAt(clip, fromLocalMs) }];
  const points: GainPoint[] = [];
  for (let local = fromLocalMs; ; local = Math.min(local + GAIN_SAMPLE_MS, toLocalMs)) {
    points.push({ atMs: local - fromLocalMs, value: clipPanAt(clip, local) });
    if (local >= toLocalMs) break;
  }
  return withoutFlatRuns(points);
}

export function isCentered(clip: Pick<Clip, "pan" | "keyframes">, track: Pick<Track, "pan">): boolean {
  return (clip.pan ?? 0) === 0 && (clip.keyframes?.pan ?? []).length === 0 && (track.pan ?? 0) === 0;
}

export function panInRange(pan: number): boolean {
  return Number.isFinite(pan) && pan >= PAN_RANGE[0] && pan <= PAN_RANGE[1];
}

function panRangeIssue(pan: number | undefined): IssueCode | null {
  return pan === undefined || panInRange(pan) ? null : "out_of_range";
}

export function trackPanIssue(track: Pick<Track, "kind" | "pan">): IssueCode | null {
  if ((track.pan ?? 0) !== 0 && track.kind !== "audio") return "invalid";
  return panRangeIssue(track.pan);
}

export function clipPanIssue(clip: Pick<Clip, "type" | "pan">): IssueCode | null {
  if ((clip.pan ?? 0) !== 0 && clip.type !== "audio") return "invalid";
  return panRangeIssue(clip.pan);
}
