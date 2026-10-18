"use client";

import { useTranslations } from "next-intl";

import { Info } from "@/components/icons";
import { FeatureExplainer } from "@/components/elevated-design/feature-explainer";
import { cn } from "@/lib/utils";

import { explainerSpec, type ExplainerId } from "./catalog";
import { ExplainerScene } from "./ExplainerScene";

export function ExplainerHint({
  id,
  side = "bottom",
  align = "start",
  className,
}: {
  id: ExplainerId;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const t = useTranslations("explainers");
  const spec = explainerSpec(id);
  const text = (key: string) => t(`${id}.${key}`);
  const name = text("name");
  const tagline = text("tagline");
  const Mark = spec.icon;

  return (
    <FeatureExplainer
      name={name}
      tagline={tagline}
      side={side}
      align={align}
      mark={
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground">
          <Mark className="h-6 w-6" />
        </span>
      }
      visual={<ExplainerScene spec={spec.scene} text={(key) => text(`scene.${key}`)} label={tagline} />}
      steps={Array.from({ length: spec.steps }, (_, index) => ({ title: text(`steps.${index + 1}.title`), text: text(`steps.${index + 1}.text`) }))}
      footnote={spec.footnote ? text("footnote") : undefined}
    >
      <button
        type="button"
        aria-label={t("trigger", { name })}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Info className="h-4 w-4" />
      </button>
    </FeatureExplainer>
  );
}
