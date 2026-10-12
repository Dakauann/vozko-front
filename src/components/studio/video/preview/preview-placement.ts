import type { CanvasSize } from "@/lib/studio/document";
import { followViewport, placeFrame, type FramePlacement, type Viewport } from "@/lib/studio/viewport";

import type { VideoViewState } from "../view-store";

type PlacementState = Pick<VideoViewState, "previewFit" | "previewViewport" | "previewContainer">;

export function previewViewportOf(state: PlacementState, canvas: CanvasSize): Viewport {
  return followViewport(state.previewFit, state.previewViewport, state.previewContainer, { left: 0, top: 0, right: canvas.width, bottom: canvas.height });
}

export function previewPlacement(state: PlacementState, canvas: CanvasSize): FramePlacement | null {
  if (!state.previewContainer) return null;
  return placeFrame(previewViewportOf(state, canvas), canvas, state.previewContainer);
}
