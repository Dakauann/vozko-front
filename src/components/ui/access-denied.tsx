"use client";

import { ArrowLeft, Info, ShieldWarning } from "@/components/icons";

import { Button } from "@/components/ui/button";
import { CircuitTraces } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { IconBox } from "@/components/elevated-design/listing-card";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface AccessDeniedProps {
  backHref: string;
}

export function AccessDenied({ backHref }: AccessDeniedProps) {
  const t = useTranslations("errors.accessDenied");

  return (
    <div className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden px-4 py-12">
      <LightPool />
      <CircuitTraces className="pointer-events-none absolute -right-10 -top-10 hidden h-64 w-64 sm:block" />
      <div className="relative w-full max-w-lg text-center">
        {/* Icon */}
        <div className="mx-auto mb-6">
          <IconBox color="amber" size="lg" className="mx-auto h-20 w-20 rounded-full ring-8 ring-warning/50">
            <ShieldWarning
              className="h-10 w-10"
              weight="duotone"
            />
          </IconBox>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
          {t("title")}
        </h1>

        {/* Description */}
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          {t("description")}
        </p>

        {/* Hint card */}
        <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-[--radius] border border-border bg-muted px-4 py-3.5 text-left">
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
