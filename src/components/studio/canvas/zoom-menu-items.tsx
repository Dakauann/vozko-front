"use client";

import { DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ZOOM_MENU_PRESETS } from "@/lib/studio/viewport";

export function zoomPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export function ZoomMenuItems({ fit, fitLabel, onFit, onZoom }: { fit: boolean; fitLabel: string; onFit: () => void; onZoom: (scale: number) => void }) {
  return (
    <>
      <DropdownMenuCheckboxItem checked={fit} onSelect={onFit}>
        {fitLabel}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      {ZOOM_MENU_PRESETS.map((preset) => (
        <DropdownMenuItem key={preset} onSelect={() => onZoom(preset)}>
          {zoomPercent(preset)}
        </DropdownMenuItem>
      ))}
    </>
  );
}
