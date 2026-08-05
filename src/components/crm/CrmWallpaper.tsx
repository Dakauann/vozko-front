"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const PATTERN = "/images/assets/crm-pattern.webp";

/**
 * The conversation wallpaper.
 *
 * The source art is a flat ground carrying sparse doodle marks. Shipping it as
 * a photograph was wrong twice: painted at `cover` on a panel narrower than the
 * art, the marks scaled up enormously, and the ground baked into the file could
 * never agree with a themed surface, so the dark variant read as the wrong
 * colour against the rest of the app.
 *
 * So the ground is gone. `scripts/build-crm-wallpaper.mjs` strips it and keeps
 * only the marks as an alpha stencil, which this masks over a themed fill:
 *
 * - THE GROUND is a token, so it is correct in both themes by construction and
 *   there is no second asset for dark mode.
 * - THE MARKS take `--foreground` at 4%, so they are dark-on-light in light mode
 *   and light-on-dark in dark mode from the same 23KB file.
 * - THE SCALE is fixed at a tile size rather than stretched to fit, so a mark is
 *   the same size on a 420px kanban panel as on a full-width conversation.
 *
 * No placeholder is needed any more, and that is a feature rather than a
 * regression: the ground is a CSS colour, so it paints in the first frame with
 * nothing to wait for. The stencil fades in over it when decoded — at 4% on a
 * matching ground there is nothing to flash.
 */
export function CrmWallpaper({ className }: { className?: string }) {
  const [decoded, setDecoded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = PATTERN;
    img
      .decode()
      // decode() rejects on some engines even when the bitmap is fine; showing
      // the pattern beats sitting on a bare ground forever.
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
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-muted",
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
          // Tiled at a fixed size. `cover` is what made the marks enormous.
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
