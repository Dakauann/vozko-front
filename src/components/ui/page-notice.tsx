"use client";

import type { ReactNode } from "react";

import { ArrowLeft } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CircuitTraces } from "@/components/brand/circuit";
import { LightPool } from "@/components/brand/light-pool";
import { type AccentColor, IconBox } from "@/components/elevated-design/listing-card";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface PageNoticeProps {
  icon: ReactNode;
  color: AccentColor;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children?: ReactNode;
}

const ringByColor: Partial<Record<AccentColor, string>> = { amber: "ring-warning/50" };

export function PageNotice({ icon, color, title, description, backHref, backLabel, children }: PageNoticeProps) {
  return (
    <div className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden px-4 py-12">
      <LightPool />
      <CircuitTraces className="pointer-events-none absolute -right-10 -top-10 hidden h-64 w-64 sm:block" />
      <div className="relative w-full max-w-lg text-center">
        <div className="mx-auto mb-6">
          <IconBox color={color} size="lg" className={cn("mx-auto h-20 w-20 rounded-full ring-8", ringByColor[color] ?? "ring-primary/15")}>
            {icon}
          </IconBox>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground">{title}</h1>

        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{description}</p>

        {children}

        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
