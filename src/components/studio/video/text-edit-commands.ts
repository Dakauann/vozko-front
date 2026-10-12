import type { Layer, VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { checkedDocument } from "@/lib/studio/selection-edit";
import type { StudioEditorStore } from "@/lib/studio/store";
import type { TextEdit } from "@/lib/studio/text-run-editing";
import { hasRuns, sameRuns } from "@/lib/studio/text-runs";
import { findClip, updateClip } from "@/lib/studio/timeline";

import type { PlaybackController } from "./playback-controller";
import type { VideoViewStore } from "./view-store";

export interface TextEditCommands {
  startTextEdit: (clipId: string) => boolean;
  styleClipText: (clipId: string, patch: Partial<Layer>) => boolean;
  finishTextEdit: (clipId: string, edit?: TextEdit) => boolean;
}

interface TextEditCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  playback: Pick<PlaybackController, "pause" | "seek">;
  apply: (operation: (doc: VideoDocument) => VideoDocument) => void;
}

export function createTextEditCommands({ store, view, playback, apply }: TextEditCommandDeps): TextEditCommands {
  const editableText = (clipId: string) => {
    const found = findClip(store.getState().document, clipId);
    return found && !found.track.locked && found.clip.layer?.type === "text" ? { clip: found.clip, layer: found.clip.layer } : null;
  };

  const commitLayer = (clipId: string, patch: Partial<Layer>): boolean => {
    const target = editableText(clipId);
    if (!target) return false;
    const doc = store.getState().document;
    const result = checkedDocument(doc, updateClip(doc, clipId, { layer: { ...target.layer, ...patch } }));
    if (!result.ok) return false;
    apply(() => result.document);
    return true;
  };

  return {
    startTextEdit: (clipId) => {
      const target = editableText(clipId);
      if (!target) return false;
      playback.pause();
      store.getState().select([clipId]);
      if (localTime(target.clip, view.getState().playheadMs) === null) playback.seek(target.clip.startMs);
      view.setState({ editingTextClipId: clipId });
      return true;
    },
    styleClipText: commitLayer,
    finishTextEdit: (clipId, edit) => {
      if (view.getState().editingTextClipId === clipId) view.setState({ editingTextClipId: null });
      const target = editableText(clipId);
      if (!edit || !target || target.clip.counter || edit.text.trim() === "") return false;
      if (edit.text === target.layer.text && sameRuns(edit.runs, target.layer.runs)) return false;
      return commitLayer(clipId, hasRuns(target.layer) || edit.runs ? { text: edit.text, runs: edit.runs } : { text: edit.text });
    },
  };
}
