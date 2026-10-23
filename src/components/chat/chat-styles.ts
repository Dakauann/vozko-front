import { bubbleCorners } from "@/components/crm/thread/bubble-corners";
import { joinedEdges, type GroupPosition } from "@/lib/chat/message-groups";
import { cn } from "@/lib/utils";

export const CHAT_HEADER = "flex items-center gap-1 border-b border-border py-2 pl-2 pr-2";

export const CHAT_HEADER_TITLE = "truncate text-sm font-semibold leading-5 text-foreground";

export const CHAT_HEADER_SUBTITLE = "truncate text-2xs text-muted-foreground";

export const CHAT_ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export const CHAT_CANVAS = "h-full overflow-y-auto overscroll-contain bg-muted";

export const CHAT_CANVAS_BODY = "px-3 pb-4 pt-1";

export const CHAT_LOAD_OLDER =
  "rounded-[--radius] px-3 py-1 text-2xs font-semibold text-muted-foreground hover:bg-accent-hover hover:text-foreground disabled:opacity-60";

export const CHAT_EMPTY ="py-10 text-center text-xs text-muted-foreground";

export const CHAT_BUBBLE = "relative max-w-[78%] rounded-lg px-3 py-2 shadow-sm";

export const CHAT_BUBBLE_OWN = "bg-foreground text-background";

export const CHAT_BUBBLE_OTHER = "border border-border bg-card text-foreground";

export const CHAT_OWN_CONTENT = "vz-inverse text-foreground";

export const CHAT_AUTHOR = "mb-0.5 text-2xs font-semibold text-foreground";

export const CHAT_SYSTEM_ROW = "flex justify-center py-1.5";

export const CHAT_SYSTEM_LINE = "max-w-[90%] rounded-lg border border-dashed border-border-strong bg-card/70 px-3 py-1 text-center text-2xs text-muted-foreground";

export const CHAT_COMPOSER_PANEL = "mx-2 mt-2 rounded-[--radius] border border-border bg-card px-3 shadow-sm sm:mx-3";

export function chatRowClass(own: boolean, position: GroupPosition): string {
  return cn("group/msg relative flex items-center gap-1", own ? "justify-end" : "justify-start", joinedEdges(position).top ? "pt-[1px]" : "pt-1.5");
}

export function chatBubbleClass(own: boolean, position: GroupPosition): string {
  return cn(CHAT_BUBBLE, own ? CHAT_BUBBLE_OWN : CHAT_BUBBLE_OTHER, bubbleCorners(position, own));
}

export function chatMetaClass(own: boolean): string {
  return cn("mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums", own ? "text-background/65" : "text-muted-foreground");
}
