import type { DragEvent } from "react";

export const PHOTO_DRAG_TYPE = "application/x-vozko-studio-photo";

const MEDIA_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function writeDraggedPhoto(data: DataTransfer, mediaId: string): void {
  data.setData(PHOTO_DRAG_TYPE, mediaId);
  data.effectAllowed = "copy";
}

export function acceptPhotoDrag(event: DragEvent<HTMLElement>): boolean {
  if (!event.dataTransfer.types.includes(PHOTO_DRAG_TYPE)) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  return true;
}

export function takeDroppedPhoto(event: DragEvent<HTMLElement>): string | null {
  const id = event.dataTransfer.getData(PHOTO_DRAG_TYPE).trim();
  if (!MEDIA_ID.test(id)) return null;
  event.preventDefault();
  return id;
}
