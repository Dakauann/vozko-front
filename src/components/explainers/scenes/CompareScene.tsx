import { Check, Minus, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { SceneFrame, stagger } from "./scene-kit";

type CompareRow = { icon?: Icon; label: string };
type CompareSide = { label: string; rows: CompareRow[] };

function Panel({ side, active, index }: { side: CompareSide; active: boolean; index: number }) {
  return (
    <div className={cn("vz-wave-pop min-w-0 rounded-lg border bg-card p-2.5 shadow-sm", active ? "border-primary" : "border-border")} style={stagger(index)}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-muted-foreground/50")} />
        <span className={cn("truncate text-2xs font-semibold uppercase tracking-wide", active ? "text-foreground" : "text-muted-foreground")}>{side.label}</span>
      </div>
      <ul className="space-y-1.5">
        {side.rows.map((row, rowIndex) => {
          const Glyph = row.icon ?? (active ? Check : Minus);
          return (
            <li key={rowIndex} className="vz-wave-pop flex items-center gap-1.5" style={stagger(index + rowIndex + 1)}>
              <Glyph className={cn("h-3.5 w-3.5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
              <span className={cn("min-w-0 text-2xs leading-tight", active ? "text-foreground" : "text-muted-foreground")}>{row.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CompareScene({ off, on, label }: { off: CompareSide; on: CompareSide; label: string }) {
  return (
    <SceneFrame label={label}>
      <div className="grid grid-cols-2 gap-2.5">
        <Panel side={off} active={false} index={0} />
        <Panel side={on} active index={2} />
      </div>
    </SceneFrame>
  );
}
