"use client";

import { kWeightingStages } from "@/lib/studio/audio-meter";
import { MOMENTARY_MS, peakOf, tailPower } from "@/lib/studio/live-meter";

const PEAK_WINDOW = 2048;
const LOUDNESS_WINDOW = 32768;
const STEREO = [0, 1] as const;

export interface StereoPeak {
  left: number;
  right: number;
}

export interface MeterFrame {
  master: StereoPeak & { power: number };
  tracks: Record<string, StereoPeak>;
}

export function stereoBus(context: BaseAudioContext): GainNode {
  const bus = context.createGain();
  bus.channelCount = 2;
  bus.channelCountMode = "explicit";
  bus.channelInterpretation = "speakers";
  return bus;
}

function analyser(context: BaseAudioContext, size: number): AnalyserNode {
  const node = context.createAnalyser();
  node.fftSize = size;
  return node;
}

export class PeakTap {
  private readonly analysers: AnalyserNode[];
  private readonly samples = new Float32Array(PEAK_WINDOW);

  constructor(context: BaseAudioContext, source: AudioNode) {
    const splitter = context.createChannelSplitter(2);
    source.connect(splitter);
    this.analysers = STEREO.map((channel) => {
      const node = analyser(context, PEAK_WINDOW);
      splitter.connect(node, channel);
      return node;
    });
  }

  read(): StereoPeak {
    const [left, right] = this.analysers.map((node) => {
      node.getFloatTimeDomainData(this.samples);
      return peakOf(this.samples);
    });
    return { left, right };
  }
}

export class LoudnessTap {
  private readonly analysers: AnalyserNode[];
  private readonly samples = new Float32Array(LOUDNESS_WINDOW);
  private readonly momentary: number;

  constructor(context: BaseAudioContext, source: AudioNode) {
    const splitter = context.createChannelSplitter(2);
    source.connect(splitter);
    const stages = kWeightingStages(context.sampleRate);
    this.momentary = Math.round((MOMENTARY_MS / 1000) * context.sampleRate);
    this.analysers = STEREO.map((channel) => {
      const filters = stages.map((stage) => context.createIIRFilter(stage.b, [1, ...stage.a]));
      splitter.connect(filters[0], channel);
      filters[0].connect(filters[1]);
      const node = analyser(context, LOUDNESS_WINDOW);
      filters[1].connect(node);
      return node;
    });
  }

  power(): number {
    return this.analysers.reduce((sum, node) => {
      node.getFloatTimeDomainData(this.samples);
      return sum + tailPower(this.samples, this.momentary);
    }, 0);
  }
}
