"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CaretDown, Heat, Layers, MapPin } from "@/components/icons";
import { MAP_FLOATY } from "@/components/maps/map-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { NO_COLOUR } from "@/lib/leads/map-view";
import type { MapLayerMode } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

export interface MapLayerBarProps {
  mode: MapLayerMode;
  onModeChange: (mode: MapLayerMode) => void;
  fields: readonly CustomFieldDefinition[];
  colourKey: string | undefined;
  onColourChange: (key: string) => void;
  children?: ReactNode;
  className?: string;
}

const DIVIDER = <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border-strong" />;

export function MapLayerBar({ mode, onModeChange, fields, colourKey, onColourChange, children, className }: MapLayerBarProps) {
  const t = useTranslations("leadMap");
  const current = fields.find((field) => field.key === colourKey);
  const currentLabel = current?.label ?? t("colorBy.none");

  return (
    <div className={cn("flex flex-wrap items-center gap-2 p-1", MAP_FLOATY, className)}>
      <ElevatedPillToggle<MapLayerMode>
        bare
        size="md"
        aria-label={t("layerMode.label")}
        value={mode}
        onChange={onModeChange}
        collapseLabels="sm"
        options={[
          { value: "heat", label: t("layerMode.heat"), icon: <Heat size={14} aria-hidden="true" /> },
          { value: "points", label: t("layerMode.points"), icon: <MapPin size={14} aria-hidden="true" /> },
          { value: "districts", label: t("layerMode.districts"), icon: <Layers size={14} aria-hidden="true" /> },
        ]}
      />
      {fields.length > 0 ? (
        <>
          {DIVIDER}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${t("colorBy.label")}: ${currentLabel}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="max-sm:sr-only">{t.rich("colorBy.trigger", { field: currentLabel, b: (chunks) => <b className="font-semibold">{chunks}</b> })}</span>
              <CaretDown size={12} aria-hidden="true" className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup value={colourKey ?? NO_COLOUR} onValueChange={onColourChange}>
                <DropdownMenuRadioItem value={NO_COLOUR}>{t("colorBy.none")}</DropdownMenuRadioItem>
                {fields.map((field) => (
                  <DropdownMenuRadioItem key={field.key} value={field.key}>
                    {field.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
      {children ? (
        <>
          {DIVIDER}
          {children}
        </>
      ) : null}
    </div>
  );
}
