import { vi } from "vitest";

export class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supportedTypes = new Set(["audio/webm; codecs=opus"]);
  static nextChunk: Blob = new Blob(["voice"], { type: "audio/webm" });
  static failConstruction: Error | null = null;
  static isTypeSupported(type: string) {
    return FakeMediaRecorder.supportedTypes.has(type);
  }

  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;
  readonly stream: MediaStream;
  readonly mimeType: string;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    if (FakeMediaRecorder.failConstruction) throw FakeMediaRecorder.failConstruction;
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "";
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: FakeMediaRecorder.nextChunk });
    void this.onstop?.();
  }
}

export class FakeAudioContext {
  static decodable = true;
  static instances: FakeAudioContext[] = [];
  closed = false;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createAnalyser() {
    return { fftSize: 0, frequencyBinCount: 4, getByteFrequencyData: (samples: Uint8Array) => samples.fill(64) };
  }

  createMediaStreamSource() {
    return { connect: () => undefined };
  }

  async decodeAudioData() {
    if (!FakeAudioContext.decodable) throw new DOMException("cannot decode", "EncodingError");
    return {
      numberOfChannels: 1,
      sampleRate: 8000,
      length: 2,
      getChannelData: () => new Float32Array([0, 0.5]),
    };
  }

  async close() {
    this.closed = true;
  }
}

export interface FakeMicrophone {
  track: { stop: ReturnType<typeof vi.fn> };
  getUserMedia: ReturnType<typeof vi.fn>;
}

export function grantedMicrophone(): FakeMicrophone {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }) as unknown as MediaStream);
  vi.stubGlobal("navigator", { ...globalThis.navigator, mediaDevices: { getUserMedia } });
  return { track, getUserMedia };
}

export function refusedMicrophone(failure: string): FakeMicrophone {
  const track = { stop: vi.fn() };
  const getUserMedia = vi.fn(() => Promise.reject(new DOMException("browser words", failure)));
  vi.stubGlobal("navigator", { ...globalThis.navigator, mediaDevices: { getUserMedia } });
  return { track, getUserMedia };
}

export function installFakeRecorder() {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.failConstruction = null;
  FakeMediaRecorder.nextChunk = new Blob(["voice"], { type: "audio/webm" });
  FakeAudioContext.instances = [];
  FakeAudioContext.decodable = true;
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("AudioContext", FakeAudioContext);
}
