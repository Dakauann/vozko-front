"use client";

import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import { ArrowClockwise, CircleNotch, Eye } from "@/components/icons";
import { withDarkBackdrop } from "@/lib/email-design/look";

interface PreviewPaneProps {
  html?: string;
  loading: boolean;
  dark: boolean;
  frameWidth: number;
  onRequest?: () => void;
}

export function PreviewPane({ html, loading, dark, frameWidth, onRequest }: PreviewPaneProps) {
  const t = useTranslations("emailEditor.preview");
  if (!html) {
    if (loading) return <ScreenLoader fit="fill" label={t("loading")} className="min-h-[420px]" />;
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed border-control-edge bg-card px-6 py-10 text-center dark:bg-muted">
        <Eye className="h-6 w-6 text-muted-foreground" />
        <p className="font-display text-base font-semibold text-foreground">{t("emptyTitle")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("emptyBody")}</p>
        {onRequest ? <Button variant="primary" size="sm" title={t("request")} onClick={onRequest} /> : null}
      </div>
    );
  }
  return (
    <div className="relative mx-auto flex h-full min-h-[560px] flex-col" style={{ width: frameWidth, maxWidth: "100%" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground" aria-live="polite">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <CircleNotch className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              {t("refreshing")}
            </span>
          ) : (
            t("backendNote")
          )}
        </p>
        {onRequest ? <Button variant="ghost" size="sm" iconVisible icon={<ArrowClockwise />} title={t("refresh")} disabled={loading} onClick={onRequest} /> : null}
      </div>
      <iframe title={t("frameTitle")} sandbox="" srcDoc={dark ? withDarkBackdrop(html) : html} className="min-h-[520px] w-full flex-1 rounded-lg border-0 bg-card shadow-lg" />
    </div>
  );
}
