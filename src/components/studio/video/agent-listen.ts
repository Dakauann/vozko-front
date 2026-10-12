"use client";

import { limitPeaks } from "@/lib/studio/audio-limiter";
import { ceilingHits, integratedLoudness, kWeighted, levelsBetween } from "@/lib/studio/audio-meter";
import { audibleTrackIds, listenReport, stemDocument, windowSpans, type ListenPlan, type ListenReadout, type MeasuredMix, type MeasuredStem } from "@/lib/studio/agent/listen";
import type { VideoDocument } from "@/lib/studio/document";
import { DUCKING_DEFAULTS, mergeRegions, speechRegions, type TimeRegion } from "@/lib/studio/ducking";
import { EXPORT_SAMPLE_RATE } from "@/lib/studio/export-encoding";

import { decodeAudioFile } from "./audio-graph";
import { channelsOf, renderMix } from "./export/audio-mixdown";
import { analyzeBuffer } from "./speech-analysis";

type Plan = Extract<ListenPlan, { ok: true }>;

export type Heard = ListenReadout & { unreadable_clips?: string[] };

function sampleOf(ms: number, rate: number): number {
  return Math.round((ms * rate) / 1000);
}

function measured(buffer: AudioBuffer, plan: Plan): { integrated: number | null; windows: MeasuredMix["windows"] } {
  const channels = channelsOf(buffer);
  const weighted = channels.map((channel) => kWeighted(channel, buffer.sampleRate));
  const from = sampleOf(plan.fromMs, buffer.sampleRate);
  const to = sampleOf(plan.toMs, buffer.sampleRate);
  return {
    integrated: integratedLoudness(
      weighted.map((channel) => channel.subarray(from, to)),
      buffer.sampleRate,
    ),
    windows: windowSpans(plan).map((span) => levelsBetween(channels, weighted, buffer.sampleRate, span.fromMs, span.toMs)),
  };
}

function limiterMs(buffer: AudioBuffer, spans: readonly TimeRegion[]): number[] {
  const channels = channelsOf(buffer);
  return spans.map((span) => (ceilingHits(channels, sampleOf(span.fromMs, buffer.sampleRate), sampleOf(span.toMs, buffer.sampleRate)) * 1000) / buffer.sampleRate);
}

function clipsOfAssets(doc: VideoDocument, assetIds: ReadonlySet<string>): string[] {
  return doc.tracks.flatMap((track) => (track.kind === "audio" ? track.clips.filter((clip) => clip.assetId && assetIds.has(clip.assetId)).map((clip) => clip.id) : []));
}

export async function listenTo(doc: VideoDocument, plan: Plan): Promise<Heard> {
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  const unreadable = new Set<string>();
  const bufferOf = (assetId: string) => {
    const cached = decoded.get(assetId);
    if (cached) return cached;
    const loading = decodeAudioFile(assetId, EXPORT_SAMPLE_RATE).then((buffer) => {
      if (!buffer) unreadable.add(assetId);
      return buffer;
    });
    decoded.set(assetId, loading);
    return loading;
  };
  const spans = windowSpans(plan);
  const mixed = await renderMix(doc, bufferOf);
  const limited = limiterMs(mixed, spans);
  limitPeaks(channelsOf(mixed), mixed.sampleRate);
  const mix: MeasuredMix = { ...measured(mixed, plan), limiterMs: limited };
  const stems: MeasuredStem[] = [];
  let speech: TimeRegion[] = [];
  for (const trackId of audibleTrackIds(doc)) {
    const stem = await renderMix(stemDocument(doc, trackId), bufferOf);
    const name = doc.tracks.find((track) => track.id === trackId)?.name;
    stems.push({ trackId, ...(name ? { name } : {}), ...measured(stem, plan) });
    if (plan.voiceTrackIds.includes(trackId)) speech = [...speech, ...speechRegions(analyzeBuffer(stem), DUCKING_DEFAULTS.sensitivity, DUCKING_DEFAULTS.holdMs)];
  }
  const report = listenReport({ plan, mix, stems, speech: mergeRegions(speech, DUCKING_DEFAULTS.holdMs) });
  const missing = clipsOfAssets(doc, unreadable);
  return missing.length > 0 ? { ...report, unreadable_clips: missing } : report;
}
