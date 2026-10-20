import { joinedEdges, type GroupPosition } from "@/lib/conversations/thread-rows";
import { cn } from "@/lib/utils";

export function bubbleCorners(position: GroupPosition, outgoing: boolean): string {
  const joined = joinedEdges(position);
  if (outgoing) return cn(joined.top && "rounded-tr-sm", joined.bottom && "rounded-br-sm");
  return cn(joined.top && "rounded-tl-sm", joined.bottom && "rounded-bl-sm");
}
