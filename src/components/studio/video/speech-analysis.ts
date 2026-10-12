"use client";

import { analyzeSpeech, triggerAssetIds, type SpeechAnalysis } from "@/lib/studio/ducking";
import type { VideoDocument } from "@/lib/studio/document";

export function analyzeBuffer(buffer: AudioBuffer): SpeechAnalysis {
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / buffer.numberOfChannels;
  }
  return analyzeSpeech(mono, buffer.sampleRate);
}

export async function speechOfTriggers(doc: VideoDocument, analysis: (assetId: string) => Promise<SpeechAnalysis | null>): Promise<Map<string, SpeechAnalysis>> {
  const ids = triggerAssetIds(doc);
  const analyses = await Promise.all(ids.map(analysis));
  return new Map(ids.flatMap((id, i) => (analyses[i] ? [[id, analyses[i]] as const] : [])));
}
