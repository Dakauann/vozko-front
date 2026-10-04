"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Copy, LinkSimple } from "@/components/icons";
import { PLATE_TILE_CLASS, roleTheme } from "@/lib/workspace/role-theme";
import type { CustomRole } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const TILE_SIZE = {
  sm: { box: "h-6 w-6", glyph: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8", glyph: "h-4 w-4" },
  lg: { box: "h-10 w-10", glyph: "h-5 w-5" },
} as const;

export function RoleTile({
  presetKey,
  size = "md",
  className,
}: {
  presetKey?: string | null;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  const theme = roleTheme(presetKey);
  const Glyph = theme.icon;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex flex-shrink-0 items-center justify-center rounded-[--radius]",
        PLATE_TILE_CLASS[theme.plate],
        TILE_SIZE[size].box,
        className,
      )}
    >
      <Glyph className={TILE_SIZE[size].glyph} weight="fill" />
    </span>
  );
}

const HIGHLIGHT_LIMIT = 3;

export function useRolePresetCopy() {
  const t = useTranslations("roleBuilder");
  return React.useMemo(
    () => ({
      name(key: string, fallback?: string) {
        const path = `presets.${key}.name`;
        return t.has(path) ? t(path) : (fallback ?? key);
      },
      description(key: string, fallback?: string) {
        const path = `presets.${key}.description`;
        return t.has(path) ? t(path) : (fallback ?? "");
      },
      highlights(key: string, fallback: string[] = []) {
        const localized: string[] = [];
        for (let index = 0; index < HIGHLIGHT_LIMIT; index += 1) {
          const path = `presets.${key}.highlights.${index}`;
          if (!t.has(path)) break;
          localized.push(t(path));
        }
        return (localized.length > 0 ? localized : fallback).slice(0, HIGHLIGHT_LIMIT);
      },
    }),
    [t],
  );
}

export function RoleOriginMarker({
  role,
  presetName,
  className,
}: {
  role: Pick<CustomRole, "presetKey" | "linked">;
  presetName?: string;
  className?: string;
}) {
  const t = useTranslations("roleBuilder");
  const copy = useRolePresetCopy();
  if (!role.presetKey) return null;
  const preset = copy.name(role.presetKey, presetName);
  const Glyph = role.linked ? LinkSimple : Copy;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-2xs text-muted-foreground", className)}>
      <Glyph className="h-3 w-3 flex-shrink-0" aria-hidden />
      <span className="min-w-0 truncate">
        {role.linked ? t("linkedTo", { preset }) : t("basedOn", { preset })}
      </span>
    </span>
  );
}
