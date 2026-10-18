"use client";

import { useMemo, type DragEvent } from "react";

import { acceptLibraryDrag, findLibraryItem, takeDroppedItem, type ItemFinder } from "@/components/studio/library/drag";
import { videoCanvasSize } from "@/lib/studio/document";
import { AUDIO_CATEGORY_ID } from "@/lib/studio/library/builtin/sounds";
import { frameWithItem, framesItem, mediaClipAt } from "@/lib/studio/library/framing";
import { videoClips } from "@/lib/studio/library/instantiate";
import type { LibraryItem } from "@/lib/studio/library/model";

import type { LibraryAdapter } from "../library/library-panel";
import { useRecentItems } from "../library/recent-items";
import { useLibraryText } from "../library/use-library-text";
import { useVideoEditor } from "./editor-context";
import { useWorkspaceSounds } from "./library-sounds";
import { isGeneratedLayer } from "@/lib/studio/generated-layers";

interface VideoDropSpot {
  x?: number;
  y?: number;
  atMs?: number;
  trackId?: string;
}

interface VideoLibrary extends LibraryAdapter {
  insertAt: (item: LibraryItem, spot: VideoDropSpot) => boolean;
  find: ItemFinder;
}

export function useVideoLibrary(): VideoLibrary {
  const { store, view, commands } = useVideoEditor();
  const { locale, sample } = useLibraryText();
  const { remember } = useRecentItems();
  const sounds = useWorkspaceSounds();
  return useMemo(() => {
    const extras = new Map([[AUDIO_CATEGORY_ID, sounds]]);
    const find: ItemFinder = async (id) => sounds.find((item) => item.id === id) ?? findLibraryItem(id);
    const frameAt = (item: LibraryItem, spot: VideoDropSpot) => {
      const doc = store.getState().document;
      const under = (item.template.kind === "frame" || item.template.kind === "mockup") && spot.x !== undefined && spot.y !== undefined ? mediaClipAt(doc, spot.atMs ?? view.getState().playheadMs, spot.x, spot.y) : null;
      const framed = frameWithItem(doc, item, under ? [under] : store.getState().selection);
      if (!framed) return false;
      if (!framed.ok) {
        commands.notify(`framing.${framed.reason}`, "error");
        return false;
      }
      commands.apply(() => framed.document, framed.ids);
      remember(item.id);
      return true;
    };
    const insertAt = (item: LibraryItem, spot: VideoDropSpot) => {
      if (framesItem(item)) return frameAt(item, spot);
      const doc = store.getState().document;
      const box = spot.x !== undefined && spot.y !== undefined ? { x: spot.x, y: spot.y } : undefined;
      const clips = videoClips(item, { canvas: videoCanvasSize(doc), locale, text: sample, box, atMs: spot.atMs ?? view.getState().playheadMs, documentMs: doc.durationMs });
      const inserted = clips ? commands.insertLibrary(clips, spot.trackId) : false;
      if (inserted) remember(item.id);
      const generated = inserted ? clips?.find((clip) => clip.layer !== undefined && isGeneratedLayer(clip.layer)) : undefined;
      if (generated) view.setState({ dataEditorFor: generated.id });
      return inserted;
    };
    return { editor: "video" as const, insert: (item) => insertAt(item, {}), insertAt, extras, find };
  }, [store, view, commands, locale, sample, remember, sounds]);
}

export function frameDropSpot(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): VideoDropSpot {
  return rect.width > 0 && rect.height > 0 ? { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height } : {};
}

export function useVideoPreviewDrop(): { onDragOver: (event: DragEvent<HTMLElement>) => void; onDrop: (event: DragEvent<HTMLElement>) => void } {
  const library = useVideoLibrary();
  return useMemo(
    () => ({
      onDragOver: (event) => {
        acceptLibraryDrag(event);
      },
      onDrop: (event) => {
        const spot = frameDropSpot(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
        takeDroppedItem(event, (item) => library.insertAt(item, spot), library.find);
      },
    }),
    [library],
  );
}
