import { dtmfFrequencies, type SoundCue } from "./rules";

export type SoundName = SoundCue | "incomingCall";

export const SOUND_FILES: Record<SoundName, string> = {
    message: "/audio/message.mp3",
    incomingCall: "/audio/incoming-call.mp3",
    callConnected: "/audio/call-connected.mp3",
    callEnded: "/audio/call-ended.mp3",
};

const KEY_TONE_SECONDS = 0.12;
const KEY_TONE_LEVEL = 0.08;
const EDGE_SECONDS = 0.005;

type ContextFactory = () => AudioContext | null;
type Fetcher = (url: string) => Promise<ArrayBuffer>;

function browserContext(): AudioContext | null {
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
    return new window.AudioContext();
}

async function browserFetch(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`sound ${url} answered ${response.status}`);
    return response.arrayBuffer();
}

export class SoundPlayer {
    private context: AudioContext | null = null;
    private readonly buffers = new Map<SoundName, Promise<AudioBuffer | null>>();

    constructor(
        private readonly createContext: ContextFactory = browserContext,
        private readonly fetchSound: Fetcher = browserFetch,
    ) {}

    unlock(): void {
        const context = this.audio();
        if (context?.state === "suspended") void context.resume().catch(() => undefined);
    }

    play(name: SoundName, volume = 1): void {
        const context = this.audio();
        if (!context) return;
        void this.buffer(context, name).then((buffer) => {
            if (buffer) this.source(context, buffer, volume).start();
        });
    }

    loop(name: SoundName, volume = 1): () => void {
        const context = this.audio();
        let stopped = false;
        let source: AudioBufferSourceNode | null = null;
        if (context) {
            void this.buffer(context, name).then((buffer) => {
                if (!buffer || stopped) return;
                source = this.source(context, buffer, volume);
                source.loop = true;
                source.start();
            });
        }
        return () => {
            stopped = true;
            source?.stop();
            source = null;
        };
    }

    keyTone(key: string): void {
        const frequencies = dtmfFrequencies(key);
        const context = this.audio();
        if (!frequencies || !context) return;
        const start = context.currentTime;
        const end = start + KEY_TONE_SECONDS;
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(KEY_TONE_LEVEL, start + EDGE_SECONDS);
        envelope.gain.setValueAtTime(KEY_TONE_LEVEL, end - EDGE_SECONDS);
        envelope.gain.linearRampToValueAtTime(0, end);
        envelope.connect(context.destination);
        for (const frequency of frequencies) {
            const oscillator = context.createOscillator();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, start);
            oscillator.connect(envelope);
            oscillator.start(start);
            oscillator.stop(end);
        }
    }

    private audio(): AudioContext | null {
        this.context ??= this.createContext();
        return this.context;
    }

    private buffer(context: AudioContext, name: SoundName): Promise<AudioBuffer | null> {
        const cached = this.buffers.get(name);
        if (cached) return cached;
        const loading = this.fetchSound(SOUND_FILES[name])
            .then((data) => context.decodeAudioData(data))
            .catch(() => {
                this.buffers.delete(name);
                return null;
            });
        this.buffers.set(name, loading);
        return loading;
    }

    private source(context: AudioContext, buffer: AudioBuffer, volume: number): AudioBufferSourceNode {
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(context.destination);
        return source;
    }
}

export const soundPlayer = new SoundPlayer();
