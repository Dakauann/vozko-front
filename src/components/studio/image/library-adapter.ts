"use client";

import { useMemo, type DragEvent } from "react";

import { acceptLibraryDrag, takeDroppedItem } from "@/components/studio/library/drag";
import { artboardAt, artboardById } from "@/lib/studio/artboards";
import type { ImageDocument } from "@/lib/studio/document";
import { imageContent } from "@/lib/studio/library/instantiate";
import { withStylePalette } from "@/lib/studio/chart";
import type { LibraryItem } from "@/lib/studio/library/model";
import type { LibraryBox } from "@/lib/studio/library/placement";
import { screenToWorld, type Point } from "@/lib/studio/viewport";

import type { LibraryAdapter } from "../library/library-panel";
import { useRecentItems } from "../library/recent-items";
import { useLibraryText } from "../library/use-library-text";
import { acceptPhotoDrag, takeDroppedPhoto } from "./photo-drag";
import { currentArtboard, useImageEditor } from "./editor-state";
import { isGeneratedLayer } from "@/lib/studio/generated-layers";

interface ImageDropSpot {
  artboardId: string;
  x: number;
  y: number;
}

interface ImageLibrary extends LibraryAdapter {
  insertAt: (item: LibraryItem, spot: ImageDropSpot | null) => boolean;
}

export function canvasDropSpot(doc: ImageDocument, world: Point): ImageDropSpot | null {
  const board = artboardAt(doc, world);
  return board ? { artboardId: board.id, x: (world.x - board.x) / board.canvas.width, y: (world.y - board.y) / board.canvas.height } : null;
}

export function useImageCanvasDrop(): { onDragOver: (event: DragEvent<HTMLElement>) => void; onDrop: (event: DragEvent<HTMLElement>) => void } {
  const { store, ui, commands } = useImageEditor();
  const library = useImageLibrary();
  return useMemo(
    () => ({
      onDragOver: (event) => {
        if (!acceptLibraryDrag(event)) acceptPhotoDrag(event);
      },
      onDrop: (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const world = screenToWorld(ui.getState().viewport, { x: event.clientX - rect.left, y: event.clientY - rect.top });
        const spot = canvasDropSpot(store.getState().document, world);
        const photo = takeDroppedPhoto(event);
        if (photo) {
          if (spot) void commands.placePhoto(photo, spot);
          return;
        }
        takeDroppedItem(event, (item) => library.insertAt(item, spot));
      },
    }),
    [store, ui, library, commands],
  );
}

export function useImageLibrary(): ImageLibrary {
  const { store, ui, commands } = useImageEditor();
  const { locale, sample, label } = useLibraryText();
  const { remember } = useRecentItems();
  return useMemo(() => {
    const place = (item: LibraryItem, artboardId: string, box?: LibraryBox) => {
      const doc = store.getState().document;
      const board = artboardById(doc, artboardId);
      const built = board ? imageContent(item, { canvas: board.canvas, locale, text: sample, box, name: label(item.label) }) : null;
      const content = built ? { ...built, layers: built.layers.map((layer) => withStylePalette(layer, doc.styles)) } : null;
      const ids = board && content ? commands.insertLibrary(content, board.id) : [];
      if (ids.length > 0) remember(item.id);
      const generatedAt = content?.layers.findIndex(isGeneratedLayer) ?? -1;
      if (generatedAt >= 0 && ids[generatedAt]) ui.setState({ dataEditorFor: ids[generatedAt] });
      return ids.length > 0;
    };
    const insert = (item: LibraryItem) => place(item, currentArtboard(store, ui).id);
    return {
      editor: "image" as const,
      insert,
      insertAt: (item, spot) => (spot ? place(item, spot.artboardId, { x: spot.x, y: spot.y }) : insert(item)),
    };
  }, [store, ui, commands, locale, sample, label, remember]);
}
