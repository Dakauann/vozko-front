import { canvasAspect, msOfFrame, type Clip, type VideoDocument } from "@/lib/studio/document";
import { relatedKeys, shiftedKeys, type RelatedKeys } from "@/lib/studio/focus-lanes";
import { easeKeySides, reverseKeys, roveKeys, setKeysVelocity, setSmooth, stretchKeys, type EaseSides, type KeyEdit, type StretchAnchor, type VelocityChange, type VelocityRefusal } from "@/lib/studio/keyframe-ease";
import { localTime, momentKeys } from "@/lib/studio/keyframe-edit";
import { moveKeyframes, type Keyframes, type KeyRef } from "@/lib/studio/keyframes";
import type { StudioEditorStore } from "@/lib/studio/store";
import { findClip, updateClip } from "@/lib/studio/timeline";

import type { KeyDialog, NoticeTone, VideoViewStore } from "./view-store";

export interface KeyCommands {
  easeSides: (sides: EaseSides) => void;
  setKeyVelocity: (change: VelocityChange) => VelocityRefusal | null;
  smoothKeys: (smooth: boolean) => void;
  reverseKeys: () => void;
  stretchKeys: (ratio: number, anchor: StretchAnchor) => boolean;
  roveKeys: () => void;
  nudgeKeysOrJumpMarker: (direction: 1 | -1, frames: 1 | 10) => void;
  selectRelatedKeys: (mode: RelatedKeys) => void;
  openKeyDialog: (dialog: KeyDialog | null) => void;
}

interface KeyCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  notify: (key: string, tone?: NoticeTone) => void;
  jumpMarker: (direction: 1 | -1) => void;
}

interface KeyTarget {
  clip: Clip;
  keys: KeyRef[];
  selected: boolean;
}

export function keyTarget(doc: VideoDocument, view: VideoViewStore, selection: readonly string[], allowMoment: boolean): KeyTarget | null {
  const { focus, selectedKeys, playheadMs } = view.getState();
  const focused = focus ? findClip(doc, focus.clipId)?.clip : undefined;
  if (focused && selectedKeys.length > 0) return { clip: focused, keys: selectedKeys, selected: true };
  if (!allowMoment) return null;
  const clip = selection.length === 1 ? findClip(doc, selection[0])?.clip : undefined;
  const local = clip ? localTime(clip, playheadMs) : null;
  const keys = clip && local !== null ? momentKeys(clip, local) : [];
  return clip && keys.length > 0 ? { clip, keys, selected: false } : null;
}

export function createKeyCommands({ store, view, notify, jumpMarker }: KeyCommandDeps): KeyCommands {
  const state = () => store.getState();
  const target = (allowMoment: boolean) => keyTarget(state().document, view, state().selection, allowMoment);
  const write = (clip: Clip, keyframes: Keyframes | undefined): boolean => {
    if (findClip(state().document, clip.id)?.track.locked) {
      notify("clipLocked", "error");
      return false;
    }
    if (keyframes !== clip.keyframes) state().apply((doc) => updateClip(doc, clip.id, { keyframes }));
    return true;
  };
  const selectedOrNotify = () => {
    const found = target(false);
    if (!found) notify("keys.select");
    return found;
  };
  const moved = (found: KeyTarget, edit: KeyEdit | null): boolean => {
    if (!edit) {
      notify("keys.blocked", "error");
      return false;
    }
    if (!write(found.clip, edit.keyframes)) return false;
    view.setState({ selectedKeys: edit.keys });
    return true;
  };

  return {
    easeSides: (sides) => {
      const found = target(true);
      const eased = found ? easeKeySides(found.clip.keyframes, found.keys, sides) : null;
      if (!found || !eased || eased.applied === 0) notify("noKeysToEase");
      else write(found.clip, eased.keyframes);
    },
    setKeyVelocity: (change) => {
      const found = target(true);
      if (!found) return { kind: "noSide" };
      const result = setKeysVelocity(found.clip.keyframes, found.keys, change, canvasAspect(state().document));
      if (!result.ok) return result.refusal;
      write(found.clip, result.keyframes);
      return null;
    },
    smoothKeys: (smooth) => {
      const found = target(true);
      if (!found) notify("keys.select");
      else write(found.clip, setSmooth(found.clip.keyframes, found.keys, smooth));
    },
    reverseKeys: () => {
      const found = selectedOrNotify();
      if (found) moved(found, reverseKeys(found.clip.keyframes ?? {}, found.keys));
    },
    stretchKeys: (ratio, anchor) => {
      const found = selectedOrNotify();
      return found ? moved(found, stretchKeys(found.clip.keyframes ?? {}, found.keys, ratio, anchor)) : false;
    },
    roveKeys: () => {
      const found = selectedOrNotify();
      if (!found) return;
      const edit = roveKeys(found.clip.keyframes ?? {}, found.keys, canvasAspect(state().document));
      if (edit && edit.keyframes === found.clip.keyframes) notify("keys.still");
      else moved(found, edit);
    },
    nudgeKeysOrJumpMarker: (direction, frames) => {
      const found = target(false);
      if (!found) {
        jumpMarker(direction);
        return;
      }
      const delta = msOfFrame(direction * frames);
      const keyframes = moveKeyframes(found.clip.keyframes, found.keys, delta);
      if (keyframes === found.clip.keyframes) notify("keys.blocked", "error");
      else if (write(found.clip, keyframes)) view.setState({ selectedKeys: shiftedKeys(found.keys, delta) });
    },
    selectRelatedKeys: (mode) => {
      const found = selectedOrNotify();
      if (found) view.setState({ selectedKeys: relatedKeys(found.clip.keyframes, found.keys, mode) });
    },
    openKeyDialog: (dialog) => {
      if (dialog !== null && !target(dialog === "velocity")) {
        notify("keys.select");
        return;
      }
      view.setState({ keyDialog: dialog });
    },
  };
}
