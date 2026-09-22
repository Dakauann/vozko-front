"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const PATTERN = "/images/assets/crm-pattern.webp";

export function CrmWallpaper({ className }: { className?: string }) {
  const [decoded, setDecoded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = PATTERN;
    img
      .decode()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDecoded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-foreground transition-opacity duration-500",
          decoded ? "opacity-[0.07] dark:opacity-[0.09]" : "opacity-0",
        )}
        style={{
          maskImage: `url("${PATTERN}")`,
          WebkitMaskImage: `url("${PATTERN}")`,
          maskSize: "420px auto",
          WebkitMaskSize: "420px auto",
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
        }}
      />
    </div>
  );
}

export default CrmWallpaper;
