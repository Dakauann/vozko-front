"use client";

import { useTranslations } from "next-intl";

import { ChatCircle } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { WidgetPosition } from "@/lib/webchat/types";

function readableOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(value)) return "#FFFFFF";
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111827" : "#FFFFFF";
}

export function WebchatPreview({
  name,
  accentColor,
  position,
  launcherLabel,
  welcomeTitle,
  welcomeMessage,
  teamName,
  assistantName,
}: {
  name: string;
  accentColor: string;
  position: WidgetPosition;
  launcherLabel: string;
  welcomeTitle: string;
  welcomeMessage: string;
  teamName: string;
  assistantName: string;
}) {
  const t = useTranslations("webchat.preview");
  const ink = readableOn(accentColor);
  const alignEnd = position === "right";

  return (
    <figure className="space-y-2" aria-label={t("label")}>
      <figcaption className="text-xs font-medium text-muted-foreground">{t("label")}</figcaption>
      <div className="flex h-[22rem] flex-col justify-end gap-3 rounded-lg border border-border bg-muted p-3">
        <div
          className={cn(
            "w-[15rem] overflow-hidden rounded-xl border border-border bg-card shadow-md",
            alignEnd ? "self-end" : "self-start",
          )}
        >
          <div className="px-3 py-2.5" style={{ backgroundColor: accentColor, color: ink }}>
            <p className="truncate text-sm font-semibold">{teamName || name}</p>
            <p className="truncate text-2xs opacity-80">{t("online")}</p>
          </div>
          <div className="space-y-2 p-3">
            <p className="text-sm font-semibold text-foreground">{welcomeTitle || t("defaultTitle")}</p>
            <div className="rounded-lg bg-muted px-2.5 py-2">
              {assistantName && <p className="text-2xs font-semibold text-muted-foreground">{assistantName}</p>}
              <p className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-foreground">
                {welcomeMessage || t("defaultMessage")}
              </p>
            </div>
            <div className="rounded-lg border border-border px-2.5 py-1.5 text-2xs text-muted-foreground">
              {t("composer")}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-md",
            alignEnd ? "self-end" : "self-start",
          )}
          style={{ backgroundColor: accentColor, color: ink }}
        >
          <ChatCircle className="h-4 w-4" />
          {launcherLabel || t("defaultLauncher")}
        </span>
      </div>
    </figure>
  );
}
