"use client";

import { limitPeaks } from "@/lib/studio/audio-limiter";
import type { VideoDocument } from "@/lib/studio/document";
import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE, exportSamples } from "@/lib/studio/export-encoding";
import { audioPlan, soundAssetIds } from "@/lib/studio/playback";
import { filmSpan, spanLength, type TimeSpan } from "@/lib/studio/work-area";

import { scheduleVoice } from "../audio-graph";
import { analyzeBuffer, speechOfTriggers } from "../speech-analysis";

export function channelsOf(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
}

export async function mixdown(doc: VideoDocument, bufferOf: (assetId: string) => Promise<AudioBuffer | null>, span: TimeSpan = filmSpan(doc.durationMs)): Promise<AudioBuffer> {
  const rendered = await renderMix(doc, bufferOf, span);
  limitPeaks(channelsOf(rendered), rendered.sampleRate);
  return rendered;
}

export async function renderMix(doc: VideoDocument, bufferOf: (assetId: string) => Promise<AudioBuffer | null>, span: TimeSpan = filmSpan(doc.durationMs)): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(EXPORT_CHANNELS, exportSamples(spanLength(span)), EXPORT_SAMPLE_RATE);
  const loaded = new Map(await Promise.all(soundAssetIds(doc).map(async (id) => [id, await bufferOf(id)] as const)));
  const speech = await speechOfTriggers(doc, async (assetId) => {
    const buffer = loaded.get(assetId);
    return buffer ? analyzeBuffer(buffer) : null;
  });
  const sourceMs = (assetId: string) => {
    const buffer = loaded.get(assetId);
    return buffer ? buffer.duration * 1000 : undefined;
  };
  for (const voice of audioPlan(doc, span.startMs, { speech: (assetId) => speech.get(assetId), sourceMs })) {
    const buffer = loaded.get(voice.assetId);
    if (buffer) scheduleVoice(context, context.destination, buffer, voice, voice.delayMs / 1000);
  }
  return context.startRendering();
}
