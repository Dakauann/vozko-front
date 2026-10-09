import type { StreamRequest } from "@/lib/studio/media/frame-stream";
import type { StreamEvent } from "@/lib/studio/media/stream-decoder";

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

export type MediaRequest = ({ stream: string } & ({ kind: "open"; blob: Blob } | { kind: "close" } | StreamRequest)) | StillRequest;

export type MediaEvent = ({ stream: string } & StreamEvent<VideoFrame>) | StillEvent;

export interface MediaPort {
  send(request: MediaRequest): void;
  listen(onEvent: (event: MediaEvent) => void, onBroken: () => void): void;
  close(): void;
}
