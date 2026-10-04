"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowLeft, ArrowRight } from "@/components/icons";

const META_ADS_TERMS_URL = "https://www.facebook.com/legal/self_service_ads_terms";

export function EditorFooter({
  onClose,
  onBack,
  onNext,
  status,
  secondary,
  finish,
  terms = true,
}: {
  onClose: () => void;
  onBack: (() => void) | null;
  onNext: (() => void) | null;
  status?: ReactNode;
  secondary?: ReactNode;
  finish?: ReactNode;
  terms?: boolean;
}) {
  const t = useTranslations("adsEditor.footer");
  const finishing = terms && !onNext && !!finish;
  return (
    <div className="space-y-2">
      {finishing ? (
        <p className="text-2xs text-muted-foreground">
          {t.rich("terms", {
            link: (chunks) => (
              <a href={META_ADS_TERMS_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary-ink hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" title={t("close")} onClick={onClose} />
        {secondary}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {status}
          {onBack ? (
            <Button variant="ghost" title={t("back")} icon={<ArrowLeft className="h-4 w-4" />} iconVisible iconSide="left" onClick={onBack} />
          ) : null}
          <Button
            variant={onNext ? "primary" : "secondary"}
            title={t("next")}
            icon={<ArrowRight className="h-4 w-4" />}
            iconVisible
            iconSide="right"
            disabled={!onNext}
            onClick={onNext ?? undefined}
          />
          {onNext ? null : finish}
        </div>
      </div>
    </div>
  );
}
