"use client";

import { limitPeaks } from "@/lib/studio/audio-limiter";
import type { VideoDocument } from "@/lib/studio/document";
import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE, exportSamples } from "@/lib/studio/export-encoding";
import { audioPlan } from "@/lib/studio/playback";

import { scheduleVoice } from "../audio-graph";

export async function mixdown(doc: VideoDocument, bufferOf: (assetId: string) => Promise<AudioBuffer | null>): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(EXPORT_CHANNELS, exportSamples(doc.durationMs), EXPORT_SAMPLE_RATE);
  const voices = audioPlan(doc, 0);
  const buffers = await Promise.all(voices.map((voice) => bufferOf(voice.assetId)));
  voices.forEach((voice, i) => {
    const buffer = buffers[i];
    if (buffer) scheduleVoice(context, context.destination, buffer, voice, voice.delayMs / 1000);
  });
  const rendered = await context.startRendering();
  limitPeaks(
    Array.from({ length: rendered.numberOfChannels }, (_, channel) => rendered.getChannelData(channel)),
    rendered.sampleRate,
  );
  return rendered;
}
