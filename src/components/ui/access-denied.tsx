"use client";

import { ArrowLeft, Info, ShieldWarning } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { IconBox } from "@/components/elevated-design/listing-card";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface AccessDeniedProps {
  backHref: string;
}

export function AccessDenied({ backHref }: AccessDeniedProps) {
  const t = useTranslations("errors.accessDenied");

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg text-center">
        {/* Icon */}
        <div className="mx-auto mb-6">
          <IconBox color="amber" size="lg" className="mx-auto h-20 w-20 rounded-full ring-8 ring-amber-50/50">
            <ShieldWarning
              className="h-10 w-10"
              weight="duotone"
            />
          </IconBox>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>

        {/* Description */}
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          {t("description")}
        </p>

        {/* Hint card */}
        <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-xl border border-border bg-muted/80 px-4 py-3.5 text-left">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">{t("hint")}</p>
        </div>

        {/* Back button */}
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {t("goBack")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
