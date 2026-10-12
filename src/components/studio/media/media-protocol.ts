import type { StreamRequest } from "@/lib/studio/media/frame-stream";
import type { StreamEvent } from "@/lib/studio/media/stream-decoder";
import type { BoxTrackRequest } from "@/lib/studio/point-track";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";

export interface StillRequest {
  kind: "still";
  id: string;
  file: string;
  blob: Blob;
  seconds: number;
  heightPx: number;
}

export interface StillEvent {
  kind: "still";
  id: string;
  image: Blob | null;
  decodable: boolean;
}

export interface TrackRequest {
  kind: "track";
  id: string;
  blob: Blob;
  request: BoxTrackRequest;
}

export type TrackEvent = { kind: "track-progress"; id: string; done: number } | { kind: "track-done"; id: string; outcome: TrackOutcome };

export type MediaRequest = ({ stream: string } & ({ kind: "open"; blob: Blob } | { kind: "close" } | StreamRequest)) | StillRequest | TrackRequest | { kind: "track-cancel"; id: string };

export type MediaEvent = ({ stream: string } & StreamEvent<VideoFrame>) | StillEvent | TrackEvent;

export interface MediaPort {
  send(request: MediaRequest): void;
  listen(onEvent: (event: MediaEvent) => void, onBroken: () => void): void;
  close(): void;
}
