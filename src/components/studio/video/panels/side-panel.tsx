"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useTranslations } from "next-intl";

import { ChatText, ImageSquare, Sparkle, TextT, Waveform, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useVideoEditor, useViewState } from "../editor-context";
import type { PanelId } from "../view-store";
import { AiPanel } from "./ai-panel";
import { CaptionsPanel } from "./captions-panel";
import { ElementsPanel } from "./elements-panel";
import { MediaPanel } from "./media-panel";
import { ProcessPanel } from "./process-panel";

const PANELS: { id: PanelId; icon: Icon; tour: string }[] = [
  { id: "media", icon: ImageSquare, tour: "studio-video-media" },
  { id: "ai", icon: Sparkle, tour: "studio-video-ai" },
  { id: "elements", icon: TextT, tour: "studio-video-elements" },
  { id: "captions", icon: ChatText, tour: "studio-video-captions" },
  { id: "process", icon: Waveform, tour: "studio-video-process" },
];

export function SidePanel() {
  const t = useTranslations("studio.video.panels");
  const { view } = useVideoEditor();
  const panel = useViewState((s) => s.panel);

  return (
    <TabsPrimitive.Root
      value={panel}
      onValueChange={(value) => view.setState({ panel: value as PanelId })}
      orientation="vertical"
      className="flex h-full w-full min-w-0 bg-card"
    >
      <TabsPrimitive.List aria-label={t("label")} className="flex w-20 shrink-0 flex-col gap-1 border-r border-border p-1">
        {PANELS.map(({ id, icon: Glyph, tour }) => (
          <TabsPrimitive.Trigger
            key={id}
            value={id}
            data-tour={tour}
            className={cn(
              "flex flex-col items-center gap-1 rounded-[--radius] px-1 py-1.5 text-2xs font-medium text-muted-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-button-primary data-[state=active]:hover:bg-[hsl(var(--primary-hover))]",
            )}
          >
            <Glyph className="h-[18px] w-[18px]" aria-hidden />
            <span className="max-w-full truncate leading-tight">{t(`tabs.${id}`)}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {PANELS.map(({ id }) => (
        <TabsPrimitive.Content key={id} value={id} forceMount className="min-w-0 flex-1 overflow-y-auto focus-visible:outline-none data-[state=inactive]:hidden">
          <h2 className="border-b border-border px-3 py-2.5 text-xs font-semibold text-foreground">{t(`titles.${id}`)}</h2>
          {id === "media" ? <MediaPanel /> : null}
          {id === "ai" ? <AiPanel /> : null}
          {id === "elements" ? <ElementsPanel /> : null}
          {id === "captions" ? <CaptionsPanel /> : null}
          {id === "process" ? <ProcessPanel /> : null}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
