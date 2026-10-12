import { blurredPlan } from "@/lib/studio/blurred-plan";
import type { TrackLevels } from "@/lib/studio/behaviors";
import { videoCanvasSize, type VideoDocument } from "@/lib/studio/document";
import { fitCamera, type Renderer } from "@/lib/studio/render/renderer";
import { videoSources, type Scene, type SceneVideo } from "@/lib/studio/scene/scene";
import { videoScene } from "@/lib/studio/scene/video-scene";

export const STALL_MS = 20_000;

export type FrameLoopOutcome = "complete" | "undecodable" | "stalled" | "lut_unavailable";

export class Wake {
  private waiter: ((woken: boolean) => void) | null = null;
  private pending = false;

  notify(): void {
    const waiter = this.waiter;
    this.waiter = null;
    if (waiter) waiter(true);
    else this.pending = true;
  }

  next(timeoutMs: number): Promise<boolean> {
    if (this.pending) {
      this.pending = false;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        resolve(false);
      }, timeoutMs);
      this.waiter = (woken) => {
        clearTimeout(timer);
        resolve(woken);
      };
    });
  }
}

export interface FrameLoopDeps {
  doc: VideoDocument;
  times: readonly number[];
  originMs?: number;
  viewWidth?: number;
  videos: { sync(clips: readonly SceneVideo[]): SceneVideo[]; ready(clips: readonly SceneVideo[]): boolean };
  renderer: Pick<Renderer, "render" | "busy" | "missingLuts">;
  wake: Wake;
  emit: (index: number) => Promise<void>;
  onProgress: (done: number, total: number) => void;
  stallMs?: number;
  levels?: TrackLevels;
}

export async function drawWhenReady(scene: Scene, deps: Pick<FrameLoopDeps, "videos" | "renderer" | "wake" | "stallMs" | "viewWidth">): Promise<FrameLoopOutcome> {
  const clips = videoSources(scene);
  const shown = clips.filter((clip) => clip.visible);
  const camera = fitCamera(scene, { width: deps.viewWidth ?? scene.width });
  for (;;) {
    if (deps.videos.sync(clips).length > 0) return "undecodable";
    deps.renderer.render([scene], camera);
    if (deps.renderer.missingLuts.size > 0) return "lut_unavailable";
    if (deps.videos.ready(shown) && !deps.renderer.busy) return "complete";
    if (!(await deps.wake.next(deps.stallMs ?? STALL_MS))) return "stalled";
  }
}

export function outputScale(doc: VideoDocument, viewWidth?: number): number {
  const { width } = videoCanvasSize(doc);
  return (viewWidth ?? width) / width;
}

export async function renderFrames(deps: FrameLoopDeps): Promise<FrameLoopOutcome> {
  const total = deps.times.length;
  for (let index = 0; index < total; index++) {
    const outcome = await drawWhenReady(videoScene(deps.doc, blurredPlan(deps.doc, (deps.originMs ?? 0) + deps.times[index], outputScale(deps.doc, deps.viewWidth), deps.levels)), deps);
    if (outcome !== "complete") return outcome;
    await deps.emit(index);
    deps.onProgress(index + 1, total);
  }
  return "complete";
}
