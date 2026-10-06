"use client";

import { rulerTicks } from "@/lib/studio/viewport";

import { useEditorUi } from "../editor-state";

export const RULER_PX = 20;

export function Rulers() {
  const on = useEditorUi((s) => s.rulers);
  const viewport = useEditorUi((s) => s.viewport);
  const container = useEditorUi((s) => s.container);
  if (!on || !container) return null;
  const across = rulerTicks(viewport.scale, viewport.x, container.width);
  const down = rulerTicks(viewport.scale, viewport.y, container.height);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none text-2xs tabular-nums text-muted-foreground">
      <div className="absolute inset-x-0 top-0 overflow-hidden border-b border-border bg-card/95" style={{ height: RULER_PX }}>
        {across.map((tick) => (
          <span key={tick.value} className="absolute top-0 h-full border-l border-border pl-0.5 leading-[18px]" style={{ left: tick.screen }}>
            {tick.value}
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 overflow-hidden border-r border-border bg-card/95" style={{ width: RULER_PX }}>
        {down.map((tick) => (
          <span
            key={tick.value}
            className="absolute left-0 w-full border-t border-border pt-0.5 text-center leading-none [writing-mode:vertical-rl]"
            style={{ top: tick.screen }}
          >
            {tick.value}
          </span>
        ))}
      </div>
      <div className="absolute left-0 top-0 border-b border-r border-border bg-card" style={{ width: RULER_PX, height: RULER_PX }} />
    </div>
  );
}
