"use client";

import { useTranslations } from "next-intl";

import { Sparkle, Square, TextT, UploadSimple, type Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { Hint } from "./controls";
import { PANEL_IDS, useEditorUi, useImageEditor, type PanelId } from "./editor-state";
import { AiPanel } from "./panels/ai-panel";
import { ElementsPanel } from "./panels/elements-panel";
import { TextPanel } from "./panels/text-panel";
import { UploadsPanel } from "./panels/uploads-panel";

const RAIL_ICONS: Record<PanelId, Icon> = { text: TextT, elements: Square, uploads: UploadSimple, ai: Sparkle };

const PANELS: Record<PanelId, () => React.JSX.Element> = { text: TextPanel, elements: ElementsPanel, uploads: UploadsPanel, ai: AiPanel };

export function SideRail() {
  const t = useTranslations("studio.image.rail");
  const { ui } = useImageEditor();
  const panel = useEditorUi((s) => s.panel);
  const Panel = panel ? PANELS[panel] : null;

  return (
    <div className="flex h-full min-h-0 shrink-0" data-tour="studio-image-panels">
      <nav aria-label={t("label")} className="flex w-[72px] shrink-0 flex-col gap-1 border-r border-border bg-card px-1 py-1.5">
        {PANEL_IDS.map((id) => {
          const RailIcon = RAIL_ICONS[id];
          const active = panel === id;
          return (
            <Hint key={id} label={t(id)} side="right">
              <button
                type="button"
                aria-pressed={active}
                aria-controls="studio-image-panel"
                onClick={() => ui.setState({ panel: active ? null : id })}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[--radius] px-0.5 py-1.5 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))] [--icon-accent:currentColor]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <RailIcon className="h-[18px] w-[18px]" aria-hidden />
                <span className="w-full truncate text-center">{t(id)}</span>
              </button>
            </Hint>
          );
        })}
      </nav>
      {Panel ? (
        <section id="studio-image-panel" aria-label={t(panel as PanelId)} className="w-64 shrink-0 overflow-y-auto border-r border-border bg-card p-3 max-xl:w-60">
          <Panel />
        </section>
      ) : null}
    </div>
  );
}
