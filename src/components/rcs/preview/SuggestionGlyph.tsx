import { ArrowSquareOut, CalendarBlank, ChatText, Globe, MapPin, Phone, type Icon } from "@/components/icons";
import { buttonActionOf, type RcsButtonAction } from "@/lib/rcs/buttons";
import type { RcsSuggestion } from "@/lib/rcs/types";
import { cn } from "@/lib/utils";

export const ACTION_GLYPHS: Record<RcsButtonAction, Icon> = {
  reply: ChatText,
  open_url: ArrowSquareOut,
  webview: Globe,
  dial: Phone,
  view_location: MapPin,
  calendar: CalendarBlank,
};

export function ActionGlyph({ action, className }: { action: RcsButtonAction; className?: string }) {
  const Glyph = ACTION_GLYPHS[action];
  return <Glyph aria-hidden className={cn("h-4 w-4 shrink-0", className)} />;
}

export function SuggestionGlyph({ suggestion, className }: { suggestion: RcsSuggestion; className?: string }) {
  return <ActionGlyph action={buttonActionOf(suggestion)} className={className} />;
}
