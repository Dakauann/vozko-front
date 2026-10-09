import type { VideoDocument } from "@/lib/studio/document";
import { exportFrameCount, exportFrameMs } from "@/lib/studio/export-encoding";
import { visualPlan } from "@/lib/studio/playback";
import { fitCamera, type Renderer } from "@/lib/studio/render/renderer";
import { videoSources, type Scene, type SceneVideo } from "@/lib/studio/scene/scene";
import { videoScene } from "@/lib/studio/scene/video-scene";

export const STALL_MS = 20_000;

export type FrameLoopOutcome = "complete" | "undecodable" | "stalled";

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
  videos: { sync(clips: readonly SceneVideo[]): SceneVideo[]; ready(clips: readonly SceneVideo[]): boolean };
  renderer: Pick<Renderer, "render" | "busy">;
  wake: Wake;
  emit: (index: number) => Promise<void>;
  onProgress: (done: number, total: number) => void;
  stallMs?: number;
}

async function drawWhenReady(scene: Scene, deps: FrameLoopDeps): Promise<FrameLoopOutcome> {
  const clips = videoSources(scene);
  const shown = clips.filter((clip) => clip.visible);
  const camera = fitCamera(scene, { width: scene.width });
  for (;;) {
    if (deps.videos.sync(clips).length > 0) return "undecodable";
    deps.renderer.render([scene], camera);
    if (deps.videos.ready(shown) && !deps.renderer.busy) return "complete";
    if (!(await deps.wake.next(deps.stallMs ?? STALL_MS))) return "stalled";
  }
}

export async function renderFrames(deps: FrameLoopDeps): Promise<FrameLoopOutcome> {
  const total = exportFrameCount(deps.doc.durationMs);
  for (let index = 0; index < total; index++) {
    const outcome = await drawWhenReady(videoScene(deps.doc, visualPlan(deps.doc, exportFrameMs(index))), deps);
    if (outcome !== "complete") return outcome;
    await deps.emit(index);
    deps.onProgress(index + 1, total);
  }
  return "complete";
}
