export const DEFAULT_SHEET_WIDTH = 480;
export const MIN_SHEET_WIDTH = 400;
export const MAX_SHEET_WIDTH = 640;
export const MIN_PAGE_WIDTH = 640;

export type SheetMode = "push" | "full";

export interface SheetLayout {
  mode: SheetMode;
  width: number;
}

export function sheetLayout(desired: number, viewportWidth: number, sidebarWidth: number): SheetLayout {
  const room = viewportWidth - sidebarWidth - MIN_PAGE_WIDTH;
  if (room < MIN_SHEET_WIDTH) return { mode: "full", width: viewportWidth };
  const max = Math.min(MAX_SHEET_WIDTH, room);
  return { mode: "push", width: Math.round(Math.min(Math.max(desired, MIN_SHEET_WIDTH), max)) };
}
