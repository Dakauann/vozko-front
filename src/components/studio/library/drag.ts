import type { DragEvent } from "react";

import { readyItem } from "@/lib/studio/library/instantiate";
import { LIBRARY_ID_PATTERN, type LibraryItem } from "@/lib/studio/library/model";

import { libraryItems } from "./registry";

export const LIBRARY_DRAG_TYPE = "application/x-vozko-studio-library";

export function carriesLibraryItem(data: DataTransfer): boolean {
  return data.types.includes(LIBRARY_DRAG_TYPE);
}

export function writeDraggedItem(data: DataTransfer, itemId: string): void {
  data.setData(LIBRARY_DRAG_TYPE, itemId);
  data.effectAllowed = "copy";
}

export function readDraggedItem(data: DataTransfer): string | null {
  const id = data.getData(LIBRARY_DRAG_TYPE).trim();
  return LIBRARY_ID_PATTERN.test(id) ? id : null;
}

export function acceptLibraryDrag(event: DragEvent<HTMLElement>): boolean {
  if (!carriesLibraryItem(event.dataTransfer)) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  return true;
}

export type ItemFinder = (id: string) => Promise<LibraryItem | undefined>;

export const findLibraryItem: ItemFinder = (id) => libraryItems().then((items) => items.get(id));

export function takeDroppedItem(event: DragEvent<HTMLElement>, place: (item: LibraryItem) => void, find: ItemFinder = findLibraryItem): boolean {
  const id = readDraggedItem(event.dataTransfer);
  if (!id) return false;
  event.preventDefault();
  void find(id).then(async (item) => {
    if (item && (await readyItem(item))) place(item);
  });
  return true;
}
