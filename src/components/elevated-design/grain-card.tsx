"use client";

import type { ColorGroup, GrainPalette } from "./grain-background";
import type { ComponentType, ReactNode } from "react";

import GrainBackground from "./grain-background";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface GrainProps {
  palette: GrainPalette | string[] | ColorGroup[];
  seed?: number;
  opacity?: number;
  className?: string;
}

interface FeatureVariant extends GrainProps {
  variant: "feature";
  icon: Icon;
  title: string;
  description: string;
  size?: "sm" | "lg";
  children?: ReactNode;
}

interface MetricVariant extends GrainProps {
  variant: "metric";
  value: string;
  label: string;
  description?: string;
  children?: ReactNode;
}

interface CustomVariant extends GrainProps {
  variant?: "custom";
  children: ReactNode;
}

export type GrainCardProps = FeatureVariant | MetricVariant | CustomVariant;

export default function GrainCard(props: GrainCardProps) {
  const { palette, seed = 42, opacity = 0.25, className } = props;
  const variant = props.variant ?? "custom";

  if (variant === "feature") {
    const {
      icon: Icon,
      title,
      description,
      children,
      size = "sm",
    } = props as FeatureVariant;
    const lg = size === "lg";
    return (
      <GrainBackground
        palette={palette}
        seed={seed}
        opacity={opacity}
        className={cn(
          "group flex h-full flex-col gap-4 rounded-2xl p-6",
          className,
        )}
      >
        <Icon className="h-6 w-6 text-white" weight="duotone" />
        <h3
          className={cn("font-semibold text-white", lg ? "text-lg" : "text-sm")}
        >
          {title}
        </h3>
        <p
          className={cn(
            "leading-relaxed text-white/70",
            lg ? "text-sm md:text-base" : "text-sm",
          )}
        >
          {description}
        </p>
        {children}
      </GrainBackground>
    );
  }

  if (variant === "metric") {
    const { value, label, description, children } = props as MetricVariant;
    return (
      <GrainBackground
        palette={palette}
        seed={seed}
        opacity={opacity}
        className={cn(
          "flex h-full flex-col items-center gap-3 rounded-2xl p-8",
          className,
        )}
      >
        <span className="text-4xl font-semibold text-white md:text-5xl">
          {value}
        </span>
        <p className="text-xs font-semibold uppercase text-white/60">{label}</p>
        {description && (
          <p className="text-sm text-white/70 md:text-base">{description}</p>
        )}
        {children}
      </GrainBackground>
    );
  }

  return (
    <GrainBackground
      palette={palette}
      seed={seed}
      opacity={opacity}
      className={cn("rounded-2xl", className)}
    >
      {(props as CustomVariant).children}
    </GrainBackground>
  );
}
