"use client";

import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { MapTrifold } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MapScreenLoader({ className }: { className?: string }) {
  const t = useTranslations("leadMap");
  return <ScreenLoader fit="fill" label={t("loading")} className={className} />;
}

export function MapFailure({
  message,
  onRetry,
  className,
  diagnostic,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
  diagnostic?: string;
}) {
  const t = useTranslations("leadMap");
  return (
    <div
      role="alert"
      data-map-failure={diagnostic}
      className={cn("flex h-full min-h-40 w-full flex-col items-center justify-center gap-3 bg-muted px-4 text-center text-sm text-muted-foreground", className)}
    >
      <MapTrifold size={20} aria-hidden="true" />
      <p>{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
